/**
 * RequestPipeline: сайт отправляет по сохранённой привязке; журнал;
 * посетителю — статус и разрешённые поля; превью и тест для редактора.
 */
import type { DataBinding } from '../models/DataBinding'
import type { DataSource } from '../models/DataSource'
import { ConnectorRegistry } from '../services/requests/connectors/registry'
import { createRestConnector } from '../services/requests/connectors/rest'
import {
  RequestPipeline,
  addressForLog,
  type RequestPipelineDeps,
  type SubmissionFinish,
  type SubmissionStart,
} from '../services/requests/RequestPipeline'
import type { RequestSpec } from '../services/requests/spec'
import type { AuthConfig, FetchConfig, FetchResult } from '../services/SecureDataSourceService'

const BINDING_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_ID = '22222222-2222-4222-8222-222222222222'
const PAGE_ID = '33333333-3333-4333-8333-333333333333'

const SPEC: RequestSpec = {
  version: 1,
  connector: 'rest',
  rest: {
    method: 'POST',
    path: '/estateBuy/create',
    body: { format: 'json', value: { name: '{{form.name}}', phones: ['{{form.phone | digits}}'], lang: '{{page.lang}}', domain: '{{request.domain}}' } },
  },
  response: { expose: 'fields', dataPath: 'data', fields: [{ from: 'id', to: 'leadId' }], variable: 'lead' },
}

function source(over: Partial<DataSource> = {}): DataSource {
  return {
    id: SOURCE_ID,
    name: 'MACRO',
    type: 'rest-api',
    config: { url: 'https://api.example.com/v2' },
    authConfig: { type: 'bearer', token: { storageType: 'encrypted', value: 'x' } },
    ...over,
  } as unknown as DataSource
}

function binding(over: Record<string, unknown> = {}, outputConfig: Record<string, unknown> = { request: SPEC }): DataBinding {
  return {
    id: BINDING_ID,
    blockId: 'el-form',
    pageId: PAGE_ID,
    dataSourceId: SOURCE_ID,
    bindingType: 'output',
    isActive: true,
    config: { outputConfig: { trigger: 'submit', payloadMappings: [], ...outputConfig } },
    dataSource: source(),
    ...over,
  } as unknown as DataBinding
}

function harness(opts: { binding?: DataBinding | null; result?: FetchResult; decryptThrows?: boolean } = {}) {
  const sent: Array<{ config: FetchConfig; auth: AuthConfig | undefined }> = []
  const started: SubmissionStart[] = []
  const finished: Array<{ id: string; result: SubmissionFinish }> = []
  const logs: string[] = []
  const rest = createRestConnector(async (config, auth) => {
    sent.push({ config, auth })
    return opts.result ?? { success: true, data: { data: { id: 777, manager: 'internal' } }, metadata: { statusCode: 201, headers: {}, responseTime: 5 } }
  })
  const deps: RequestPipelineDeps = {
    loadBinding: jest.fn(async () => (opts.binding === undefined ? binding() : opts.binding)),
    decryptAuth: jest.fn(async () => {
      if (opts.decryptThrows) throw new Error('bad key')
      return { type: 'bearer', token: 'decrypted' } as AuthConfig
    }),
    connectors: new ConnectorRegistry([rest]),
    startSubmission: jest.fn(async (fields) => {
      started.push(fields)
      return 'sub-1'
    }),
    finishSubmission: jest.fn(async (id, result) => {
      finished.push({ id, result })
    }),
    now: () => new Date('2026-11-18T10:00:00Z'),
    log: (_level, message) => logs.push(message),
  }
  return { pipeline: new RequestPipeline(deps), deps, sent, started, finished, logs }
}

const input = {
  outputBindingId: BINDING_ID,
  data: { name: 'Иван', phone: '+998 90 123-45-67' },
  page: { path: '/ru/', lang: 'ru', title: 'Главная' },
}
const meta = { ip: '203.0.113.7', domain: 'gh.uz', userAgent: 'UA', referrer: 'https://gh.uz/ru/', sessionId: 's1' }

