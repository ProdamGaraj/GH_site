/**
 * Секция «Выбрать» без цены: фильтры площади и этажа вместо фильтра цены,
 * карточка без цены — на снимке живого блока со стенда (2026-09-29).
 *
 * Поведение самих фильтров в браузере — в choiceFilters.runtime.test.ts.
 */
import liveBlock from './fixtures/choiceBlockLive.json'
import { migrateChoiceFilters } from '../scripts/choiceFilters'
import {
  CARD_FLOORS_ATTR,
  CARD_RANGE_ATTRS,
  PageTranslation,
  rangeTranslationPlan,
} from '../scripts/choiceRanges'
import { FILTERS_CSS_MARKER, FILTERS_JS_MARKER } from '../scripts/choiceFilters.assets'
import { StructureNode, findAll, hasClass, incompleteNodes } from '../scripts/choiceToPlanTypes'

const LIVE = liveBlock as unknown as StructureNode
const result = migrateChoiceFilters(LIVE)
const out = result.structure

const byId = (root: StructureNode, id: string) => findAll(root, (n) => n.id === id)[0]
const panel = (name: string) => findAll(out, (n) => hasClass(n, 'filter-panel') && n.attributes?.['data-panel'] === name)
const card = () => findAll(out, (n) => hasClass(n, 'apartment-card'))[0]
const texts = (root: StructureNode) => JSON.stringify(root)

describe('фильтры: цена → площадь и этаж', () => {
  it('кнопки: цены нет, площадь и этаж — на её месте, между сроком сдачи и видом из окна', () => {
    const triggers = findAll(out, (n) => hasClass(n, 'filter-trigger')).map((n) => n.attributes!['data-panel'])
    expect(triggers).toEqual(['rooms', 'deadline', 'area', 'floor', 'windowViews', 'all'])
    const area = findAll(out, (n) => hasClass(n, 'filter-trigger') && n.attributes!['data-panel'] === 'area')[0]
    expect(area.content).toBe('Площадь')
    expect(area.attributes).toMatchObject({ type: 'button', class: 'filter-trigger' })
  })

  it('панели: площадь с «м²», этаж без единицы; поля «от/до» под свой фильтр', () => {
    expect(panel('price')).toHaveLength(0)
    const [area] = panel('area')
    const [floor] = panel('floor')
    expect(findAll(area, (n) => n.tagName === 'h3')[0].content).toBe('Площадь, м²')
    expect(findAll(floor, (n) => n.tagName === 'h3')[0].content).toBe('Этаж')

    const inputs = (root: StructureNode) => findAll(root, (n) => n.tagName === 'input').map((n) => n.attributes)
    expect(inputs(area)).toEqual([
      expect.objectContaining({ type: 'number', 'data-filter': 'areaMin', placeholder: 'от', inputmode: 'decimal', step: 'any' }),
      expect.objectContaining({ 'data-filter': 'areaMax', placeholder: 'до' }),
    ])
    expect(inputs(floor)).toEqual([
      expect.objectContaining({ 'data-filter': 'floorMin', inputmode: 'numeric' }),
      expect.objectContaining({ 'data-filter': 'floorMax' }),
    ])
    expect(inputs(floor)[0]).not.toHaveProperty('step')

    const unit = findAll(area, (n) => hasClass(n, 'range-unit'))
    expect(unit.map((n) => n.content)).toEqual(['м²'])
    const floorSpans = findAll(floor, (n) => n.tagName === 'span').map((n) => n.content)
    expect(floorSpans).toEqual(['—'])
  })

  it('кнопки «Сбросить / Показать» в новых панелях — как у остальных', () => {
    for (const name of ['area', 'floor']) {
      const actions = findAll(panel(name)[0], (n) => n.attributes?.['data-filter-action'] !== undefined)
      expect(actions.map((n) => [n.attributes!['data-filter-action'], n.content])).toEqual([
        ['reset', 'Сбросить'],
        ['apply', 'Показать'],
      ])
    }
  })

  it('«Все фильтры»: вместо группы цены — площадь и этаж, на её месте', () => {
    const [all] = panel('all')
    const groups = findAll(all, (n) => hasClass(n, 'filter-group'))
    const titles = groups.map((g) => findAll(g, (n) => n.tagName === 'h3')[0].content)
    expect(titles).toEqual(['Комнатность', 'Площадь, м²', 'Этаж', 'Срок сдачи', 'Вид из окна'])
    const ranges = groups.filter((g) => hasClass(g, 'filter-group--range'))
    expect(ranges).toHaveLength(2)
    expect(groups.some((g) => hasClass(g, 'filter-group--price'))).toBe(false)
  })

  it('цены в блоке не осталось ни в разметке, ни в привязках', () => {
    // Только дерево узлов: в CSS блока остаются безвредные правила .apartment-price.
    const json = texts({ ...out, metadata: {} })
    for (const gone of ['priceMin', 'priceMax', 'priceLabel', 'data-price', 'Цена', 'UZS', 'apartment-price']) {
      expect(json).not.toContain(gone)
    }
  })

  it('id новых узлов уникальны и детерминированы, узлы полные', () => {
    const ids = findAll(out, (n) => typeof n.id === 'string').map((n) => n.id!)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('flt-h3-20--area')
    expect(ids).toContain('flt-h3-47--floor')
    expect(incompleteNodes(out)).toEqual([])
    expect(JSON.stringify(migrateChoiceFilters(LIVE).structure)).toBe(JSON.stringify(out))
  })
})

