/**
 * @jest-environment jsdom
 *
 * Лента новостей в браузере (services/runtime/news-feed-runtime.js): полоса
 * фильтров из вариантов сервиса, бесконечная подгрузка, фильтры и поиск с
 * состоянием в адресе, карточки по скрытому образцу. fetch и
 * IntersectionObserver подменены; разметка — как у блока «News feed» после
 * миграции (scripts/newsFeedBlock.ts).
 */
import * as fs from 'fs'
import * as path from 'path'

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'services', 'runtime', 'news-feed-runtime.js'), 'utf8')

const FACETS = {
  total: 20,
  categories: [
    { key: 'promo', name: 'Акции', count: 8 },
    { key: 'news', name: 'Новости', count: 12 },
  ],
  tags: [
    { key: 'mortgage', name: 'Ипотека', count: 5 },
    { key: 'gift', name: 'Подарок', count: 3 },
  ],
  months: [
    { month: '2026-10', count: 4 },
    { month: '2026-08', count: 2 },
  ],
  firstDate: '2026-08-02',
  lastDate: '2026-10-05',
}

function card(i: number, extra: Record<string, unknown> = {}) {
  return {
    slug: `n${i}`,
    url: `/ru/news/n${i}/`,
    title: `Новость ${i}`,
    lead: `Анонс ${i}`,
    date: '2026-10-01',
    dateLabel: '1 октября 2026',
    category: [{ key: 'promo', name: 'Акции' }],
    categoryKey: 'promo',
    tags: [{ key: 'gift', name: 'Подарок' }],
    cover: [{ image: `/media/c${i}.webp`, position: '30% 40%' }],
    ...extra,
  }
}

/** Карточка в HTML — как её отдаёт деплой. */
function staticCard(i: number): string {
  return `<article class="news-card" data-news-card=""><a data-news-link="" href="/ru/news/s${i}/">Статичная ${i}</a></article>`
}

const TEMPLATE = `
  <article class="news-card" hidden="" data-news-card-template="">
    <div class="news-media">
      <span><img src="" alt="" data-news-cover=""></span>
      <span><span class="news-badge" data-news-badge=""></span></span>
    </div>
    <div class="news-body">
      <span class="news-date" data-news-date=""></span>
      <h2><a class="news-card-link" href="" data-news-link=""></a></h2>
      <p data-news-lead=""></p>
      <div class="news-tags" data-news-tags=""><span><span data-news-tag=""></span></span></div>
    </div>
  </article>`

function page(staticCount: number, lang = 'ru') {
  document.documentElement.lang = lang
  document.body.innerHTML = `
    <section class="news-grid" data-news-feed="">
      <div class="news-filters" data-news-filters=""></div>
      <div class="news-list" data-news-list="">${Array.from({ length: staticCount }, (_, i) => staticCard(i)).join('')}</div>
      ${TEMPLATE}
      <div class="news-feed-status" data-news-status=""></div>
      <div class="news-feed-more" data-news-more=""></div>
    </section>`
  return document.querySelector('[data-news-feed]') as HTMLElement
}

type Feed = { items: unknown[]; total: number; hasMore: boolean; tagModeTotals?: unknown }
let feedResponder: (params: URLSearchParams) => Feed | Promise<Feed> | number
let fetchMock: jest.Mock
let notifyMore: (visible: boolean) => void

function install() {
  fetchMock = jest.fn(async (url: string) => {
    const u = new URL(url, 'http://localhost')
    if (u.pathname === '/news-api/public/news/facets') return { ok: true, status: 200, json: async () => FACETS }
    const body = await feedResponder(u.searchParams)
    if (typeof body === 'number') return { ok: false, status: body, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => body }
  })
  ;(window as any).fetch = fetchMock
  ;(window as any).IntersectionObserver = function (cb: (e: Array<{ isIntersecting: boolean }>) => void) {
    notifyMore = (visible) => cb([{ isIntersecting: visible }])
    return { observe: () => undefined, disconnect: () => undefined }
  }
}

function run() {
  // eslint-disable-next-line no-new-func
  new Function(SOURCE)()
}

async function flush() {
  for (let i = 0; i < 30; i++) await Promise.resolve()
}

