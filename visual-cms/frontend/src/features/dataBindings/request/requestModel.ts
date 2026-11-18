/**
 * Логика редактора запроса привязки без React: значения по умолчанию,
 * список ссылок для подсказки, вставка ссылки, тело JSON ↔ текст.
 */
import type { KeyValueTemplate, RequestSpec, ResponseSpec, RestBody, RestRequestSpec } from '@/shared/types/requestSpec'

/** Новая привязка: POST к адресу источника, тело — вся форма, странице — только статус. */
export function defaultRequestSpec(): RequestSpec {
  return {
    version: 1,
    connector: 'rest',
    rest: { method: 'POST', path: '', body: { format: 'json', value: '{{form}}' } },
    response: { expose: 'status' },
  }
}

export function restOf(spec: RequestSpec): RestRequestSpec {
  return spec.rest ?? { method: 'POST', path: '', body: { format: 'none' } }
}

export function withRest(spec: RequestSpec, patch: Partial<RestRequestSpec>): RequestSpec {
  const rest = { ...restOf(spec), ...patch }
  // У GET тела нет: при смене метода на GET тело убирается.
  if (rest.method === 'GET') rest.body = { format: 'none' }
  return { ...spec, rest }
}

export function withResponse(spec: RequestSpec, patch: Partial<ResponseSpec>): RequestSpec {
  return { ...spec, response: { ...(spec.response ?? { expose: 'status' }), ...patch } }
}

export interface RefGroup {
  title: string
  refs: Array<{ ref: string; hint: string }>
}

/** Ссылки для подсказки: поля формы блока + данные страницы, визита, сервера. */
export function refGroups(formFieldNames: string[]): RefGroup[] {
  return [
    {
      title: 'Форма',
      refs: [
        ...formFieldNames.map((name) => ({ ref: `form.${name}`, hint: `поле «${name}»` })),
        { ref: 'form', hint: 'все поля объектом' },
      ],
    },
    {
      title: 'Страница и визит',
      refs: [
        { ref: 'page.path', hint: 'адрес страницы' },
        { ref: 'page.lang', hint: 'язык' },
        { ref: 'page.title', hint: 'заголовок' },
        { ref: 'visitor.referrer', hint: 'откуда пришёл' },
        { ref: 'visitor.utm.source', hint: 'utm_source' },
        { ref: 'visitor.utm.campaign', hint: 'utm_campaign' },
      ],
    },
    {
      title: 'Сервер',
      refs: [
        { ref: 'request.domain', hint: 'домен сайта' },
        { ref: 'request.ip', hint: 'IP посетителя' },
        { ref: 'now', hint: 'дата и время (ISO)' },
        { ref: 'now.date', hint: 'дата ГГГГ-ММ-ДД' },
      ],
    },
  ]
}

export const TEMPLATE_FILTERS = ['digits', 'trim', 'number', 'bool', 'lower', 'upper', 'json', 'default:"…"'] as const

/** Вставить текст вместо выделения; вернуть новое значение и позицию курсора. */
export function insertAt(value: string, start: number, end: number, text: string): { value: string; cursor: number } {
  const s = Math.max(0, Math.min(start, value.length))
  const e = Math.max(s, Math.min(end, value.length))
  return { value: value.slice(0, s) + text + value.slice(e), cursor: s + text.length }
}

/** Тело JSON → текст для редактора. Строка-шаблон целиком тоже валидный JSON. */
export function bodyToText(body: RestBody | undefined): string {
  if (!body || body.format !== 'json') return ''
  return JSON.stringify(body.value, null, 2)
}

/** Текст редактора → значение тела; ошибка — текстом для подсказки. */
export function parseBodyText(text: string): { value: unknown } | { error: string } {
  if (!text.trim()) return { value: {} }
  try {
    return { value: JSON.parse(text) }
  } catch (error) {
    return { error: `JSON: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/** Значение пары ключ-шаблон для поля ввода (не-строки — JSON). */
export function pairValueText(item: KeyValueTemplate): string {
  return typeof item.value === 'string' ? item.value : JSON.stringify(item.value)
}

/** Примерные значения формы для превью/теста: «пример» в каждом поле. */
export function sampleFormData(formFieldNames: string[]): Record<string, string> {
  return Object.fromEntries(formFieldNames.map((name) => [name, 'пример']))
}
