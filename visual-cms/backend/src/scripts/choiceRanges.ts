/**
 * Секция «Выбрать»: цена уходит с сайта, вместо фильтра цены — фильтры
 * площади и этажа (решение 2026-09-29).
 *
 * Что меняется в блоке «Complex choice»:
 * - кнопка, панель и группа «Все фильтры» цены → такие же для площади и
 *   этажа. Новые узлы — клоны узлов цены: у них те же классы, атрибуты и
 *   стили, а у кнопок «Сбросить / Показать» — те же переводы;
 * - карточка без цены: ни строки «от … UZS», ни data-price в разметке
 *   страницы. Вместо них — data-area-min/max и data-floors для фильтра;
 * - строка этажей в карточке помечена data-card-floors: её читает окно
 *   планировки (ComplexOverlaysRuntime), а не разбирает текст меты.
 *
 * Только чистое преобразование: запись — в `migrate-choice-filters.ts`.
 * Идемпотентно: каждая правка проверяет, не применена ли она уже.
 */
import { MigrationError, StructureNode, findAll, findOne, hasClass, setAttr, walk, withClass } from './choiceToPlanTypes'

/** Подписи по языкам: ru — в структуре, остальные — строками переводов. */
export interface Texts {
  ru: string
  uz: string
  en: string
}

export interface RangeSpec {
  /** Имя фильтра: data-panel, data-filter="<имя>Min|Max" (см. FILTERS_JS). */
  name: 'area' | 'floor'
  trigger: Texts
  title: Texts
  /** Единица после полей; null — без единицы (этаж). */
  unit: Texts | null
  inputmode: 'decimal' | 'numeric'
}

export const RANGE_SPECS: readonly RangeSpec[] = [
  {
    name: 'area',
    trigger: { ru: 'Площадь', uz: 'Maydon', en: 'Area' },
    title: { ru: 'Площадь, м²', uz: 'Maydon, m²', en: 'Area, m²' },
    unit: { ru: 'м²', uz: 'm²', en: 'm²' },
    inputmode: 'decimal',
  },
  {
    name: 'floor',
    trigger: { ru: 'Этаж', uz: 'Qavat', en: 'Floor' },
    title: { ru: 'Этаж', uz: 'Qavat', en: 'Floor' },
    unit: null,
    inputmode: 'numeric',
  },
]

/** Данные карточки для фильтров: поля PlanTypeDTO (estate, services/i18n.ts). */
export const CARD_RANGE_ATTRS: Record<string, string> = {
  'data-area-min': '{{$.areaMin}}',
  'data-area-max': '{{$.areaMax}}',
  'data-floors': '{{$.floorsAttr}}',
}
const CARD_PRICE_ATTRS = ['data-price', 'data-price-max']
const FLOORS_BINDING = '{{$.floorsLabel}}'
export const CARD_FLOORS_ATTR = 'data-card-floors'

const PRICE_PANEL = 'price'
const PRICE_INPUT = /^price(Min|Max)$/

export interface RangesResult {
  changes: string[]
  /** Узлы, которых больше нет: их переводы удаляются. */
  removedIds: string[]
  /** Клоны узлов цены: новый id → id образца (переводы копируются). */
  clones: Map<string, string>
  /** Узлы с новым текстом: `${id}|${поле}` → подписи по языкам. */
  retexts: Map<string, Texts>
}

const panelOf = (node: StructureNode) => node.attributes?.['data-panel']
const isPriceInput = (node: StructureNode) => PRICE_INPUT.test(node.attributes?.['data-filter'] ?? '')
const containsPriceInput = (node: StructureNode) => findAll(node, isPriceInput).length > 0

function idsOf(root: StructureNode): string[] {
  const ids: string[] = []
  walk(root, (n) => {
    if (n.id) ids.push(n.id)
  })
  return ids
}

/**
 * Клон узла цены под фильтр `spec`: id с суффиксом (детерминированно — повторный
 * запуск даёт те же id), тексты и атрибуты — под площадь или этаж.
 */
function cloneForRange(source: StructureNode, spec: RangeSpec, out: RangesResult): StructureNode {
  const copy: StructureNode = JSON.parse(JSON.stringify(source))
  walk(copy, (node) => {
    if (node.id) {
      const from = node.id
      node.id = `${from}--${spec.name}`
      out.clones.set(node.id, from)
    }
  })
  walk(copy, (node) => {
    const attrs = node.attributes ?? {}
    if (panelOf(node) === PRICE_PANEL) {
      setAttr(node, 'data-panel', spec.name)
      if (hasClass(node, 'filter-trigger')) retext(node, spec.trigger, out)
    }
    if (hasClass(node, 'filter-group--price')) {
      node.attributes = { ...attrs, class: (attrs.class ?? '').replace('filter-group--price', '').trim() }
      withClass(node, 'filter-group--range')
    }
    if (node.tagName === 'h3') retext(node, spec.title, out)
    const filter = node.attributes?.['data-filter'] ?? ''
    const bound = PRICE_INPUT.exec(filter)
    if (bound) {
      setAttr(node, 'data-filter', `${spec.name}${bound[1]}`)
      setAttr(node, 'inputmode', spec.inputmode)
      setAttr(node, 'min', '0')
      if (spec.inputmode === 'decimal') setAttr(node, 'step', 'any')
    }
  })
  // Единица — последний <span> в .range-box («UZS»): у площади «м²», у этажа её нет.
  walk(copy, (node) => {
    if (!hasClass(node, 'range-box')) return
    const spans = (node.children ?? []).filter((c) => c.tagName === 'span')
    const unit = spans.length > 1 ? spans[spans.length - 1] : undefined
    if (!unit) return
    if (spec.unit) {
      withClass(unit, 'range-unit')
      retext(unit, spec.unit, out)
    } else {
      node.children = node.children!.filter((c) => c !== unit)
      out.clones.delete(unit.id!)
    }
  })
  return copy
}

