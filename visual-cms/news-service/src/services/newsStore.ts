/**
 * Снимок базы новостей в памяти.
 *
 * Новостей — сотни, а читают их часто (публичная лента на каждой прокрутке),
 * поэтому сервис держит один снимок: новости, переводы, словари и что
 * выкачено. Любая запись (админка, отчёт CMS о деплое) сбрасывает снимок —
 * следующее чтение соберёт новый. Сервис — один процесс, поэтому сброса в
 * памяти достаточно. Записи ленты по языкам тоже кэшируются до сброса.
 */
import { AppDataSource } from '../config/database'
import { News } from '../models/News'
import { NewsCategory, NewsTag } from '../models/NewsDictionary'
import { NewsDeployment } from '../models/NewsDeployment'
import { NewsTranslation } from '../models/NewsTranslation'
import { FeedEntry } from './feed'
import { NewsSnapshot, feedEntries } from './catalog'
import { DictionaryRow, Locale, NewsRow, TrRow } from './news'

let current: Promise<NewsSnapshot> | null = null
const feedCache = new Map<Locale, FeedEntry[]>()

async function load(): Promise<NewsSnapshot> {
  const [news, translations, categories, tags, deployments] = await Promise.all([
    AppDataSource.getRepository(News).find(),
    AppDataSource.getRepository(NewsTranslation).find(),
    AppDataSource.getRepository(NewsCategory).find(),
    AppDataSource.getRepository(NewsTag).find(),
    AppDataSource.getRepository(NewsDeployment).find(),
  ])
  const byNews = new Map<string, TrRow[]>()
  for (const t of translations) {
    const list = byNews.get(t.newsId) ?? []
    list.push({ newsId: t.newsId, locale: t.locale, field: t.field, value: t.value })
    byNews.set(t.newsId, list)
  }
  const deployed = new Map<string, Set<string>>()
  for (const d of deployments) {
    const set = deployed.get(d.locale) ?? new Set<string>()
    set.add(d.newsId)
    deployed.set(d.locale, set)
  }
  const dictionary = (rows: DictionaryRow[]) => new Map(rows.map((r) => [r.key, r]))
  return {
    news: news as NewsRow[],
    translations: byNews,
    dict: { categories: dictionary(categories), tags: dictionary(tags) },
    deployed,
  }
}

export function snapshot(): Promise<NewsSnapshot> {
  if (!current) {
    current = load().catch((err) => {
      current = null
      throw err
    })
  }
  return current
}

/** Сбросить снимок после записи. */
export function invalidateNews(): void {
  current = null
  feedCache.clear()
}

export async function feedEntriesCached(locale: Locale): Promise<FeedEntry[]> {
  const s = await snapshot()
  const cached = feedCache.get(locale)
  if (cached) return cached
  const entries = feedEntries(s, locale)
  // Снимок мог смениться, пока строились записи — кэшируем только актуальные.
  if (current && (await current) === s) feedCache.set(locale, entries)
  return entries
}