describe('submitPublic', () => {
  it('собирает запрос по шаблону привязки, шлёт с расшифрованным токеном, отдаёт разрешённое поле', async () => {
    const h = harness()
    const outcome = await h.pipeline.submitPublic(input, meta)

    expect(outcome).toEqual({ kind: 'done', submissionId: 'sub-1', data: { leadId: 777 }, variable: 'lead' })
    expect(h.sent).toHaveLength(1)
    expect(h.sent[0].config).toMatchObject({
      url: 'https://api.example.com/v2/estateBuy/create',
      method: 'POST',
      body: { name: 'Иван', phones: ['998901234567'], lang: 'ru', domain: 'gh.uz' },
    })
    expect(h.sent[0].auth).toEqual({ type: 'bearer', token: 'decrypted' })
    expect(JSON.stringify(outcome)).not.toContain('internal')
  })

  it('журнал: привязка, страница и источник — из привязки; адрес без query; статус', async () => {
    const h = harness({
      binding: binding({}, { request: { ...SPEC, rest: { ...SPEC.rest!, path: '/x?token=secret' } } }),
    })
    await h.pipeline.submitPublic({ ...input, trigger: 'button_click' }, meta)
    expect(h.started).toEqual([
      {
        dataSourceId: SOURCE_ID,
        outputBindingId: BINDING_ID,
        pageId: PAGE_ID,
        blockId: null,
        method: 'POST',
        endpoint: 'https://api.example.com/v2/x',
        trigger: 'button_click',
        fieldNames: ['name', 'phone'],
        ip: meta.ip,
        userAgent: meta.userAgent,
        referrer: meta.referrer,
        sessionId: meta.sessionId,
      },
    ])
    expect(h.finished[0]).toMatchObject({ id: 'sub-1', result: { status: 'success', responseStatusCode: 201 } })
  })

  it('только статус в ответе — без данных', async () => {
    const h = harness({ binding: binding({}, { request: { ...SPEC, response: { expose: 'status' } } }) })
    expect(await h.pipeline.submitPublic(input, meta)).toEqual({ kind: 'done', submissionId: 'sub-1' })
  })

  it('старая привязка (без request) — адаптер: вся форма телом', async () => {
    const h = harness({ binding: binding({}, { endpoint: { path: '/leads', method: 'POST' } }) })
    expect((await h.pipeline.submitPublic(input, meta)).kind).toBe('done')
    expect(h.sent[0].config).toMatchObject({ url: 'https://api.example.com/v2/leads', body: input.data })
  })

  it('GET с данными посетителя в query', async () => {
    const spec: RequestSpec = {
      version: 1,
      connector: 'rest',
      rest: { method: 'GET', path: '/flats', query: [{ key: 'rooms', value: '{{form.rooms | number}}' }] },
    }
    const h = harness({ binding: binding({}, { request: spec }) })
    await h.pipeline.submitPublic({ ...input, data: { rooms: '2' } }, meta)
    expect(h.sent[0].config).toMatchObject({ method: 'GET', url: 'https://api.example.com/v2/flats?rooms=2' })
    expect(h.sent[0].config).not.toHaveProperty('body')
  })

  it.each([
    ['привязки нет', null, 'binding not found'],
    ['не output', binding({ bindingType: 'input' }), 'not an output binding'],
    ['выключена', binding({ isActive: false }), 'binding is inactive'],
    ['нет источника', binding({ dataSource: null }), 'no data source'],
    ['источник без коннектора (SQL)', binding({ dataSource: source({ type: 'database' } as never) }), 'типа «database» пока не поддерживается'],
    ['ошибка в шаблоне', binding({}, { request: { ...SPEC, rest: { ...SPEC.rest!, path: '/{{secret.x}}' } } }), 'Нет данных «secret»'],
    ['ошибка в ответе', binding({}, { request: { ...SPEC, response: { expose: 'fields' } } }), 'перечислите поля'],
  ])('не годится: %s — без отправки и журнала', async (_name, b, reason) => {
    const h = harness({ binding: b as DataBinding | null })
    const outcome = await h.pipeline.submitPublic(input, meta)
    expect(outcome.kind).toBe('unusable')
    expect((outcome as { reason: string }).reason).toContain(reason)
    expect(h.sent).toHaveLength(0)
    expect(h.started).toHaveLength(0)
    expect(h.logs.join('\n')).toContain(reason)
  })

  it('данные посетителя ломают путь («..») — invalid, без отправки', async () => {
    const spec: RequestSpec = { version: 1, connector: 'rest', rest: { method: 'GET', path: '/items/{{form.id}}' } }
    const h = harness({ binding: binding({}, { request: spec }) })
    const outcome = await h.pipeline.submitPublic({ ...input, data: { id: '..' } }, meta)
    expect(outcome.kind).toBe('invalid')
    expect(h.sent).toHaveLength(0)
  })

  it('сервис ответил ошибкой — failed; детали только в журнале', async () => {
    const h = harness({
      result: { success: false, error: { code: 'HTTP_400', message: 'Bad Request', details: '{"e":"phones"}' }, metadata: { statusCode: 400, headers: {}, responseTime: 1 } },
    })
    expect(await h.pipeline.submitPublic(input, meta)).toEqual({ kind: 'failed', submissionId: 'sub-1' })
    expect(h.finished[0].result).toMatchObject({ status: 'failed', responseStatusCode: 400, errorCode: 'HTTP_400', errorMessage: 'Bad Request — {"e":"phones"}' })
  })

  it('таймаут — статус timeout в журнале', async () => {
    const h = harness({ result: { success: false, error: { code: 'FETCH_ERROR', message: 'The operation was aborted due to timeout' } } })
    await h.pipeline.submitPublic(input, meta)
    expect(h.finished[0].result.status).toBe('timeout')
  })

  it('токен не расшифровался — failed, журнал закрыт, запрос не ушёл', async () => {
    const h = harness({ decryptThrows: true })
    expect((await h.pipeline.submitPublic(input, meta)).kind).toBe('failed')
    expect(h.sent).toHaveLength(0)
    expect(h.finished[0].result).toMatchObject({ status: 'failed', errorCode: 'AUTH_ERROR' })
  })

  it('источник без авторизации — токен не расшифровывается', async () => {
    const h = harness({ binding: binding({ dataSource: source({ authConfig: undefined }) }) })
    await h.pipeline.submitPublic(input, meta)
    expect(h.deps.decryptAuth).not.toHaveBeenCalled()
    expect(h.sent[0].auth).toBeUndefined()
  })
})

