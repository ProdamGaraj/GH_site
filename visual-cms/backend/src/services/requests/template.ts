/**
 * TemplateEngine — шаблоны запросов привязок (docs/request-pipeline-architecture.md, 3.2).
 *
 * Шаблон — JSON-дерево. Строковые листья могут ссылаться на данные:
 *   "{{form.phone}}"            — лист целиком ссылка → значение С ТИПОМ
 *                                 (число, массив, объект остаются собой);
 *   "Имя: {{form.name}}"        — ссылка внутри текста → строка;
 *   "{{form.phone | digits}}"   — фильтры через «|».
 * Ключи объектов не шаблонизируются: посетитель не может добавить поле.
 *
 * Никакого выполнения кода: свой маленький парсер, фиксированный список
 * фильтров, ссылки — только пути по контексту.
 */

/** Пространства имён ссылок. */
export const TEMPLATE_NAMESPACES = ['form', 'page', 'visitor', 'request', 'now'] as const
export type TemplateNamespace = (typeof TEMPLATE_NAMESPACES)[number]

/** Контекст подстановки (см. context.ts). */
export interface TemplateContext {
  form: Record<string, unknown>
  page: Record<string, unknown>
  visitor: Record<string, unknown>
  request: Record<string, unknown>
  /** Момент отправки; `{{now}}` — ISO, `{{now.date}}` — YYYY-MM-DD, `{{now.unix}}` — секунды. */
  now: Date
}

export interface TemplateFilter {
  name: string
  arg?: string | number
}

export interface TemplateRef {
  /** Как написано: 'form.phone'. */
  path: string
  namespace: string
  /** Путь внутри пространства: ['phone']. */
  segments: string[]
  filters: TemplateFilter[]
}

/** Кусок строки-шаблона: текст или ссылка. */
export type TemplatePart = { text: string } | { ref: TemplateRef }

export class TemplateSyntaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemplateSyntaxError'
  }
}

const FILTERS = ['default', 'trim', 'digits', 'number', 'bool', 'lower', 'upper', 'json'] as const
const FILTERS_WITH_ARG = new Set(['default'])
const PATH_RE = /^[A-Za-z_][\w-]*(?:\.[\w-]+)*$/
const FILTER_RE = /^([a-z]+)(?:\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(-?\d+(?:\.\d+)?)))?$/

function parseFilter(raw: string): TemplateFilter {
  const m = raw.trim().match(FILTER_RE)
  if (!m) throw new TemplateSyntaxError(`Непонятный фильтр «${raw.trim()}»`)
  const [, name, dq, sq, num] = m
  if (!(FILTERS as readonly string[]).includes(name)) throw new TemplateSyntaxError(`Нет фильтра «${name}»`)
  const hasArg = dq !== undefined || sq !== undefined || num !== undefined
  if (hasArg && !FILTERS_WITH_ARG.has(name)) throw new TemplateSyntaxError(`Фильтр «${name}» без параметра`)
  if (!hasArg && FILTERS_WITH_ARG.has(name)) throw new TemplateSyntaxError(`Фильтру «${name}» нужен параметр: ${name}:"…"`)
  if (!hasArg) return { name }
  const arg = num !== undefined ? Number(num) : (dq ?? sq ?? '').replace(/\\(.)/g, '$1')
  return { name, arg }
}

/** «|» вне кавычек разделяет путь и фильтры. */
function splitPipes(inner: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote: string | null = null
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (quote) {
      current += ch
      if (ch === '\\' && i + 1 < inner.length) current += inner[++i]
      else if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
    } else if (ch === '|') {
      parts.push(current)
      current = ''
    } else current += ch
  }
  parts.push(current)
  return parts
}

function parseRef(inner: string): TemplateRef {
  const [pathRaw, ...filterRaws] = splitPipes(inner)
  const path = pathRaw.trim()
  if (!PATH_RE.test(path)) throw new TemplateSyntaxError(`Непонятная ссылка «${path}»`)
  const [namespace, ...segments] = path.split('.')
  if (!(TEMPLATE_NAMESPACES as readonly string[]).includes(namespace)) {
    throw new TemplateSyntaxError(`Нет данных «${namespace}» — доступны: ${TEMPLATE_NAMESPACES.join(', ')}`)
  }
  return { path, namespace, segments, filters: filterRaws.map(parseFilter) }
}

/**
 * Разобрать строку на текст и ссылки. Кавычки внутри параметра фильтра могут
 * содержать «}}» — поэтому разбор посимвольный, а не регуляркой по всей строке.
 */
