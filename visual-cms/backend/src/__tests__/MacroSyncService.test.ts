/**
 * Оркестратор синхронизации.
 *
 * Проверяется дорогое: сколько раз ходим в CRM, что происходит при сбоях и
 * что во втором прогоне вызовов планировок не остаётся. Ошибка здесь не падает
 * тестом функциональности — она проявляется как упирание в лимит на проде.
 */
import { MacroSyncService, summarizeRun } from '../services/MacroSyncService'
import { MacroSellClient } from '../services/MacroSellClient'
import { MacroHttp } from '../services/MacroHttp'
import { PlanImageImporter } from '../services/PlanImageImporter'
import type { EstateSyncApi, KnownApartment } from '../services/EstateSyncApi'

const FIXTURE = require('./fixtures/macro/02-apartments.json')
const HOUSE = 5139395

/**
 * Мок MacroCRM: список квартир из фикстуры, планировка на каждую.
 * planPer — сколько квартир делят одну планировку.
 */
function makeMacro(options: { apartments?: any[]; planPer?: number; failPlanFor?: number[] } = {}) {
  const apartments = options.apartments ?? FIXTURE.slice(0, 10)
  const planPer = options.planPer ?? 5
  const failPlanFor = new Set(options.failPlanFor ?? [])
  const planCalls: number[] = []

  const fetchImpl = (async (url: any, init: any) => {
    const path = String(url)
    const body = JSON.parse(String(init.body))

    if (path.endsWith('/estateHouses/list')) {
      return json({ data: [{ id: HOUSE, complexId: 5139393, name: 'Дом', floorsCount: 15 }], meta: { next: null } })
    }
    if (path.endsWith('/estateSell/list')) {
      return json({ data: apartments, meta: { next: null } })
    }
    if (path.endsWith('/estateSell/getFlatPlans')) {
      const estateId = body.estateId
      planCalls.push(estateId)
      if (failPlanFor.has(estateId)) return json({ error: 'oops' }, 500)
      const index = apartments.findIndex((a: any) => a.id === estateId)
      const group = Math.floor(index / planPer)
      return json({
        data: {
          estateId,
          planName: `План-${group}`,
          files: [{ title: 'Main image', url: `https://macrocrm.gh.uz/e/f/tmp/${HOUSE}/${group}/sig/plan-${group}.jpg`, thumbUrl: '' }],
        },
      })
    }
    throw new Error('неожиданный путь ' + path)
  }) as unknown as typeof fetch

  const http = new MacroHttp({
    baseUrl: 'https://api.x/v2',
    token: 't',
    fetchImpl,
    minIntervalMs: 0,
    maxRetries: 0,
  })
  return { client: new MacroSellClient(http), planCalls }
}

function json(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

/** Мок estate-service: помнит последнюю выгрузку. */
function makeEstate(known: KnownApartment[] = [], planTypes: any[] = []) {
  const sent: any[] = []
  const api = {
    listSyncableComplexes: jest.fn(async () => []),
    getHouseState: jest.fn(async () => ({ known, planTypes })),
    syncHouse: jest.fn(async (payload: any) => {
      sent.push(payload)
      return {
        apartmentsCreated: payload.apartments.length,
        apartmentsUpdated: 0,
        apartmentsGone: 0,
        planTypesCreated: payload.planTypes.length,
        planTypesUpdated: 0,
        planTypesEmpty: 0,
      }
    }),
  } as unknown as EstateSyncApi
  return { api, sent }
}

/** Импортёр с подставным скачиванием — в сеть не ходим. */
function makeImporter() {
  const stored: any[] = []
  let n = 0
  const media = {
    upload: async (input: any) => {
      n++
      const asset = { id: 'a' + n, title: input.title, alt: input.alt, storageKey: 'k' + n }
      stored.push(asset)
      return asset
    },
    list: async (filter: any) => ({
      items: stored
        .filter((a) => !filter.search || String(a.title).includes(filter.search))
        .map((a) => ({ ...a, url: `https://cms/${a.storageKey}`, optimizedUrl: null, thumbnailUrl: null })),
    }),
    toDto: (a: any) => ({ ...a, url: `https://cms/${a.storageKey}`, optimizedUrl: null, thumbnailUrl: null }),
  }
  const fetchImpl = (async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => new ArrayBuffer(512),
  })) as unknown as typeof fetch
  return new PlanImageImporter({ media, fetchImpl })
}

