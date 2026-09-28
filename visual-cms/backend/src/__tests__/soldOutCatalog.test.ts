/**
 * Каталог на главной из estate и распроданные проекты: преобразование живых
 * блоков (fixtures/catalogBlock.json, complexHeroBlock.json, choiceBlock.json —
 * копии со стенда) и результат против настоящего движка подстановки и
 * генератора страницы. Данные — в той форме, в какой их отдаёт estate.
 *
 * Методы подстановки приватные — дёргаем через `as any`. БД мокаем.
 */
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(), find: jest.fn(), save: jest.fn(), findByIds: jest.fn(),
    }),
  },
}))

import * as cheerio from 'cheerio'
import { deployService } from '../services/DeployService'
import { htmlGenerator } from '../services/HtmlGenerator'
import { linkedBlocksService } from '../services/LinkedBlocksService'
import { MigrationError, StructureNode, findAll, hasClass, incompleteNodes } from '../scripts/choiceToPlanTypes'
import {
  CATALOG_CSS_MARKER,
  CHOICE_CSS_MARKER,
  HERO_CSS_MARKER,
  SALE_STATE_ATTR,
  SOLD_LABEL_ATTR,
  EstateAdminComplex,
  StaticCatalogCard,
  dropPublishWhitelist,
  estateCardPatch,
  makeIdFactory,
  migrateCatalogBlock,
  migrateChoiceBlock,
  migrateHeroBlock,
  staticCatalogCards,
} from '../scripts/soldOutCatalog'
import type { BlockNode } from '../types/blockNode'

const CATALOG: StructureNode = require('./fixtures/catalogBlock.json')
const HERO: StructureNode = require('./fixtures/complexHeroBlock.json')
const CHOICE: StructureNode = require('./fixtures/choiceBlock.json')

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const byId = (root: StructureNode, id: string) => findAll(root, (n) => n.id === id)[0]
const byClass = (root: StructureNode, name: string) => findAll(root, (n) => hasClass(n, name))
const substitute = (structure: unknown, item: unknown) => (deployService as any).substituteItemData(structure, item)
const ids = () => makeIdFactory(1)

function render(structure: StructureNode, item: unknown): { $: cheerio.CheerioAPI; html: string } {
  const html = htmlGenerator.generatePage(substitute(structure, item) as BlockNode, {
    metadata: { title: 'T', description: 'D', keywords: [] },
    slug: 'index',
  })
  return { $: cheerio.load(html), html }
}

/** Элементы каталога estate (/api/complexes) — продающийся и распроданный. */
const DOSTLIK = {
  slug: 'assalom-dostlik',
  name: 'Assalom Doʼstlik',
  className: 'Комфорт+',
  intro: 'Комплекс с закрытой территорией.',
  cardImage: '/media/dostlik.jpg',
  status: 'active',
  filterClass: 'comfort',
  tags: ['Ремонт в подарок', 'Ипотека'],
  soldOut: [],
  cardClass: '',
}
const OZMAKON = {
  slug: 'ozmakon',
  name: 'OʼzMakon',
  className: 'Бизнес',
  intro: 'Городской проект.',
  cardImage: '/media/ozmakon.jpg',
  status: 'sold_out',
  filterClass: 'business',
  tags: [],
  soldOut: [{ label: 'Распродано' }],
  cardClass: 'is-sold-visible',
}

// Узлы первой карточки со стенда. У data-узлов есть переводы Doʼstlik (uz),
// у «Цена по запросу» и «Подробнее» — общие для всех карточек.
const OLD = {
  card: 'node-1782187948709-0a2b2fe2u',
  badge: 'node-1782187948709-vul2b66v1',
  intro: 'node-1782187948709-mezfia1uj',
  firstTag: 'node-1782187948709-7j4b0g5m5',
  price: 'node-1782187948709-2b86zmadg',
  more: 'node-1782187948709-qzu1g2ahb',
}

