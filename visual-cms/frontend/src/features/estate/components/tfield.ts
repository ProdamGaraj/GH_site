import type { Locale } from '../types'

/**
 * Хелперы редактирования переводимых полей на рабочей копии сущности.
 * ru пишет в базовое поле; uz/en — в form.translations[locale][field].
 * Значение uz/en, если оверрайда нет — undefined (в UI показываем пусто,
 * базовое ru идёт как placeholder-подсказка).
 */
export function getT<T extends { translations?: any }>(form: T, field: string, locale: Locale): unknown {
  if (locale === 'ru') return (form as any)[field]
  return form.translations?.[locale]?.[field]
}

export function setT<T extends { translations?: any }>(
  form: T,
  field: string,
  locale: Locale,
  value: unknown
): T {
  if (locale === 'ru') return { ...form, [field]: value }
  const loc = { ...(form.translations?.[locale] || {}), [field]: value }
  return { ...form, translations: { ...(form.translations || {}), [locale]: loc } }
}

export const isRu = (l: Locale) => l === 'ru'

/**
 * Словарь перевода «значение ru → перевод» (виды из окна): новая копия с одной
 * правкой. Пустой перевод удаляет ключ — на сайте останется ru. Пустой словарь
 * возвращается как undefined, чтобы не сохранять строку перевода «{}».
 */
export function setLabel(
  labels: Record<string, string> | undefined | null,
  key: string,
  text: string
): Record<string, string> | undefined {
  const next: Record<string, string> = { ...(labels || {}) }
  const value = text.trim()
  if (value) next[key] = value
  else delete next[key]
  return Object.keys(next).length > 0 ? next : undefined
}
