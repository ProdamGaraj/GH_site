/**
 * RequestPipeline — отправка данных привязкой (docs/request-pipeline-architecture.md, 3).
 *
 *   привязка → спецификация → проверка → контекст → коннектор.prepare →
 *   журнал → коннектор.execute → разрешённые поля ответа.
 *
 * Сайт присылает только id привязки и значения (form/page/visitor); адрес,
 * метод, заголовки, тело и авторизация — из сохранённой привязки и источника.
 * Посетитель получает статус и (если разрешено) поля ответа; подробности
 * ошибки — в журнал. Редактор (с сессией) получает превью и тест-отправку
 * через тот же код.
 *
 * Этап 1: доставка direct (одна попытка). Очередь — этап 3.
 */
import type { DataBinding } from '../../models/DataBinding'
import type { DataSource } from '../../models/DataSource'
import type { AuthConfig } from '../SecureDataSourceService'
import { buildRequestContext, type ServerMeta, type VisitorInput } from './context'
import type { ConnectorRegistry } from './connectors/registry'
import { RequestInputError, type Connector, type ConnectorResult, type PreparedRequest, type SourceInfo } from './connectors/types'
import { shapeResponse } from './response'
import { requestSpecOf, responseIssues, type RequestSpec } from './spec'
import { TemplateSyntaxError } from './template'

/** Ограничения на данные с сайта (защита от мусора и раздувания журнала). */
export const PUBLIC_SUBMIT_MAX_FIELDS = 50
export const PUBLIC_SUBMIT_MAX_BYTES = 32 * 1024

const ERROR_MESSAGE_MAX = 500
/** Тест-отправка: сколько ответа сервиса показать редактору. */
const TEST_RESPONSE_MAX_BYTES = 64 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type RequestTrigger =
  | 'form_submit'
  | 'button_click'
  | 'input_change'
  | 'input_blur'
  | 'interval'
  | 'custom_event'
  | 'api_call'

export interface PublicRequestInput extends VisitorInput {
  outputBindingId: string
  trigger?: RequestTrigger
}

export interface PublicRequestMeta extends ServerMeta {
  referrer?: string
  sessionId?: string
}

export interface SubmissionStart {
  dataSourceId: string
  outputBindingId: string
  pageId: string | null
  blockId: string | null
  method: string
  endpoint: string
  trigger: RequestTrigger
  fieldNames: string[]
  ip: string
  userAgent: string
  referrer?: string
  sessionId?: string
}

export interface SubmissionFinish {
  status: 'success' | 'failed' | 'timeout'
  responseStatusCode: number | null
  durationMs: number
  errorCode?: string
  errorMessage?: string
}

export interface RequestPipelineDeps {
  /** Привязка вместе с источником (relation dataSource). */
  loadBinding(id: string): Promise<DataBinding | null>
  decryptAuth(authConfig: Record<string, unknown>): Promise<AuthConfig>
  connectors: ConnectorRegistry
  startSubmission(fields: SubmissionStart): Promise<string>
  finishSubmission(id: string, result: SubmissionFinish): Promise<void>
  now?: () => Date
  log?: (level: 'warn' | 'error', message: string) => void
}

export type PublicOutcome =
  | { kind: 'done'; submissionId: string; data?: unknown; variable?: string }
  | { kind: 'unusable'; reason: string }
  /** Данные посетителя не годятся для запроса (например, «..» в пути). */
  | { kind: 'invalid'; reason: string }
  | { kind: 'failed'; submissionId: string }

/** Что проверено и собрано, но ещё не отправлено. */
type Plan =
  | { issues: string[]; invalidInput?: boolean }
  | { issues: []; connector: Connector; prepared: PreparedRequest; spec: RequestSpec }

export interface PreviewResult {
  issues: string[]
  /** Запрос, который уйдёт (секретные заголовки скрыты, без авторизации источника). */
  request?: PreparedRequest
}

export interface TestResult extends PreviewResult {
  result?: Omit<ConnectorResult, 'data'> & { data?: unknown; truncated?: boolean }
  /** Что получила бы страница. */
  pageData?: unknown
}

/** Адрес для журнала: без query (там бывают токены). */
export function addressForLog(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    return parsed.toString()
  } catch {
    return url.split('?')[0]
  }
}

function truncate(text: string): string {
  return text.length > ERROR_MESSAGE_MAX ? `${text.slice(0, ERROR_MESSAGE_MAX)}…` : text
}

function sourceInfo(source: DataSource): SourceInfo {
  return { id: source.id, type: source.type, config: (source.config || {}) as Record<string, unknown> }
}

function isTimeout(result: ConnectorResult): boolean {
  return /timeout|aborted/i.test(`${result.error?.code ?? ''} ${result.error?.message ?? ''}`)
}

export class RequestPipeline {
  private readonly now: () => Date

  constructor(private readonly deps: RequestPipelineDeps) {
    this.now = deps.now ?? (() => new Date())
  }