describe('staticCatalogCards — что переезжает в estate', () => {
  it('четыре ручные карточки: слаг, класс для фильтра, картинка, теги с узлами', () => {
    const cards = staticCatalogCards(CATALOG)
    expect(cards.map((c) => [c.slug, c.filterClass, c.image])).toEqual([
      ['assalom-dostlik', 'comfort', '/media/d65851c0-0bcf-4901-87d7-4d91c77738c3.jpg'],
      ['ozmakon-business', 'business', '/media/21249019-a9a9-4b90-bfef-d2f883388d77.jpg'],
      ['harizma', 'business', '/media/e271d545-b5d1-49fe-ab4d-5bf090b2d98e.jpg'],
      ['ozmahal', 'business', '/media/40e7e690-b2a6-454b-bfaf-fffa29050612.jpg'],
    ])
    expect(cards[0].tags).toEqual([
      { text: 'Ремонт в подарок', nodeId: OLD.firstTag },
      { text: 'Скидка', nodeId: 'node-1782187948709-upq0ipuw1' },
      { text: 'Акция', nodeId: 'node-1782187948709-njuewh9e5' },
      { text: 'Ипотека', nodeId: 'node-1782187948709-vtha7bhq5' },
    ])
  })
})

describe('migrateCatalogBlock — структура', () => {
  const result = migrateCatalogBlock(CATALOG, ids())
  const grid = byClass(result.structure, 'project-grid')[0]
  const card = grid.children![0]

  it('грид повторяется по item.complexes, в нём одна карточка-образец', () => {
    expect(grid._repeat).toEqual({ source: 'item.complexes' })
    expect(grid.children).toHaveLength(1)
    expect(result.cards.map((c) => c.slug)).toEqual(['assalom-dostlik', 'ozmakon-business', 'harizma', 'ozmahal'])
  })

  it('поля карточки — из данных estate', () => {
    expect(card.attributes).toMatchObject({
      class: 'project-card {{$.cardClass}}',
      'data-href': '/complex/{{$.slug}}',
      'data-class': '{{$.filterClass}}',
    })
    expect(byClass(card, 'project-image')[0].styles?.properties?.['--image']).toBe("url('{{$.cardImage}}')")
    expect(byClass(card, 'project-class')[0].content).toBe('{{$.className}}')
    expect(byClass(card, 'project-more')[0].attributes).toMatchObject({ href: '/complex/{{$.slug}}' })
    expect(byClass(card, 'project-more')[0].attributes?.['data-page-id']).toBeUndefined()
  })

  it('теги: сначала «Распродано» (item.soldOut), потом теги карточки', () => {
    const tags = byClass(card, 'project-tags')[0]
    expect(tags.children!.map((c) => [c.attributes?.class, c._repeat?.source])).toEqual([
      ['project-tags-sold', '$.soldOut'],
      ['project-tags-list', '$.tags'],
    ])
    expect(tags.children![0].children![0]).toMatchObject({ content: '{{$.label}}', attributes: { class: 'project-label--sold' } })
    expect(tags.children![1].children![0].content).toBe('{{$}}')
  })

  it('узлы с данными получили новые id — перевод Doʼstlik не ляжет на все карточки', () => {
    for (const id of [OLD.card, OLD.badge, OLD.intro, OLD.firstTag]) expect(byId(result.structure, id)).toBeUndefined()
  })

  it('«Цена по запросу» и «Подробнее» сохранили id — их переводы работают для всех карточек', () => {
    expect(byId(card, OLD.price)?.attributes?.class).toBe('project-price')
    expect(byId(card, OLD.more)?.attributes?.class).toBe('project-more')
  })

  it('id уникальны, узлы полные, остальной блок не тронут', () => {
    const all = findAll(result.structure, () => true).map((n) => n.id)
    expect(new Set(all).size).toBe(all.length)
    expect(incompleteNodes(result.structure)).toEqual([])
    expect(byClass(result.structure, 'class-filter')).toEqual(byClass(CATALOG, 'class-filter'))
    expect(byClass(result.structure, 'home-pages-block')).toEqual(byClass(CATALOG, 'home-pages-block'))
  })

  it('CSS: обёртки тегов без своего бокса, у распроданного нет цены', () => {
    const css = (result.structure.metadata as any).globalCss as string
    expect(css).toContain(CATALOG_CSS_MARKER)
    expect(css).toMatch(/\.project-tags-sold,\s*\.project-tags-list\s*{\s*display: contents;/)
    expect(css).toMatch(/\.project-card\.is-sold-visible \.project-price\s*{\s*display: none;/)
  })

  it('исходная структура не мутирует', () => {
    expect(byClass(CATALOG, 'project-grid')[0]._repeat).toBeUndefined()
  })

  it('повторный запуск ничего не меняет', () => {
    const again = migrateCatalogBlock(result.structure, ids())
    expect(again.alreadyMigrated).toBe(true)
    expect(again.cards).toEqual([])
    expect(again.structure).toEqual(result.structure)
  })

  it('грид без карточки-образца — ошибка, а не пустой каталог', () => {
    const broken = clone(CATALOG)
    byClass(broken, 'project-grid')[0].children = []
    expect(() => migrateCatalogBlock(broken, ids())).toThrow(MigrationError)
  })
})

describe('migrateCatalogBlock — главная после публикации', () => {
  const { structure } = migrateCatalogBlock(CATALOG, ids())
  const { $, html } = render(structure, { complexes: [DOSTLIK, OZMAKON] })
  const cards = $('.project-grid > .project-card').toArray().map((c) => $(c))
  const bySlug = (slug: string) => cards.find((c) => c.attr('data-href') === `/complex/${slug}`)!
  const tagTexts = (card: ReturnType<typeof $>) => card.find('.project-tags span').toArray().map((s) => $(s).text().trim())

  it('карточки — ровно проекты из данных, в их порядке', () => {
    expect(cards.map((c) => c.attr('data-href'))).toEqual(['/complex/assalom-dostlik', '/complex/ozmakon'])
    expect(cards.map((c) => c.find('h3').text())).toEqual(['Assalom Doʼstlik', 'OʼzMakon'])
  })

  it('продающийся: класс, фильтр, картинка, теги, цена по запросу, ссылка', () => {
    const card = bySlug('assalom-dostlik')
    expect(card.attr('data-class')).toBe('comfort')
    expect(card.hasClass('is-sold-visible')).toBe(false)
    expect(card.find('.project-class').text()).toBe('Комфорт+')
    expect(card.find('.project-body p').text()).toBe('Комплекс с закрытой территорией.')
    expect(tagTexts(card)).toEqual(['Ремонт в подарок', 'Ипотека'])
    expect(card.find('.project-label--sold')).toHaveLength(0)
    expect(card.find('.project-price').text()).toContain('Цена по')
    expect(card.find('.project-more').attr('href')).toBe('/complex/assalom-dostlik')
    expect(html).toContain("url('/media/dostlik.jpg')")
  })

  it('распроданный: класс карточки и тег «Распродано» первым', () => {
    const card = bySlug('ozmakon')
    expect(card.hasClass('is-sold-visible')).toBe(true)
    expect(tagTexts(card)).toEqual(['Распродано'])
    expect(card.find('.project-tags span').first().hasClass('project-label--sold')).toBe(true)
  })

  it('ни одного плейсхолдера в HTML', () => {
    expect(html).not.toContain('{{')
  })

  it('данных нет (пустой каталог) — пустой грид, а не карточка с плейсхолдерами', () => {
    const empty = render(structure, { complexes: [] })
    expect(empty.$('.project-card')).toHaveLength(0)
    expect(empty.html).not.toContain('{{')
  })
})

describe('estateCardPatch — перенос ручной карточки в estate', () => {
  const card: StaticCatalogCard = staticCatalogCards(CATALOG)[0]
  const UZ: Record<string, string> = {
    [OLD.firstTag]: 'Ta’mir sovg‘a sifatida',
    'node-1782187948709-upq0ipuw1': 'Chegirma',
    'node-1782187948709-njuewh9e5': 'Aksiya',
    'node-1782187948709-vtha7bhq5': 'Ipoteka',
  }
  const uz = (nodeId: string, locale: string) => (locale === 'uz' ? UZ[nodeId] : undefined)
  const fresh = (extra: Partial<EstateAdminComplex> = {}): EstateAdminComplex => ({
    id: 'c1',
    slug: 'assalom-dostlik',
    filterClass: 'business',
    cardImage: '',
    cardTags: [],
    translations: { uz: { name: 'Assalom Doʼstlik', intro: 'uz intro' } },
    ...extra,
  })

  it('пустой проект получает теги, картинку, класс и перевод тегов', () => {
    const patch = estateCardPatch(fresh(), card, uz)!
    expect(patch.body).toEqual({
      cardTags: ['Ремонт в подарок', 'Скидка', 'Акция', 'Ипотека'],
      cardImage: '/media/d65851c0-0bcf-4901-87d7-4d91c77738c3.jpg',
      filterClass: 'comfort',
      translations: {
        // Остальные переводы проекта на месте: admin API заменяет их целиком.
        uz: { name: 'Assalom Doʼstlik', intro: 'uz intro', cardTags: ['Ta’mir sovg‘a sifatida', 'Chegirma', 'Aksiya', 'Ipoteka'] },
      },
    })
  })

  it('тег без перевода остаётся русским, а не пропадает', () => {
    const partial = (nodeId: string, locale: string) => (nodeId === OLD.firstTag ? undefined : uz(nodeId, locale))
    const body = estateCardPatch(fresh(), card, partial)!.body as any
    expect(body.translations.uz.cardTags).toEqual(['Ремонт в подарок', 'Chegirma', 'Aksiya', 'Ipoteka'])
  })

  it('нет ни одного перевода — переводы проекта не трогаются', () => {
    const body = estateCardPatch(fresh(), card, () => undefined)!.body
    expect(body.translations).toBeUndefined()
  })

  it('заполненное в estate не перетирается', () => {
    const filled = fresh({
      cardTags: ['Своё'],
      cardImage: '/media/own.jpg',
      filterClass: 'premium',
      translations: { uz: { cardTags: ['O‘ziniki'] } },
    })
    expect(estateCardPatch(filled, card, uz)).toBeNull()
  })

  it('класс по умолчанию «business» у бизнес-карточки — не правка', () => {
    const business = { ...staticCatalogCards(CATALOG)[1] }
    const patch = estateCardPatch(fresh({ cardTags: ['x'], cardImage: '/y.jpg', translations: { uz: { cardTags: ['z'] } } }), business, uz)
    expect(patch).toBeNull()
  })

  it('неизвестный класс из вёрстки не уходит в estate', () => {
    const odd = { ...card, filterClass: 'luxury' }
    expect(estateCardPatch(fresh(), odd, uz)!.body.filterClass).toBeUndefined()
  })

  it('исходный объект estate не мутирует', () => {
    const current = fresh()
    const before = clone(current)
    estateCardPatch(current, card, uz)
    expect(current).toEqual(before)
  })
})

describe('migrateHeroBlock — бейдж «Распродано» в шапке проекта', () => {
  const result = migrateHeroBlock(HERO)

  it('после бейджа класса — повторитель по item.soldOut', () => {
    const copy = byClass(result.structure, 'complex-hero-copy')[0]
    expect(copy.children!.map((c) => c.attributes?.class ?? c.tagName)).toEqual(['badge', 'hero-sold', 'h1', 'p'])
    const wrap = copy.children![1]
    expect(wrap._repeat).toEqual({ source: 'item.soldOut' })
    expect(wrap.children![0]).toMatchObject({ content: '{{$.label}}', attributes: { class: 'badge badge--sold' } })
    expect(incompleteNodes(result.structure)).toEqual([])
    expect((result.structure.metadata as any).globalCss).toContain(HERO_CSS_MARKER)
  })

  it('распроданный — два бейджа, без повтора html-id projectClass', () => {
    const { $ } = render(result.structure, { className: 'Бизнес', name: 'OʼzMakon', intro: '', heroImages: [], soldOut: [{ label: 'Sotilgan' }] })
    expect($('.complex-hero-copy .badge').toArray().map((b) => $(b).text())).toEqual(['Бизнес', 'Sotilgan'])
    expect($('#projectClass')).toHaveLength(1)
  })

  it('продающийся — только бейдж класса', () => {
    const { $ } = render(result.structure, { className: 'Комфорт+', name: 'Doʼstlik', intro: '', heroImages: [], soldOut: [] })
    expect($('.complex-hero-copy .badge')).toHaveLength(1)
  })

  it('повторный запуск ничего не меняет', () => {
    expect(migrateHeroBlock(result.structure)).toMatchObject({ alreadyMigrated: true, changes: [] })
  })
})

describe('migrateChoiceBlock — планировки без цен у распроданного', () => {
  const result = migrateChoiceBlock(CHOICE)

  it('корень несёт состояние продаж и подпись из данных проекта', () => {
    expect(result.structure.attributes).toMatchObject({
      [SALE_STATE_ATTR]: '{{item.saleStateClass}}',
      [SOLD_LABEL_ATTR]: '{{item.soldOut.0.label}}',
    })
  })

  it('группы фильтра цены (панель «Цена» и «Все фильтры») помечены', () => {
    const groups = byClass(result.structure, 'filter-group--price')
    expect(groups.map((g) => g.id)).toEqual(['flt-div-26', 'flt-div-53'])
  })

  it('CSS скрывает цену, кнопку и панель фильтра цены под data-sale-state', () => {
    const css = (result.structure.metadata as any).globalCss as string
    expect(css).toContain(CHOICE_CSS_MARKER)
    for (const selector of ['.apartment-price', '.filter-trigger[data-panel="price"]', '.filter-panel[data-panel="price"]', '.filter-group--price']) {
      expect(css).toContain(`[data-sale-state~="is-sold-out"] ${selector}`)
    }
  })

  it('на странице: распроданный и продающийся проект', () => {
    const sold = render(result.structure, { saleStateClass: 'is-sold-out', soldOut: [{ label: 'Распродано' }], planTypes: [] }).$('#choice')
    expect(sold.attr(SALE_STATE_ATTR)).toBe('is-sold-out')
    expect(sold.attr(SOLD_LABEL_ATTR)).toBe('Распродано')

    const active = render(result.structure, { saleStateClass: '', soldOut: [], planTypes: [] }).$('#choice')
    expect(active).toHaveLength(1)
    expect(active.attr(SALE_STATE_ATTR) ?? '').toBe('')
    expect(active.attr(SOLD_LABEL_ATTR) ?? '').toBe('')
  })

  it('атрибуты переживают linked-плейсхолдер (его class перекрывает class блока)', () => {
    const placeholder = {
      id: 'ph',
      attributes: { id: 'choice', class: 'detail-section detail-section-pad' },
      metadata: { linkedBlockId: 'choice-block' },
      children: [],
    }
    const expanded = (linkedBlocksService as any)._applyLinkedBlocks(
      placeholder,
      new Map([['choice-block', result.structure]]),
      new Set()
    )
    expect(expanded.attributes).toMatchObject({
      class: 'detail-section detail-section-pad',
      [SALE_STATE_ATTR]: '{{item.saleStateClass}}',
      [SOLD_LABEL_ATTR]: '{{item.soldOut.0.label}}',
    })
  })

  it('повторный запуск ничего не меняет', () => {
    expect(migrateChoiceBlock(result.structure)).toMatchObject({ alreadyMigrated: true, changes: [] })
  })

  it('нет фильтра цены — ошибка', () => {
    const broken = clone(CHOICE)
    for (const n of findAll(broken, (x) => x.attributes?.['data-filter'] === 'priceMin')) delete n.attributes!['data-filter']
    expect(() => migrateChoiceBlock(broken)).toThrow(MigrationError)
  })
})

describe('dropPublishWhitelist', () => {
  const whitelist = { id: 'publish-whitelist', type: 'include', filter: { field: 'slug', operator: 'in', value: ['a'] }, enabled: true }
  const other = { id: 'sort', type: 'sort' }

  it('убирает только publish-whitelist', () => {
    expect(dropPublishWhitelist([whitelist, other])).toEqual([other])
    expect(dropPublishWhitelist([whitelist])).toEqual([])
  })

  it('его нет — null (нечего записывать)', () => {
    expect(dropPublishWhitelist([other])).toBeNull()
    expect(dropPublishWhitelist(undefined)).toBeNull()
  })
})
