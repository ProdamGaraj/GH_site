/**
 * REST-коннектор: проверка спецификации, сборка запроса (структурная
 * подстановка данных посетителя), скрытие секретов, выполнение и
 * классификация повторов.
 */
import { classifyRestFailure, createRestConnector } from '../services/requests/connectors/rest'
import { RequestInputError, type SourceInfo } from '../services/requests/connectors/types'
import type { RequestSpec, RestRequestSpec } from '../services/requests/spec'
import type { TemplateContext } from '../services/requests/template'
import type { FetchConfig, FetchResult } from '../services/SecureDataSourceService'

const source = (config: Record<string, unknown> = {}): SourceInfo => ({
  id: 's1',
  type: 'rest-api',
  config: { url: 'https://api.example.com/v2', ...config },
})

const spec = (rest: Partial<RestRequestSpec>, extra: Partial<RequestSpec> = {}): RequestSpec => ({
  version: 1,
  connector: 'rest',
  rest: { method: 'POST', path: '', ...rest },
  ...extra,
})

const ctx = (form: Record<string, unknown> = {}): TemplateContext => ({
  form,
  page: { path: '/ru/', lang: 'ru', title: '' },
  visitor: { referrer: '', utm: {} },
  request: { ip: '1.2.3.4', domain: 'gh.uz', userAgent: 'UA' },
  now: new Date('2026-11-18T00:00:00Z'),
})

function connector(result?: FetchResult) {
  const calls: Array<{ config: FetchConfig; auth: unknown }> = []
  let clock = 0
  const c = createRestConnector(
    async (config, auth) => {
      calls.push({ config, auth })
      clock += 40
      return result ?? { success: true, data: { id: 1 }, metadata: { statusCode: 201, headers: {}, responseTime: 40 } }
    },
    () => clock,
  )
  return { c, calls }
}

describe('validate', () => {
  const { c } = connector()

  it('корректная спецификация — без ошибок', () => {
    expect(c.validate(spec({ path: '/x/{{form.id}}', query: [{ key: 'q', value: '{{form.q}}' }], body: { format: 'json', value: { a: '{{form.a}}' } } }), source())).toEqual([])
  })

  it.each([
    ['нет настроек REST', { version: 1, connector: 'rest' } as RequestSpec, 'нет настроек REST'],
    ['метод', spec({ method: 'HEAD' as never }), 'метод HEAD'],
    ['ошибка шаблона в пути', spec({ path: '/x/{{bad.y}}' }), 'Путь: Нет данных «bad»'],
    ['ссылка в хосте абсолютного адреса', spec({ path: 'https://{{form.host}}/x' }), 'адрес сервера не может зависеть'],
    ['пустое имя query', spec({ query: [{ key: ' ', value: 'x' }] }), 'Query: пустое имя'],
    ['недопустимый заголовок', spec({ headers: [{ key: 'Bad Header', value: 'x' }] }), 'недопустимое имя'],
    ['служебный заголовок', spec({ headers: [{ key: 'Host', value: 'x' }] }), 'задаёт сам клиент'],
    ['ошибка шаблона в теле', spec({ body: { format: 'json', value: ['{{form.a'] } }), 'Тело: Незакрытая'],
    ['пустое имя поля формы', spec({ body: { format: 'form-urlencoded', fields: [{ key: '', value: 'x' }] } }), 'Тело: пустое имя'],
    ['тело у GET', spec({ method: 'GET', body: { format: 'json', value: {} } }), 'у GET-запроса тела нет'],
  ])('ошибка: %s', (_name, s, message) => {
    expect(c.validate(s, source()).join('\n')).toContain(message)
  })

  it('относительный путь без адреса у источника — ошибка; абсолютный — можно', () => {
    expect(c.validate(spec({ path: '/x' }), source({ url: '' })).join()).toContain('нет адреса http(s)')
    expect(c.validate(spec({ path: 'https://hooks.example.org/{{form.id}}' }), source({ url: '' }))).toEqual([])
  })
})

