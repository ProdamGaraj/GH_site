/**
 * @jest-environment jsdom
 *
 * Каталог ЖК на главной: фильтр по классу. Преобразование — на снимке живого
 * блока «Complexes»; скрипт — в jsdom на разметке, как её отдаёт деплой
 * (5 карточек: 1 комфорт, 4 бизнес, премиум-проектов нет).
 */
// TranslationService создаёт синглтон с репозиториями на импорте — без БД.
jest.mock('../config/database', () => ({
  AppDataSource: { getRepository: () => ({}) },
}))

import catalogBlock from './fixtures/catalogBlockLive.json'
import {
  CATALOG_FILTER_CSS_MARKER,
  CATALOG_FILTER_JS,
  CATALOG_FILTER_JS_MARKER,
  catalogTitleTranslationPlan,
  migrateCatalogClassFilter,
} from '../scripts/catalogClassFilter'
import { StructureNode, findAll, hasClass } from '../scripts/choiceToPlanTypes'
import { applyTranslationsToTree, extractTranslatableFields } from '../services/TranslationService'

const LIVE = catalogBlock as unknown as StructureNode
const result = migrateCatalogClassFilter(LIVE)
const buttons = (root: StructureNode) => findAll(root, (n) => n.tagName === 'button' && !!n.attributes?.['data-filter'])

describe('блок «Complexes» (живой снимок)', () => {
  it('скрипт и CSS фильтра — в блоке; у блока их не было', () => {
    expect(LIVE.metadata!.globalJs ?? '').toBe('')
    expect(result.structure.metadata!.globalJs).toContain(CATALOG_FILTER_JS_MARKER)
    expect(result.structure.metadata!.globalCss).toContain(CATALOG_FILTER_CSS_MARKER)
  })

  it('у кнопок нет демо-роликов data-video, фильтр и подписи на месте', () => {
    const out = buttons(result.structure)
    expect(out.map((b) => b.attributes!['data-filter'])).toEqual(['all', 'comfort', 'business', 'premium'])
    for (const b of out) {
      expect(b.attributes).not.toHaveProperty('data-video')
      expect(b.attributes!['data-title']).toBeTruthy()
    }
  })

  it('видео сайта не тронуто', () => {
    const [video] = findAll(result.structure, (n) => n.attributes?.id === 'complexesVideo')
    expect(video.attributes!.src).toBe('/media/5ae4a707-dff0-4037-8ab3-e99234838ecb.mp4')
  })

  it('подписи заголовка по кнопкам — для переводов', () => {
    expect(result.titles.map((t) => t.ru)).toEqual([
      'Подборка всех проектов',
      'Проекты комфорт-класса',
      'Бизнес-класс',
      'Премиум проекты',
    ])
  })

  it('повторный запуск ничего не меняет, исходник не мутируется', () => {
    const snapshot = JSON.stringify(LIVE)
    migrateCatalogClassFilter(LIVE)
    expect(JSON.stringify(LIVE)).toBe(snapshot)
    const again = migrateCatalogClassFilter(result.structure)
    expect(again).toMatchObject({ alreadyMigrated: true, changes: [] })
  })

  it('CSS других секций блока сохранён', () => {
    const before = LIVE.metadata!.globalCss as string
    const after = result.structure.metadata!.globalCss as string
    expect(after.startsWith(before.trimEnd())).toBe(true)
  })
})

describe('переводы подписей (data-title)', () => {
  it('TranslationService выдаёт data-title на перевод и подставляет перевод на деплое', () => {
    const node = { id: 'b', tagName: 'button', content: 'Комфорт', attributes: { 'data-title': 'Проекты комфорт-класса' } }
    expect(extractTranslatableFields(node)).toContainEqual({ nodeId: 'b', field: 'data-title', value: 'Проекты комфорт-класса' })
    const { structure } = applyTranslationsToTree({ ...node, children: [] }, { b: { 'data-title': 'Komfort-klass loyihalari' } })
    expect(structure.attributes['data-title']).toBe('Komfort-klass loyihalari')
  })

  it('план: языки страницы (uz), существующие строки не дублируются', () => {
    const rows = [
      { nodeId: 'node-1782187948708-dnsgovmg6', locale: 'uz', field: 'content', value: 'Barcha loyihalar to‘plami' },
      { nodeId: 'node-1782187948708-ynz8h7u5g', locale: 'uz', field: 'data-title', value: 'Biznes' },
    ]
    const plan = catalogTitleTranslationPlan(result.titles, rows)
    expect(plan.missing).toEqual([])
    expect(plan.add.map((r) => [r.nodeId.slice(-9), r.locale, r.value])).toEqual([
      ['q96kqxx12', 'uz', 'Barcha loyihalar to‘plami'],
      ['0ntqcgcu4', 'uz', 'Komfort-klass loyihalari'],
      ['6hwa10lgw', 'uz', 'Premium loyihalar'],
    ])
    expect(plan.add.every((r) => r.field === 'data-title')).toBe(true)
  })

  it('подпись, которой нет в словаре, — в missing', () => {
    const plan = catalogTitleTranslationPlan([{ nodeId: 'x', ru: 'Своя подпись' }], [{ nodeId: 'y', locale: 'uz', field: 'content' }])
    expect(plan).toEqual({ add: [], missing: ['Своя подпись'] })
  })
})

