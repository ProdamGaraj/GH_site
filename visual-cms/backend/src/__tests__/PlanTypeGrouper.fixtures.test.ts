/**
 * Группировщик на живой выгрузке MacroCRM.
 *
 * Фикстура снята 09.09.2026 по домам 5139395 и 5622025: 336 квартир в продаже
 * и планировка каждой из них. Синтетика этот слой не проверяет — весь смысл
 * группировки в том, как устроены НАСТОЯЩИЕ имена и файлы, а они оказались
 * устроены не так, как выглядело по документации.
 *
 * Числа здесь зафиксированы намеренно: если правка ключа группировки их
 * изменит, тест это покажет. Расхождение — не обязательно ошибка, но повод
 * понять причину, а не узнать о ней из готовой страницы.
 */
import { mapApartments } from '../services/MacroEstateMapper'
import { groupPlanTypes, buildSignature, type PlanProbe } from '../services/PlanTypeGrouper'

const FLATS = require('./fixtures/macro/02-apartments.json')
const PLANS = require('./fixtures/macro/05-flatplans-full.json')
const HOUSES = require('./fixtures/macro/01-houses.json').data
const STATS = require('./fixtures/macro/07-house-stats.json').data

const probes: PlanProbe[] = PLANS.map((p: any) => ({ estateId: p.estateId, plan: p.data }))
const { apartments } = mapApartments(FLATS, {})
const { planTypes, unassigned } = groupPlanTypes(apartments, probes)

describe('выгрузка', () => {
  it('336 квартир в продаже по двум домам', () => {
    expect(apartments).toHaveLength(336)
    const byHouse: Record<number, number> = {}
    for (const a of apartments) byHouse[a.externalHouseId] = (byHouse[a.externalHouseId] ?? 0) + 1
    expect(byHouse).toEqual({ 5139395: 148, 5622025: 188 })
  })

  it('число квартир сходится со статистикой самой CRM', () => {
    // Macro считает countOnSale сама — расхождение означало бы, что мы
    // запрашиваем не тот срез: не те статусы или не ту категорию.
    for (const house of STATS) {
      const ours = apartments.filter((a) => a.externalHouseId === house.id).length
      const theirs = house.stats.categories.flat.countOnSale
      expect(Math.abs(ours - theirs)).toBeLessThanOrEqual(2)
    }
  })

  it('у каждой квартиры есть планировка — пустых ответов CRM не дала', () => {
    expect(unassigned).toHaveLength(0)
  })

  it('этажность домов известна для обоих', () => {
    expect(HOUSES.map((h: any) => h.floorsCount)).toEqual([15, 16])
  })
})