describe('редактор', () => {
  it('preview: запрос с подставленными значениями, секреты скрыты, ничего не отправлено', () => {
    const h = harness()
    const spec: RequestSpec = { ...SPEC, rest: { ...SPEC.rest!, headers: [{ key: 'X-Api-Key', value: 'k' }] } }
    const result = h.pipeline.preview(source(), spec, { data: { name: 'Тест', phone: '90 1' } }, meta)
    expect(result.issues).toEqual([])
    expect(result.request).toMatchObject({
      method: 'POST',
      url: 'https://api.example.com/v2/estateBuy/create',
      headers: { 'X-Api-Key': '••••' },
      body: { format: 'json', value: { name: 'Тест', phones: ['901'] } },
    })
    expect(h.sent).toHaveLength(0)
  })

  it('preview: ошибки спецификации списком', () => {
    const h = harness()
    const result = h.pipeline.preview(source(), { version: 1, connector: 'rest', rest: { method: 'GET', path: '/{{x.y}}' } }, { data: {} }, meta)
    expect(result.issues.join()).toContain('Нет данных «x»')
    expect(result.request).toBeUndefined()
  })

  it('test: отправляет, показывает полный ответ сервиса и что получит страница; журнал не пишет', async () => {
    const h = harness()
    const result = await h.pipeline.test(source(), SPEC, { data: { name: 'Тест', phone: '901' } }, meta)
    expect(h.sent).toHaveLength(1)
    expect(result.result).toMatchObject({ ok: true, status: 201, data: { data: { id: 777, manager: 'internal' } } })
    expect(result.pageData).toEqual({ leadId: 777 })
    expect(h.started).toHaveLength(0)
  })

  it('test: огромный ответ обрезается', async () => {
    const h = harness({ result: { success: true, data: { big: 'x'.repeat(100_000) }, metadata: { statusCode: 200, headers: {}, responseTime: 1 } } })
    const result = await h.pipeline.test(source(), { ...SPEC, response: { expose: 'status' } }, { data: {} }, meta)
    expect(result.result!.truncated).toBe(true)
    expect(String(result.result!.data).length).toBe(64 * 1024)
  })
})

it('addressForLog убирает query', () => {
  expect(addressForLog('https://a.example.com/x?token=s')).toBe('https://a.example.com/x')
  expect(addressForLog('bad?token=s')).toBe('bad')
})
