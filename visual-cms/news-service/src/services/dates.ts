import type { Locale } from './news'

/**
 * Дата новости подписью на языке страницы. Месяцы своими таблицами, а не
 * через Intl: узбекская локаль в сборках Node бывает неполной, а подпись на
 * сайте должна быть одинаковой везде. Время не показываем; день — по Ташкенту
 * (UTC+5, без перехода на летнее время), иначе новость, опубликованная в
 * 02:00 по Ташкенту, получила бы вчерашнюю дату.
 */
const MONTHS: Record<Locale, string[]> = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000

/** Календарный день по Ташкенту: { year, month (1..12), day }. */
export function tashkentDay(date: Date): { year: number; month: number; day: number } {
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS)
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() }
}

/** `YYYY-MM-DD` по Ташкенту — для фильтров по датам и data-атрибутов. */
export function isoDay(date: Date): string {
  const { year, month, day } = tashkentDay(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function dateLabel(date: Date, locale: Locale): string {
  const { year, month, day } = tashkentDay(date)
  const name = MONTHS[locale][month - 1]
  if (locale === 'en') return `${name} ${day}, ${year}`
  if (locale === 'uz') return `${day}-${name}, ${year}`
  return `${day} ${name} ${year}`
}
