/**
 * Боевые зависимости заявок: настройки из окружения, каталог, отправка в CRM.
 */
jest.mock('../config/database', () => ({ AppDataSource: { getRepository: () => ({}) } }))

import {
  DEFAULT_LEAD_ACTION,
  DEFAULT_LEAD_CATEGORY,
  estateContextLoader,
  leadCrmConfigFromEnv,
  macroLeadSender,
  MACRO_LEAD_PATH,
  typeormLeadStore,
} from '../services/leads/leadDeps'
import { MacroHttp, MacroHttpError } from '../services/MacroHttp'
import type { Repository } from 'typeorm'
import type { Lead } from '../models/Lead'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('leadCrmConfigFromEnv', () => {
  it('по умолчанию buy / flat, без канала', () => {
    expect(leadCrmConfigFromEnv({})).toEqual({
      action: DEFAULT_LEAD_ACTION,
      category: DEFAULT_LEAD_CATEGORY,
      advertisingChannelId: null,
    })
    expect(DEFAULT_LEAD_ACTION).toBe('buy')
    expect(DEFAULT_LEAD_CATEGORY).toBe('flat')
  })

  it('значения из окружения; канал — только целое положительное', () => {
    expect(
      leadCrmConfigFromEnv({ MACRO_LEAD_ACTION: ' callback ', MACRO_LEAD_CATEGORY: 'newflat', MACRO_LEAD_CHANNEL_ID: '14407' })
    ).toEqual({ action: 'callback', category: 'newflat', advertisingChannelId: 14407 })
    expect(leadCrmConfigFromEnv({ MACRO_LEAD_CHANNEL_ID: 'abc' }).advertisingChannelId).toBeNull()
    expect(leadCrmConfigFromEnv({ MACRO_LEAD_CHANNEL_ID: '-3' }).advertisingChannelId).toBeNull()
  })
})

describe('estateContextLoader', () => {
  const ctx = { complex: { slug: 's', name: 'S' }, houseExternalIds: [1], plan: null }

  it('зовёт /api/lead-context с адресом страницы и id карточки', async () => {
    const fetchImpl = jest.fn(async (_url: string) => jsonResponse(ctx))
    const load = estateContextLoader('http://estate:5100/', fetchImpl as unknown as typeof fetch)
    await expect(load('/ru/complex/s/', 'p1')).resolves.toEqual(ctx)
    expect(fetchImpl.mock.calls[0][0]).toBe('http://estate:5100/api/lead-context?path=%2Fru%2Fcomplex%2Fs%2F&planType=p1')
  })

  it('без карточки — без planType', async () => {
    const fetchImpl = jest.fn(async (_url: string) => jsonResponse(ctx))
    await estateContextLoader('http://estate:5100', fetchImpl as unknown as typeof fetch)('/', null)
    expect(fetchImpl.mock.calls[0][0]).toBe('http://estate:5100/api/lead-context?path=%2F')
  })

  it('не-200 и чужой ответ — ошибка (вызывающий подставит пустой контекст)', async () => {
    const bad = estateContextLoader('http://e', (async () => jsonResponse({}, 500)) as unknown as typeof fetch)
    await expect(bad('/', null)).rejects.toThrow('500')
    const odd = estateContextLoader('http://e', (async () => jsonResponse({ items: [] })) as unknown as typeof fetch)
    await expect(odd('/', null)).rejects.toThrow('неожиданный ответ')
  })
})

describe('macroLeadSender', () => {
  it('без токена или адреса — null', () => {
    expect(macroLeadSender({ MACRO_BASE_URL: 'https://api' })).toBeNull()
    expect(macroLeadSender({ MACRO_TOKEN: 't' })).toBeNull()
  })

  it('POST на estateBuy/create с Bearer и телом заявки', async () => {
    const fetchImpl = jest.fn(async (_url: string, _init: RequestInit) => jsonResponse({ data: { id: 9 } }))
    const send = macroLeadSender(
      { MACRO_BASE_URL: 'https://api.macrocrm.gh.uz/v2/', MACRO_TOKEN: 'secret' },
      fetchImpl as unknown as typeof fetch
    )!
    await expect(send({ name: 'Иван', phones: ['+998901234567'] })).resolves.toEqual({ data: { id: 9 } })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`https://api.macrocrm.gh.uz/v2${MACRO_LEAD_PATH}`)
    expect(MACRO_LEAD_PATH).toBe('/estateBuy/create')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret')
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Иван', phones: ['+998901234567'] })
  })

  it('5xx не повторяет — заявка могла создаться', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ error: 'boom' }, 502))
    const send = macroLeadSender({ MACRO_BASE_URL: 'https://api', MACRO_TOKEN: 't' }, fetchImpl as unknown as typeof fetch)!
    await expect(send({})).rejects.toBeInstanceOf(MacroHttpError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('MacroHttp: retryServerErrors', () => {
  const opts = { baseUrl: 'https://api', token: 't', sleepImpl: async () => undefined, minIntervalMs: 0 }

  it('по умолчанию 5xx повторяется (чтение)', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }))
    const http = new MacroHttp({ ...opts, fetchImpl })
    await expect(http.post('/x', {})).resolves.toEqual({ ok: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('retryServerErrors: false — 5xx сразу ошибка, а 429 по-прежнему повторяется', async () => {
    const five = jest.fn().mockResolvedValue(jsonResponse({}, 500))
    await expect(new MacroHttp({ ...opts, fetchImpl: five, retryServerErrors: false }).post('/x', {})).rejects.toThrow('500')
    expect(five).toHaveBeenCalledTimes(1)

    const limited = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse({ ok: 2 }))
    await expect(
      new MacroHttp({ ...opts, fetchImpl: limited, retryServerErrors: false }).post('/x', {})
    ).resolves.toEqual({ ok: 2 })
    expect(limited).toHaveBeenCalledTimes(2)
  })
})

describe('typeormLeadStore.findRecent', () => {
  /** Конструктор запроса-регистратор: какие условия ушли в SQL. */
  function recordingRepo() {
    const wheres: Array<[string, Record<string, unknown>]> = []
    const qb: Record<string, unknown> = {}
    const add = (sql: string, params: Record<string, unknown>) => {
      wheres.push([sql, params])
      return qb
    }
    Object.assign(qb, { where: add, andWhere: add, orderBy: () => qb, getOne: async () => null })
    const repo = { createQueryBuilder: () => qb } as unknown as Repository<Lead>
    return { repo, wheres }
  }
  const since = new Date('2026-11-17T00:00:00Z')

  it('с id планировки — по планировке из исходной заявки, без привязки к странице', async () => {
    const { repo, wheres } = recordingRepo()
    await typeormLeadStore(repo).findRecent({ phone: '+998901234567', kind: 'plan', since, pagePath: '/ru/x/', planId: 'p1' })
    expect(wheres).toEqual([
      ['lead.phone = :phone', { phone: '+998901234567' }],
      ['lead.kind = :kind', { kind: 'plan' }],
      ['lead.createdAt >= :since', { since }],
      [`lead.input -> 'plan' ->> 'id' = :planId`, { planId: 'p1' }],
    ])
  })

  it('без планировки — по странице', async () => {
    const { repo, wheres } = recordingRepo()
    await typeormLeadStore(repo).findRecent({ phone: '+998901234567', kind: 'callback', since, pagePath: '/ru/', planId: null })
    expect(wheres[3]).toEqual(['lead.pagePath = :pagePath', { pagePath: '/ru/' }])
    expect(wheres).toHaveLength(4)
  })
})
