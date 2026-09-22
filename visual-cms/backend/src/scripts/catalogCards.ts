/**
 * Карточки проектов в каталоге на главной.
 *
 * Каталог (блок «Complexes») — статическая вёрстка: повторителя там нет, и
 * поставить его нельзя. `_repeat` и `{{item.*}}` разворачивает только
 * `deployCollection`, а главная деплоится обычным `deployPage`, который
 * плейсхолдеры не резолвит — они ушли бы в вёрстку литералом. Рантайм привязок
 * (`data_bindings`) на этой инсталляции не используется ни на одной странице.
 *
 * Поэтому новый проект добавляется в каталог клоном существующей карточки.
 * Здесь — чистое преобразование дерева; запись в базу в
 * `migrate-catalog-cards.ts`.
 *
 * Идемпотентность: карточка со слагом, который уже есть в гриде, не
 * добавляется повторно.
 */

/** Узел структуры блока. */
export interface StructureNode {
  id?: string
  tagName?: string
  content?: string
  attributes?: Record<string, string>
  children?: StructureNode[]
  styles?: { properties?: Record<string, string> }
  [key: string]: unknown
}

/** Данные карточки каталога. */
export interface CatalogCard {
  slug: string
  name: string
  /** Подпись класса на бейдже: «Бизнес», «Комфорт+». */
  className: string
  /** Значение data-class для фильтра вверху каталога: business | comfort | premium. */
  dataClass: string
  intro: string
  /** Адрес изображения; подставляется в CSS-переменную --image. */
  image: string
  /** Маркетинговые плашки. Пустой список — узел .project-tags не создаётся. */
  tags: string[]
}

export interface CardsResult {
  structure: StructureNode
  added: string[]
  skipped: string[]
}

export class CatalogError extends Error {}

const CLASS_GRID = 'project-grid'
const CLASS_CARD = 'project-card'
const CLASS_IMAGE = 'project-image'
const CLASS_BADGE = 'project-class'
const CLASS_BODY = 'project-body'
const CLASS_TAGS = 'project-tags'
const CLASS_MORE = 'project-more'

function classesOf(node: StructureNode): string[] {
  return (node.attributes?.class ?? '').split(/\s+/).filter(Boolean)
}

function hasClass(node: StructureNode, name: string): boolean {
  return classesOf(node).includes(name)
}

function findOne(root: StructureNode, pred: (n: StructureNode) => boolean, what: string): StructureNode {
  const stack: StructureNode[] = [root]
  const found: StructureNode[] = []
  while (stack.length) {
    const n = stack.pop()!
    if (pred(n)) found.push(n)
    for (const c of n.children ?? []) stack.push(c)
  }
  if (found.length !== 1) {
    throw new CatalogError(`Ожидался ровно один узел «${what}», найдено ${found.length}`)
  }
  return found[0]
}

function firstChildWithClass(node: StructureNode, name: string): StructureNode | undefined {
  return (node.children ?? []).find((c) => hasClass(c, name))
}

function descendantWithClass(node: StructureNode, name: string): StructureNode | undefined {
  const stack = [...(node.children ?? [])]
  while (stack.length) {
    const n = stack.shift()!
    if (hasClass(n, name)) return n
    for (const c of n.children ?? []) stack.push(c)
  }
  return undefined
}

function setAttr(node: StructureNode, key: string, value: string): void {
  if (!node.attributes) node.attributes = {}
  node.attributes[key] = value
}

/**
 * Свежие идентификаторы для клона.
 *
 * Редактор адресует узлы по `id`, и он же уезжает в разметку как
 * `data-element-id`. Копия с теми же id дала бы две карточки под одним
 * адресом: правка одной меняла бы обе, а в HTML появились бы дубликаты.
 */
function reassignIds(node: StructureNode, nextId: () => string): void {
  if (node.id) node.id = nextId()
  for (const child of node.children ?? []) reassignIds(child, nextId)
}

/** Генератор идентификаторов в формате редактора: node-<время>-<счётчик>. */
export function makeIdFactory(seed: number): () => string {
  let n = 0
  return () => `node-${seed}-${(n++).toString(36)}`
}

