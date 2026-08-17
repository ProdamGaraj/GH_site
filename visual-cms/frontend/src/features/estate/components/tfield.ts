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