describe('карточка', () => {
  it('без цены: ни строки «от … UZS», ни data-price', () => {
    const c = card()
    expect(c.attributes).not.toHaveProperty('data-price')
    expect(c.attributes).not.toHaveProperty('data-price-max')
    expect(findAll(c, (n) => hasClass(n, 'apartment-price'))).toEqual([])
  })

  it('данные для фильтров: площадь «от/до» и этажи группы', () => {
    expect(card().attributes).toMatchObject(CARD_RANGE_ATTRS)
  })

  it('прочие атрибуты на месте: комнатность, срок, ракурсы, вид из окна', () => {
    expect(card().attributes).toMatchObject({
      'data-rooms': '{{$.rooms}}',
      'data-deadline': '{{$.deadline}}',
      'data-plan-images': '{{$.imagesAttr}}',
      'data-windowViews': '{{$.windowViewsAttr}}',
    })
  })

  it('строка этажей помечена для окна планировки, класс проекта — как был', () => {
    const [floors] = findAll(card(), (n) => n.attributes?.[CARD_FLOORS_ATTR] !== undefined)
    expect(floors.content).toContain('{{$.floorsLabel}}')
    const [cls] = findAll(card(), (n) => n.attributes?.['data-apartment-class'] !== undefined)
    expect(cls.content).toContain('{{item.className}}')
  })
})

describe('скрипт и стили блока', () => {
  const css = out.metadata!.globalCss as string

  it('скрипт фильтров v6, стили v7', () => {
    expect(out.metadata!.globalJs as string).toContain(FILTERS_JS_MARKER)
    expect(css).toContain(FILTERS_CSS_MARKER)
    expect(css).not.toContain('choice-filters v6')
  })

  it('секция «Распродано» после фильтров не пропала при замене секции фильтров', () => {
    const before = LIVE.metadata!.globalCss as string
    const soldOut = before.slice(before.indexOf('/* ==== choice-sold-out'))
    expect(css.endsWith(soldOut)).toBe(true)
    expect(css.indexOf(FILTERS_CSS_MARKER)).toBeLessThan(css.indexOf('/* ==== choice-sold-out'))
  })

  it('исходный CSS блока до секций сохранён', () => {
    const before = LIVE.metadata!.globalCss as string
    const base = before.slice(0, before.indexOf('/* ==== choice-filters')).trimEnd()
    expect(css.startsWith(base)).toBe(true)
  })
})

