/**
 * Транспорт MacroHttp и клиент объектов продажи.
 *
 * Отдельная тема здесь — БЮДЖЕТ ВЫЗОВОВ. Лимит Macro 100 запросов в минуту, а
 * первый обход планировок стоит по вызову на квартиру. Если однажды кто-то
 * добавит лишний запрос в цикл, это не сломает ни один функциональный тест —
 * просто синк начнёт упираться в 429. Поэтому число вызовов проверяется явно.
 */
import { MacroHttp, MacroHttpError } from '../services/MacroHttp'
import { MacroSellClient, STATUS_ON_SALE } from '../services/MacroSellClient'

interface MockCall {
  url: string
  body: any
  headers: Record<string, string>
}

/** Мок fetch: отдаёт заготовленные ответы по очереди и запоминает вызовы. */
function makeFetch(responses: Array<{ status?: number; body: any }>) {
  const calls: MockCall[] = []
  const fn = (async (url: any, init: any) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init.body)),
      headers: init.headers as Record<string, string>,
    })
    const r = responses.shift()
    if (!r) throw new Error('кончились заготовленные ответы, вызовов больше чем ожидалось')
    const status = r.status ?? 200
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: 'OK',
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    } as unknown as Response
  }) as unknown as typeof fetch
  return { fn, calls }
}

/** Часы и сон под контролем: иначе тест на темп идёт настоящие секунды. */
function makeClock() {
  let now = 1_000_000
  const slept: number[] = []
  return {
    slept,
    nowImpl: () => now,
    sleepImpl: async (ms: number) => {
      slept.push(ms)
      now += ms
    },
    advance: (ms: number) => {
      now += ms
    },
  }
}

function makeHttp(
  responses: Array<{ status?: number; body: any }>,
  opts: Partial<ConstructorParameters<typeof MacroHttp>[0]> = {}
) {
  const { fn, calls } = makeFetch(responses)
  const clock = makeClock()
  const http = new MacroHttp({
    baseUrl: 'https://api.macrocrm.gh.uz/v2',
    token: 'tok',
    appId: 'app',
    fetchImpl: fn,
    sleepImpl: clock.sleepImpl,
    nowImpl: clock.nowImpl,
    ...opts,
  })
  return { http, calls, clock }
}

describe('заголовки и адрес', () => {
  it('шлёт Bearer и AppId', async () => {
    const { http, calls } = makeHttp([{ body: { data: [] } }])
    await http.post('/estateSell/list', {})
    expect(calls[0].url).toBe('https://api.macrocrm.gh.uz/v2/estateSell/list')
    expect(calls[0].headers['Authorization']).toBe('Bearer tok')
    expect(calls[0].headers['AppId']).toBe('app')
  })

  it('без AppId заголовок не шлётся пустым', async () => {
    const { http, calls } = makeHttp([{ body: { data: [] } }], { appId: undefined })
    await http.post('/x', {})
    expect('AppId' in calls[0].headers).toBe(false)
  })

  it('лишний слэш в baseUrl не даёт двойного', async () => {
    const { http, calls } = makeHttp([{ body: {} }], { baseUrl: 'https://api.x/v2//' })
    await http.post('/estateSell/list', {})
    expect(calls[0].url).toBe('https://api.x/v2/estateSell/list')
  })
})

describe('темп запросов', () => {
  it('первый запрос уходит без паузы', async () => {
    const { http, clock } = makeHttp([{ body: {} }])
    await http.post('/x', {})
    expect(clock.slept).toEqual([])
  })

  it('второй запрос подряд ждёт до минимального промежутка', async () => {
    const { http, clock } = makeHttp([{ body: {} }, { body: {} }], { minIntervalMs: 667 })
    await http.post('/x', {})
    await http.post('/x', {})
    expect(clock.slept).toEqual([667])
  })

  it('если между запросами и так прошло время, пауза не нужна', async () => {
    const { http, clock } = makeHttp([{ body: {} }, { body: {} }], { minIntervalMs: 667 })
    await http.post('/x', {})
    clock.advance(5000)
    await http.post('/x', {})
    expect(clock.slept).toEqual([])
  })

  it('параллельные вызовы не сливаются в один момент', async () => {
    const { http, clock } = makeHttp(
      [{ body: {} }, { body: {} }, { body: {} }],
      { minIntervalMs: 667 }
    )
    await Promise.all([http.post('/x', {}), http.post('/x', {}), http.post('/x', {})])
    // Три запроса — две паузы: очередь разводит их по времени, а не отпускает
    // все три разом, посчитав промежуток от одного и того же момента.
    expect(clock.slept).toEqual([667, 667])
  })
})

