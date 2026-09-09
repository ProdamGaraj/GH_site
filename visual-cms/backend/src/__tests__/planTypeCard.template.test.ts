/**
 * Секция «Выбрать планировку»: разметка против настоящего движка подстановки.
 *
 * Разметка блока живёт в CMS, а не в коде, и проверить её обычно нечем — ошибку
 * видно только на опубликованной странице. Здесь фрагмент прогоняется через тот
 * же substituteItemData, что и деплой коллекции, с данными в форме DTO
 * estate-service. Так плейсхолдер, который никуда не подставится, и repeater
 * по несуществующему полю ловятся до заливки в живой блок, а не после.
 *
 * Методы приватные — дёргаем через `as any`. БД мокаем: подстановка чистая.
 */
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(), find: jest.fn(), save: jest.fn(), findByIds: jest.fn(),
    }),
  },
}))

import { deployService } from '../services/DeployService'

const FRAGMENT = require('./fixtures/planTypeCard.json')

const substitute = (structure: unknown, item: unknown) =>
  (deployService as any).substituteItemData(structure, item)

/** DTO проекта в той форме, в какой его отдаёт estate-service. */
const ITEM = {
  slug: 'ozmakon-business',
  name: "O'zMakon Business",
  planSections: [{ title: 'Планировки' }],
  planRooms: ['1', '2', '3'],
  planViews: ['двор', 'бульвар'],
  planTypes: [
    {
      id: 'p1',
      planName: 'К2-54.65-6',
      rooms: 2,
      title: '2-комн. 56.12 м²',
      areaLabel: '55.64 – 56.12 м²',
      priceLabel: 'от 1 153 779 562 UZS',
      countLabel: '12 квартир',
      floorsLabel: 'этажи 3–16',
      image: 'https://cms/media/a.jpg',
      cover: [{ image: 'https://cms/media/a.jpg' }],
      imagesAttr: 'https://cms/media/a.jpg|https://cms/media/b.jpg',
      panorama: [{ url: 'https://tour/x' }],
      apartmentsCount: 12,
      areaMin: 55.64,
      areaMax: 56.12,
      priceMin: 1153779562,
      priceMax: 1300000000,
      floorMin: 3,
      floorMax: 16,
      floorsAttr: '3,4,7,12,16',
      entrancesAttr: '1,2',
      windowViewsAttr: 'бульвар|двор',
    },
    {
      id: 'p2',
      planName: 'К1-40.00-2',
      rooms: 1,
      title: '1-комн. 40 м²',
      areaLabel: '40 м²',
      priceLabel: 'от 845 861 909 UZS',
      countLabel: '1 квартира',
      floorsLabel: '5 этаж',
      image: '',
      cover: [],
      imagesAttr: '',
      panorama: [],
      apartmentsCount: 1,
      areaMin: 40,
      areaMax: 40,
      priceMin: 845861909,
      priceMax: 845861909,
      floorMin: 5,
      floorMax: 5,
      floorsAttr: '5',
      entrancesAttr: '1',
      windowViewsAttr: 'двор',
    },
  ],
}

const out = () => substitute(JSON.parse(JSON.stringify(FRAGMENT)), ITEM)

/** Первый узел, удовлетворяющий условию. */
function find(node: any, test: (n: any) => boolean): any {
  if (!node || typeof node !== 'object') return null
  if (test(node)) return node
  for (const child of node.children ?? []) {
    const hit = find(child, test)
    if (hit) return hit
  }
  return null
}

function findAll(node: any, test: (n: any) => boolean, acc: any[] = []): any[] {
  if (!node || typeof node !== 'object') return acc
  if (test(node)) acc.push(node)
  for (const child of node.children ?? []) findAll(child, test, acc)
  return acc
}

const attr = (node: any, name: string) => node?.attributes?.[name]
const hasClass = (node: any, cls: string) =>
  String(attr(node, 'class') || '').split(/\s+/).includes(cls)