describe('группировка', () => {
  it('336 квартир сводятся в 105 типов', () => {
    expect(planTypes).toHaveLength(105)
  })

  it('ни одна квартира не потеряна и не посчитана дважды', () => {
    const total = planTypes.reduce((n, p) => n + p.apartmentsCount, 0)
    expect(total).toBe(apartments.length)
    const ids = planTypes.flatMap((p) => p.apartmentExternalIds)
    expect(new Set(ids).size).toBe(apartments.length)
  })

  it('набор файлов в ключ не входит — иначе типов было бы больше', () => {
    // Внутри одного имени лежат разные наборы: тот же чертёж, переэкспортированный
    // под каждую площадь (planirovka_k3-76_64-5-77.96.jpg и -77.01.jpg).
    const withFiles = new Set(
      PLANS.map(
        (p: any) =>
          `${p.data.planName}|${(p.data.files ?? []).map((f: any) => f.url).sort().join(',')}`
      )
    )
    expect(withFiles.size).toBeGreaterThan(planTypes.length)
  })

  it('16 типов накрывают несколько площадей — ради них всё и затевалось', () => {
    const ranges = planTypes.filter((p) => p.areaMin !== p.areaMax)
    expect(ranges).toHaveLength(16)
  })

  it('комнатность внутри типа не смешивается', () => {
    const byId = new Map(apartments.map((a) => [a.externalId, a]))
    for (const planType of planTypes) {
      const rooms = new Set(planType.apartmentExternalIds.map((id) => byId.get(id)!.rooms))
      expect(rooms.size).toBe(1)
    }
  })

  it('подписи типов уникальны в пределах дома', () => {
    const seen = new Set<string>()
    for (const planType of planTypes) {
      const key = `${planType.externalHouseId}::${planType.signature}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('подпись — имя планировки, а не хеш', () => {
    expect(planTypes.some((p) => p.signature === 'К2-54.65-6')).toBe(true)
  })

  it('диапазон площади сходится с квартирами типа', () => {
    const byId = new Map(apartments.map((a) => [a.externalId, a]))
    for (const planType of planTypes) {
      const areas = planType.apartmentExternalIds.map((id) => byId.get(id)!.areaM2)
      expect(planType.areaMin).toBe(Math.min(...areas))
      expect(planType.areaMax).toBe(Math.max(...areas))
    }
  })

  it('у каждого типа есть цена, площадь и хотя бы один этаж', () => {
    for (const planType of planTypes) {
      expect(planType.priceMin).toBeGreaterThan(0)
      expect(planType.areaMin).toBeGreaterThan(0)
      expect(planType.floors.length).toBeGreaterThan(0)
    }
  })

  it('показывается самый полный набор файлов из имевшихся', () => {
    const byName = new Map<string, number>()
    for (const p of PLANS) {
      const count = (p.data.files ?? []).length
      byName.set(p.data.planName, Math.max(byName.get(p.data.planName) ?? 0, count))
    }
    for (const planType of planTypes) {
      expect(planType.images.length).toBe(byName.get(planType.planName))
    }
  })

  it('порядок — по комнатности, затем по площади', () => {
    for (let i = 1; i < planTypes.length; i++) {
      const prev = planTypes[i - 1]
      const curr = planTypes[i]
      const ordered =
        prev.rooms < curr.rooms || (prev.rooms === curr.rooms && prev.areaMin <= curr.areaMin)
      expect(ordered).toBe(true)
    }
  })
})

describe('стоимость синхронизации', () => {
  it('картинок к скачиванию меньше, чем квартир — за это и группировали', () => {
    const files = new Set(planTypes.flatMap((p) => p.images.map((i) => i.url)))
    expect(files.size).toBe(187)
    expect(files.size).toBeLessThan(apartments.length)
  })

  it('повторная группировка тех же данных даёт те же подписи', () => {
    const again = groupPlanTypes(apartments, probes).planTypes
    expect(again.map((p) => p.signature)).toEqual(planTypes.map((p) => p.signature))
  })

  it('перестановка ответов CRM на результат не влияет', () => {
    const shuffled = [...probes].reverse()
    const out = groupPlanTypes(apartments, shuffled).planTypes
    expect(out.map((p) => p.signature).sort()).toEqual(planTypes.map((p) => p.signature).sort())

    // Выбор картинок тоже не должен зависеть от порядка: иначе импортёр качал
    // бы новые файлы на каждом прогоне вместо переиспользования старых.
    const bySignature = new Map(out.map((p) => [p.signature, p.images.map((i) => i.url).join('|')]))
    for (const planType of planTypes) {
      expect(bySignature.get(planType.signature)).toBe(
        planType.images.map((i) => i.url).join('|')
      )
    }
  })
})

describe('данные для фильтров', () => {
  it('виды из окон заполнены и осмысленны', () => {
    const views = new Set(planTypes.flatMap((p) => p.windowViews))
    expect(views.has('двор')).toBe(true)
    expect(views.has('бульвар')).toBe(true)
    expect(views.has('')).toBe(false)
  })

  it('комнатность покрывает весь диапазон проекта', () => {
    const rooms = [...new Set(planTypes.map((p) => p.rooms))].sort((a, b) => a - b)
    expect(rooms).toEqual([1, 2, 3, 4])
  })

  it('3D-тур есть у части типов и только у одного дома', () => {
    const withTour = planTypes.filter((p) => p.panoUrl !== '')
    expect(withTour.length).toBeGreaterThan(0)
    expect(withTour.length).toBeLessThan(planTypes.length)
    expect(new Set(withTour.map((p) => p.externalHouseId)).size).toBe(1)
  })

  it('этажи типа лежат в пределах этажности дома', () => {
    const floorsByHouse = new Map<number, number>(HOUSES.map((h: any) => [h.id, h.floorsCount]))
    for (const planType of planTypes) {
      const limit = floorsByHouse.get(planType.externalHouseId)!
      expect(Math.max(...planType.floors)).toBeLessThanOrEqual(limit)
    }
  })
})

describe('подпись', () => {
  it('планировка без имени опирается на файлы', () => {
    const signature = buildSignature({
      estateId: 1,
      planName: '',
      files: [{ title: '', url: 'https://a/1/x.jpg', thumbUrl: '' }],
    })
    expect(signature).toMatch(/^unnamed\|/)
  })
})