describe('скрипт фильтра в браузере', () => {
  const CARDS: Array<[string, string]> = [
    ['ozmakon-business', 'business'],
    ['assalom-dostlik', 'comfort'],
    ['harizma', 'business'],
    ['ozmahal', 'business'],
    ['ozmakon', 'business'],
  ]

  function page(cards = CARDS): Document {
    document.body.innerHTML = `
      <section id="complexes" class="complexes-section">
        <div class="class-filter">
          <button type="button" class="active" data-filter="all" data-title="Barcha loyihalar to‘plami">Barchasi</button>
          <button type="button" data-filter="comfort" data-title="Komfort-klass loyihalari">Komfort</button>
          <button type="button" data-filter="business" data-title="Biznes-klass">Biznes</button>
          <button type="button" data-filter="premium" data-title="Premium loyihalar">Premium</button>
        </div>
        <article class="complexes-hero"><video id="complexesVideo" src="/media/v.mp4"></video>
          <h3 id="complexesVideoTitle">Barcha loyihalar to‘plami</h3></article>
        <div class="project-grid">${cards
          .map(
            ([slug, cls]) =>
              `<article class="project-card" id="${slug}" data-class="${cls}" data-href="/uz/complex/${slug}">
                 <h3>${slug}</h3><a class="project-more" href="/uz/complex/${slug}">Batafsil</a></article>`
          )
          .join('')}</div>
      </section>`
    new Function(CATALOG_FILTER_JS)()
    return document
  }

  const visible = (dom: Document) =>
    [...dom.querySelectorAll('.project-card')].filter((c) => !c.classList.contains('is-hidden')).map((c) => c.id)
  const button = (dom: Document, value: string) => dom.querySelector(`[data-filter="${value}"]`) as HTMLButtonElement
  const title = (dom: Document) => dom.getElementById('complexesVideoTitle')!

  it('сначала — все карточки, «Все» отмечена, заголовок как есть', () => {
    const dom = page()
    expect(visible(dom)).toHaveLength(5)
    expect(button(dom, 'all').getAttribute('aria-pressed')).toBe('true')
    expect(title(dom).textContent).toBe('Barcha loyihalar to‘plami')
  })

  it('«Комфорт» — только комфорт, заголовок — подпись кнопки на языке страницы', () => {
    const dom = page()
    button(dom, 'comfort').click()
    expect(visible(dom)).toEqual(['assalom-dostlik'])
    expect(title(dom).textContent).toBe('Komfort-klass loyihalari')
    expect(button(dom, 'comfort').classList.contains('active')).toBe(true)
    expect(button(dom, 'all').classList.contains('active')).toBe(false)
  })

  it('«Бизнес», потом «Все» — список возвращается целиком', () => {
    const dom = page()
    button(dom, 'business').click()
    expect(visible(dom)).toEqual(['ozmakon-business', 'harizma', 'ozmahal', 'ozmakon'])
    button(dom, 'all').click()
    expect(visible(dom)).toHaveLength(5)
    expect(title(dom).textContent).toBe('Barcha loyihalar to‘plami')
  })

  it('класс без проектов (премиум) — кнопка спрятана и не срабатывает', () => {
    const dom = page()
    expect(button(dom, 'premium').classList.contains('is-empty')).toBe(true)
    expect(button(dom, 'comfort').classList.contains('is-empty')).toBe(false)
    button(dom, 'premium').click()
    expect(visible(dom)).toHaveLength(5)
  })

  it('появился премиум-проект — кнопка на месте сама', () => {
    const dom = page([...CARDS, ['new', 'premium']])
    expect(button(dom, 'premium').classList.contains('is-empty')).toBe(false)
  })

  it('клик по карточке — как по её ссылке «Подробнее»; клик по самой ссылке — один переход', () => {
    const dom = page()
    const link = dom.querySelector('#harizma .project-more') as HTMLAnchorElement
    const clicks: string[] = []
    link.addEventListener('click', (e) => {
      e.preventDefault()
      clicks.push(link.getAttribute('href')!)
    })
    ;(dom.querySelector('#harizma h3') as HTMLElement).click()
    expect(clicks).toEqual(['/uz/complex/harizma'])
    link.click()
    expect(clicks).toEqual(['/uz/complex/harizma', '/uz/complex/harizma'])
  })

  it('видео при выборе класса не меняется', () => {
    const dom = page()
    button(dom, 'business').click()
    expect(dom.getElementById('complexesVideo')!.getAttribute('src')).toBe('/media/v.mp4')
  })
})

describe('кнопки в живом блоке после миграции (снимок)', () => {
  it('класс карточки — из данных estate ({{$.filterClass}})', () => {
    const [card] = findAll(result.structure, (n) => hasClass(n, 'project-card'))
    expect(card.attributes!['data-class']).toBe('{{$.filterClass}}')
  })
})
