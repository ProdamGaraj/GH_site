/**
 * Каталог языка: что видно на сайте (коллекция CMS, статичные карточки) и
 * что отдаёт публичная лента — только выкаченное, иначе карточка вела бы на 404.
 */
import { NewsSnapshot, availableNews, cardsIn, detailBySlug, detailsIn, feedEntries } from '../services/catalog'
import { NewsRow, TrRow } from '../services/news'
import { dictionaries, fullTranslation, newsRow } from './helpers/newsFixtures'

function snapshotOf(news: NewsRow[], translations: TrRow[] = [], deployed: Record<string, string[]> = {}): NewsSnapshot {
  const byNews = new Map<string, TrRow[]>()
  for (const t of translations) byNews.set(t.newsId, [...(byNews.get(t.newsId) ?? []), t])
  return {
    news,
    translations: byNews,
    dict: dictionaries(),
    deployed: new Map(Object.entries(deployed).map(([locale, ids]) => [locale, new Set(ids)])),
  }
}

const older = newsRow({ slug: 'older', publishedAt: new Date('2026-08-01'), publishOn: ['uz'] })
const newer = newsRow({ slug: 'newer', publishedAt: new Date('2026-09-01') })
const draft = newsRow({ slug: 'draft', status: 'draft' })
const S = snapshotOf([older, draft, newer], fullTranslation(older, 'uz'), { ru: [older.id, draft.id], uz: [older.id] })

describe('видимое на языке', () => {
  it('ru: опубликованные от новых к старым, без черновиков', () => {
    expect(availableNews(S, 'ru').map((n) => n.slug)).toEqual(['newer', 'older'])
  })

  it('uz: только отмеченные и переведённые', () => {
    expect(availableNews(S, 'uz').map((n) => n.slug)).toEqual(['older'])
    expect(availableNews(S, 'en')).toEqual([])
  })

  it('карточки и страницы с ограничением количества (главная — последние N)', () => {
    expect(cardsIn(S, 'ru', 1).map((c) => c.slug)).toEqual(['newer'])
    expect(detailsIn(S, 'ru').map((d) => d.slug)).toEqual(['newer', 'older'])
  })

  it('страница по адресу — только если видна на языке', () => {
    expect(detailBySlug(S, 'uz', 'older')?.title).toBe('UZ заголовок')
    expect(detailBySlug(S, 'uz', 'newer')).toBeNull()
    expect(detailBySlug(S, 'ru', 'draft')).toBeNull()
  })
})

describe('публичная лента', () => {
  it('только видимое И выкаченное на этом языке', () => {
    // newer опубликована, но ещё не выкачена; draft выкачена раньше, но снята.
    expect(feedEntries(S, 'ru').map((e) => e.card.slug)).toEqual(['older'])
    expect(feedEntries(S, 'uz').map((e) => e.card.slug)).toEqual(['older'])
    expect(feedEntries(S, 'en')).toEqual([])
  })

  it('текст для поиска нормализован, на языке ленты', () => {
    const [ru] = feedEntries(S, 'ru')
    const [uz] = feedEntries(S, 'uz')
    expect(ru.title).toBe('заголовок')
    expect(uz.title).toBe('uz заголовок')
    expect(uz.body).toContain('uz анонс')
  })
})
