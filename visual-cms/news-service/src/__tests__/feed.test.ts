/**
 * Публичная лента: фильтры, теги any/all с подсказкой, поиск «сначала
 * заголовок», подгрузка порциями и варианты фильтров.
 */
import { FeedEntry, buildFacets, normalizeSearch, parseFeedQuery, runFeed } from '../services/feed'
import { buildCard } from '../services/news'
import { dictionaries, newsRow } from './helpers/newsFixtures'

const dict = dictionaries()

function entry(overrides: Parameters<typeof newsRow>[0] & { body?: string }): FeedEntry {
  const { body = '', ...rest } = overrides
  const news = newsRow(rest)
  return { card: buildCard(news, [], 'ru', dict), title: normalizeSearch(news.title), body: normalizeSearch(body) }
}

// Отсортированы от новых к старым, как отдаёт каталог.
const ENTRIES: FeedEntry[] = [
  entry({ slug: 'a', title: 'Ипотека от банка-партнёра', publishedAt: new Date('2026-10-03T06:00:00Z'), categoryKey: 'promo', tagKeys: ['mortgage', 'installment'] }),
  entry({ slug: 'b', title: 'Новый этап строительства', publishedAt: new Date('2026-09-20T06:00:00Z'), categoryKey: 'news', tagKeys: ['harizma'], body: 'Подъезды и ипотека для жителей Harizma' }),
  entry({ slug: 'c', title: 'Рассрочка без переплат', publishedAt: new Date('2026-09-01T06:00:00Z'), categoryKey: 'promo', tagKeys: ['installment'] }),
  entry({ slug: 'd', title: 'Ёлка во дворе', publishedAt: new Date('2025-12-25T06:00:00Z'), categoryKey: 'news', tagKeys: ['harizma', 'old'] }),
]

const slugs = (page: { items: Array<{ slug: string }> }) => page.items.map((i) => i.slug)
const run = (raw: Record<string, unknown>) => runFeed(ENTRIES, parseFeedQuery(raw))

describe('parseFeedQuery', () => {
  it('значения по умолчанию', () => {
    expect(parseFeedQuery({})).toEqual({ q: '', category: '', tags: [], tagMode: 'any', from: '', to: '', offset: 0, limit: 12 })
  })

  it('мусор отбрасывается, лимиты зажимаются', () => {
    expect(
      parseFeedQuery({
        q: 'x'.repeat(500),
        category: 'DROP TABLE',
        tags: 'mortgage,,bad tag,mortgage,harizma',
        tagMode: 'weird',
        from: '2026-13-45',
        to: 'yesterday',
        offset: '-5',
        limit: '1000',
      })
    ).toEqual({ q: 'x'.repeat(100), category: '', tags: ['mortgage', 'harizma'], tagMode: 'any', from: '', to: '', offset: 0, limit: 48 })
  })

  it('массив параметра (?tags=a&tags=b) — берётся первый', () => {
    expect(parseFeedQuery({ tags: ['mortgage', 'harizma'] }).tags).toEqual(['mortgage'])
  })
})

describe('runFeed', () => {
  it('без фильтров — всё от новых к старым', () => {
    expect(slugs(run({}))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('рубрика', () => {
    expect(slugs(run({ category: 'promo' }))).toEqual(['a', 'c'])
  })

  it('период включительно, по дням', () => {
    expect(slugs(run({ from: '2026-09-01', to: '2026-09-20' }))).toEqual(['b', 'c'])
    expect(slugs(run({ to: '2025-12-31' }))).toEqual(['d'])
  })

  it('теги: любой из выбранных / все сразу; при 2+ тегах — числа обоих режимов', () => {
    const any = run({ tags: 'installment,harizma' })
    expect(slugs(any)).toEqual(['a', 'b', 'c', 'd'])
    expect(any.tagModeTotals).toEqual({ any: 4, all: 0 })
    const all = run({ tags: 'mortgage,installment', tagMode: 'all' })
    expect(slugs(all)).toEqual(['a'])
    expect(all.tagModeTotals).toEqual({ any: 2, all: 1 })
    expect(run({ tags: 'harizma' }).tagModeTotals).toBeNull()
  })

  it('поиск: сначала совпадения в заголовке, потом в тексте; внутри — по дате', () => {
    expect(slugs(run({ q: 'ипотека' }))).toEqual(['a', 'b'])
    expect(slugs(run({ q: 'ИПОТЕКА' }))).toEqual(['a', 'b'])
  })

  it('поиск: каждое слово должно найтись (в заголовке или тексте)', () => {
    expect(slugs(run({ q: 'ипотека harizma' }))).toEqual(['b'])
    expect(slugs(run({ q: 'ипотека марс' }))).toEqual([])
  })

  it('поиск не различает ё/е', () => {
    expect(slugs(run({ q: 'елка' }))).toEqual(['d'])
  })

  it('поиск и фильтры вместе; числа режимов тегов — с учётом поиска', () => {
    const page = run({ q: 'рассрочка', tags: 'installment,mortgage' })
    expect(slugs(page)).toEqual(['c'])
    expect(page.tagModeTotals).toEqual({ any: 1, all: 0 })
  })

  it('порции: offset/limit, hasMore, total', () => {
    const first = run({ limit: '3' })
    expect(slugs(first)).toEqual(['a', 'b', 'c'])
    expect(first).toMatchObject({ total: 4, offset: 0, limit: 3, hasMore: true })
    const second = run({ limit: '3', offset: '3' })
    expect(slugs(second)).toEqual(['d'])
    expect(second.hasMore).toBe(false)
    expect(slugs(run({ offset: '10' }))).toEqual([])
  })
})

describe('buildFacets', () => {
  it('рубрики и теги с числом новостей, без скрытых и пустых; месяцы от новых', () => {
    const facets = buildFacets(ENTRIES, dict, 'ru')
    expect(facets.total).toBe(4)
    expect(facets.categories).toEqual([
      { key: 'news', name: 'Новости', count: 2 },
      { key: 'promo', name: 'Акции', count: 2 },
    ])
    expect(facets.tags).toEqual([
      { key: 'harizma', name: 'Harizma', count: 2 },
      { key: 'installment', name: 'Рассрочка', count: 2 },
      { key: 'mortgage', name: 'Ипотека', count: 1 },
    ])
    expect(facets.months).toEqual([
      { month: '2026-10', count: 1 },
      { month: '2026-09', count: 2 },
      { month: '2025-12', count: 1 },
    ])
    expect(facets).toMatchObject({ firstDate: '2025-12-25', lastDate: '2026-10-03' })
  })

  it('названия — на языке ленты', () => {
    const facets = buildFacets(ENTRIES, dict, 'uz')
    expect(facets.categories[0]).toEqual({ key: 'news', name: 'Yangiliklar', count: 2 })
  })

  it('пустая лента', () => {
    expect(buildFacets([], dict, 'ru')).toEqual({ total: 0, categories: [], tags: [], months: [], firstDate: '', lastDate: '' })
  })
})