  /** Сайт: отправка по сохранённой привязке. */
  async submitPublic(input: PublicRequestInput, meta: PublicRequestMeta): Promise<PublicOutcome> {
    const binding = await this.deps.loadBinding(input.outputBindingId)
    const unusable = this.bindingProblem(binding)
    if (unusable) return this.unusable(input.outputBindingId, unusable)
    const spec = requestSpecOf(binding!)
    if (!spec) return this.unusable(input.outputBindingId, 'no output config')

    const plan = this.plan(binding!.dataSource, spec, input, meta)
    if (!('prepared' in plan)) {
      if (plan.invalidInput) {
        this.deps.log?.('warn', `[Request] binding ${input.outputBindingId}: ${plan.issues.join('; ')}`)
        return { kind: 'invalid', reason: plan.issues.join('; ') }
      }
      return this.unusable(input.outputBindingId, plan.issues.join('; '))
    }

    const submissionId = await this.deps.startSubmission({
      dataSourceId: binding!.dataSourceId,
      outputBindingId: binding!.id,
      // Страница и блок — из привязки, не из запроса: браузеру тут не доверяем.
      pageId: binding!.pageId,
      blockId: UUID_RE.test(binding!.blockId || '') ? binding!.blockId : null,
      method: plan.prepared.method,
      endpoint: addressForLog(plan.prepared.url),
      trigger: input.trigger ?? 'form_submit',
      fieldNames: Object.keys(input.data),
      ip: meta.ip,
      userAgent: meta.userAgent,
      referrer: meta.referrer,
      sessionId: meta.sessionId,
    })

    const result = await this.execute(plan.connector, plan.prepared, binding!.dataSource)
    await this.deps.finishSubmission(submissionId, this.finish(result))
    if (!result.ok) {
      this.deps.log?.('warn', `[Request] ${submissionId} via binding ${binding!.id} failed: ${result.error?.code}`)
      return { kind: 'failed', submissionId }
    }
    const data = shapeResponse(result.data, plan.spec.response)
    return data === undefined
      ? { kind: 'done', submissionId }
      : { kind: 'done', submissionId, data, variable: plan.spec.response?.variable }
  }

  /** Редактор: что уйдёт при этих значениях (без отправки). */
  preview(source: DataSource, spec: RequestSpec, input: VisitorInput, meta: ServerMeta): PreviewResult {
    const plan = this.plan(source, spec, input, meta)
    if (!('prepared' in plan)) return { issues: plan.issues }
    return { issues: [], request: plan.connector.describe(plan.prepared) }
  }

  /** Редактор: отправить по-настоящему и показать ответ сервиса. В журнал не пишется. */
  async test(source: DataSource, spec: RequestSpec, input: VisitorInput, meta: ServerMeta): Promise<TestResult> {
    const plan = this.plan(source, spec, input, meta)
    if (!('prepared' in plan)) return { issues: plan.issues }
    const result = await this.execute(plan.connector, plan.prepared, source)
    const json = result.data === undefined ? '' : JSON.stringify(result.data)
    const truncated = json.length > TEST_RESPONSE_MAX_BYTES
    return {
      issues: [],
      request: plan.connector.describe(plan.prepared),
      result: {
        ...result,
        data: truncated ? json.slice(0, TEST_RESPONSE_MAX_BYTES) : result.data,
        ...(truncated ? { truncated } : {}),
      },
      pageData: result.ok ? shapeResponse(result.data, plan.spec.response) : undefined,
    }
  }

  private bindingProblem(binding: DataBinding | null): string | null {
    if (!binding) return 'binding not found'
    if (binding.bindingType !== 'output') return 'not an output binding'
    if (!binding.isActive) return 'binding is inactive'
    if (!binding.dataSource) return 'no data source'
    return null
  }

  private unusable(bindingId: string, reason: string): PublicOutcome {
    this.deps.log?.('warn', `[Request] binding ${bindingId}: ${reason}`)
    return { kind: 'unusable', reason }
  }

  private plan(source: DataSource, spec: RequestSpec, input: VisitorInput, meta: ServerMeta): Plan {
    const connector = this.deps.connectors.forSourceType(source.type)
    if (!connector) return { issues: [`Отправка для источника типа «${source.type}» пока не поддерживается`] }
    if (spec.connector !== connector.id) return { issues: [`Запрос для «${spec.connector}», а источник — «${source.type}»`] }
    const info = sourceInfo(source)
    const issues = [...connector.validate(spec, info), ...responseIssues(spec.response)]
    if (issues.length) return { issues }
    try {
      const ctx = buildRequestContext(input, meta, this.now())
      return { issues: [], connector, prepared: connector.prepare(spec, ctx, info), spec }
    } catch (error) {
      if (error instanceof RequestInputError) return { issues: [error.message], invalidInput: true }
      if (error instanceof TemplateSyntaxError || error instanceof TypeError) return { issues: [error.message] }
      throw error
    }
  }

  private async execute(connector: Connector, prepared: PreparedRequest, source: DataSource): Promise<ConnectorResult> {
    try {
      const auth = source.authConfig ? await this.deps.decryptAuth(source.authConfig) : undefined
      return await connector.execute(prepared, auth)
    } catch (error) {
      return {
        ok: false,
        status: null,
        retry: 'unknown',
        durationMs: 0,
        error: { code: 'AUTH_ERROR', message: error instanceof Error ? error.message : String(error) },
      }
    }
  }

  private finish(result: ConnectorResult): SubmissionFinish {
    if (result.ok) return { status: 'success', responseStatusCode: result.status, durationMs: result.durationMs }
    return {
      status: isTimeout(result) ? 'timeout' : 'failed',
      responseStatusCode: result.status,
      durationMs: result.durationMs,
      errorCode: result.error?.code || 'SEND_FAILED',
      errorMessage: truncate(result.error?.message || 'unknown error'),
    }
  }
}