describe('prepare', () => {
  const { c } = connector()

  it('путь к адресу источника, query источника и привязки, заголовки, тело JSON с типами', () => {
    const prepared = c.prepare(
      spec({
        path: '/clients/{{form.id}}/leads',
        query: [{ key: 'lang', value: '{{page.lang}}' }, { key: 'tag', value: '{{form.tags}}' }, { key: 'skip', value: '{{form.none}}' }],
        headers: [{ key: 'X-Form', value: 'site {{page.lang}}' }],
        body: { format: 'json', value: { phones: ['{{form.phone | digits}}'], rooms: '{{form.rooms | number}}', action: 'buy' } },
      }),
      ctx({ id: 42, tags: ['a', 'b'], phone: '+998 90 123', rooms: '2' }),
      source({ url: 'https://api.example.com/v2/', queryParams: { app: 'site' }, headers: { 'X-App': 'cms' } }),
    )
    expect(prepared).toEqual({
      connector: 'rest',
      method: 'POST',
      url: 'https://api.example.com/v2/clients/42/leads?app=site&lang=ru&tag=a&tag=b',
      headers: { 'X-App': 'cms', 'X-Form': 'site ru', 'Content-Type': 'application/json' },
      body: { format: 'json', value: { phones: ['99890123'], rooms: 2, action: 'buy' } },
      timeoutMs: 15000,
      insecureTLS: false,
    })
  })

  it('данные посетителя не меняют путь: «/», «?», «#», «..» кодируются', () => {
    const url = (id: string) => c.prepare(spec({ path: '/items/{{form.id}}' }), ctx({ id }), source()).url
    expect(url('a/../../admin')).toBe('https://api.example.com/v2/items/a%2F..%2F..%2Fadmin')
    expect(url('x?admin=1#frag')).toBe('https://api.example.com/v2/items/x%3Fadmin%3D1%23frag')
  })

  it.each(['..', '.'])('сегмент пути из точек (%s) — отказ, а не переход по папкам', (id) => {
    expect(() => c.prepare(spec({ path: '/items/{{form.id}}/x' }), ctx({ id }), source())).toThrow(RequestInputError)
  })

  it('«%2e%2e» от посетителя — текст: «%» кодируется, URL-парсер не видит точек', () => {
    const url = c.prepare(spec({ path: '/items/{{form.id}}/x' }), ctx({ id: '%2e%2E' }), source()).url
    expect(url).toBe('https://api.example.com/v2/items/%252e%252E/x')
  })

  it('точки из двух ссылок подряд тоже ловятся', () => {
    expect(() => c.prepare(spec({ path: '/items/{{form.a}}{{form.b}}' }), ctx({ a: '.', b: '.' }), source())).toThrow(RequestInputError)
  })

  it('точки внутри значения — обычный текст', () => {
    expect(c.prepare(spec({ path: '/files/{{form.f}}' }), ctx({ f: 'plan.v2.pdf' }), source()).url).toBe('https://api.example.com/v2/files/plan.v2.pdf')
  })

  it('данные посетителя в query не добавляют параметров', () => {
    const prepared = c.prepare(spec({ method: 'GET', query: [{ key: 'q', value: '{{form.q}}' }] }), ctx({ q: 'a&admin=1' }), source())
    expect(new URL(prepared.url).searchParams.getAll('admin')).toEqual([])
    expect(new URL(prepared.url).searchParams.get('q')).toBe('a&admin=1')
  })

  it('перевод строки в заголовке не добавляет заголовок; пустой заголовок пропускается', () => {
    const prepared = c.prepare(
      spec({ headers: [{ key: 'X-Name', value: '{{form.n}}' }, { key: 'X-Empty', value: '{{form.none}}' }] }),
      ctx({ n: 'a\r\nX-Admin: 1' }),
      source(),
    )
    expect(prepared.headers['X-Name']).toBe('a X-Admin: 1')
    expect(prepared.headers).not.toHaveProperty('X-Empty')
    expect(prepared.headers).not.toHaveProperty('X-Admin')
  })

  it('query прямо в пути редактора сохраняется', () => {
    expect(c.prepare(spec({ path: '/search?type=flat' }), ctx(), source()).url).toBe('https://api.example.com/v2/search?type=flat')
  })

  it('абсолютный адрес — без адреса источника', () => {
    expect(c.prepare(spec({ path: 'https://hooks.example.org/in/{{form.id}}' }), ctx({ id: 'a b' }), source()).url).toBe(
      'https://hooks.example.org/in/a%20b',
    )
  })

  it('form-urlencoded: поля, массивы повтором, пустые пропущены, Content-Type', () => {
    const prepared = c.prepare(
      spec({ body: { format: 'form-urlencoded', fields: [{ key: 'name', value: '{{form.name}}' }, { key: 'tag', value: '{{form.tags}}' }, { key: 'x', value: '{{form.none}}' }] } }),
      ctx({ name: 'Иван & Co', tags: [1, 2] }),
      source(),
    )
    expect(prepared.body).toEqual({ format: 'form-urlencoded', text: 'name=%D0%98%D0%B2%D0%B0%D0%BD+%26+Co&tag=1&tag=2' })
    expect(prepared.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
  })

  it('GET и формат none — без тела; свой Content-Type не перетирается', () => {
    expect(c.prepare(spec({ method: 'GET' }), ctx(), source()).body).toBeUndefined()
    expect(c.prepare(spec({ body: { format: 'none' } }), ctx(), source()).body).toBeUndefined()
    const p = c.prepare(spec({ headers: [{ key: 'content-type', value: 'application/vnd.api+json' }], body: { format: 'json', value: {} } }), ctx(), source())
    expect(p.headers).toEqual({ 'content-type': 'application/vnd.api+json' })
  })

  it('таймаут — из доставки, в границах', () => {
    expect(c.prepare(spec({}, { delivery: { mode: 'direct', timeoutMs: 5000 } }), ctx(), source()).timeoutMs).toBe(5000)
    expect(c.prepare(spec({}, { delivery: { mode: 'direct', timeoutMs: 1 } }), ctx(), source()).timeoutMs).toBe(1000)
    expect(c.prepare(spec({}, { delivery: { mode: 'direct', timeoutMs: 999999 } }), ctx(), source()).timeoutMs).toBe(30000)
  })

  it('insecureTLS — только явный true источника', () => {
    expect(c.prepare(spec({}), ctx(), source({ insecureTLS: true })).insecureTLS).toBe(true)
    expect(c.prepare(spec({}), ctx(), source({ insecureTLS: 'yes' })).insecureTLS).toBe(false)
  })
})

it('describe скрывает секретные заголовки', () => {
  const { c } = connector()
  const prepared = c.prepare(
    spec({ headers: [{ key: 'Authorization', value: 'Bearer x' }, { key: 'X-Api-Key', value: 'k' }, { key: 'X-Form', value: 'f' }] }),
    ctx(),
    source(),
  )
  expect(c.describe(prepared).headers).toEqual({ Authorization: '••••', 'X-Api-Key': '••••', 'X-Form': 'f' })
  expect(prepared.headers.Authorization).toBe('Bearer x') // сам запрос не тронут
})

describe('execute', () => {
  it('отправка через защищённый клиент: метод, адрес, тело, авторизация, таймаут', async () => {
    const { c, calls } = connector()
    const prepared = c.prepare(spec({ method: 'PUT', body: { format: 'json', value: { a: 1 } } }), ctx(), source())
    const result = await c.execute(prepared, { type: 'bearer', token: 't' })
    expect(calls[0]).toEqual({
      config: {
        type: 'rest-api',
        url: 'https://api.example.com/v2',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
        insecureTLS: false,
        body: { a: 1 },
        bodyFormat: 'json',
      },
      auth: { type: 'bearer', token: 't' },
    })
    expect(result).toEqual({ ok: true, status: 201, data: { id: 1 }, retry: 'never', durationMs: 40 })
  })

  it('form-urlencoded уходит строкой как есть', async () => {
    const { c, calls } = connector()
    await c.execute(c.prepare(spec({ body: { format: 'form-urlencoded', fields: [{ key: 'a', value: '1' }] } }), ctx(), source()), undefined)
    expect(calls[0].config).toMatchObject({ body: 'a=1', bodyFormat: 'raw' })
  })

  it('HTTP-ошибка: статус, тело ответа в сообщении (для журнала)', async () => {
    const { c } = connector({ success: false, error: { code: 'HTTP_400', message: 'Bad Request', details: '{"e":"phones"}' }, metadata: { statusCode: 400, headers: {}, responseTime: 1 } })
    const result = await c.execute(c.prepare(spec({}), ctx(), source()), undefined)
    expect(result).toMatchObject({ ok: false, status: 400, retry: 'never', error: { code: 'HTTP_400', message: 'Bad Request — {"e":"phones"}' } })
  })

  it('клиент бросил — ошибка без исключения наружу', async () => {
    const c = createRestConnector(async () => {
      throw new Error('boom')
    })
    expect(await c.execute(c.prepare(spec({}), ctx(), source()), undefined)).toMatchObject({ ok: false, retry: 'unknown', error: { code: 'SEND_ERROR', message: 'boom' } })
  })
})

describe('classifyRestFailure', () => {
  const fail = (code: string, message = '') => ({ success: false, error: { code, message } }) as FetchResult
  it.each([
    [fail('HTTP_400'), 400, 'never'],
    [fail('HTTP_404'), 404, 'never'],
    [fail('HTTP_408'), 408, 'safe'],
    [fail('HTTP_429'), 429, 'safe'],
    [fail('HTTP_500'), 500, 'unknown'],
    [fail('HTTP_503'), 503, 'unknown'],
    [fail('FETCH_ERROR', 'fetch failed: ECONNREFUSED'), null, 'safe'],
    [fail('FETCH_ERROR', 'fetch failed: ENOTFOUND'), null, 'safe'],
    [fail('FETCH_ERROR', 'Не удалось разрешить хост: x'), null, 'safe'],
    [fail('FETCH_ERROR', 'Адрес заблокирован (private/loopback/metadata): 10.0.0.1'), null, 'never'],
    [fail('FETCH_ERROR', 'The operation was aborted due to timeout'), null, 'unknown'],
    [fail('FETCH_ERROR', 'fetch failed: ECONNRESET'), null, 'unknown'],
  ])('%#', (result, status, retry) => {
    expect(classifyRestFailure(result)).toEqual({ status, retry })
  })
})
