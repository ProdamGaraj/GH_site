/**
 * Коннектор — точка расширения конвейера запросов: один тип связи (REST,
 * позже GraphQL, SQL, …). docs/request-pipeline-architecture.md, 3.3.
 *
 * Конвейер, рантайм страницы и (позже) очередь о типе связи не знают —
 * только об этом интерфейсе.
 */
import type { AuthConfig } from '../../SecureDataSourceService'
import type { RequestSpec } from '../spec'
import type { TemplateContext } from '../template'

/**
 * Данные посетителя не годятся для запроса (например, «..» в пути).
 * Посетителю — «проверьте введённые данные», в журнал — причина.
 */
export class RequestInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RequestInputError'
  }
}

/** Что коннектору нужно знать об источнике (без секретов). */
export interface SourceInfo {
  id: string
  type: string
  config: Record<string, unknown>
}

/** Собранный запрос: всё, кроме авторизации. Его пишут в журнал и (позже) в очередь. */
export interface PreparedRequest {
  connector: string
  method: string
  url: string
  headers: Record<string, string>
  body?: { format: 'json'; value: unknown } | { format: 'form-urlencoded'; text: string }
  timeoutMs: number
  insecureTLS: boolean
}

/** Можно ли повторить: 'safe' — точно не дошло; 'unknown' — могло дойти; 'never'. */
export type RetryHint = 'safe' | 'unknown' | 'never'

export interface ConnectorResult {
  ok: boolean
  status: number | null
  data?: unknown
  retry: RetryHint
  /** Только для журнала и редактора — посетителю не отдаётся. */
  error?: { code: string; message: string }
  durationMs: number
}

export interface Connector {
  id: RequestSpec['connector']
  /** Типы источников, с которыми работает коннектор. */
  sourceTypes: readonly string[]
  /** Ошибки спецификации (при сохранении в редакторе и перед отправкой); пусто — годится. */
  validate(spec: RequestSpec, source: SourceInfo): string[]
  /** Шаблон + контекст → запрос. Бросает только на некорректной спецификации. */
  prepare(spec: RequestSpec, ctx: TemplateContext, source: SourceInfo): PreparedRequest
  /** Для превью и журнала: секретные заголовки скрыты. */
  describe(prepared: PreparedRequest): PreparedRequest
  /** Выполнить; авторизация подставляется здесь. Не бросает. */
  execute(prepared: PreparedRequest, auth: AuthConfig | undefined): Promise<ConnectorResult>
}
