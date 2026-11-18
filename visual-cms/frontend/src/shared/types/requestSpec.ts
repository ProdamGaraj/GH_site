/**
 * Запрос привязки (`outputConfig.request`) — зеркало типов бэкенда
 * backend/src/services/requests/spec.ts и connectors/types.ts.
 * docs/request-pipeline-architecture.md.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export const HTTP_METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export interface KeyValueTemplate {
  key: string
  /** Шаблон: строка со ссылками {{form.x}} или JSON-значение. */
  value: unknown
}

export type RestBody =
  | { format: 'none' }
  | { format: 'json'; value: unknown }
  | { format: 'form-urlencoded'; fields: KeyValueTemplate[] }

export interface RestRequestSpec {
  method: HttpMethod
  path: string
  query?: KeyValueTemplate[]
  headers?: Array<{ key: string; value: string }>
  body?: RestBody
}

export interface ResponseField {
  from: string
  to: string
}

export interface ResponseSpec {
  expose: 'status' | 'fields'
  dataPath?: string
  fields?: ResponseField[]
  maxItems?: number
  variable?: string
}

export interface RequestSpec {
  version: number
  connector: 'rest'
  rest?: RestRequestSpec
  response?: ResponseSpec
  delivery?: { mode: 'direct'; timeoutMs?: number }
}

/** Собранный запрос (превью / тест): секретные заголовки скрыты. */
export interface PreparedRequestView {
  connector: string
  method: string
  url: string
  headers: Record<string, string>
  body?: { format: 'json'; value: unknown } | { format: 'form-urlencoded'; text: string }
  timeoutMs: number
}

export interface RequestPreviewResult {
  issues: string[]
  request?: PreparedRequestView
}

export interface RequestTestResult extends RequestPreviewResult {
  result?: {
    ok: boolean
    status: number | null
    data?: unknown
    truncated?: boolean
    retry: 'safe' | 'unknown' | 'never'
    error?: { code: string; message: string }
    durationMs: number
  }
  pageData?: unknown
}

/** Тело превью/теста: несохранённый запрос + примерные значения. */
export interface RequestEditorPayload {
  dataSourceId: string
  request: RequestSpec
  data?: Record<string, unknown>
  page?: { path?: string; lang?: string; title?: string }
}
