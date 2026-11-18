/**
 * REST-коннектор: шаблон запроса → HTTP-запрос через SecureDataSourceService
 * (SSRF-guard, авторизация источника, TLS-опция). Новый HTTP-клиент не пишется.
 *
 * Данные посетителя подставляются структурно:
 *   путь  — encodeURIComponent; сегмент из точек — отказ (без выхода из пути);
 *   query — URLSearchParams;
 *   заголовок — без переводов строк;
 *   тело JSON — значением узла дерева (сериализация экранирует сама).
 */
import type { AuthConfig, FetchConfig, FetchResult } from '../../SecureDataSourceService'
import { HTTP_METHODS, timeoutOf, type KeyValueTemplate, type RequestSpec } from '../spec'
import {
  renderTemplate,
  renderTemplateString,
  renderTemplateText,
  templateIssues,
  valueAsText,
  type TemplateContext,
} from '../template'
import { RequestInputError, type Connector, type ConnectorResult, type PreparedRequest, type RetryHint, type SourceInfo } from './types'

export type RestSender = (config: FetchConfig, auth: AuthConfig | undefined) => Promise<FetchResult>

const HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
/** Заголовки, которые задаёт сам HTTP-клиент. */
const FORBIDDEN_HEADERS = new Set(['host', 'content-length', 'transfer-encoding', 'connection'])
const SECRET_HEADER_RE = /authorization|token|secret|api[-_]?key|password|cookie/i
const ABSOLUTE_RE = /^https?:\/\//i

/** Сегмент «.» / «..» (в том числе %2E) — URL-парсер понял бы его как переход по папкам. */
const DOT_SEGMENT_RE = /^(?:\.|%2e){1,2}$/i

function assertNoDotSegments(path: string): void {
  if (path.split('/').some((segment) => DOT_SEGMENT_RE.test(segment))) {
    throw new RequestInputError('Недопустимое значение в адресе: сегмент из точек')
  }
}

function stripLineBreaks(text: string): string {
  return text.replace(/[\r\n]+/g, ' ')
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) if (typeof v === 'string') out[key] = v
  return out
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Хост абсолютного пути: до первого «/» после «//». Ссылок в нём быть не должно. */
function absoluteHostPart(path: string): string {
  const afterScheme = path.replace(ABSOLUTE_RE, '')
  const slash = afterScheme.indexOf('/')
  return slash === -1 ? afterScheme : afterScheme.slice(0, slash)
}

/** Значения ключ-шаблон → пары; null/пусто пропускаются, массив — повтор ключа. */
function renderPairs(items: KeyValueTemplate[] | undefined, ctx: TemplateContext): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  for (const item of items ?? []) {
    const value = typeof item.value === 'string' ? renderTemplateString(item.value, ctx) : renderTemplate(item.value, ctx)
    if (value === null || value === undefined) continue
    for (const v of Array.isArray(value) ? value : [value]) pairs.push([item.key, valueAsText(v)])
  }
  return pairs
}

/** 'safe' — запрос точно не дошёл; 'unknown' — мог дойти; 'never' — повтор бессмыслен. */
export function classifyRestFailure(result: FetchResult): { status: number | null; retry: RetryHint } {
  const code = result.error?.code || ''
  const http = code.match(/^HTTP_(\d{3})$/)
  if (http) {
    const status = Number(http[1])
    if (status === 408 || status === 429) return { status, retry: 'safe' }
    if (status >= 500) return { status, retry: 'unknown' }
    return { status, retry: 'never' }
  }
  const message = result.error?.message || ''
  if (/заблокирован|Протокол не разрешён|Некорректный URL|лимит редиректов/i.test(message)) return { status: null, retry: 'never' }
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|разрешить хост|не разрешается/i.test(message)) return { status: null, retry: 'safe' }
  return { status: null, retry: 'unknown' }
}