describe('первый прогон', () => {
  it('опрашивает планировку каждой квартиры', async () => {
    const { client, planCalls } = makeMacro()
    const { api } = makeEstate()
    const outcome = await new MacroSyncService({ client, estate: api, importer: makeImporter() })
      .syncHouse(HOUSE)

    expect(planCalls).toHaveLength(10)
    expect(outcome.probed).toBe(10)
    expect(outcome.apartments).toBe(10)
  })

  it('квартиры сводятся в типы, а не идут по одной', async () => {
    const { client } = makeMacro({ planPer: 5 })
    const { api, sent } = makeEstate()
    const outcome = await new MacroSyncService({ client, estate: api, importer: makeImporter() })
      .syncHouse(HOUSE)

    expect(outcome.planTypes).toBe(2)
    expect(sent[0].planTypes).toHaveLength(2)
    expect(sent[0].apartments).toHaveLength(10)
  })

  it('этажность дома доезжает до квартир', async () => {
    const { client } = makeMacro()
    const { api, sent } = makeEstate()
    await new MacroSyncService({ client, estate: api, importer: makeImporter() }).syncHouse(HOUSE)

    expect(sent[0].house.floorsCount).toBe(15)
    expect(sent[0].apartments[0].floor).toMatch(/\/15$/)
  })

  it('в выгрузку идут наши картинки, а не подписанные ссылки CRM', async () => {
    const { client } = makeMacro()
    const { api, sent } = makeEstate()
    await new MacroSyncService({ client, estate: api, importer: makeImporter() }).syncHouse(HOUSE)

    for (const planType of sent[0].planTypes) {
      for (const image of planType.images) {
        expect(image.url).toMatch(/^https:\/\/cms\//)
        expect(image.url).not.toContain('macrocrm')
      }
    }
  })

  it('каждая квартира ссылается на присланный тип', async () => {
    const { client } = makeMacro()
    const { api, sent } = makeEstate()
    await new MacroSyncService({ client, estate: api, importer: makeImporter() }).syncHouse(HOUSE)

    const signatures = new Set(sent[0].planTypes.map((p: any) => p.signature))
    for (const apartment of sent[0].apartments) {
      expect(signatures.has(apartment.planSignature)).toBe(true)
    }
  })

  it('одна картинка на тип скачивается один раз, а не на каждую квартиру', async () => {
    const { client } = makeMacro({ planPer: 5 })
    const { api } = makeEstate()
    const importer = makeImporter()
    await new MacroSyncService({ client, estate: api, importer }).syncHouse(HOUSE)

    expect(importer.getStats().downloaded).toBe(2)
  })
})

describe('повторный прогон', () => {
  it('без изменений в CRM не стоит ни одного вызова планировок', async () => {
    const apartments = FIXTURE.slice(0, 10)
    const known: KnownApartment[] = apartments.map((a: any) => ({
      externalId: a.id,
      dateModified: new Date(a.dateModified).toISOString(),
      probedAt: '2026-09-01T00:00:00.000Z',
      planSignature: 'План-0',
    }))
    const existing = [{ signature: 'План-0', planName: 'План-0', images: [{ title: '', url: 'https://cms/k1', thumbUrl: '' }], panoUrl: '' }]

    const { client, planCalls } = makeMacro({ apartments })
    const { api, sent } = makeEstate(known, existing)
    const outcome = await new MacroSyncService({ client, estate: api, importer: makeImporter() })
      .syncHouse(HOUSE)

    expect(planCalls).toHaveLength(0)
    expect(outcome.probed).toBe(0)
    expect(outcome.skippedProbes).toBe(10)
    // Квартиры всё равно выгружаются: цены и статусы могли поменяться.
    expect(sent[0].apartments).toHaveLength(10)
  })

  it('неопрошенные квартиры не помечаются опрошенными', async () => {
    const apartments = FIXTURE.slice(0, 3)
    const known: KnownApartment[] = apartments.map((a: any) => ({
      externalId: a.id,
      dateModified: new Date(a.dateModified).toISOString(),
      probedAt: '2026-09-01T00:00:00.000Z',
      planSignature: null,
    }))
    const { client } = makeMacro({ apartments })
    const { api, sent } = makeEstate(known)
    await new MacroSyncService({ client, estate: api, importer: makeImporter() }).syncHouse(HOUSE)

    expect(sent[0].apartments.every((a: any) => a.planProbed === false)).toBe(true)
  })

  it('изменившаяся в CRM квартира опрашивается заново', async () => {
    const apartments = FIXTURE.slice(0, 5)
    const known: KnownApartment[] = apartments.map((a: any, i: number) => ({
      externalId: a.id,
      dateModified: i === 0 ? '2020-01-01T00:00:00.000Z' : new Date(a.dateModified).toISOString(),
      probedAt: '2026-09-01T00:00:00.000Z',
      planSignature: null,
    }))
    const { client, planCalls } = makeMacro({ apartments })
    const { api } = makeEstate(known)
    await new MacroSyncService({ client, estate: api, importer: makeImporter() }).syncHouse(HOUSE)

    expect(planCalls).toEqual([apartments[0].id])
  })
})

describe('инкрементальный прогон не стирает прошлый', () => {
  /**
   * Дефект, пойманный на боевом стенде: первый прогон разложил 336 квартир по
   * 105 типам, второй опросил одну — и отправил остальные 335 без планировки,
   * потому что группировка видела только свежие опросы. Типы обнулились,
   * страница опустела.
   */
  const apartments = FIXTURE.slice(0, 10)
  const known: KnownApartment[] = apartments.map((a: any, i: number) => ({
    externalId: a.id,
    dateModified: new Date(a.dateModified).toISOString(),
    probedAt: '2026-09-01T00:00:00.000Z',
    planSignature: i < 5 ? 'План-0' : 'План-1',
  }))
  const existing = [
    { signature: 'План-0', planName: 'План-0', images: [{ title: 'Main image', url: 'https://cms/media/p0.jpg', thumbUrl: '' }], panoUrl: '' },
    { signature: 'План-1', planName: 'План-1', images: [{ title: 'Main image', url: 'https://cms/media/p1.jpg', thumbUrl: '' }], panoUrl: 'https://tour/1' },
  ]

  it('типы сохраняются, даже когда не опрошено ничего', async () => {
    const { client, planCalls } = makeMacro({ apartments })
    const { api, sent } = makeEstate(known, existing)
    const outcome = await new MacroSyncService({ client, estate: api, importer: makeImporter() })
      .syncHouse(HOUSE)

    expect(planCalls).toHaveLength(0)
    expect(outcome.planTypes).toBe(2)
    expect(sent[0].planTypes.map((p: any) => p.signature).sort()).toEqual(['План-0', 'План-1'])
  })

  it('привязки квартир восстанавливаются из состояния дома', async () => {
    const { client } = makeMacro({ apartments })
    const { api, sent } = makeEstate(known, existing)
    await new MacroSyncService({ client, estate: api, importer: makeImporter() }).syncHouse(HOUSE)

    expect(sent[0].apartments.every((a: any) => a.planSignature !== null)).toBe(true)
    expect(sent[0].apartments.filter((a: any) => a.planSignature === 'План-0')).toHaveLength(5)
  })

  it('картинки восстановленных типов не качаются заново', async () => {
    const { client } = makeMacro({ apartments })
    const { api, sent } = makeEstate(known, existing)
    const importer = makeImporter()
    await new MacroSyncService({ client, estate: api, importer }).syncHouse(HOUSE)

    // Они уже в медиатеке: «перенос» означал бы скачать их из собственного
    // хранилища и положить туда же копию — на каждом прогоне.
    expect(importer.getStats().downloaded).toBe(0)
    const urls = sent[0].planTypes.flatMap((p: any) => p.images.map((i: any) => i.url))
    expect(urls).toContain('https://cms/media/p0.jpg')
  })

  it('агрегаты считаются по всем квартирам типа, а не по опрошенным', async () => {
    const { client } = makeMacro({ apartments })
    const { api, sent } = makeEstate(known, existing)
    await new MacroSyncService({ client, estate: api, importer: makeImporter() }).syncHouse(HOUSE)

    const total = sent[0].planTypes.reduce((n: number, p: any) => n + p.apartmentsCount, 0)
    expect(total).toBe(apartments.length)
  })

  it('3D-тур восстановленного типа не теряется', async () => {
    const { client } = makeMacro({ apartments })
    const { api, sent } = makeEstate(known, existing)
    await new MacroSyncService({ client, estate: api, importer: makeImporter() }).syncHouse(HOUSE)

    const withTour = sent[0].planTypes.find((p: any) => p.signature === 'План-1')
    expect(withTour.images[0].url).toBe('https://cms/media/p1.jpg')
  })

  it('свежий опрос перекрывает сохранённое, а не дублирует тип', async () => {
    // Первая квартира изменилась в CRM — её опросят заново.
    const changed = known.map((k, i) => (i === 0 ? { ...k, dateModified: '2020-01-01T00:00:00.000Z' } : k))
    const { client, planCalls } = makeMacro({ apartments, planPer: 5 })
    const { api, sent } = makeEstate(changed, existing)
    await new MacroSyncService({ client, estate: api, importer: makeImporter() }).syncHouse(HOUSE)

    expect(planCalls).toHaveLength(1)
    expect(sent[0].planTypes).toHaveLength(2)
    expect(sent[0].apartments).toHaveLength(10)
  })

  it('квартира без сохранённой привязки остаётся без планировки, а не выдумывает её', async () => {
    const orphan = known.map((k) => ({ ...k, planSignature: null }))
    const { client } = makeMacro({ apartments })
    const { api, sent } = makeEstate(orphan, [])
    const outcome = await new MacroSyncService({ client, estate: api, importer: makeImporter() })
      .syncHouse(HOUSE)

    expect(outcome.unassigned).toBe(10)
    expect(sent[0].planTypes).toHaveLength(0)
  })
})

describe('полная пересборка', () => {
  it('опрашивает всех, игнорируя прошлые отметки', async () => {
    // Путь восстановления: отметка об опросе стоит, а привязки потеряны —
    // обычный прогон такие квартиры пропустит навсегда.
    const apartments = FIXTURE.slice(0, 6)
    const known: KnownApartment[] = apartments.map((a: any) => ({
      externalId: a.id,
      dateModified: new Date(a.dateModified).toISOString(),
      probedAt: '2026-09-01T00:00:00.000Z',
      planSignature: null,
    }))
    const { client, planCalls } = makeMacro({ apartments, planPer: 3 })
    const { api, sent } = makeEstate(known)
    await new MacroSyncService({
      client,
      estate: api,
      importer: makeImporter(),
      forceFullProbe: true,
    }).syncHouse(HOUSE)

    expect(planCalls).toHaveLength(6)
    expect(sent[0].planTypes).toHaveLength(2)
  })

  it('курсор уважается и при полной пересборке — рестарт не стоит второго круга', async () => {
    const apartments = FIXTURE.slice(0, 6)
    const done = new Set<number>(apartments.slice(0, 4).map((a: any) => a.id))
    const { client, planCalls } = makeMacro({ apartments })
    const { api } = makeEstate()
    await new MacroSyncService({
      client,
      estate: api,
      importer: makeImporter(),
      forceFullProbe: true,
      alreadyProbed: done,
    }).syncHouse(HOUSE)

    expect(planCalls).toHaveLength(2)
  })
})

describe('возобновление', () => {
  it('уже опрошенные в прерванном прогоне не опрашиваются снова', async () => {
    const apartments = FIXTURE.slice(0, 10)
    const done = new Set<number>(apartments.slice(0, 6).map((a: any) => a.id))

    const { client, planCalls } = makeMacro({ apartments })
    const { api } = makeEstate()
    await new MacroSyncService({
      client,
      estate: api,
      importer: makeImporter(),
      alreadyProbed: done,
    }).syncHouse(HOUSE)

    expect(planCalls).toHaveLength(4)
  })

  it('каждая опрошенная квартира отмечается — из этого строится курсор', async () => {
    const seen: number[] = []
    const { client } = makeMacro({ apartments: FIXTURE.slice(0, 4) })
    const { api } = makeEstate()
    await new MacroSyncService({
      client,
      estate: api,
      importer: makeImporter(),
      onProbe: (id) => {
        seen.push(id)
      },
    }).syncHouse(HOUSE)

    expect(seen).toHaveLength(4)
  })
})

describe('сбои', () => {
  it('упавшая планировка не срывает обход остальных', async () => {
    const apartments = FIXTURE.slice(0, 6)
    const { client, planCalls } = makeMacro({
      apartments,
      planPer: 3,
      failPlanFor: [apartments[0].id],
    })
    const { api, sent } = makeEstate()
    const outcome = await new MacroSyncService({ client, estate: api, importer: makeImporter() })
      .syncHouse(HOUSE)

    expect(planCalls).toHaveLength(6)
    expect(outcome.unassigned).toBe(1)
    // Квартира без планировки всё равно выгружается, просто без привязки.
    expect(sent[0].apartments).toHaveLength(6)
    expect(sent[0].apartments.find((a: any) => a.externalId === apartments[0].id).planSignature)
      .toBeNull()
  })

  it('сбой одного дома не отменяет второй', async () => {
    const { client } = makeMacro()
    const estate = {
      getHouseState: jest.fn(async () => ({ known: [], planTypes: [] })),
      syncHouse: jest.fn(async (payload: any) => {
        if (payload.externalHouseId === 1) throw new Error('estate-service 500')
        return { apartmentsCreated: 1, apartmentsUpdated: 0, apartmentsGone: 0, planTypesCreated: 1, planTypesUpdated: 0, planTypesEmpty: 0 }
      }),
    } as unknown as EstateSyncApi

    const outcomes = await new MacroSyncService({ client, estate, importer: makeImporter() })
      .syncHouses([1, 2])

    expect(outcomes).toHaveLength(2)
    expect(outcomes[0].error).toMatch(/estate-service 500/)
    expect(outcomes[1].error).toBeNull()
  })

  it('дом без квартир проходит без падения', async () => {
    const { client } = makeMacro({ apartments: [] })
    const { api, sent } = makeEstate()
    const outcome = await new MacroSyncService({ client, estate: api, importer: makeImporter() })
      .syncHouse(HOUSE)

    expect(outcome.apartments).toBe(0)
    expect(sent[0].planTypes).toEqual([])
  })
})

describe('сводка прогона', () => {
  const ok = (id: number) => ({
    externalHouseId: id, apartments: 10, planTypes: 2, probed: 10,
    skippedProbes: 0, imagesDownloaded: 2, imagesReused: 1, imagesFailed: 0,
    unassigned: 0, result: null, error: null,
  })
  const bad = (id: number) => ({ ...ok(id), apartments: 0, planTypes: 0, probed: 0, error: 'упал' })

  it('все дома прошли — статус ok', () => {
    expect(summarizeRun([ok(1), ok(2)]).status).toBe('ok')
  })

  it('часть домов упала — статус partial, а не ok', () => {
    const summary = summarizeRun([ok(1), bad(2)])
    expect(summary.status).toBe('partial')
    expect(summary.error).toMatch(/2: упал/)
  })

  it('упали все — статус failed', () => {
    expect(summarizeRun([bad(1), bad(2)]).status).toBe('failed')
  })

  it('счётчики складываются по домам', () => {
    const summary = summarizeRun([ok(1), ok(2)])
    expect(summary.apartmentsSeen).toBe(20)
    expect(summary.plansProbed).toBe(20)
    expect(summary.planTypesUpserted).toBe(4)
  })
})
