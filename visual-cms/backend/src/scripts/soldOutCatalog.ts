/**
 * Каталог проектов из estate и распроданные проекты на сайте.
 *
 * Было: каталог на главной (блок «Complexes», c934851d) — четыре карточки,
 * свёрстанные руками; новый проект добавлялся клоном карточки отдельным
 * скриптом, а список проектов коллекции ограничивал фильтр publish-whitelist.
 *
 * Стало:
 *   - главная получает «данные при публикации» (page.publishData): каталог
 *     estate на языке версии страницы как item.complexes. Грид карточек
 *     повторяется по нему; что выставлено на сайт, решает галочка
 *     «Показывать на сайте» в estate;
 *   - карточка распроданного проекта: тег «Распродано» первым, без
 *     «Цена по запросу» (estate отдаёт soldOut и cardClass);
 *   - шапка страницы проекта: второй бейдж «Распродано» (item.soldOut);
 *   - «Выбрать»: у распроданного проекта планировки без цен — цена карточки,
 *     фильтр по цене и цена в окне планировки скрыты (data-sale-state).
 *
 * Теги, класс для фильтра и картинки карточек переезжают из вёрстки в estate
 * (staticCatalogCards + estateCardPatch) — иначе карточки после перевода на
 * данные остались бы без них.
 *
 * Чистые преобразования; запись — migrate-sold-out-catalog.ts.
 * Повторный вызов ничего не меняет (alreadyMigrated).
 */
import { upsertCssSection } from './complexMedia'
import {
  MigrationError,
  MigrationResult,
  StructureNode,
  findAll,
  findOne,
  hasClass,
  makeNode,
  withClass,
} from './choiceToPlanTypes'

// --- Каталог на главной ---

/** Имя данных главной: в разметке — item.complexes. */
export const CATALOG_DATA_NAME = 'complexes'
const CATALOG_SOURCE = `item.${CATALOG_DATA_NAME}`

/** Ключи фильтра по классу на главной — те же, что у кнопок фильтра и в estate. */
const FILTER_CLASSES = ['comfort', 'business', 'premium']

const CATALOG_CSS_HEAD = '/* ==== catalog-sold-out'
export const CATALOG_CSS_MARKER = `${CATALOG_CSS_HEAD} v1 ====`
export const CATALOG_CSS = `${CATALOG_CSS_MARKER} */
/* Обёртки повторителей тегов: сами не рисуются, их плашки — прямые участники
   ряда .project-tags. */
.project-tags-sold,
.project-tags-list {
  display: contents;
}

/* Нет ни одного тега — нет и пустого отступа под описанием. */
.project-tags:not(:has(span)) {
  display: none;
}

/* Распроданный проект: без «Цена по запросу», кнопка остаётся справа. */
.project-card.is-sold-visible .project-price {
  display: none;
}

.project-card.is-sold-visible .project-more {
  margin-left: auto;
}
`

/** Тег карточки в старой вёрстке: текст и узел — по нему находятся его переводы. */
export interface StaticCardTag {
  text: string
  nodeId: string
}

/** Карточка каталога, свёрстанная руками, — то, что переезжает в estate. */
export interface StaticCatalogCard {
  slug: string
  filterClass: string
  image: string
  tags: StaticCardTag[]
}

export interface CatalogMigrationResult extends MigrationResult {
  /** Карточки старой вёрстки (пусто, если каталог уже на данных). */
  cards: StaticCatalogCard[]
}

function gridOf(structure: StructureNode): StructureNode {
  return findOne(structure, (n) => hasClass(n, 'project-grid'), '.project-grid')
}

function descendant(node: StructureNode, name: string, label: string): StructureNode {
  const found = findAll(node, (n) => n !== node && hasClass(n, name))
  if (found.length !== 1) throw new MigrationError(`${label}: ожидался один .${name}, найдено ${found.length}`)
  return found[0]
}

function childByTag(node: StructureNode, tag: string, label: string): StructureNode {
  const found = (node.children ?? []).filter((c) => c.tagName === tag)
  if (found.length !== 1) throw new MigrationError(`${label}: ожидался один <${tag}>, найдено ${found.length}`)
  return found[0]
}