export function createRestConnector(send: RestSender, now: () => number = Date.now): Connector {
  return {
    id: 'rest',
    sourceTypes: ['rest-api', 'rest'],

    validate(spec: RequestSpec, source: SourceInfo): string[] {
      const rest = spec.rest
      if (spec.connector !== 'rest' || !rest) return ['Запрос: нет настроек REST']
      const issues: string[] = []
      if (!HTTP_METHODS.includes(rest.method)) issues.push(`Запрос: метод ${rest.method} не поддерживается`)
      const path = typeof rest.path === 'string' ? rest.path : ''
      issues.push(...templateIssues(path).map((m) => `Путь: ${m}`))
      if (ABSOLUTE_RE.test(path)) {
        if (absoluteHostPart(path).includes('{{')) issues.push('Путь: адрес сервера не может зависеть от данных посетителя')
      } else if (!isHttpUrl(String(source.config.url ?? ''))) {
        issues.push('Запрос: у источника нет адреса http(s)')
      }
      for (const q of rest.query ?? []) {
        if (!q.key?.trim()) issues.push('Query: пустое имя параметра')
        issues.push(...templateIssues(q.value).map((m) => `Query «${q.key}»: ${m}`))
      }
      for (const h of rest.headers ?? []) {
        if (!HEADER_NAME_RE.test(h.key || '')) issues.push(`Заголовок: недопустимое имя «${h.key}»`)
        else if (FORBIDDEN_HEADERS.has(h.key.toLowerCase())) issues.push(`Заголовок «${h.key}» задаёт сам клиент`)
        if (typeof h.value !== 'string') issues.push(`Заголовок «${h.key}»: значение — строка`)
        else issues.push(...templateIssues(h.value).map((m) => `Заголовок «${h.key}»: ${m}`))
      }
      const body = rest.body ?? { format: 'none' }
      if (body.format === 'json') issues.push(...templateIssues(body.value).map((m) => `Тело: ${m}`))
      else if (body.format === 'form-urlencoded') {
        for (const f of body.fields ?? []) {
          if (!f.key?.trim()) issues.push('Тело: пустое имя поля')
          issues.push(...templateIssues(f.value).map((m) => `Тело «${f.key}»: ${m}`))
        }
      } else if (body.format !== 'none') issues.push('Тело: неизвестный формат')
      if (rest.method === 'GET' && body.format !== 'none') issues.push('Тело: у GET-запроса тела нет — данные передайте в query')
      return issues
    },

    prepare(spec: RequestSpec, ctx: TemplateContext, source: SourceInfo): PreparedRequest {
      const rest = spec.rest!
      const renderedPath = renderTemplateText(rest.path || '', ctx, encodeURIComponent)
      const q = renderedPath.indexOf('?')
      const pathPart = q === -1 ? renderedPath : renderedPath.slice(0, q)
      const inlineQuery = q === -1 ? '' : renderedPath.slice(q + 1)
      assertNoDotSegments(pathPart.replace(ABSOLUTE_RE, ''))
      const url = new URL(ABSOLUTE_RE.test(rest.path) ? pathPart : String(source.config.url))
      if (!ABSOLUTE_RE.test(rest.path) && pathPart) {
        url.pathname = `${url.pathname.replace(/\/+$/, '')}/${pathPart.replace(/^\/+/, '')}`
      }
      if (inlineQuery) new URLSearchParams(inlineQuery).forEach((v, k) => url.searchParams.append(k, v))
      for (const [k, v] of Object.entries(stringRecord(source.config.queryParams))) url.searchParams.append(k, v)
      for (const [k, v] of renderPairs(rest.query, ctx)) url.searchParams.append(k, v)

      const headers: Record<string, string> = { ...stringRecord(source.config.headers) }
      for (const h of rest.headers ?? []) {
        const value = renderTemplateText(h.value, ctx, stripLineBreaks).trim()
        if (value) headers[h.key] = stripLineBreaks(value)
      }

      const method = rest.method
      const body = rest.body ?? { format: 'none' as const }
      let preparedBody: PreparedRequest['body']
      if (method !== 'GET' && body.format === 'json') {
        preparedBody = { format: 'json', value: renderTemplate(body.value, ctx) }
        if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json'
      } else if (method !== 'GET' && body.format === 'form-urlencoded') {
        const params = new URLSearchParams()
        for (const [k, v] of renderPairs(body.fields, ctx)) params.append(k, v)
        preparedBody = { format: 'form-urlencoded', text: params.toString() }
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }

      return {
        connector: 'rest',
        method,
        url: url.toString(),
        headers,
        ...(preparedBody ? { body: preparedBody } : {}),
        timeoutMs: timeoutOf(spec),
        insecureTLS: source.config.insecureTLS === true,
      }
    },

    describe(prepared: PreparedRequest): PreparedRequest {
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(prepared.headers)) headers[k] = SECRET_HEADER_RE.test(k) ? '••••' : v
      return { ...prepared, headers }
    },

    async execute(prepared: PreparedRequest, auth: AuthConfig | undefined): Promise<ConnectorResult> {
      const started = now()
      const config: FetchConfig = {
        type: 'rest-api',
        url: prepared.url,
        method: prepared.method as FetchConfig['method'],
        headers: prepared.headers,
        timeout: prepared.timeoutMs,
        insecureTLS: prepared.insecureTLS,
        ...(prepared.body?.format === 'json' ? { body: prepared.body.value, bodyFormat: 'json' as const } : {}),
        ...(prepared.body?.format === 'form-urlencoded' ? { body: prepared.body.text, bodyFormat: 'raw' as const } : {}),
      }
      let result: FetchResult
      try {
        result = await send(config, auth)
      } catch (error) {
        result = { success: false, error: { code: 'SEND_ERROR', message: error instanceof Error ? error.message : String(error) } }
      }
      const durationMs = now() - started
      if (result.success) {
        return { ok: true, status: result.metadata?.statusCode ?? null, data: result.data, retry: 'never', durationMs }
      }
      const { status, retry } = classifyRestFailure(result)
      const details = (result.error?.code || '').startsWith('HTTP_') ? result.error?.details : undefined
      return {
        ok: false,
        status,
        retry,
        durationMs,
        error: {
          code: result.error?.code || 'SEND_FAILED',
          message: [result.error?.message, details].filter(Boolean).join(' — ') || 'unknown error',
        },
      }
    },
  }
}