describe('карточки планировок', () => {
  it('разворачиваются по числу типов', () => {
    const cards = findAll(out(), (n) => hasClass(n, 'apartment-card'))
    expect(cards).toHaveLength(2)
  })

  it('подписи подставляются целиком', () => {
    const card = findAll(out(), (n) => hasClass(n, 'apartment-card'))[0]
    const texts = findAll(card, (n) => typeof n.content === 'string').map((n) => n.content)
    expect(texts).toContain('2-комн. 56.12 м²')
    expect(texts).toContain('от 1 153 779 562 UZS')
    expect(texts).toContain('12 квартир')
    expect(texts).toContain('этажи 3–16')
  })

  it('атрибуты фильтра получают значения, а не остаются шаблоном', () => {
    const card = findAll(out(), (n) => hasClass(n, 'apartment-card'))[0]
    expect(attr(card, 'data-rooms')).toBe('2')
    expect(attr(card, 'data-price-min')).toBe('1153779562')
    expect(attr(card, 'data-price-max')).toBe('1300000000')
    expect(attr(card, 'data-area-min')).toBe('55.64')
    expect(attr(card, 'data-floor-min')).toBe('3')
    expect(attr(card, 'data-floor-max')).toBe('16')
    expect(attr(card, 'data-floors')).toBe('3,4,7,12,16')
    expect(attr(card, 'data-views')).toBe('бульвар|двор')
  })

  it('ссылки на все ракурсы уезжают в атрибут модалки', () => {
    const card = findAll(out(), (n) => hasClass(n, 'apartment-card'))[0]
    expect(attr(card, 'data-plan-images')).toBe(
      'https://cms/media/a.jpg|https://cms/media/b.jpg'
    )
  })

  it('обложка подставляется в background-image', () => {
    const card = findAll(out(), (n) => hasClass(n, 'apartment-card'))[0]
    const visual = find(card, (n) => hasClass(n, 'plan-visual'))
    const image = visual.children[0]
    expect(image.styles.properties['background-image']).toBe('url("https://cms/media/a.jpg")')
  })

  it('тип без картинки не даёт пустой url() — узел просто не создаётся', () => {
    const card = findAll(out(), (n) => hasClass(n, 'apartment-card'))[1]
    const visual = find(card, (n) => hasClass(n, 'plan-visual'))
    expect(visual.children).toHaveLength(0)
  })

  it('3D-тур появляется только там, где он есть', () => {
    const cards = findAll(out(), (n) => hasClass(n, 'apartment-card'))
    expect(findAll(cards[0], (n) => hasClass(n, 'plan-tour'))).toHaveLength(1)
    expect(findAll(cards[1], (n) => hasClass(n, 'plan-tour'))).toHaveLength(0)
  })

  it('ссылка тура ведёт на настоящий адрес', () => {
    const tour = find(out(), (n) => hasClass(n, 'plan-tour'))
    expect(attr(tour, 'href')).toBe('https://tour/x')
  })
})

describe('чипсы фильтра', () => {
  it('комнатности разворачиваются из данных проекта', () => {
    const chips = findAll(
      out(),
      (n) => attr(n, 'data-filter-field') === 'rooms' && attr(n, 'data-filter-value') !== ''
    )
    expect(chips.map((c) => attr(c, 'data-filter-value'))).toEqual(['1', '2', '3'])
    expect(chips.map((c) => c.content)).toEqual(['1', '2', '3'])
  })

  it('виды из окон разворачиваются из данных проекта', () => {
    const chips = findAll(
      out(),
      (n) => attr(n, 'data-filter-field') === 'views' && attr(n, 'data-filter-value') !== ''
    )
    expect(chips.map((c) => attr(c, 'data-filter-value'))).toEqual(['двор', 'бульвар'])
  })

  it('чипс «Все» остаётся один на группу и активен по умолчанию', () => {
    const all = findAll(out(), (n) => attr(n, 'data-filter-value') === '')
    expect(all).toHaveLength(2)
    for (const chip of all) expect(hasClass(chip, 'is-active')).toBe(true)
  })

  it('виды выбираются несколькими, комнатность — одной', () => {
    const view = find(
      out(),
      (n) => attr(n, 'data-filter-field') === 'views' && attr(n, 'data-filter-value') === 'двор'
    )
    const room = find(
      out(),
      (n) => attr(n, 'data-filter-field') === 'rooms' && attr(n, 'data-filter-value') === '2'
    )
    expect(attr(view, 'data-filter-multiple')).toBe('true')
    expect(attr(room, 'data-filter-multiple')).toBeUndefined()
  })

  it('диапазоны объявлены на все три числовых поля', () => {
    const bounds = findAll(out(), (n) => attr(n, 'data-filter-bound') !== undefined)
    const fields = [...new Set(bounds.map((n) => attr(n, 'data-filter-field')))].sort()
    expect(fields).toEqual(['area', 'floor', 'price'])
    expect(bounds).toHaveLength(6)
  })
})