const feedCalls = () => fetchMock.mock.calls.map((c) => new URL(c[0], 'http://localhost')).filter((u) => u.pathname === '/news-api/public/news')
const lastFeedParams = () => feedCalls().slice(-1)[0].searchParams
const cards = () => [...document.querySelectorAll('[data-news-list] [data-news-card]')] as HTMLElement[]
const titles = () => cards().map((c) => c.querySelector('[data-news-link]')!.textContent)
const byText = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === text) as HTMLButtonElement

let warn: jest.SpyInstance
beforeEach(() => {
  history.replaceState(null, '', '/ru/news/')
  feedResponder = () => ({ items: [], total: 0, hasMore: false })
  install()
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterEach(() => {
  jest.useRealTimers()
  warn.mockRestore()
  document.body.innerHTML = ''
  delete (window as any).ghNewsFeed
})

describe('полоса фильтров', () => {
  it('из вариантов сервиса: поиск, рубрики с «Все», период, теги; порций без нужды не грузит', async () => {
    page(12)
    run()
    await flush()
    expect(document.querySelector('.news-fsearch')).toBeTruthy()
    expect([...document.querySelectorAll('.news-fcats .news-fchip')].map((b) => b.textContent)).toEqual(['Все', 'Акции', 'Новости'])
    expect(byText('Период')).toBeTruthy()
    expect(byText('Теги')).toBeTruthy()
    expect(feedCalls()).toHaveLength(0)
  })

  it('на uz — подписи по-узбекски', async () => {
    page(0, 'uz')
    run()
    await flush()
    expect((document.querySelector('.news-fsearch') as HTMLInputElement).placeholder).toBe('Yangiliklar boʻyicha qidiruv')
    expect(byText('Davr')).toBeTruthy()
  })

  it('варианты не загрузились — полосы нет, лента живёт', async () => {
    page(12)
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 502, json: async () => ({}) }))
    run()
    await flush()
    expect(document.querySelector('.news-fbar')).toBeNull()
  })
})

describe('бесконечная подгрузка', () => {
  it('метка у экрана — следующая порция после карточек из HTML; карточка по образцу', async () => {
    page(12)
    feedResponder = () => ({ items: [card(13), card(14, { cover: [], category: [], tags: [] })], total: 14, hasMore: false })
    run()
    await flush()
    notifyMore(true)
    await flush()
    expect(lastFeedParams().get('offset')).toBe('12')
    expect(lastFeedParams().get('limit')).toBe('12')
    expect(lastFeedParams().get('lang')).toBe('ru')
    expect(cards()).toHaveLength(14)

    const [full, bare] = cards().slice(12)
    expect(full.hasAttribute('hidden')).toBe(false)
    expect(full.hasAttribute('data-news-card-template')).toBe(false)
    expect(full.querySelector('[data-news-link]')!.getAttribute('href')).toBe('/ru/news/n13/')
    expect(full.querySelector('[data-news-link]')!.textContent).toBe('Новость 13')
    expect(full.querySelector('[data-news-cover]')!.getAttribute('src')).toBe('/media/c13.webp')
    expect((full.querySelector('[data-news-cover]') as HTMLElement).style.objectPosition).toBe('30% 40%')
    expect(full.querySelector('[data-news-badge]')!.textContent).toBe('Акции')
    expect(full.querySelector('[data-news-date]')!.textContent).toBe('1 октября 2026')
    expect(full.querySelector('[data-news-lead]')!.textContent).toBe('Анонс 13')
    expect([...full.querySelectorAll('[data-news-tag]')].map((t) => t.textContent)).toEqual(['Подарок'])
    // Без обложки, рубрики и тегов — этих элементов нет вовсе.
    expect(bare.querySelector('[data-news-cover]')).toBeNull()
    expect(bare.querySelector('[data-news-badge]')).toBeNull()
    expect(bare.querySelectorAll('[data-news-tag]')).toHaveLength(0)

    notifyMore(true)
    await flush()
    expect(feedCalls()).toHaveLength(1) // hasMore=false — больше не просим
  })

  it('в HTML неполная порция — ленты дальше нет, запросов нет', async () => {
    page(5)
    run()
    await flush()
    notifyMore(true)
    await flush()
    expect(feedCalls()).toHaveLength(0)
  })

  it('пока порция грузится, метка не запрашивает её второй раз', async () => {
    page(12)
    let release: (f: Feed) => void = () => undefined
    feedResponder = () => new Promise<Feed>((r) => (release = r))
    run()
    await flush()
    notifyMore(true)
    notifyMore(true)
    await flush()
    expect(feedCalls()).toHaveLength(1)
    release({ items: [card(13)], total: 13, hasMore: false })
    await flush()
    expect(cards()).toHaveLength(13)
  })

  it('сбой порции — сообщение и «Повторить»', async () => {
    page(12)
    feedResponder = () => 500
    run()
    await flush()
    notifyMore(true)
    await flush()
    expect(document.querySelector('[data-news-status]')!.textContent).toContain('Не удалось загрузить новости.')
    feedResponder = () => ({ items: [card(13)], total: 13, hasMore: false })
    byText('Повторить').click()
    await flush()
    expect(cards()).toHaveLength(13)
  })
})

