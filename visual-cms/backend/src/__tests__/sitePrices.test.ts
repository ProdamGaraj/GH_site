/**
 * Цен на сайте нет: вычистка цен из блоков и страниц CMS.
 *
 * Каталог на главной — снимок живого блока «Complexes» со стенда (2026-09-30);
 * остальное — разметка, как она встречается в мёртвых блоках и черновиках
 * (старые карточки квартир дизайна, фильтр цены) и на живых страницах
 * (сноска о стоимости, «Площадь от» в .project-price коммерции).
 */
import catalogBlock from './fixtures/catalogBlockLive.json'
import { priceReason, stripPrices } from '../scripts/sitePrices'
import { StructureNode, findAll, hasClass, incompleteNodes } from '../scripts/choiceToPlanTypes'

const node = (over: StructureNode): StructureNode => ({ attributes: {}, children: [], styles: { properties: {} }, ...over })
const texts = (root: StructureNode) => findAll(root, (n) => typeof n.content === 'string').map((n) => n.content)

describe('каталог на главной (живой блок)', () => {
  const live = catalogBlock as unknown as StructureNode
  const result = stripPrices(live)
  const card = () => findAll(result.structure, (n) => hasClass(n, 'project-card'))[0]

  it('«Цена по запросу» убрана из карточки', () => {
    expect(findAll(result.structure, (n) => hasClass(n, 'project-price'))).toEqual([])
    expect(texts(result.structure).join(' ')).not.toMatch(/Цена/)
    expect(result.removedIds).toContain('node-1782187948709-2b86zmadg')
  })

  it('«Подробнее» остаётся и прижата вправо', () => {
    const [foot] = findAll(card(), (n) => hasClass(n, 'project-foot'))
    expect(foot.children!.map((c) => c.attributes?.class)).toEqual(['project-more'])
    expect(foot.styles!.properties).toMatchObject({ display: 'flex', justifyContent: 'flex-end' })
  })

  it('остальная карточка цела: название, описание, теги, класс', () => {
    const all = texts(card()).join(' ')
    for (const binding of ['{{$.name}}', '{{$.intro}}', '{{$.className}}', '{{$.label}}', 'Подробнее']) {
      expect(all).toContain(binding)
    }
    expect(incompleteNodes(result.structure)).toEqual([])
  })

  it('повторный запуск ничего не меняет, исходник не мутируется', () => {
    const snapshot = JSON.stringify(live)
    const again = stripPrices(result.structure)
    expect(again.alreadyMigrated).toBe(true)
    expect(again.changes).toEqual([])
    expect(JSON.stringify(live)).toBe(snapshot)
  })
})

describe('что считается ценой', () => {
  it('карточка квартиры дизайна: цена и старая цена', () => {
    const price = node({
      id: 'p',
      attributes: { class: 'apartment-price' },
      children: [node({ id: 's', tagName: 'span', content: '1 354 320 000 UZS' }), node({ id: 'o', attributes: { class: 'old-price' }, content: '1 539 000 000 UZS' })],
    })
    expect(priceReason(price)).toBe('цена карточки')
    expect(priceReason(node({ attributes: { class: 'old-price' }, content: '1 UZS' }))).toBe('старая цена')
  })

  it('сумма как весь текст узла — на любом языке и в любой валюте', () => {
    for (const money of ['1 354 320 000 UZS', 'от 450 млн сум', '450 000 000 so‘m', '$ 50 000', '120 000 USD', '1 153 779 562 UZS dan']) {
      expect(priceReason(node({ content: money }))).toBe('сумма')
    }
  })

  it('фильтр цены: кнопка, панель, группа с полями цены', () => {
    expect(priceReason(node({ attributes: { class: 'filter-trigger', 'data-panel': 'price' }, content: 'Цена ⌄' }))).toBe('кнопка фильтра цены')
    // Вёрстка дизайна: без data-panel, только подпись.
    expect(priceReason(node({ attributes: { class: 'filter-trigger' }, content: 'Цена ⌄' }))).toBe('кнопка фильтра цены')
    expect(priceReason(node({ attributes: { class: 'filter-trigger' }, content: 'Narx' }))).toBe('кнопка фильтра цены')
    expect(priceReason(node({ attributes: { class: 'filter-trigger' }, content: 'Комнатность ⌄' }))).toBeNull()
    expect(priceReason(node({ attributes: { class: 'filter-panel', 'data-panel': 'price' } }))).toBe('панель фильтра цены')
    const group = node({
      attributes: { class: 'filter-group' },
      children: [node({ tagName: 'input', attributes: { 'data-filter': 'priceMin' } })],
    })
    expect(priceReason(group)).toBe('группа фильтра цены')
  })

  it('привязка к цене из данных', () => {
    expect(priceReason(node({ tagName: 'span', content: '{{$.priceLabel}}' }))).toBe('привязка к цене')
    expect(priceReason(node({ attributes: { class: 'project-price' }, children: [node({ content: '{{item.priceFrom}}' })] }))).toBe(
      'цена карточки проекта'
    )
  })

  it('не цена: сноска о стоимости, «Площадь от» в .project-price, площади и числа', () => {
    const notPrices = [
      node({ tagName: 'span', content: '*Стоимость и условия уточняйте у менеджеров Golden House.' }),
      node({ attributes: { class: 'project-price' }, children: [node({ content: 'Площадь от' }), node({ content: '78 м²' })] }),
      node({ content: '> 1 млн м²' }),
      node({ content: '1 млн+' }),
      node({ content: '2 кв. 2028' }),
      node({ attributes: { class: 'filter-group' }, children: [node({ tagName: 'input', attributes: { 'data-filter': 'areaMin' } })] }),
      node({ attributes: { class: 'filter-trigger', 'data-panel': 'area' }, content: 'Площадь' }),
    ]
    for (const n of notPrices) expect(priceReason(n)).toBeNull()
  })
})