function retext(node: StructureNode, texts: Texts, out: RangesResult): void {
  node.content = texts.ru
  if (node.id) out.retexts.set(`${node.id}|content`, texts)
}

/** Заменяет в родителе каждый узел, подходящий под `pred`, клонами под площадь и этаж. */
function replaceWithRanges(
  root: StructureNode,
  pred: (n: StructureNode) => boolean,
  what: string,
  out: RangesResult
): void {
  walk(root, (parent) => {
    const children = parent.children ?? []
    if (!children.some(pred)) return
    parent.children = children.flatMap((child) => {
      if (!pred(child)) return [child]
      out.removedIds.push(...idsOf(child))
      return RANGE_SPECS.map((spec) => cloneForRange(child, spec, out))
    })
    out.changes.push(`${what}: цена → площадь и этаж`)
  })
}

/** Фильтры и карточка секции «Выбрать» без цены. Мутирует `structure` (копию). */
export function migrateRanges(structure: StructureNode): RangesResult {
  const out: RangesResult = { changes: [], removedIds: [], clones: new Map(), retexts: new Map() }

  replaceWithRanges(
    structure,
    (n) => hasClass(n, 'filter-trigger') && panelOf(n) === PRICE_PANEL,
    'кнопка фильтра',
    out
  )
  replaceWithRanges(
    structure,
    (n) => hasClass(n, 'filter-panel') && panelOf(n) === PRICE_PANEL,
    'панель фильтра',
    out
  )
  // Группа цены в «Все фильтры» (панель цены уже заменена выше).
  replaceWithRanges(
    structure,
    (n) => hasClass(n, 'filter-group') && containsPriceInput(n),
    'группа в «Все фильтры»',
    out
  )

  const card = findOne(structure, (n) => hasClass(n, 'apartment-card'), '.apartment-card')
  const priceAttrs = CARD_PRICE_ATTRS.filter((key) => card.attributes?.[key] !== undefined)
  for (const key of priceAttrs) delete card.attributes![key]
  if (priceAttrs.length) out.changes.push(`карточка: без ${priceAttrs.join(', ')} — цены нет и в разметке`)
  const added = Object.entries(CARD_RANGE_ATTRS).filter(([key, value]) => card.attributes?.[key] !== value)
  for (const [key, value] of added) setAttr(card, key, value)
  if (added.length) out.changes.push(`карточка: ${added.map(([key]) => key).join(', ')} для фильтров`)

  walk(card, (node) => {
    const prices = (node.children ?? []).filter((c) => hasClass(c, 'apartment-price'))
    if (!prices.length) return
    for (const price of prices) out.removedIds.push(...idsOf(price))
    node.children = node.children!.filter((c) => !prices.includes(c))
    out.changes.push('карточка: строка цены убрана')
  })

  const floors = findAll(card, (n) => typeof n.content === 'string' && n.content.includes(FLOORS_BINDING))
  if (floors.length !== 1) {
    throw new MigrationError(`В карточке ожидалась одна строка этажей (${FLOORS_BINDING}), найдено ${floors.length}`)
  }
  if (floors[0].attributes?.[CARD_FLOORS_ATTR] === undefined) {
    setAttr(floors[0], CARD_FLOORS_ATTR, '')
    out.changes.push(`карточка: строка этажей помечена ${CARD_FLOORS_ATTR} — её читает окно планировки`)
  }

  return out
}

/** Строка перевода страницы, как её отдаёт таблица translations. */
export interface PageTranslation {
  id: string
  nodeId: string
  locale: string
  field: string
  value: string
}

export interface RangeTranslationPlan {
  add: Array<Omit<PageTranslation, 'id'>>
  /** id строк переводов удалённых узлов. */
  remove: string[]
}

/**
 * Переводы после замены цены на площадь и этаж.
 *
 * Клон получает переводы своего образца («Tozalash», «dan»), кроме полей с
 * новым текстом: те переводятся подписями фильтра. Языки — те, на которые
 * страница уже переводится: заводить английский за одну кнопку незачем.
 * Строки удалённых узлов удаляются. Существующие строки не дублируются.
 */
export function rangeTranslationPlan(ranges: RangesResult, rows: PageTranslation[]): RangeTranslationPlan {
  const locales = [...new Set(rows.map((r) => r.locale))].sort()
  const exists = new Set(rows.map((r) => `${r.nodeId}|${r.locale}|${r.field}`))
  const add: RangeTranslationPlan['add'] = []
  const push = (row: Omit<PageTranslation, 'id'>) => {
    const key = `${row.nodeId}|${row.locale}|${row.field}`
    if (exists.has(key)) return
    exists.add(key)
    add.push(row)
  }

  for (const [nodeId, from] of ranges.clones) {
    for (const row of rows.filter((r) => r.nodeId === from)) {
      if (ranges.retexts.has(`${nodeId}|${row.field}`)) continue
      push({ nodeId, locale: row.locale, field: row.field, value: row.value })
    }
  }
  for (const [key, texts] of ranges.retexts) {
    const [nodeId, field] = key.split('|')
    for (const locale of locales) {
      const value = texts[locale as keyof Texts]
      if (value) push({ nodeId, locale, field, value })
    }
  }

  const removed = new Set(ranges.removedIds)
  return { add, remove: rows.filter((r) => removed.has(r.nodeId)).map((r) => r.id) }
}