describe('фильтры', () => {
  it('рубрика: адрес страницы, запрос с первой карточки, список заменён', async () => {
    page(12)
    feedResponder = (p) => ({ items: [card(1)], total: 1, hasMore: false, tagModeTotals: null, ...(p.get('category') ? {} : {}) })
    run()
    await flush()
    byText('Акции').click()
    await flush()
    expect(location.search).toBe('?category=promo')
    expect(lastFeedParams().get('category')).toBe('promo')
    expect(lastFeedParams().get('offset')).toBe('0')
    expect(titles()).toEqual(['Новость 1'])
    expect(byText('Акции').getAttribute('aria-pressed')).toBe('true')
  })

  it('пришли по ссылке с фильтрами — лента сразу перегружается по ним', async () => {
    history.replaceState(null, '', '/ru/news/?q=ипотека&tags=mortgage,gift&tagMode=all&month=2026-08')
    page(12)
    feedResponder = () => ({ items: [card(7)], total: 1, hasMore: false, tagModeTotals: { any: 4, all: 1 } })
    run()
    await flush()
    const p = lastFeedParams()
    expect(p.get('q')).toBe('ипотека')
    expect(p.get('tags')).toBe('mortgage,gift')
    expect(p.get('tagMode')).toBe('all')
    expect(p.get('from')).toBe('2026-08-01')
    expect(p.get('to')).toBe('2026-08-31')
    expect(titles()).toEqual(['Новость 7'])
    expect(byText('Август 2026')).toBeTruthy() // подпись кнопки периода
  })

  it('поиск — с задержкой ввода, одним запросом', async () => {
    jest.useFakeTimers()
    page(12)
    feedResponder = () => ({ items: [card(2)], total: 1, hasMore: false })
    run()
    await flush()
    const input = document.querySelector('.news-fsearch') as HTMLInputElement
    for (const v of ['и', 'ип', 'ипо']) {
      input.value = v
      input.dispatchEvent(new Event('input'))
    }
    await jest.advanceTimersByTimeAsync(299)
    expect(feedCalls()).toHaveLength(0)
    await jest.advanceTimersByTimeAsync(1)
    await flush()
    expect(feedCalls()).toHaveLength(1)
    expect(lastFeedParams().get('q')).toBe('ипо')
    expect(location.search).toBe('?q=%D0%B8%D0%BF%D0%BE')
  })

  it('теги: при двух — переключатель «любой / все» с числами; «все» уходит в адрес и запрос', async () => {
    page(12)
    feedResponder = () => ({ items: [card(3)], total: 5, hasMore: false, tagModeTotals: { any: 5, all: 2 } })
    run()
    await flush()
    byText('Теги').click()
    byText('Ипотека').click()
    await flush()
    expect(document.querySelector('[data-news-tagmode]')).toBeNull() // один тег — разницы нет
    byText('Подарок').click()
    await flush()
    const mode = document.querySelector('[data-news-tagmode]') as HTMLElement
    expect(mode.querySelector('[data-count="any"]')!.textContent).toBe('5')
    expect(mode.querySelector('[data-count="all"]')!.textContent).toBe('2')
    expect(mode.textContent).toContain('хотя бы с одним')
    expect((document.querySelector('[data-tags-pop]') as HTMLElement).hidden).toBe(false) // окно не закрылось
    const all = mode.querySelector('input[value="all"]') as HTMLInputElement
    all.checked = true
    all.dispatchEvent(new Event('change'))
    await flush()
    expect(lastFeedParams().get('tagMode')).toBe('all')
    expect(location.search).toBe('?tags=mortgage%2Cgift&tagMode=all')
    expect(byText('Теги: 2')).toBeTruthy()
  })

  it('период «Быстро»: за 3 месяца от сегодня', async () => {
    page(12)
    run()
    await flush()
    ;(document.querySelector('[data-news-feed]') as any).ghNewsFeed.today = () => new Date(2026, 9, 5)
    byText('Период').click()
    byText('За 3 месяца').click()
    await flush()
    expect(lastFeedParams().get('from')).toBe('2026-07-08')
    expect(lastFeedParams().get('to')).toBeNull()
    expect(location.search).toBe('?period=months3')
    expect(byText('За 3 месяца').className).toContain('is-set')
  })

  it('«Месяц»: месяцы без новостей неактивны', async () => {
    page(12)
    run()
    await flush()
    byText('Период').click()
    byText('Месяц').click()
    const months = [...document.querySelectorAll('.news-fmonths button')] as HTMLButtonElement[]
    const enabled = months.filter((b) => !b.disabled).map((b) => b.title)
    expect(enabled).toEqual(['Август 2026 · 2', 'Октябрь 2026 · 4'])
  })

  it('«Свои даты»: перепутанные с/по меняются местами', async () => {
    page(12)
    run()
    await flush()
    byText('Период').click()
    byText('Свои даты').click()
    const [from, to] = [...document.querySelectorAll('.news-fdates input')] as HTMLInputElement[]
    expect(from.min).toBe('2026-08-02')
    from.value = '2026-10-01'
    to.value = '2026-08-15'
    byText('Применить').click()
    await flush()
    expect(lastFeedParams().get('from')).toBe('2026-08-15')
    expect(lastFeedParams().get('to')).toBe('2026-10-01')
    expect(byText('15.08.2026 — 01.10.2026')).toBeTruthy()
  })

  it('ответ на прошлые фильтры, пришедший позже, не затирает новые', async () => {
    page(12)
    const pending: Record<string, (f: Feed) => void> = {}
    feedResponder = (p) => new Promise<Feed>((r) => (pending[p.get('category') || 'all'] = r))
    run()
    await flush()
    byText('Акции').click()
    await flush()
    byText('Новости').click()
    await flush()
    pending.news({ items: [card(20)], total: 1, hasMore: false })
    await flush()
    pending.promo({ items: [card(10)], total: 1, hasMore: false })
    await flush()
    expect(titles()).toEqual(['Новость 20'])
  })

  it('ничего не нашлось — сообщение и «Сбросить всё»; активные фильтры плашками', async () => {
    page(12)
    feedResponder = (p) => (p.get('category') ? { items: [], total: 0, hasMore: false } : { items: [card(1)], total: 1, hasMore: false })
    run()
    await flush()
    byText('Акции').click()
    await flush()
    expect(document.querySelector('[data-news-status]')!.textContent).toContain('Ничего не найдено.')
    expect([...document.querySelectorAll('.news-fpill')].map((b) => b.textContent)).toEqual(['Акции ×'])
    ;(document.querySelector('[data-news-status] button') as HTMLButtonElement).click()
    await flush()
    expect(location.search).toBe('')
    expect(titles()).toEqual(['Новость 1'])
    expect(document.querySelector('.news-fpill')).toBeNull()
  })

  it('окно периода закрывается кликом мимо и Esc', async () => {
    page(12)
    run()
    await flush()
    byText('Период').click()
    const pop = document.querySelector('.news-fpop') as HTMLElement
    expect(pop.hidden).toBe(false)
    document.body.click()
    expect(pop.hidden).toBe(true)
    byText('Период').click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(pop.hidden).toBe(true)
  })
})

describe('rangeOf', () => {
  it('месяц — от первого до последнего дня, с високосным февралём', () => {
    run()
    const { rangeOf } = (window as any).ghNewsFeed
    expect(rangeOf({ kind: 'month', value: '2028-02' }, new Date())).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(rangeOf({ kind: 'month', value: '2026-02' }, new Date())).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(rangeOf({ kind: 'quick', value: 'week' }, new Date(2026, 0, 3))).toEqual({ from: '2025-12-28', to: '' })
    expect(rangeOf({ kind: 'all' }, new Date())).toEqual({ from: '', to: '' })
  })
})