/** Адрес картинки из --image: url('/media/x.jpg') → /media/x.jpg. */
function imageOf(card: StructureNode, label: string): string {
  const image = descendant(card, 'project-image', label)
  const raw = image.styles?.properties?.['--image'] ?? ''
  const match = /^url\((['"]?)(.*)\1\)$/.exec(raw.trim())
  return match ? match[2] : ''
}

/** Карточки старой вёрстки: слаг, класс для фильтра, картинка и теги с узлами. */
export function staticCatalogCards(structure: StructureNode): StaticCatalogCard[] {
  const grid = gridOf(structure)
  return (grid.children ?? [])
    .filter((c) => hasClass(c, 'project-card'))
    .map((card) => {
      const slug = (card.attributes?.['data-href'] ?? '').replace(/^\/complex\//, '').replace(/\/$/, '')
      const label = `Карточка «${slug || card.id}»`
      if (!slug) throw new MigrationError(`${label}: нет data-href`)
      const tagsNode = findAll(card, (n) => hasClass(n, 'project-tags'))[0]
      const tags = (tagsNode?.children ?? [])
        .filter((t) => typeof t.content === 'string' && t.content.trim() !== '')
        .map((t) => ({ text: (t.content as string).trim(), nodeId: t.id ?? '' }))
      return { slug, filterClass: card.attributes?.['data-class'] ?? '', image: imageOf(card, label), tags }
    })
}

/**
 * Свежие id узлам с данными. У них в CMS есть переводы старых карточек
 * (описание и класс Doʼstlik по-узбекски): с прежним id такой перевод лёг бы
 * на шаблон и все карточки на uz получили бы текст Doʼstlik. Узлы с общим для
 * всех карточек текстом («Цена по запросу», «Подробнее») свои id и переводы
 * сохраняют.
 */
function renew(node: StructureNode, nextId: () => string): void {
  node.id = nextId()
}

/** Обёртка-повторитель внутри .project-tags. */
function tagRepeater(id: string, className: string, source: string, template: StructureNode): StructureNode {
  return makeNode({
    id,
    tagName: 'div',
    elementType: 'container',
    attributes: { class: className },
    _repeat: { source },
    children: [template],
  })
}

/**
 * Каталог на главной — на данных estate.
 *
 * Шаблон — первая карточка грида: вёрстка и стили наследуются целиком,
 * меняются только значения. Остальные карточки уходят: их данные (теги,
 * класс, картинку) раннер переносит в estate до записи блока.
 */
export function migrateCatalogBlock(
  input: StructureNode,
  nextId: () => string = makeIdFactory(Date.now())
): CatalogMigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []
  const grid = gridOf(structure)
  const metadata = (structure.metadata ??= {}) as Record<string, unknown>

  if (grid._repeat) {
    if (upsertCssSection(metadata, CATALOG_CSS_HEAD, CATALOG_CSS_MARKER, CATALOG_CSS)) {
      changes.push('CSS каталога обновлён')
    }
    return { structure, changes, alreadyMigrated: changes.length === 0, cards: [] }
  }

  const cards = staticCatalogCards(structure)
  const template = (grid.children ?? []).find((c) => hasClass(c, 'project-card'))
  if (!template) throw new MigrationError('В .project-grid нет карточки-образца')
  const label = 'Карточка-образец'

  renew(template, nextId)
  template.attributes = {
    ...template.attributes,
    class: 'project-card {{$.cardClass}}',
    'data-href': '/complex/{{$.slug}}',
    'data-class': '{{$.filterClass}}',
  }

  const image = descendant(template, 'project-image', label)
  renew(image, nextId)
  image.styles = { ...image.styles, properties: { ...image.styles?.properties, '--image': "url('{{$.cardImage}}')" } }

  const badge = descendant(template, 'project-class', label)
  renew(badge, nextId)
  badge.content = '{{$.className}}'

  const body = descendant(template, 'project-body', label)
  renew(body, nextId)
  const heading = childByTag(body, 'h3', label)
  renew(heading, nextId)
  heading.content = '{{$.name}}'
  const intro = childByTag(body, 'p', label)
  renew(intro, nextId)
  intro.content = '{{$.intro}}'

  const tags = descendant(template, 'project-tags', label)
  renew(tags, nextId)
  const tagTemplate = (tags.children ?? [])[0]
  if (!tagTemplate) throw new MigrationError(`${label}: в .project-tags нет плашки-образца`)
  const markTag: StructureNode = { ...JSON.parse(JSON.stringify(tagTemplate)), id: nextId(), content: '{{$}}' }
  const soldTag: StructureNode = {
    ...JSON.parse(JSON.stringify(tagTemplate)),
    id: nextId(),
    content: '{{$.label}}',
    attributes: { ...tagTemplate.attributes, class: 'project-label--sold' },
  }
  // «Распродано» первым: у распроданного проекта это главное.
  tags.children = [
    tagRepeater(nextId(), 'project-tags-sold', '$.soldOut', soldTag),
    tagRepeater(nextId(), 'project-tags-list', '$.tags', markTag),
  ]

  const more = descendant(template, 'project-more', label)
  const moreAttrs: Record<string, string> = { ...more.attributes, href: '/complex/{{$.slug}}' }
  // Ссылка на конкретную страницу для выбора в редакторе: у шаблона своя у каждой карточки.
  delete moreAttrs['data-page-id']
  more.attributes = moreAttrs

  grid._repeat = { source: CATALOG_SOURCE }
  grid.children = [template]
  changes.push(`грид карточек повторяется по ${CATALOG_SOURCE}; ручные карточки (${cards.map((c) => c.slug).join(', ')}) — в данные estate`)
  changes.push('тег «Распродано» первым в тегах, у распроданного — без «Цена по запросу»')

  upsertCssSection(metadata, CATALOG_CSS_HEAD, CATALOG_CSS_MARKER, CATALOG_CSS)
  changes.push('CSS каталога добавлен')

  return { structure, changes, alreadyMigrated: false, cards }
}

/** Генератор id в формате редактора: node-<время>-<счётчик>. */
export function makeIdFactory(seed: number): () => string {
  let n = 0
  return () => `node-${seed}-sold-${(n++).toString(36)}`
}

// --- Перенос карточек в estate ---

/** Проект в admin API estate (только нужные здесь поля). */
export interface EstateAdminComplex {
  id: string
  slug: string
  filterClass?: string | null
  cardImage?: string | null
  cardTags?: string[] | null
  translations?: Record<string, Record<string, unknown>>
}

export interface EstateCardPatch {
  body: Record<string, unknown>
  changes: string[]
}

/**
 * Что записать в estate из ручной карточки. Только в незаполненные поля:
 * то, что уже поправили в админке estate, не перетирается.
 *
 * Перевод тегов (uz) — из переводов CMS по узлам тегов; тег без перевода
 * остаётся русским. Admin API заменяет переводы проекта целиком, поэтому
 * отправляются все его переводы с добавленными тегами.
 */
export function estateCardPatch(
  current: EstateAdminComplex,
  card: StaticCatalogCard,
  translatedTag: (nodeId: string, locale: string) => string | undefined,
  locales: readonly string[] = ['uz', 'en']
): EstateCardPatch | null {
  const body: Record<string, unknown> = {}
  const changes: string[] = []
  const texts = card.tags.map((t) => t.text)

  if (texts.length > 0 && !(current.cardTags ?? []).length) {
    body.cardTags = texts
    changes.push(`теги: ${texts.join(', ')}`)
  }
  if (card.image && !current.cardImage) {
    body.cardImage = card.image
    changes.push(`картинка карточки: ${card.image}`)
  }
  // 'business' — значение по умолчанию после миграции estate 008.
  const currentClass = current.filterClass || 'business'
  if (currentClass === 'business' && card.filterClass !== currentClass && FILTER_CLASSES.includes(card.filterClass)) {
    body.filterClass = card.filterClass
    changes.push(`класс для фильтра: ${card.filterClass}`)
  }

  const translations = JSON.parse(JSON.stringify(current.translations ?? {})) as Record<string, Record<string, unknown>>
  let translated = false
  for (const locale of locales) {
    if (texts.length === 0 || translations[locale]?.cardTags) continue
    const tags = card.tags.map((t) => translatedTag(t.nodeId, locale))
    if (tags.every((t) => !t)) continue
    translations[locale] = { ...translations[locale], cardTags: tags.map((t, i) => t || texts[i]) }
    changes.push(`теги (${locale}): ${(translations[locale].cardTags as string[]).join(', ')}`)
    translated = true
  }
  if (translated) body.translations = translations

  return changes.length ? { body, changes } : null
}

// --- Шапка страницы проекта ---

const HERO_SOLD_CLASS = 'hero-sold'
const HERO_CSS_HEAD = '/* ==== hero-sold-out'
export const HERO_CSS_MARKER = `${HERO_CSS_HEAD} v1 ====`
export const HERO_CSS = `${HERO_CSS_MARKER} */
.hero-sold {
  display: contents;
}

.complex-hero-copy .badge--sold {
  margin-left: 8px;
  background: #050505;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
`

/** Бейдж «Распродано» рядом с классом проекта: повторяется по item.soldOut (0..1). */
export function migrateHeroBlock(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []
  const copy = findOne(structure, (n) => hasClass(n, 'complex-hero-copy'), '.complex-hero-copy')
  const metadata = (structure.metadata ??= {}) as Record<string, unknown>

  if (!findAll(copy, (n) => hasClass(n, HERO_SOLD_CLASS)).length) {
    const badge = (copy.children ?? []).find((c) => hasClass(c, 'badge'))
    if (!badge) throw new MigrationError('Шапка проекта: нет бейджа класса (.badge)')
    const sold = makeNode({
      ...JSON.parse(JSON.stringify(badge)),
      id: 'hero-sold-badge',
      content: '{{$.label}}',
      attributes: { class: 'badge badge--sold' },
    })
    const wrap = makeNode({
      id: 'hero-sold',
      tagName: 'span',
      elementType: 'container',
      attributes: { class: HERO_SOLD_CLASS },
      _repeat: { source: 'item.soldOut' },
      children: [sold],
    })
    const at = (copy.children ?? []).indexOf(badge)
    copy.children = [...(copy.children ?? []).slice(0, at + 1), wrap, ...(copy.children ?? []).slice(at + 1)]
    changes.push('бейдж «Распродано» рядом с классом проекта (item.soldOut)')
  }
  if (upsertCssSection(metadata, HERO_CSS_HEAD, HERO_CSS_MARKER, HERO_CSS)) changes.push('CSS бейджа добавлен')
  return { structure, changes, alreadyMigrated: changes.length === 0 }
}

// --- «Выбрать» ---

/**
 * Признак распроданности — атрибутом корня, не классом: на странице блок
 * стоит linked-плейсхолдером, и его class перекрывает class корня блока, а
 * остальные атрибуты сливаются.
 */
export const SALE_STATE_ATTR = 'data-sale-state'
/** Подпись «Распродано» на языке страницы — для окна планировки (ComplexOverlaysRuntime). */
export const SOLD_LABEL_ATTR = 'data-sold-label'
const PRICE_GROUP_CLASS = 'filter-group--price'

const CHOICE_CSS_HEAD = '/* ==== choice-sold-out'
export const CHOICE_CSS_MARKER = `${CHOICE_CSS_HEAD} v1 ====`
export const CHOICE_CSS = `${CHOICE_CSS_MARKER} */
/* Распроданный проект: планировки без цен и без фильтра по цене. */
[${SALE_STATE_ATTR}~="is-sold-out"] .apartment-price,
[${SALE_STATE_ATTR}~="is-sold-out"] .filter-trigger[data-panel="price"],
[${SALE_STATE_ATTR}~="is-sold-out"] .filter-panel[data-panel="price"],
[${SALE_STATE_ATTR}~="is-sold-out"] .${PRICE_GROUP_CLASS} {
  display: none;
}
`

export function migrateChoiceBlock(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []
  const metadata = (structure.metadata ??= {}) as Record<string, unknown>

  const attrs = structure.attributes ?? {}
  if (attrs[SALE_STATE_ATTR] === undefined || attrs[SOLD_LABEL_ATTR] === undefined) {
    structure.attributes = {
      ...attrs,
      [SALE_STATE_ATTR]: '{{item.saleStateClass}}',
      [SOLD_LABEL_ATTR]: '{{item.soldOut.0.label}}',
    }
    changes.push(`корень: ${SALE_STATE_ATTR} и ${SOLD_LABEL_ATTR} из данных проекта`)
  }

  // Группа цены — та, где поля priceMin/priceMax (в панели «Цена» и во «Все фильтры»).
  const groups = findAll(
    structure,
    (n) => hasClass(n, 'filter-group') && findAll(n, (c) => c.attributes?.['data-filter'] === 'priceMin').length > 0
  )
  if (groups.length === 0) throw new MigrationError('«Выбрать»: нет группы фильтра по цене')
  const marked = groups.filter((g) => withClass(g, PRICE_GROUP_CLASS)).length
  if (marked) changes.push(`группы фильтра цены помечены .${PRICE_GROUP_CLASS} (${marked})`)

  if (upsertCssSection(metadata, CHOICE_CSS_HEAD, CHOICE_CSS_MARKER, CHOICE_CSS)) {
    changes.push('CSS: у распроданного скрыты цены и фильтр по цене')
  }
  return { structure, changes, alreadyMigrated: changes.length === 0 }
}

// --- Коллекция ---

/** Фильтр коллекции, которым раньше решалось, какие проекты на сайте. */
export const PUBLISH_WHITELIST_ID = 'publish-whitelist'

/** Трансформации коллекции без publish-whitelist; null — его и не было. */
export function dropPublishWhitelist(transforms: unknown): unknown[] | null {
  if (!Array.isArray(transforms)) return null
  const rest = transforms.filter((t) => (t as { id?: string })?.id !== PUBLISH_WHITELIST_ID)
  return rest.length === transforms.length ? null : rest
}
