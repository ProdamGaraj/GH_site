/** Языки сайта: база ru, переводы uz/en (общие для админок estate и новостей). */
export type Locale = 'ru' | 'uz' | 'en'
export const LOCALES: Locale[] = ['ru', 'uz', 'en']
export const LOCALE_LABELS: Record<Locale, string> = { ru: 'RU', uz: 'UZ', en: 'EN' }
