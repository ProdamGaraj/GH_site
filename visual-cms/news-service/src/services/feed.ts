/**
 * Публичная лента новостей: бесконечная подгрузка, поиск и фильтры.
 *
 * Первые карточки страница /news получает статично (деплой CMS), дальше
 * браузер просит порции здесь. Отбор:
 *  - рубрика (бейдж карточки);
 *  - теги: «с любым из выбранных» (any) или «со всеми сразу» (all); при 2+
 *    тегах ответ несёт число найденных в обоих режимах — подсказка у
 *    переключателя;
 *  - период: с — по, включительно, дни по Ташкенту (быстрые периоды, месяц и
 *    свои даты фронт сводит к from/to);
 *  - поиск: каждое слово запроса должно найтись. Сначала новости, где все
 *    слова в заголовке, потом — где только в тексте; внутри групп — от новых
 *    к старым.
 *
 * Чистые функции: на вход — карточки языка, уже отсортированные от новых к
 * старым, и запрос; на выход — страница ленты.
 */
import type { DictionaryRow, Dictionaries, Locale, NewsCardDTO } from './news'
import { dictionaryName } from './news'

export type TagMode = 'any' | 'all'

export interface FeedQuery {
  q: string
  category: string
  tags: string[]
  tagMode: TagMode
  /** YYYY-MM-DD включительно; пусто — без границы. */
  from: string
  to: string
  offset: number
  limit: number
}

export interface FeedEntry {
  card: NewsCardDTO
  /** Нормализованный заголовок (normalizeSearch). */
  title: string
  /** Нормализованный текст: анонс и секции. */
  body: string
}

export interface FeedPage {
  items: NewsCardDTO[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
  /** При 2+ выбранных тегах: сколько найдётся в каждом режиме. */
  tagModeTotals: { any: number; all: number } | null
}

export const FEED_PAGE_DEFAULT = 12
export const FEED_PAGE_MAX = 48
const QUERY_MAX_LENGTH = 100
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const KEY_RE = /^[a-z0-9_-]{1,40}$/

/** Регистр, ё/е и апострофы узбекской латиницы не мешают поиску. */
export function normalizeSearch(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/['‘’ʻʼ`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : ''
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(str(value), 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function day(value: unknown): string {
  const v = str(value).trim()
  return DAY_RE.test(v) && !Number.isNaN(Date.parse(v)) ? v : ''
}

/** Параметры запроса → FeedQuery. Мусор отбрасывается, а не роняет запрос. */
export function parseFeedQuery(raw: Record<string, unknown>): FeedQuery {
  const category = str(raw.category).trim()
  return {
    q: str(raw.q).trim().slice(0, QUERY_MAX_LENGTH),
    category: KEY_RE.test(category) ? category : '',
    tags: [...new Set(str(raw.tags).split(',').map((t) => t.trim()).filter((t) => KEY_RE.test(t)))],
    tagMode: str(raw.tagMode) === 'all' ? 'all' : 'any',
    from: day(raw.from),
    to: day(raw.to),
    offset: int(raw.offset, 0, 0, 100000),
    limit: int(raw.limit, FEED_PAGE_DEFAULT, 1, FEED_PAGE_MAX),
  }
}

function hasTags(card: NewsCardDTO, tags: readonly string[], mode: TagMode): boolean {
  if (tags.length === 0) return true
  const own = new Set(card.tags.map((t) => t.key))
  return mode === 'all' ? tags.every((t) => own.has(t)) : tags.some((t) => own.has(t))
}

function matchesBase(entry: FeedEntry, query: FeedQuery): boolean {
  const { card } = entry
  if (query.category && card.categoryKey !== query.category) return false
  if (query.from && card.date < query.from) return false
  if (query.to && card.date > query.to) return false
  return true
}

/** Отбор по поиску с порядком «сначала заголовок». */
function searchOrdered(entries: FeedEntry[], q: string): FeedEntry[] {
  const words = normalizeSearch(q).split(' ').filter(Boolean)
  if (words.length === 0) return entries
  const inTitle: FeedEntry[] = []
  const inBody: FeedEntry[] = []
  for (const entry of entries) {
    if (words.every((w) => entry.title.includes(w))) inTitle.push(entry)
    else if (words.every((w) => entry.title.includes(w) || entry.body.includes(w))) inBody.push(entry)
  }
  return [...inTitle, ...inBody]
}

export function runFeed(entries: readonly FeedEntry[], query: FeedQuery): FeedPage {
  const base = searchOrdered(entries.filter((e) => matchesBase(e, query)), query.q)
  const matched = base.filter((e) => hasTags(e.card, query.tags, query.tagMode))
  const tagModeTotals =
    query.tags.length >= 2
      ? {
          any: base.filter((e) => hasTags(e.card, query.tags, 'any')).length,
          all: base.filter((e) => hasTags(e.card, query.tags, 'all')).length,
        }
      : null
  const items = matched.slice(query.offset, query.offset + query.limit).map((e) => e.card)
  return {
    items,
    total: matched.length,
    offset: query.offset,
    limit: query.limit,
    hasMore: query.offset + items.length < matched.length,
    tagModeTotals,
  }
}

export interface FacetDTO {
  key: string
  name: string
  count: number
}

export interface FeedFacets {
  total: number
  categories: FacetDTO[]
  tags: FacetDTO[]
  /** Месяцы, в которых есть новости, от новых: { month: 'YYYY-MM', count }. */
  months: Array<{ month: string; count: number }>
  /** Самый ранний и поздний день — границы календаря «Свои даты». */
  firstDate: string
  lastDate: string
}

function facetList(rows: ReadonlyMap<string, DictionaryRow>, counts: Map<string, number>, locale: Locale): FacetDTO[] {
  return [...rows.values()]
    .filter((row) => !row.hidden && (counts.get(row.key) ?? 0) > 0)
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
    .map((row) => ({ key: row.key, name: dictionaryName(row, locale), count: counts.get(row.key) ?? 0 }))
}

/** Варианты фильтров ленты: только то, по чему что-то найдётся. */
export function buildFacets(entries: readonly FeedEntry[], dict: Dictionaries, locale: Locale): FeedFacets {
  const categories = new Map<string, number>()
  const tags = new Map<string, number>()
  const months = new Map<string, number>()
  for (const { card } of entries) {
    if (card.categoryKey) categories.set(card.categoryKey, (categories.get(card.categoryKey) ?? 0) + 1)
    for (const tag of card.tags) tags.set(tag.key, (tags.get(tag.key) ?? 0) + 1)
    const month = card.date.slice(0, 7)
    months.set(month, (months.get(month) ?? 0) + 1)
  }
  const days = entries.map((e) => e.card.date).sort()
  return {
    total: entries.length,
    categories: facetList(dict.categories, categories, locale),
    tags: facetList(dict.tags, tags, locale),
    months: [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, count]) => ({ month, count })),
    firstDate: days[0] ?? '',
    lastDate: days[days.length - 1] ?? '',
  }
}
