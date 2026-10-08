/**
 * Страницы новостей на настоящем движке деплоя:
 *  - шаблон «Новость» (scripts/newsTemplate.ts) + данные страницы новости из
 *    news-service → HTML статьи: hero, шапка, блоки трёх типов в порядке;
 *  - блок «News feed» (живой снимок) после миграции + карточки ленты →
 *    карточки в HTML и скрытый образец для подгрузки.
 * Данные — в форме ответа news-service (services/news.ts buildDetail/buildCard).
 */
export {}

jest.mock('../config/database', () => ({
  AppDataSource: { getRepository: jest.fn(() => ({ findOne: jest.fn(), find: jest.fn(async () => []) })) },
}))
jest.mock('../services/ResponsiveImageService', () => ({ responsiveImageService: { enrich: jest.fn(async (h: string) => h) } }))
jest.mock('../services/LinkedBlocksService', () => ({ linkedBlocksService: { updateLinkedBlocks: jest.fn(async (s: any) => s) } }))
jest.mock('../services/TranslationService', () => ({ translationService: { getPageLocales: jest.fn(async () => []) } }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeployService } = require('../services/DeployService')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { htmlGenerator } = require('../services/HtmlGenerator')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildNewsTemplate, brokenRepeats, NEWS_BACK_LINK_ID } = require('../scripts/newsTemplate')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { migrateNewsFeedBlock, stripFeedInstanceLayout, NEWS_FEED_CSS_HEAD } = require('../scripts/newsFeedBlock')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { findAll, incompleteNodes } = require('../scripts/choiceToPlanTypes')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FEED_BLOCK = require('./fixtures/newsFeedBlockLive.json')

const svc: any = new DeployService()
/** Тело страницы: в <head> стили упоминают те же классы. */
const render = (structure: unknown) => {
  const html = htmlGenerator.generatePage(structure, { metadata: { title: 'T', description: '', keywords: [] }, slug: 'news/x' }) as string
  return html.slice(html.indexOf('<body'))
}

const slideOf = (image: string, video = '') => ({ url: video || image, image, video, position: '30% 60%', fit: 'cover' })

const CARD = {
  id: 'n1',
  slug: 'vaucher-makro',
  lang: 'ru',
  url: '/ru/news/vaucher-makro/',
  title: 'Ваучер Makro',
  lead: 'Подарок при покупке',
  date: '2026-10-05',
  dateLabel: '5 октября 2026',
  category: [{ key: 'promo', name: 'Акции' }],
  categoryKey: 'promo',
  tags: [
    { key: 'gift', name: 'Подарок' },
    { key: 'mortgage', name: 'Ипотека' },
  ],
  cover: [{ image: '/media/c.webp', position: '40% 50%' }],
}

const DETAIL = {
  ...CARD,
  hero: [slideOf('/media/h1.webp'), slideOf('/media/h2.webp', '/media/v.mp4')],
  sections: [
    { id: 's1', type: 'text', side: 'right', text: [{ html: '<p>Первый <strong>блок</strong></p>' }], photoText: [], sliderText: [] },
    { id: 's2', type: 'photoText', side: 'left', text: [], photoText: [{ html: '<p>Про фото</p>', image: '/media/p.webp', position: '10% 20%', fit: 'cover', side: 'left' }], sliderText: [] },
    { id: 's3', type: 'sliderText', side: 'right', text: [], photoText: [], sliderText: [{ html: '<p>Про слайды</p>', slides: [slideOf('/media/s1.webp'), slideOf('/media/s2.webp')], side: 'right' }] },
  ],
}

const NAV = { id: 'nav', tagName: 'div', attributes: { class: 'site-header' }, styles: { properties: { position: 'absolute' } }, metadata: { name: 'Navigation', linkedBlockId: 'nav-block' }, children: [] }
const FOOTER = { id: 'footer', tagName: 'div', attributes: { class: 'gh-footer' }, styles: { properties: {} }, metadata: { name: 'Footer', linkedBlockId: 'footer-block' }, children: [] }
const TEMPLATE = buildNewsTemplate({ navigation: NAV, footer: FOOTER, breakpoints: [{ id: 'mobile', width: 375 }] })

