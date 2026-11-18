/**
 * Спецификация запроса привязки (`outputConfig.request`) — данные, не код.
 * docs/request-pipeline-architecture.md, 3.1, 3.4, 3.5.
 *
 * Старые привязки (endpoint + payloadMappings, маппинг делал браузер) читаются
 * адаптером legacyRequestSpec — без миграции базы; редактор при сохранении
 * пишет уже новый вид.
 */
import type { DataBinding, OutputBindingConfig } from '../../models/DataBinding'

export const REQUEST_SPEC_VERSION = 1

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export const HTTP_METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export interface KeyValueTemplate {
  key: string
  /** Шаблон значения: строка со ссылками или JSON-значение. */
  value: unknown
}

export type RestBody =
  | { format: 'none' }
  | { format: 'json'; value: unknown }
  | { format: 'form-urlencoded'; fields: KeyValueTemplate[] }

export interface RestRequestSpec {
  method: HttpMethod
  /** Путь к url источника ('/clients/{{form.id}}') или полный http(s)-адрес без ссылок в хосте. */
  path: string
  query?: KeyValueTemplate[]
  headers?: Array<{ key: string; value: string }>
  body?: RestBody
}

export interface ResponseField {
  /** Путь в ответе сервиса (от dataPath): 'price.total'. */
  from: string
  /** Имя поля в данных страницы: 'price'. */
  to: string
}

export interface ResponseSpec {
  /** 'status' — посетитель получает только статус (по умолчанию). */
  expose: 'status' | 'fields'
  dataPath?: string
  fields?: ResponseField[]
  /** Сколько элементов отдать, если по dataPath массив. */
  maxItems?: number
  /** Переменная страницы, куда рантайм положит разрешённые данные. */
  variable?: string
}

export interface DeliverySpec {
  mode: 'direct'
  /** Ожидание ответа одной попытки, мс. */
  timeoutMs?: number
}

export interface RequestSpec {
  version: number
  connector: 'rest'
  rest?: RestRequestSpec
  response?: ResponseSpec
  delivery?: DeliverySpec
}

export const DEFAULT_TIMEOUT_MS = 15_000
export const MIN_TIMEOUT_MS = 1_000
export const MAX_TIMEOUT_MS = 30_000
export const DEFAULT_MAX_ITEMS = 50
export const MAX_ITEMS_LIMIT = 500

const VARIABLE_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const PATH_RE = /^[\w-]+(?:\.[\w-]+)*$/

export function timeoutOf(spec: RequestSpec): number {
  const t = spec.delivery?.timeoutMs
  if (typeof t !== 'number' || !Number.isFinite(t)) return DEFAULT_TIMEOUT_MS
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(t)))
}

/** Проверка части «ответ»; пусто — корректна. */
export function responseIssues(response: ResponseSpec | undefined): string[] {
  if (!response || response.expose === 'status') return []
  if (response.expose !== 'fields') return ['Ответ: неизвестный режим']
  const issues: string[] = []
  if (response.dataPath && !PATH_RE.test(response.dataPath)) issues.push(`Ответ: непонятный путь «${response.dataPath}»`)
  if (!response.fields?.length) issues.push('Ответ: перечислите поля, которые получит страница')
  for (const field of response.fields ?? []) {
    if (!PATH_RE.test(field.from || '')) issues.push(`Ответ: непонятный путь поля «${field.from}»`)
    if (!VARIABLE_RE.test(field.to || '')) issues.push(`Ответ: имя «${field.to}» — латиница, цифры, «_»`)
  }
  if (!response.variable || !VARIABLE_RE.test(response.variable)) {
    issues.push('Ответ: укажите переменную страницы (латиница, цифры, «_»)')
  }
  if (response.maxItems !== undefined && !(Number.isInteger(response.maxItems) && response.maxItems > 0 && response.maxItems <= MAX_ITEMS_LIMIT)) {
    issues.push(`Ответ: число элементов — от 1 до ${MAX_ITEMS_LIMIT}`)
  }
  return issues
}

type LegacyMapping = { sourceField?: string; targetField?: string; type?: string; value?: unknown }

/**
 * Старая привязка → спецификация, отправляющая то же, что раньше:
 * путь/метод/заголовки/query из endpoint; тело — маппинг полей
 * (direct: target ← форма[source], static: target = значение) или вся форма.
 */
export function legacyRequestSpec(output: OutputBindingConfig): RequestSpec {
  const endpoint = output.endpoint
  const method = String(endpoint?.method || output.method || 'POST').toUpperCase() as HttpMethod
  const query = Object.entries(endpoint?.queryParams ?? {}).map(([key, value]) => ({ key, value }))
  const headers = Object.entries(endpoint?.headers ?? {}).map(([key, value]) => ({ key, value: String(value) }))

  const mappings = (output.payloadMappings ?? []) as unknown as LegacyMapping[]
  let bodyValue: unknown = '{{form}}'
  if (mappings.length > 0) {
    const mapped: Record<string, unknown> = {}
    for (const m of mappings) {
      const target = (m.targetField || m.sourceField || '').trim()
      if (!target) continue
      mapped[target] = m.type === 'static' ? (m.value ?? null) : `{{form.${(m.sourceField || target).trim()}}}`
    }
    bodyValue = mapped
  }

  const contentType = String(endpoint?.contentType || '').toLowerCase()
  const urlEncoded =
    endpoint?.bodyFormat === 'form-urlencoded' || endpoint?.bodyFormat === 'form-data' || contentType.includes('x-www-form-urlencoded')

  let body: RestBody
  if (method === 'GET' || method === 'DELETE') body = { format: 'none' }
  else if (urlEncoded && bodyValue && typeof bodyValue === 'object') {
    body = { format: 'form-urlencoded', fields: Object.entries(bodyValue).map(([key, value]) => ({ key, value })) }
  } else body = { format: 'json', value: bodyValue }

  return {
    version: REQUEST_SPEC_VERSION,
    connector: 'rest',
    rest: {
      method,
      path: String(endpoint?.path ?? output.endpointPath ?? ''),
      ...(query.length ? { query } : {}),
      ...(headers.length ? { headers } : {}),
      body,
    },
    response: { expose: 'status' },
  }
}

/** Спецификация привязки: сохранённая или прочитанная из старого вида. */
export function requestSpecOf(binding: Pick<DataBinding, 'config'>): RequestSpec | null {
  const output = binding.config?.outputConfig
  if (!output) return null
  return output.request ?? legacyRequestSpec(output)
}
