import { backLinkRows, newsFeedSourceUrl, nodeIds, rowsToCopy, upsertPublishData } from '../scripts/newsPagesSetup'
import { hasNewsFeed, generateNewsFeedRuntime } from '../services/NewsFeedRuntime'

describe('данные страницы /news', () => {
  it('адрес источника: язык страницы и первые 12 карточек', () => {
    expect(newsFeedSourceUrl('http://news-service:5200/')).toBe('http://news-service:5200/api/news?lang={{lang}}&limit=12')
  })

  it('определение news добавляется, обновляется, остальные не трогаются; без изменений — changed=false', () => {
    const other = { name: 'complexes', dataSourceId: 'ds-estate', arrayPath: 'items' }
    const news = { name: 'news', dataSourceId: 'ds-news', arrayPath: 'items' }
    expect(upsertPublishData([other], news)).toEqual({ defs: [other, news], changed: true })
    expect(upsertPublishData([other, news], news)).toEqual({ defs: [other, news], changed: false })
    expect(upsertPublishData([{ ...news, dataSourceId: 'old' }], news)).toEqual({ defs: [news], changed: true })
    expect(upsertPublishData(null, news).defs).toEqual([news])
  })
})

describe('переводы шаблона «Новость»', () => {
  it('копируются только переводы узлов шапки и подвала (в т.ч. узлов под экраны)', () => {
    const block = { id: 'nav', children: [{ id: 'menu', children: [] }], variations: { mobile: { specificChildren: [{ id: 'burger', children: [] }] } } }
    const ids = nodeIds(block)
    expect([...ids].sort()).toEqual(['burger', 'menu', 'nav'])
    const rows = [
      { nodeId: 'menu', locale: 'uz', field: 'content', value: 'Menyu', status: 'draft' },
      { nodeId: 'hero-title', locale: 'uz', field: 'content', value: 'Loyiha' },
    ]
    expect(rowsToCopy(rows, ids)).toEqual([{ nodeId: 'menu', locale: 'uz', field: 'content', value: 'Menyu', status: 'draft' }])
  })

  it('ссылка «← Все новости» — на языках шаблона', () => {
    expect(backLinkRows(['uz'])).toEqual([{ nodeId: 'news-back-link', locale: 'uz', field: 'content', value: '← Barcha yangiliklar' }])
    expect(backLinkRows(['ru', 'en']).map((r) => r.locale)).toEqual(['en'])
  })
})

describe('вставка рантайма ленты', () => {
  it('только на странице с корнем ленты; образец карточки и фильтры — не корень', () => {
    expect(hasNewsFeed('<section class="news-grid" data-news-feed="">')).toBe(true)
    expect(hasNewsFeed('<div data-news-filters=""></div><article data-news-card-template="">')).toBe(false)
    expect(generateNewsFeedRuntime('<p>нет ленты</p>')).toBe('')
    const script = generateNewsFeedRuntime('<section data-news-feed>')
    expect(script.startsWith('<script>')).toBe(true)
    expect(script).toContain('window.ghNewsFeed')
    expect(script.match(/<\/script>/g)).toHaveLength(1)
  })
})