describe('stripPrices — разметка мёртвых блоков и черновиков', () => {
  const page = (): StructureNode =>
    node({
      id: 'root',
      children: [
        node({
          id: 'toolbar',
          attributes: { class: 'apartment-toolbar' },
          children: [
            node({ id: 'rooms', tagName: 'button', attributes: { class: 'filter-trigger', 'data-panel': 'rooms' }, content: 'Комнатность' }),
            node({ id: 'price-btn', tagName: 'button', attributes: { class: 'filter-trigger', 'data-panel': 'price' }, content: 'Цена ⌄' }),
            node({
              id: 'price-panel',
              attributes: { class: 'filter-panel', 'data-panel': 'price' },
              children: [node({ id: 'price-min', tagName: 'input', attributes: { 'data-filter': 'priceMin' } })],
            }),
          ],
        }),
        node({
          id: 'card',
          tagName: 'article',
          attributes: { class: 'apartment-card', 'data-price': '1354320000', 'data-old-price': '1539000000', 'data-rooms': '4' },
          children: [
            node({ id: 'title', tagName: 'h3', content: '4-комн. 114 м²' }),
            node({
              id: 'price',
              attributes: { class: 'apartment-price' },
              children: [node({ id: 'now', tagName: 'span', content: '1 354 320 000 UZS' })],
            }),
          ],
        }),
        node({ id: 'note', tagName: 'span', content: '*Стоимость и условия уточняйте у менеджеров Golden House.' }),
      ],
    })

  const result = stripPrices(page())

  it('убраны фильтр цены, цена карточки и её data-атрибуты', () => {
    const ids = findAll(result.structure, (n) => typeof n.id === 'string').map((n) => n.id)
    expect(ids).toEqual(['root', 'toolbar', 'rooms', 'card', 'title', 'note'])
    const card = findAll(result.structure, (n) => n.id === 'card')[0]
    expect(card.attributes).toEqual({ class: 'apartment-card', 'data-rooms': '4' })
  })

  it('удалённые узлы — вместе с детьми: по ним чистятся переводы', () => {
    expect(result.removedIds.sort()).toEqual(['now', 'price', 'price-btn', 'price-min', 'price-panel'])
  })

  it('сноска о стоимости остаётся — это не цена', () => {
    expect(texts(result.structure)).toContain('*Стоимость и условия уточняйте у менеджеров Golden House.')
  })

  it('правки перечислены по-человечески', () => {
    expect(result.changes).toEqual(
      expect.arrayContaining([
        'кнопка фильтра цены: price-btn «Цена ⌄»',
        'цена карточки: price «1 354 320 000 UZS»',
        'card: без data-price, data-old-price',
      ])
    )
  })

  it('без цен — правок нет', () => {
    const clean = node({ id: 'x', children: [node({ id: 'y', content: 'Площадь от 78 м²' })] })
    expect(stripPrices(clean)).toMatchObject({ alreadyMigrated: true, changes: [], removedIds: [] })
  })
})