describe('повторы', () => {
  it('429 повторяется с растущей паузой', async () => {
    const { http, clock, calls } = makeHttp(
      [{ status: 429, body: {} }, { status: 429, body: {} }, { body: { data: [1] } }],
      { retryBackoffMs: 5000, minIntervalMs: 0 }
    )
    const r = await http.post<{ data: number[] }>('/x', {})
    expect(r.data).toEqual([1])
    expect(calls).toHaveLength(3)
    expect(clock.slept).toEqual([5000, 10000])
  })

  it('5xx повторяется', async () => {
    const { http, calls } = makeHttp(
      [{ status: 503, body: {} }, { body: { data: [] } }],
      { minIntervalMs: 0 }
    )
    await http.post('/x', {})
    expect(calls).toHaveLength(2)
  })

  it('после исчерпания попыток бросает с кодом', async () => {
    const { http, calls } = makeHttp(
      Array.from({ length: 3 }, () => ({ status: 429, body: { error: 'slow down' } })),
      { maxRetries: 2, minIntervalMs: 0 }
    )
    await expect(http.post('/x', {})).rejects.toThrow(MacroHttpError)
    expect(calls).toHaveLength(3)
  })

  it('401 не повторяется — повтор даст тот же ответ', async () => {
    const { http, calls } = makeHttp([{ status: 401, body: { error: 'нет доступа' } }])
    await expect(http.post('/x', {})).rejects.toThrow(/MacroCRM 401/)
    expect(calls).toHaveLength(1)
  })
})

describe('пагинация', () => {
  it('идёт по курсору до конца и склеивает страницы', async () => {
    const { http, calls } = makeHttp(
      [
        { body: { data: [1, 2], meta: { next: 100 } } },
        { body: { data: [3], meta: { next: 200 } } },
        { body: { data: [4], meta: { next: null } } },
      ],
      { minIntervalMs: 0 }
    )
    const all = await http.postAll<number>('/estateSell/list', { houseIds: [1] })
    expect(all).toEqual([1, 2, 3, 4])
    expect(calls).toHaveLength(3)
    expect(calls[0].body.from).toBeUndefined()
    expect(calls[1].body.from).toBe(100)
    expect(calls[2].body.from).toBe(200)
  })

  it('продолжает с переданного курсора, не перечитывая начало', async () => {
    const { http, calls } = makeHttp(
      [{ body: { data: [9], meta: { next: null } } }],
      { minIntervalMs: 0 }
    )
    await http.postAll('/x', { houseIds: [1] }, 500)
    expect(calls[0].body.from).toBe(500)
  })

  it('повторившийся курсор обрывает обход, а не крутит его вечно', async () => {
    const { http } = makeHttp(
      [
        { body: { data: [1], meta: { next: 100 } } },
        { body: { data: [2], meta: { next: 100 } } },
      ],
      { minIntervalMs: 0 }
    )
    await expect(http.postAll('/x', {})).rejects.toThrow(/зациклился/)
  })

  it('отсутствие meta считается последней страницей', async () => {
    const { http, calls } = makeHttp([{ body: { data: [1] } }], { minIntervalMs: 0 })
    expect(await http.postAll('/x', {})).toEqual([1])
    expect(calls).toHaveLength(1)
  })
})

