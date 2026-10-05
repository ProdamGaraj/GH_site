/**
 * Каталог новостей языка поверх снимка базы: что видно на сайте, что уже
 * выкачено и записи публичной ленты. Чистые функции — снимок собирает
 * newsStore.ts.
 */
import { FeedEntry, normalizeSearch } from './feed'
import {
  Dictionaries,
  Locale,
  NewsCardDTO,
  NewsDetailDTO,
  NewsRow,
  TrRow,
  buildCard,
  buildDetail,
  byNewest,
  isAvailableIn,
  searchText,
} from './news'

export interface NewsSnapshot {
  news: NewsRow[]
  /** Переводы по id новости. */
  translations: ReadonlyMap<string, TrRow[]>
  dict: Dictionaries
  /** Язык → id выкаченных новостей. */
  deployed: ReadonlyMap<string, ReadonlySet<string>>
}

const trOf = (s: NewsSnapshot, news: NewsRow) => s.translations.get(news.id) ?? []

/** Новости, видимые на языке, от новых к старым. */
export function availableNews(s: NewsSnapshot, locale: Locale): NewsRow[] {
  return s.news.filter((n) => isAvailableIn(n, trOf(s, n), locale)).sort(byNewest)
}

export function cardsIn(s: NewsSnapshot, locale: Locale, limit?: number): NewsCardDTO[] {
  const list = availableNews(s, locale)
  return (limit ? list.slice(0, limit) : list).map((n) => buildCard(n, trOf(s, n), locale, s.dict))
}

export function detailsIn(s: NewsSnapshot, locale: Locale, limit?: number): NewsDetailDTO[] {
  const list = availableNews(s, locale)
  return (limit ? list.slice(0, limit) : list).map((n) => buildDetail(n, trOf(s, n), locale, s.dict))
}

export function detailBySlug(s: NewsSnapshot, locale: Locale, slug: string): NewsDetailDTO | null {
  const news = availableNews(s, locale).find((n) => n.slug === slug)
  return news ? buildDetail(news, trOf(s, news), locale, s.dict) : null
}

/**
 * Записи публичной ленты: видимые на языке И уже выкаченные на сайт на этом
 * языке. Опубликованная, но ещё не выкаченная новость вела бы на 404.
 */
export function feedEntries(s: NewsSnapshot, locale: Locale): FeedEntry[] {
  const deployed = s.deployed.get(locale) ?? new Set<string>()
  return availableNews(s, locale)
    .filter((n) => deployed.has(n.id))
    .map((n) => {
      const text = searchText(n, trOf(s, n), locale)
      return {
        card: buildCard(n, trOf(s, n), locale, s.dict),
        title: normalizeSearch(text.title),
        body: normalizeSearch(text.body),
      }
    })
}