/** Слаги, уже представленные в гриде. Ключ — data-href карточки. */
export function existingSlugs(grid: StructureNode): string[] {
  return (grid.children ?? [])
    .filter((c) => hasClass(c, CLASS_CARD))
    .map((c) => (c.attributes?.['data-href'] ?? '').replace(/^\/complex\//, ''))
    .filter(Boolean)
}

/**
 * Заполняет клон карточки данными проекта.
 *
 * Любое несовпадение с ожидаемой вёрсткой — ошибка, а не тихий пропуск: карточка
 * без имени или без ссылки выглядит на витрине как поломка, и заметить это
 * после деплоя труднее, чем прочитать сообщение здесь.
 */
function fillCard(card: StructureNode, data: CatalogCard, nextId: () => string): void {
  setAttr(card, 'data-href', `/complex/${data.slug}`)
  setAttr(card, 'data-class', data.dataClass)

  const image = descendantWithClass(card, CLASS_IMAGE)
  if (!image) throw new CatalogError(`В шаблоне карточки нет .${CLASS_IMAGE}`)
  if (!image.styles) image.styles = { properties: {} }
  if (!image.styles.properties) image.styles.properties = {}
  // Фон собран как background: var(--image) — меняем переменную, не весь фон.
  image.styles.properties['--image'] = `url('${data.image}')`

  const badge = descendantWithClass(card, CLASS_BADGE)
  if (!badge) throw new CatalogError(`В шаблоне карточки нет .${CLASS_BADGE}`)
  badge.content = data.className

  const body = descendantWithClass(card, CLASS_BODY)
  if (!body) throw new CatalogError(`В шаблоне карточки нет .${CLASS_BODY}`)

  const heading = (body.children ?? []).find((c) => c.tagName === 'h3')
  if (!heading) throw new CatalogError('В теле карточки нет заголовка h3')
  heading.content = data.name

  const intro = (body.children ?? []).find((c) => c.tagName === 'p')
  if (!intro) throw new CatalogError('В теле карточки нет абзаца с описанием')
  intro.content = data.intro

  const tags = firstChildWithClass(body, CLASS_TAGS)
  if (tags) {
    const template = (tags.children ?? [])[0]
    if (!template) throw new CatalogError(`В .${CLASS_TAGS} нет плашки-образца`)
    if (data.tags.length === 0) {
      // Пустой узел оставил бы на карточке вертикальный отступ без содержимого.
      body.children = (body.children ?? []).filter((c) => c !== tags)
    } else {
      tags.children = data.tags.map((text) => {
        const copy = JSON.parse(JSON.stringify(template)) as StructureNode
        // Каждая плашка — отдельный узел: без своего id все копии оказались бы
        // под одним адресом, как и сама карточка без reassignIds.
        reassignIds(copy, nextId)
        copy.content = text
        return copy
      })
    }
  }

  const more = descendantWithClass(card, CLASS_MORE)
  if (!more) throw new CatalogError(`В шаблоне карточки нет ссылки .${CLASS_MORE}`)
  setAttr(more, 'href', `/complex/${data.slug}`)
}

/**
 * Добавляет карточки проектов в каталог.
 *
 * Шаблон — первая карточка грида: так новая наследует вёрстку и стили целиком,
 * включая то, что не перечислено в `CatalogCard`.
 */
export function addCatalogCards(
  input: StructureNode,
  cards: CatalogCard[],
  nextId: () => string = makeIdFactory(Date.now())
): CardsResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const grid = findOne(structure, (n) => hasClass(n, CLASS_GRID), `.${CLASS_GRID}`)

  const template = (grid.children ?? []).find((c) => hasClass(c, CLASS_CARD))
  if (!template) throw new CatalogError(`В .${CLASS_GRID} нет карточки-образца`)

  const present = new Set(existingSlugs(grid))
  const added: string[] = []
  const skipped: string[] = []

  for (const data of cards) {
    if (present.has(data.slug)) {
      skipped.push(data.slug)
      continue
    }
    const copy = JSON.parse(JSON.stringify(template)) as StructureNode
    reassignIds(copy, nextId)
    fillCard(copy, data, nextId)
    grid.children = [...(grid.children ?? []), copy]
    present.add(data.slug)
    added.push(data.slug)
  }

  return { structure, added, skipped }
}