describe('шаблон «Новость»', () => {
  const html = render(svc.substituteItemData(TEMPLATE, DETAIL))

  it('собран без дыр: у каждого повтора один образец, у узлов все поля', () => {
    expect(brokenRepeats(TEMPLATE)).toEqual([])
    expect(incompleteNodes(TEMPLATE)).toEqual([])
  })

  it('шапка и подвал — экземпляры библиотечных блоков', () => {
    const linked = findAll(TEMPLATE, (n: any) => n.metadata?.linkedBlockId).map((n: any) => n.metadata.linkedBlockId)
    expect(linked).toEqual(['nav-block', 'footer-block'])
  })

  it('hero: слайды по данным, видео-слайд с адресом видео, карусель', () => {
    const hero = html.slice(html.indexOf('class="news-hero"'), html.indexOf('news-article-head'))
    expect(hero).toContain('data-carousel="true"')
    expect(hero.match(/data-carousel-slide="true"/g)).toHaveLength(2)
    expect(hero).toContain('/media/h1.webp')
    expect(hero).toContain('data-slide-video="/media/v.mp4"')
  })

  it('шапка статьи: рубрика, дата, заголовок, анонс, ссылка на ленту', () => {
    expect(html).toMatch(/<h1[^>]*class="news-article-title"[^>]*>\s*Ваучер Makro/)
    expect(html).toContain('5 октября 2026')
    expect(html).toContain('datetime="2026-10-05"')
    expect(html).toMatch(/class="news-badge"[^>]*>\s*Акции/)
    expect(html).toContain('Подарок при покупке')
    expect(html).toMatch(new RegExp(`data-element-id="${NEWS_BACK_LINK_ID}"[^>]*href="/news/"|href="/news/"[^>]*data-element-id="${NEWS_BACK_LINK_ID}"`))
  })

  it('блоки в порядке данных, каждый — своей заготовкой; HTML текста вставлен как есть', () => {
    const order = ['news-section--text', 'news-section--photo', 'news-section--slider'].map((cls) => html.indexOf(cls))
    expect(order.every((i) => i > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(html.match(/class="news-section news-section--/g)).toHaveLength(3)
    expect(html).toContain('<p>Первый <strong>блок</strong></p>')
    expect(html).toContain('news-section--media-left')
    expect(html).toMatch(/<img[^>]*src="\/media\/p\.webp"/)
    const slider = html.slice(html.indexOf('news-section--slider'))
    expect(slider.match(/data-carousel-slide="true"/g)).toHaveLength(2)
    expect(slider).toContain('<p>Про слайды</p>')
  })

  it('плейсхолдеров в HTML не осталось', () => {
    expect(html).not.toMatch(/\{\{\s*(item|\$)\./)
  })

  it('без рубрики и hero — нет ни бейджа, ни слайдов', () => {
    const bare = render(svc.substituteItemData(TEMPLATE, { ...DETAIL, category: [], hero: [], sections: [] }))
    expect(bare).not.toContain('class="news-badge"')
    expect(bare).not.toContain('data-carousel-slide="true"')
    expect(bare).not.toContain('news-section--')
  })
})

describe('блок «News feed» (живой снимок)', () => {
  const result = migrateNewsFeedBlock(FEED_BLOCK)
  const cards = (root: any) => findAll(root, (n: any) => n.attributes && 'data-news-card' in n.attributes)

  it('карточки руками убраны; повтор по item.news, образец, фильтры, сообщения, метка подгрузки', () => {
    expect(FEED_BLOCK.children).toHaveLength(6)
    const kinds = result.structure.children.map((c: any) => Object.keys(c.attributes).find((k) => k.startsWith('data-news-')))
    expect(kinds).toEqual(['data-news-filters', 'data-news-list', 'data-news-card-template', 'data-news-status', 'data-news-more'])
    expect(result.structure.children[1]._repeat).toEqual({ source: 'item.news' })
    expect(result.structure.attributes).toHaveProperty('data-news-feed')
    expect(result.structure.metadata.globalJs).toBe('')
    expect(result.structure.metadata.globalCss).toContain(NEWS_FEED_CSS_HEAD)
    expect(incompleteNodes(result.structure)).toEqual([])
    expect(cards(result.structure)).toHaveLength(1)
  })

  it('в HTML — карточки из данных: ссылка, заголовок, анонс, дата, обложка, рубрика, теги', () => {
    const page = svc.substituteItemData(result.structure, { news: [CARD, { ...CARD, slug: 'b', url: '/ru/news/b/', title: 'Без обложки', cover: [], category: [], tags: [] }] })
    const html = render(page)
    expect(html.match(/data-news-card=""/g)).toHaveLength(2)
    expect(html).toMatch(/<a[^>]*href="\/ru\/news\/vaucher-makro\/"[^>]*>\s*Ваучер Makro/)
    expect(html).toContain('Подарок при покупке')
    expect(html).toContain('5 октября 2026')
    expect(html).toMatch(/<img[^>]*src="\/media\/c\.webp"/)
    expect(html).toMatch(/data-news-badge=""[^>]*>\s*Акции/)
    expect(html.match(/data-news-tag=""/g)!.length).toBeGreaterThanOrEqual(2)
    const second = html.slice(html.indexOf('Без обложки') - 2000, html.indexOf('Без обложки'))
    expect(second.lastIndexOf('data-news-cover')).toBeLessThan(second.lastIndexOf('data-news-card=""'))
  })

  it('скрытый образец: та же вёрстка, пустые поля, по одному элементу обложки, рубрики, тега', () => {
    const html = render(svc.substituteItemData(result.structure, { news: [] }))
    const start = html.indexOf('data-news-card-template')
    const tpl = html.slice(html.lastIndexOf('<article', start), html.indexOf('</article>', start))
    expect(tpl).toContain('hidden')
    expect(tpl).toContain('data-news-cover')
    expect(tpl).toContain('data-news-badge')
    expect(tpl).toContain('data-news-tag')
    expect(tpl).toContain('data-news-link')
    expect(tpl).not.toMatch(/\{\{/)
    expect(html).not.toMatch(/data-news-card=""/)
  })

  it('уже лента со стилями v1 (стенд) — заменяется только CSS-секция: поиск строкой, фильтры под ним', () => {
    const v1 = JSON.parse(JSON.stringify(result.structure))
    const css: string = v1.metadata.globalCss
    const start = css.indexOf(NEWS_FEED_CSS_HEAD)
    v1.metadata.globalCss =
      css.slice(0, start) + '/* ==== news-feed v1 ==== */\n.news-fsearch { flex: 1 1 260px; }\n.news-fpop { right: 0; }\n'
    const up = migrateNewsFeedBlock(v1)
    expect(up.alreadyMigrated).toBe(false)
    expect(up.changes).toEqual(['CSS-секция news-feed v3: лента по ширине hero, на телефоне поля 8px'])
    const next: string = up.structure.metadata.globalCss
    expect(next).not.toContain('news-feed v1')
    expect(next).toContain('news-feed v3')
    expect(next).toContain('.news-fsearch { flex: 1 1 100%;')
    expect(next.startsWith(css.slice(0, start).trimEnd())).toBe(true)
    expect(up.structure.children).toEqual(v1.children)
    expect(migrateNewsFeedBlock(up.structure).alreadyMigrated).toBe(true)
  })

  it('повторный запуск ничего не меняет', () => {
    expect(migrateNewsFeedBlock(result.structure)).toMatchObject({ alreadyMigrated: true, changes: [] })
  })

  it('встроенные колонки и боковые отступы убраны — на телефоне работает одна колонка из CSS', () => {
    expect(FEED_BLOCK.styles.properties).toMatchObject({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', paddingLeft: '150px' })
    const props = result.structure.styles.properties
    expect(props).not.toHaveProperty('gridTemplateColumns')
    expect(props).not.toHaveProperty('paddingLeft')
    expect(props).not.toHaveProperty('paddingRight')
    // Нижний отступ и промежуток тоже ведёт CSS: встроенный стиль перебил бы его.
    expect(props).not.toHaveProperty('paddingBottom')
    expect(props).not.toHaveProperty('gap')
    expect(props).toMatchObject({ display: 'grid' })
    const css = result.structure.metadata.globalCss
    expect(css).toMatch(/@media \(max-width: 680px\) \{ \.news-grid \{ grid-template-columns: 1fr; padding: 0 8px 64px; \} \}/)
  })

  it('экземпляр на странице /news — так же; чужие узлы не трогаются, повтор — без правок', () => {
    const page = {
      id: 'root',
      children: [
        { id: 'feed', metadata: { linkedBlockId: 'feed-block' }, styles: { properties: { display: 'grid', paddingLeft: '150px', gridTemplateColumns: 'repeat(3, 1fr)' } }, children: [] },
        { id: 'head', metadata: { linkedBlockId: 'head-block' }, styles: { properties: { paddingLeft: '150px' } }, children: [] },
      ],
    }
    const out = stripFeedInstanceLayout(page, 'feed-block')
    expect(out.structure.children[0].styles.properties).toEqual({ display: 'grid' })
    expect(out.structure.children[1].styles.properties).toEqual({ paddingLeft: '150px' })
    expect(page.children[0].styles.properties).toHaveProperty('paddingLeft') // исходник цел
    expect(stripFeedInstanceLayout(out.structure, 'feed-block').alreadyMigrated).toBe(true)
  })
})
