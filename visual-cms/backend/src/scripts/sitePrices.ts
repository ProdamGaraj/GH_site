/**
 * Цен на сайте нет (решение 2026-09-29): вычистка цен из блоков и страниц CMS.
 *
 * Что считается ценой — по признакам разметки, а не по слову: сноска
 * «*Стоимость и условия уточняйте у менеджеров» и «Площадь от 78 м²» в
 * `.project-price` коммерческих страниц — не цены и остаются.
 *
 * Удаляется узел целиком (с детьми):
 * - `.apartment-price`, `.old-price` — цена и старая цена карточки квартиры;
 * - `.project-price`, если в нём цена или «Цена по запросу»;
 * - фильтр цены: кнопка и панель `data-panel="price"` (в вёрстке дизайна —
 *   кнопка с подписью «Цена ⌄»), группа с полями `data-filter="priceMin|priceMax"`;
 * - узел, чей текст — ровно сумма («1 354 320 000 UZS», «от 450 млн сум»);
 * - узел с привязкой к цене (`{{$.priceLabel}}` и т. п.).
 * С узлов снимаются атрибуты `data-price*`.
 *
 * Подвал карточки каталога (`.project-foot`) без цены прижимает кнопку
 * «Подробнее» вправо: с `space-between` и одним ребёнком она уезжала влево.
 *
 * Только чистое преобразование: запись — в `migrate-site-prices.ts`.
 * Идемпотентно: на вычищенной структуре правок нет.
 */
import { StructureNode, hasClass, walk } from './choiceToPlanTypes'

/** Сумма денег как весь текст узла: «1 354 320 000 UZS», «от 450 млн сум», «$ 50 000». */
const MONEY_ONLY =
  /^\s*(от\s+)?(\$\s*\d[\d\s.,]*|\d[\d\s.,]*\s*(млн|млрд|mln|mlrd)?\s*(UZS|сум|so['‘’ʻ`]?m|\$|USD))\s*(dan)?\s*$/i
/** Слово «цена» в подписи: «Цена по запросу», «Narx so‘rov bo‘yicha». */
const PRICE_WORD = /(^|\s)(цена|цены|narx|narxi|price)(\s|$|[,.:])/i
const PRICE_BINDING = /\{\{[^}]*price[^}]*\}\}/i
const PRICE_INPUT = /^price(Min|Max)$/
const PRICE_ATTR = /^data-(old-)?price/i

export interface SitePricesResult {
  structure: StructureNode
  changes: string[]
  /** id удалённых узлов: их переводы удаляются. */
  removedIds: string[]
  alreadyMigrated: boolean
}

function textOf(node: StructureNode): string {
  const parts: string[] = []
  walk(node, (n) => {
    if (typeof n.content === 'string') parts.push(n.content)
  })
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

const panel = (node: StructureNode) => node.attributes?.['data-panel']

/** Почему узел — цена; null — не цена. */
export function priceReason(node: StructureNode): string | null {
  if (hasClass(node, 'apartment-price')) return 'цена карточки'
  if (hasClass(node, 'old-price')) return 'старая цена'
  if (hasClass(node, 'project-price')) {
    const text = textOf(node)
    return PRICE_WORD.test(text) || MONEY_ONLY.test(text) || PRICE_BINDING.test(text) ? 'цена карточки проекта' : null
  }
  // В вёрстке дизайна у кнопки нет data-panel — только подпись «Цена ⌄».
  if (hasClass(node, 'filter-trigger') && (panel(node) === 'price' || PRICE_WORD.test(textOf(node)))) {
    return 'кнопка фильтра цены'
  }
  if (hasClass(node, 'filter-panel') && panel(node) === 'price') return 'панель фильтра цены'
  if (hasClass(node, 'filter-group')) {
    let hasPriceInput = false
    walk(node, (n) => {
      if (PRICE_INPUT.test(n.attributes?.['data-filter'] ?? '')) hasPriceInput = true
    })
    if (hasPriceInput) return 'группа фильтра цены'
  }
  if (typeof node.content === 'string') {
    if (MONEY_ONLY.test(node.content)) return 'сумма'
    if (PRICE_BINDING.test(node.content)) return 'привязка к цене'
  }
  return null
}

function idsOf(root: StructureNode): string[] {
  const ids: string[] = []
  walk(root, (n) => {
    if (n.id) ids.push(n.id)
  })
  return ids
}

export function stripPrices(input: StructureNode): SitePricesResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []
  const removedIds: string[] = []

  walk(structure, (parent) => {
    const children = parent.children ?? []
    const removed = children.filter((child) => priceReason(child) !== null)
    if (removed.length === 0) return
    for (const child of removed) {
      const text = textOf(child)
      changes.push(`${priceReason(child)}: ${child.id ?? child.tagName}${text ? ` «${text.slice(0, 50)}»` : ''}`)
      removedIds.push(...idsOf(child))
    }
    parent.children = children.filter((child) => !removed.includes(child))
    if (hasClass(parent, 'project-foot')) {
      const props = (parent.styles ??= {}).properties ?? {}
      if (props.justifyContent !== 'flex-end') {
        parent.styles.properties = { ...props, justifyContent: 'flex-end' }
        changes.push(`подвал карточки ${parent.id}: «Подробнее» прижата вправо`)
      }
    }
  })

  walk(structure, (node) => {
    const keys = Object.keys(node.attributes ?? {}).filter((key) => PRICE_ATTR.test(key))
    for (const key of keys) delete node.attributes![key]
    if (keys.length) changes.push(`${node.id}: без ${keys.join(', ')}`)
  })

  if (changes.length === 0) return { structure: input, changes, removedIds, alreadyMigrated: true }
  return { structure, changes, removedIds, alreadyMigrated: false }
}