describe('MacroSellClient', () => {
  it('квартиры запрашиваются по домам, а не по ЖК', async () => {
    const { http, calls } = makeHttp([{ body: { data: [], meta: { next: null } } }], { minIntervalMs: 0 })
    await new MacroSellClient(http).listApartments({ houseIds: [5139395, 5622025] })

    expect(calls[0].url).toMatch(/estateSell\/list$/)
    expect(calls[0].body.houseIds).toEqual([5139395, 5622025])
    expect(calls[0].body.complexIds).toBeUndefined()
  })

  it('по умолчанию только жилые и только свободные, со скидочной ценой', async () => {
    const { http, calls } = makeHttp([{ body: { data: [], meta: { next: null } } }], { minIntervalMs: 0 })
    await new MacroSellClient(http).listApartments({ houseIds: [1] })

    expect(calls[0].body.categories).toEqual(['flat'])
    expect(calls[0].body.statuses).toEqual([STATUS_ON_SALE])
    expect(calls[0].body.includeMaxDiscountPrice).toBe(true)
  })

  it('пустой список статусов снимает фильтр, а не шлёт пустой массив', async () => {
    const { http, calls } = makeHttp([{ body: { data: [], meta: { next: null } } }], { minIntervalMs: 0 })
    await new MacroSellClient(http).listApartments({ houseIds: [1], statuses: [] })
    expect('statuses' in calls[0].body).toBe(false)
  })

  it('без домов в API не ходим вовсе', async () => {
    const { http, calls } = makeHttp([], { minIntervalMs: 0 })
    const client = new MacroSellClient(http)
    expect(await client.listApartments({ houseIds: [] })).toEqual([])
    expect(await client.listHouses([])).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('дома разбираются с этажностью', async () => {
    const { http } = makeHttp(
      [{ body: { data: [{ id: 5139395, complexId: 5139393, name: "O'z Makon Business", floorsCount: 15 }], meta: { next: null } } }],
      { minIntervalMs: 0 }
    )
    const [house] = await new MacroSellClient(http).listHouses([5139395])
    expect(house).toMatchObject({ id: 5139395, complexId: 5139393, floorsCount: 15 })
  })

  it('дом без id пропускается, а не ломает разбор остальных', async () => {
    const { http } = makeHttp(
      [{ body: { data: [{ name: 'без id' }, { id: 7, name: 'ок' }], meta: { next: null } } }],
      { minIntervalMs: 0 }
    )
    const houses = await new MacroSellClient(http).listHouses([7])
    expect(houses.map((h) => h.id)).toEqual([7])
  })
})

describe('планировки', () => {
  const REAL_PLAN = {
    estateId: 5139408,
    planName: 'К2-54.65-6',
    files: [
      { title: 'Main image', url: 'https://macrocrm.gh.uz/a/plan.jpg', thumbUrl: 'https://macrocrm.gh.uz/a/thumb.jpg' },
      { title: 'Additional layout', url: 'https://macrocrm.gh.uz/b/plan.jpg', thumbUrl: '' },
    ],
  }

  it('разбирается ответ живой CRM', async () => {
    const { http } = makeHttp([{ body: { data: REAL_PLAN, meta: null } }], { minIntervalMs: 0 })
    const plan = await new MacroSellClient(http).getFlatPlan(5139408)
    expect(plan).toEqual(REAL_PLAN)
  })

  it('пустая планировка — это null, а не пустой объект', async () => {
    const { http } = makeHttp([{ body: { data: null } }], { minIntervalMs: 0 })
    expect(await new MacroSellClient(http).getFlatPlan(1)).toBeNull()
  })

  it('ни имени, ни файлов — тоже null: группировать не по чему', async () => {
    const { http } = makeHttp([{ body: { data: { estateId: 1, planName: '', files: [] } } }], { minIntervalMs: 0 })
    expect(await new MacroSellClient(http).getFlatPlan(1)).toBeNull()
  })

  it('файлы без url отбрасываются', async () => {
    const { http } = makeHttp(
      [{ body: { data: { estateId: 1, planName: 'A', files: [{ title: 'битый' }, { url: 'https://x/1.jpg' }] } } }],
      { minIntervalMs: 0 }
    )
    const plan = await new MacroSellClient(http).getFlatPlan(1)
    expect(plan!.files).toHaveLength(1)
  })

  it('сетевая ошибка пробрасывается, а не превращается в «планировки нет»', async () => {
    const { http } = makeHttp([{ status: 500, body: {} }], { minIntervalMs: 0, maxRetries: 0 })
    await expect(new MacroSellClient(http).getFlatPlan(1)).rejects.toThrow(MacroHttpError)
  })
})

describe('бюджет вызовов', () => {
  it('список из трёх страниц стоит ровно три запроса', async () => {
    const { http } = makeHttp(
      [
        { body: { data: [1], meta: { next: 10 } } },
        { body: { data: [2], meta: { next: 20 } } },
        { body: { data: [3], meta: { next: null } } },
      ],
      { minIntervalMs: 0 }
    )
    const client = new MacroSellClient(http)
    await client.listApartments({ houseIds: [1] })
    expect(client.calls).toBe(3)
  })

  it('планировка стоит ровно один запрос на квартиру', async () => {
    const responses = Array.from({ length: 5 }, (_, i) => ({
      body: { data: { estateId: i + 1, planName: 'P' + i, files: [{ url: 'u' }] } },
    }))
    const { http } = makeHttp(responses, { minIntervalMs: 0 })
    const client = new MacroSellClient(http)
    for (let i = 1; i <= 5; i++) await client.getFlatPlan(i)
    expect(client.calls).toBe(5)
  })

  it('повторы после 429 считаются в бюджете — они тоже съедают лимит', async () => {
    const { http } = makeHttp(
      [{ status: 429, body: {} }, { body: { data: { estateId: 1, planName: 'P', files: [] } } }],
      { minIntervalMs: 0 }
    )
    const client = new MacroSellClient(http)
    await client.getFlatPlan(1)
    expect(client.calls).toBe(2)
  })
})