export function parseTemplateString(template: string): TemplatePart[] {
  const parts: TemplatePart[] = []
  let i = 0
  let text = ''
  while (i < template.length) {
    if (template.startsWith('{{', i)) {
      let j = i + 2
      let quote: string | null = null
      while (j < template.length) {
        const ch = template[j]
        if (quote) {
          if (ch === '\\') j++
          else if (ch === quote) quote = null
        } else if (ch === '"' || ch === "'") quote = ch
        else if (template.startsWith('}}', j)) break
        j++
      }
      if (j >= template.length) throw new TemplateSyntaxError('Незакрытая ссылка «{{»')
      if (text) parts.push({ text })
      text = ''
      parts.push({ ref: parseRef(template.slice(i + 2, j)) })
      i = j + 2
    } else {
      text += template[i]
      i++
    }
  }
  if (text) parts.push({ text })
  return parts
}

/** Все ссылки шаблона (для проверки и подсказок редактора). */
export function templateRefs(template: unknown): TemplateRef[] {
  const out: TemplateRef[] = []
  walkStrings(template, (s) => {
    for (const part of parseTemplateString(s)) if ('ref' in part) out.push(part.ref)
  })
  return out
}

/** Ошибки разбора всех строк шаблона; пусто — шаблон корректен. */
export function templateIssues(template: unknown): string[] {
  const issues: string[] = []
  walkStrings(template, (s) => {
    try {
      parseTemplateString(s)
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error))
    }
  })
  return issues
}

function walkStrings(value: unknown, visit: (s: string) => void): void {
  if (typeof value === 'string') visit(value)
  else if (Array.isArray(value)) value.forEach((v) => walkStrings(v, visit))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => walkStrings(v, visit))
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

function resolveNow(now: Date, segments: string[]): unknown {
  if (segments.length === 0) return now.toISOString()
  if (segments.length === 1 && segments[0] === 'date') return now.toISOString().slice(0, 10)
  if (segments.length === 1 && segments[0] === 'unix') return Math.floor(now.getTime() / 1000)
  return undefined
}

function getPath(root: unknown, segments: string[]): unknown {
  let current = root
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current) && /^\d+$/.test(segment)) current = current[Number(segment)]
    else if (typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = (current as Record<string, unknown>)[segment]
    } else return undefined
  }
  return current
}

function applyFilter(value: unknown, filter: TemplateFilter): unknown {
  switch (filter.name) {
    case 'default':
      return isMissing(value) ? filter.arg : value
    case 'trim':
      return typeof value === 'string' ? value.trim() : value
    case 'digits':
      return isMissing(value) ? value : String(value).replace(/\D/g, '')
    case 'number': {
      if (isMissing(value)) return null
      const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    case 'bool':
      if (typeof value === 'boolean') return value
      return ['true', '1', 'on', 'yes', 'да'].includes(String(value ?? '').trim().toLowerCase())
    case 'lower':
      return typeof value === 'string' ? value.toLowerCase() : value
    case 'upper':
      return typeof value === 'string' ? value.toUpperCase() : value
    case 'json':
      return JSON.stringify(value ?? null)
    default:
      throw new TemplateSyntaxError(`Нет фильтра «${filter.name}»`)
  }
}

/** Значение ссылки с фильтрами (undefined — данных нет). */
export function resolveRef(ref: TemplateRef, ctx: TemplateContext): unknown {
  let value: unknown =
    ref.namespace === 'now'
      ? resolveNow(ctx.now, ref.segments)
      : getPath(ctx[ref.namespace as Exclude<TemplateNamespace, 'now'>], ref.segments)
  for (const filter of ref.filters) value = applyFilter(value, filter)
  return value
}

/** Значение как текст для подстановки внутрь строки. */
export function valueAsText(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Строка-шаблон → значение. Строка целиком из одной ссылки — значение с типом
 * (отсутствующее — null); иначе — текст, каждая ссылка через `encode`
 * (по умолчанию — как есть: для тела JSON экранирование делает сериализация).
 */
export function renderTemplateString(
  template: string,
  ctx: TemplateContext,
  encode: (text: string) => string = (t) => t
): unknown {
  const parts = parseTemplateString(template)
  if (parts.length === 1 && 'ref' in parts[0]) {
    const value = resolveRef(parts[0].ref, ctx)
    return value === undefined ? null : value
  }
  return parts.map((part) => ('ref' in part ? encode(valueAsText(resolveRef(part.ref, ctx))) : part.text)).join('')
}

/** Строка-шаблон → всегда текст (путь URL, заголовок). */
export function renderTemplateText(
  template: string,
  ctx: TemplateContext,
  encode: (text: string) => string = (t) => t
): string {
  return parseTemplateString(template)
    .map((part) => ('ref' in part ? encode(valueAsText(resolveRef(part.ref, ctx))) : part.text))
    .join('')
}

/** JSON-дерево шаблона → JSON-дерево значений. */
export function renderTemplate(template: unknown, ctx: TemplateContext): unknown {
  if (typeof template === 'string') return renderTemplateString(template, ctx)
  if (Array.isArray(template)) return template.map((item) => renderTemplate(item, ctx))
  if (template && typeof template === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(template)) out[key] = renderTemplate(value, ctx)
    return out
  }
  return template
}
