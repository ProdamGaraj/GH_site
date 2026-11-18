/**
 * Спецификация запроса: адаптер старых привязок (то же, что слал старый
 * рантайм), проверка «ответа», таймаут, разрешённые поля ответа.
 */
import type { DataBinding, OutputBindingConfig } from '../models/DataBinding'
import { shapeResponse } from '../services/requests/response'
import { legacyRequestSpec, requestSpecOf, responseIssues, timeoutOf, type RequestSpec } from '../services/requests/spec'

const legacy = (over: Record<string, unknown> = {}) =>
  ({ trigger: 'submit', payloadMappings: [], ...over }) as unknown as OutputBindingConfig

describe('legacyRequestSpec — старые привязки шлют то же, что раньше', () => {
  it('без маппинга: метод и путь из endpoint, тело — вся форма', () => {
    expect(legacyRequestSpec(legacy({ endpoint: { path: '/leads', method: 'PUT', contentType: 'application/json' } }))).toEqual({
      version: 1,
      connector: 'rest',
      rest: { method: 'PUT', path: '/leads', body: { format: 'json', value: '{{form}}' } },
      response: { expose: 'status' },
    })
  })

  it('маппинг: direct — поле формы под новым именем, static — константа', () => {
    const spec = legacyRequestSpec(
      legacy({
        endpoint: { path: '', method: 'POST' },
        payloadMappings: [
          { sourceField: 'name', targetField: 'fullName', type: 'direct' },
          { sourceField: 'phone', type: 'direct' },
          { sourceField: 'x', targetField: 'action', type: 'static', value: 'buy' },
          { sourceField: ' ', targetField: '', type: 'direct' },
        ],
      }),
    )
    expect(spec.rest!.body).toEqual({
      format: 'json',
      value: { fullName: '{{form.name}}', phone: '{{form.phone}}', action: 'buy' },
    })
  })

  it('устаревшие endpointPath/method, заголовки и query endpoint', () => {
    const spec = legacyRequestSpec(
      legacy({ endpointPath: '/old', method: 'PATCH', endpoint: { headers: { 'X-A': '1' }, queryParams: { k: 'v' } } }),
    )
    expect(spec.rest).toMatchObject({ method: 'PATCH', path: '/old', headers: [{ key: 'X-A', value: '1' }], query: [{ key: 'k', value: 'v' }] })
  })

  it('form-urlencoded по Content-Type', () => {
    const spec = legacyRequestSpec(
      legacy({
        endpoint: { path: '', method: 'POST', contentType: 'application/x-www-form-urlencoded' },
        payloadMappings: [{ sourceField: 'name', type: 'direct' }],
      }),
    )
    expect(spec.rest!.body).toEqual({ format: 'form-urlencoded', fields: [{ key: 'name', value: '{{form.name}}' }] })
  })

  it('GET/DELETE — без тела', () => {
    expect(legacyRequestSpec(legacy({ endpoint: { path: '', method: 'GET' } })).rest!.body).toEqual({ format: 'none' })
    expect(legacyRequestSpec(legacy({ endpoint: { path: '', method: 'DELETE' } })).rest!.body).toEqual({ format: 'none' })
  })

  it('по умолчанию POST', () => {
    expect(legacyRequestSpec(legacy()).rest!.method).toBe('POST')
  })
})

describe('requestSpecOf', () => {
  const saved: RequestSpec = { version: 1, connector: 'rest', rest: { method: 'GET', path: '/x' } }
  it('сохранённая спецификация важнее старого вида', () => {
    expect(requestSpecOf({ config: { outputConfig: legacy({ request: saved }) } } as unknown as DataBinding)).toBe(saved)
  })
  it('без outputConfig — null', () => {
    expect(requestSpecOf({ config: {} } as unknown as DataBinding)).toBeNull()
  })
})

describe('responseIssues', () => {
  it('статус (по умолчанию) — без ошибок', () => {
    expect(responseIssues(undefined)).toEqual([])
    expect(responseIssues({ expose: 'status' })).toEqual([])
  })

  it('поля: нужны поля, переменная, корректные пути и имена', () => {
    expect(responseIssues({ expose: 'fields', fields: [{ from: 'price.total', to: 'price' }], variable: 'priceResult' })).toEqual([])
    const issues = responseIssues({ expose: 'fields', dataPath: 'a..b', fields: [{ from: 'x y', to: '1bad' }], maxItems: 0 }).join('\n')
    expect(issues).toContain('непонятный путь «a..b»')
    expect(issues).toContain('непонятный путь поля «x y»')
    expect(issues).toContain('имя «1bad»')
    expect(issues).toContain('укажите переменную')
    expect(issues).toContain('число элементов')
    expect(responseIssues({ expose: 'fields', variable: 'v' }).join()).toContain('перечислите поля')
  })
})

it('timeoutOf: по умолчанию 15 с, в границах 1–30 с', () => {
  const s = (timeoutMs?: number): RequestSpec => ({ version: 1, connector: 'rest', delivery: { mode: 'direct', timeoutMs } })
  expect(timeoutOf(s())).toBe(15000)
  expect(timeoutOf(s(4500))).toBe(4500)
  expect(timeoutOf(s(10))).toBe(1000)
  expect(timeoutOf(s(10 ** 9))).toBe(30000)
  expect(timeoutOf(s(Number.NaN))).toBe(15000)
})

describe('shapeResponse — странице только разрешённое', () => {
  const data = {
    data: {
      items: [
        { id: 1, price: { total: 100 }, secret: 'x' },
        { id: 2, price: { total: 200 }, secret: 'y' },
        { id: 3, price: {}, secret: 'z' },
      ],
      manager: { name: 'Внутреннее имя' },
    },
  }

  it('статус — ничего', () => {
    expect(shapeResponse(data, undefined)).toBeUndefined()
    expect(shapeResponse(data, { expose: 'status' })).toBeUndefined()
  })

  it('массив по пути — поля каждого элемента, лимит', () => {
    expect(
      shapeResponse(data, { expose: 'fields', dataPath: 'data.items', fields: [{ from: 'id', to: 'id' }, { from: 'price.total', to: 'price' }], maxItems: 2, variable: 'v' }),
    ).toEqual([
      { id: 1, price: 100 },
      { id: 2, price: 200 },
    ])
  })

  it('объект — только перечисленные поля, отсутствующее — null', () => {
    expect(shapeResponse(data, { expose: 'fields', dataPath: 'data.items.2', fields: [{ from: 'price.total', to: 'price' }], variable: 'v' })).toEqual({
      price: null,
    })
  })

  it('пути нет в ответе — null; прототип недоступен', () => {
    expect(shapeResponse(data, { expose: 'fields', dataPath: 'nope', fields: [{ from: 'a', to: 'a' }], variable: 'v' })).toBeNull()
    expect(shapeResponse({}, { expose: 'fields', fields: [{ from: 'constructor', to: 'c' }], variable: 'v' })).toEqual({ c: null })
  })

  it('по умолчанию не больше 50 элементов', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ i }))
    expect((shapeResponse(many, { expose: 'fields', fields: [{ from: 'i', to: 'i' }], variable: 'v' }) as unknown[]).length).toBe(50)
  })
})