describe('контракт с рантаймом фильтра', () => {
  it('корень объявлен — без него скрипт не инжектится', () => {
    expect(attr(find(out(), (n) => attr(n, 'data-filter-root') !== undefined), 'data-filter-root'))
      .toBe('true')
  })

  it('счётчик и заглушка на месте', () => {
    expect(find(out(), (n) => attr(n, 'data-filter-count') !== undefined)).not.toBeNull()
    expect(find(out(), (n) => attr(n, 'data-filter-empty') !== undefined)).not.toBeNull()
  })

  it('кнопка сброса на месте', () => {
    expect(find(out(), (n) => attr(n, 'data-filter-reset') !== undefined)).not.toBeNull()
  })

  it('каждая карточка помечена как фильтруемая', () => {
    const cards = findAll(out(), (n) => hasClass(n, 'apartment-card'))
    for (const card of cards) expect(attr(card, 'data-filter-item')).toBe('true')
  })
})

describe('пустые данные', () => {
  const empty = () =>
    substitute(JSON.parse(JSON.stringify(FRAGMENT)), {
      slug: 'harizma',
      name: 'Harizma',
      planSections: [],
      planRooms: [],
      planViews: [],
      planTypes: [],
    })

  it('секции нет вовсе — пустая панель фильтра на странице не нужна', () => {
    expect(findAll(empty(), (n) => attr(n, 'data-filter-root') !== undefined)).toHaveLength(0)
    expect(findAll(empty(), (n) => attr(n, 'data-filter-chip') !== undefined)).toHaveLength(0)
    expect(findAll(empty(), (n) => hasClass(n, 'apartment-card'))).toHaveLength(0)
  })

  it('проект с планировками секцию получает', () => {
    expect(findAll(out(), (n) => attr(n, 'data-filter-root') !== undefined)).toHaveLength(1)
  })

  it('нерасставленных плейсхолдеров не остаётся', () => {
    expect(JSON.stringify(empty())).not.toContain('{{')
  })
})

describe('весь фрагмент', () => {
  it('не оставляет ни одного {{...}} после подстановки', () => {
    expect(JSON.stringify(out())).not.toContain('{{')
  })

  it('не ссылается на поля, которых нет в DTO проекта', () => {
    // Каждый {{item.*}} и {{$.*}} должен иметь соответствие в данных, иначе
    // подстановка молча вставит пустую строку.
    const raw = JSON.stringify(FRAGMENT)
    const itemFields = [...raw.matchAll(/\{\{item\.([a-zA-Z0-9_]+)/g)].map((m) => m[1])
    for (const field of new Set(itemFields)) {
      expect(Object.prototype.hasOwnProperty.call(ITEM, field)).toBe(true)
    }
    const planFields = [...raw.matchAll(/\{\{\$\.([a-zA-Z0-9_]+)/g)].map((m) => m[1])
    const known = new Set([
      ...Object.keys(ITEM.planTypes[0]),
      'image', // внутри cover
      'url', // внутри panorama
      'title', // заголовок секции из planSections
    ])
    for (const field of new Set(planFields)) {
      expect(known.has(field)).toBe(true)
    }
  })
})