describe('повторный запуск', () => {
  it('ничего не меняет', () => {
    const again = migrateChoiceFilters(out)
    expect(again.alreadyMigrated).toBe(true)
    expect(again.changes).toEqual([])
    expect(JSON.stringify(again.structure)).toBe(JSON.stringify(out))
  })
})

describe('переводы', () => {
  /** Переводы страницы-шаблона на стенде (uz) для узлов цены и соседей. */
  const ROWS: PageTranslation[] = [
    { id: 't1', nodeId: 'node-1783405103287-q0yzrtwmh', locale: 'uz', field: 'content', value: 'Narx' },
    { id: 't2', nodeId: 'flt-h3-20', locale: 'uz', field: 'content', value: 'Narx, UZS' },
    { id: 't3', nodeId: 'flt-h3-47', locale: 'uz', field: 'content', value: 'Narx, UZS' },
    { id: 't4', nodeId: 'flt-input-21', locale: 'uz', field: 'placeholder', value: 'dan' },
    { id: 't5', nodeId: 'flt-input-23', locale: 'uz', field: 'placeholder', value: 'gacha' },
    { id: 't6', nodeId: 'flt-btn-27', locale: 'uz', field: 'content', value: 'Tozalash' },
    { id: 't7', nodeId: 'flt-btn-28', locale: 'uz', field: 'content', value: 'Ko‘rsatish' },
    { id: 't8', nodeId: 'flt-h3-1', locale: 'uz', field: 'content', value: 'Xonalar soni' },
  ]
  const plan = rangeTranslationPlan(result.ranges, ROWS)
  const added = (nodeId: string, field = 'content') =>
    plan.add.filter((r) => r.nodeId === nodeId && r.field === field).map((r) => `${r.locale}:${r.value}`)

  it('новые подписи — по-узбекски, английских строк не заводим (страница на en не переводится)', () => {
    expect(added('node-1783405103287-q0yzrtwmh--area')).toEqual(['uz:Maydon'])
    expect(added('node-1783405103287-q0yzrtwmh--floor')).toEqual(['uz:Qavat'])
    expect(added('flt-h3-20--area')).toEqual(['uz:Maydon, m²'])
    expect(added('flt-h3-47--floor')).toEqual(['uz:Qavat'])
    expect(added('flt-span-24--area')).toEqual(['uz:m²'])
    expect(plan.add.every((r) => r.locale === 'uz')).toBe(true)
  })

  it('клоны получают переводы образцов: «dan / gacha», «Tozalash / Ko‘rsatish»', () => {
    expect(added('flt-input-21--area', 'placeholder')).toEqual(['uz:dan'])
    expect(added('flt-input-23--floor', 'placeholder')).toEqual(['uz:gacha'])
    expect(added('flt-btn-27--floor')).toEqual(['uz:Tozalash'])
    expect(added('flt-btn-28--area')).toEqual(['uz:Ko‘rsatish'])
  })

  it('«Narx» в новые узлы не копируется', () => {
    expect(plan.add.some((r) => r.value.startsWith('Narx'))).toBe(false)
  })

  it('переводы удалённых узлов цены удаляются, чужие остаются', () => {
    expect(plan.remove.sort()).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7'])
  })

  it('уже заведённый перевод не дублируется', () => {
    const existing: PageTranslation = { id: 'x', nodeId: 'flt-h3-20--area', locale: 'uz', field: 'content', value: 'Maydoni' }
    const again = rangeTranslationPlan(result.ranges, [...ROWS, existing])
    expect(again.add.filter((r) => r.nodeId === 'flt-h3-20--area')).toEqual([])
  })

  it('на уже переведённом блоке — ничего', () => {
    const again = rangeTranslationPlan(migrateChoiceFilters(out).ranges, ROWS)
    expect(again).toEqual({ add: [], remove: [] })
  })
})
