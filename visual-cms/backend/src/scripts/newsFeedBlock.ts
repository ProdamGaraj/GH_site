/**
 * Блок «News feed» страницы /news → лента из news-service.
 *
 * Было: шесть карточек, вписанных в блок руками, и скрипт фильтра
 * «Все / Акции / Новости» по data-news-type. Стало:
 *  - первые карточки — из данных страницы при публикации: повтор по
 *    `item.news` (publishData страницы, источник «News — Лента»). Они в HTML —
 *    их видят поисковики;
 *  - остальные догружает браузер при прокрутке, с поиском и фильтрами
 *    (services/runtime/news-feed-runtime.js), из публичной ленты сервиса;
 *  - вёрстка карточки одна: из первой карточки дизайна. Браузер заполняет
 *    её скрытую копию-образец (data-news-card-template) — поэтому карточки из
 *    HTML и догруженные выглядят одинаково, а правка дизайна в редакторе
 *    действует на обе.
 *
 * Корень блока остаётся сеткой карточек: полоса фильтров, сообщение и метка
 * подгрузки занимают всю строку сетки (grid-column: 1 / -1).
 *
 * Раскладка: колонки сетки и боковые отступы стояли встроенными стилями
 * (из редактора) и перебивали CSS дизайна — на телефоне было три колонки по
 * 19px между отступами по 150px. Они убираются из встроенных стилей корня и
 * экземпляра на странице (stripFeedLayout) и живут в CSS-секции, со ступенями
 * под планшет и телефон.
 *
 * Чистое преобразование; запись — `setup-news-pages.ts`. Идемпотентно.
 */
import { upsertCssSection } from './complexMedia'
import { MigrationError, MigrationResult, StructureNode, findAll, hasClass, makeNode } from './choiceToPlanTypes'

export const NEWS_FEED_ATTR = 'data-news-feed'
export const NEWS_SOURCE = 'item.news'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

/** Встроенная раскладка, перебивавшая CSS дизайна. */
export const FEED_LAYOUT_PROPS = ['gridTemplateColumns', 'paddingLeft', 'paddingRight'] as const

/** Убирает встроенную раскладку сетки; true — если было что убирать. */
export function stripFeedLayout(node: StructureNode): boolean {
  const props = node.styles?.properties
  if (!props) return false
  const found = FEED_LAYOUT_PROPS.filter((k) => k in props)
  for (const k of found) delete props[k]
  return found.length > 0
}

/** Экземпляр «News feed» на странице /news: та же встроенная раскладка. */
export function stripFeedInstanceLayout(page: StructureNode, blockId: string): MigrationResult {
  const structure = clone(page)
  const instances = findAll(structure, (n) => n.metadata?.linkedBlockId === blockId)
  const changed = instances.filter((n) => stripFeedLayout(n))
  if (changed.length === 0) return { structure: page, changes: [], alreadyMigrated: true }
  return { structure, changes: [`экземпляр «News feed» (${changed.map((n) => n.id).join(', ')}): встроенные колонки и отступы убраны`], alreadyMigrated: false }
}
const contents = { properties: { display: 'contents' } }

function find(root: StructureNode, pred: (n: StructureNode) => boolean, what: string): StructureNode {
  const [hit] = findAll(root, pred)
  if (!hit) throw new MigrationError(`В карточке нет ${what}`)
  return hit
}

/** Повтор по `source` с одним узлом-образцом — обёртка без своей раскладки. */
function repeat(id: string, source: string, child: StructureNode, name: string): StructureNode {
  return makeNode({
    id,
    tagName: 'span',
    elementType: 'container',
    styles: contents,
    metadata: { name },
    _repeat: { source },
    children: [child],
  })
}

/** Карточка с привязками к данным ленты ({{$.поле}} — карточка из item.news). */
export function boundCard(prototype: StructureNode): StructureNode {
  const card = clone(prototype)
  const { 'data-news-type': _type, ...attrs } = card.attributes ?? {}
  card.attributes = { ...attrs, 'data-news-card': '' }
  card.metadata = { ...card.metadata, name: 'Карточка новости' }

  const media = find(card, (n) => hasClass(n, 'news-media'), '.news-media')
  const img = find(media, (n) => n.tagName === 'img', 'картинки')
  const badge = find(card, (n) => hasClass(n, 'news-badge'), '.news-badge')
  media.children = [
    repeat(`${media.id}--cover`, '$.cover', makeNode({
      ...img,
      id: img.id!,
      tagName: 'img',
      elementType: String(img.elementType ?? 'image'),
      attributes: { src: '{{$.image}}', alt: '', loading: 'lazy', 'data-news-cover': '' },
      styles: { properties: { ...(img.styles?.properties ?? {}), objectPosition: '{{$.position}}' } },
    }), 'Обложка (если есть)'),
    repeat(`${badge.id}--category`, '$.category', { ...badge, content: '{{$.name}}', attributes: { ...badge.attributes, 'data-news-badge': '' } }, 'Рубрика (если есть)'),
  ]

  const date = find(card, (n) => hasClass(n, 'news-date'), '.news-date')
  date.content = '{{$.dateLabel}}'
  date.attributes = { ...date.attributes, 'data-news-date': '' }

  const title = find(card, (n) => n.tagName === 'h2', 'заголовка h2')
  title.content = ''
  title.elementType = 'container'
  title.children = [
    makeNode({
      id: `${title.id}--link`,
      tagName: 'a',
      elementType: 'text',
      content: '{{$.title}}',
      attributes: { href: '{{$.url}}', class: 'news-card-link', 'data-news-link': '' },
    }),
  ]

  const lead = find(card, (n) => n.tagName === 'p', 'анонса p')
  lead.content = '{{$.lead}}'
  lead.attributes = { ...lead.attributes, 'data-news-lead': '' }

  const tags = find(card, (n) => hasClass(n, 'news-tags'), '.news-tags')
  const [tagProto] = tags.children ?? []
  if (!tagProto) throw new MigrationError('В карточке нет образца тега')
  tags.attributes = { ...tags.attributes, 'data-news-tags': '' }
  tags.children = [
    repeat(`${tags.id}--tags`, '$.tags', { ...tagProto, content: '{{$.name}}', attributes: { ...tagProto.attributes, 'data-news-tag': '' } }, 'Теги'),
  ]
  return card
}

/**
 * Образец карточки для браузера: та же вёрстка без данных. Повторы
 * раскрыты (по одному элементу — их рантайм клонирует), плейсхолдеры пусты,
 * id с суффиксом — чтобы не совпадали с карточкой ленты.
 */
export function templateCard(bound: StructureNode): StructureNode {
  const out = clone(bound)
  const visit = (node: StructureNode) => {
    if (node.id) node.id = `${node.id}--template`
    delete node._repeat
    if (typeof node.content === 'string') node.content = node.content.replace(/\{\{\s*\$\.[\w.]+\s*\}\}/g, '')
    for (const [k, v] of Object.entries(node.attributes ?? {})) {
      if (typeof v === 'string') node.attributes![k] = v.replace(/\{\{\s*\$\.[\w.]+\s*\}\}/g, '')
    }
    for (const [k, v] of Object.entries(node.styles?.properties ?? {})) {
      if (typeof v === 'string' && v.includes('{{')) delete node.styles!.properties![k]
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(out)
  const { 'data-news-card': _card, ...attrs } = out.attributes ?? {}
  out.attributes = { ...attrs, hidden: '', 'data-news-card-template': '' }
  out.metadata = { ...out.metadata, name: 'Образец карточки (для подгрузки, скрыт)' }
  return out
}

/** Начало любой версии CSS-секции ленты — с него секция заменяется. */
const NEWS_FEED_CSS_PREFIX = '/* ==== news-feed'
/**
 * v2: поиск — отдельной строкой во всю ширину, рубрики, «Период» и «Теги» —
 * строкой под ним. Кнопки больше не у правого края — окна открываются вправо
 * от кнопки; на планшете (кнопки могут уйти к краю) — от левого края полосы.
 */
export const NEWS_FEED_CSS_HEAD = `${NEWS_FEED_CSS_PREFIX} v2 ====`
export const NEWS_FEED_CSS = `${NEWS_FEED_CSS_HEAD} */
/* Лента из news-service: полоса фильтров и подгрузка — services/runtime/news-feed-runtime.js. */
.news-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); padding-left: clamp(16px, 10.4vw, 150px); padding-right: clamp(16px, 10.4vw, 150px); }
@media (max-width: 1180px) { .news-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 680px) { .news-grid { grid-template-columns: 1fr; } }
.news-filters, .news-feed-status, .news-feed-more { grid-column: 1 / -1; }
.news-card { position: relative; }
.news-card-link { color: inherit; text-decoration: none; }
.news-card-link::after { content: ""; position: absolute; inset: 0; z-index: 1; }
.news-card-link:focus-visible { outline: none; }
.news-card:focus-within { outline: 2px solid var(--gold, #fdb82a); outline-offset: 2px; }
[data-news-card-template] { display: none !important; }
.news-feed-more { min-height: 1px; }
.news-feed-status { padding: 24px 0; color: var(--muted, rgba(21, 24, 29, .6)); text-align: center; }
.news-feed-status button { margin-left: 8px; text-decoration: underline; }
.news-fbar { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.news-fsearch { flex: 1 1 100%; min-width: 0; padding: 12px 16px; border: 1px solid rgba(21, 24, 29, .14); border-radius: 999px; background: #fff; font: inherit; }
.news-fchip, .news-fbtn { padding: 10px 16px; border: 1px solid rgba(21, 24, 29, .14); border-radius: 999px; background: #fff; color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
.news-fchip[aria-pressed="true"], .news-fbtn[aria-expanded="true"], .news-fbtn.is-set { border-color: rgba(253, 184, 42, .9); background: var(--gold, #fdb82a); color: var(--ink, #15181d); }
.news-fdrop { position: relative; }
.news-fpop { position: absolute; z-index: 30; top: calc(100% + 8px); left: 0; width: min(360px, 90vw); padding: 16px; border-radius: 18px; background: #fff; box-shadow: 0 24px 60px rgba(21, 24, 29, .18); }
.news-fpop[hidden] { display: none; }
.news-ftabs { display: flex; gap: 4px; margin-bottom: 12px; padding: 4px; border-radius: 999px; background: rgba(21, 24, 29, .06); }
.news-ftabs button { flex: 1; padding: 8px; border: 0; border-radius: 999px; background: transparent; font: inherit; font-weight: 700; cursor: pointer; }
.news-ftabs button[aria-selected="true"] { background: #fff; box-shadow: 0 2px 8px rgba(21, 24, 29, .12); }
.news-fgrid { display: flex; flex-wrap: wrap; gap: 8px; }
.news-fgrid button:disabled { opacity: .35; cursor: default; }
.news-fdates { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.news-fdates input { padding: 8px; border: 1px solid rgba(21, 24, 29, .14); border-radius: 10px; font: inherit; }
.news-fapply { margin-top: 12px; width: 100%; }
.news-fmode { display: grid; gap: 6px; margin-top: 12px; }
.news-fmode label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.news-fcount { margin-left: auto; color: var(--muted, rgba(21, 24, 29, .6)); font-weight: 700; }
.news-fhint { margin-top: 6px; color: var(--muted, rgba(21, 24, 29, .6)); font-size: 13px; }
.news-factive { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.news-factive:empty { display: none; }
.news-fpill { padding: 6px 10px; border: 0; border-radius: 999px; background: rgba(21, 24, 29, .08); font: inherit; font-size: 13px; cursor: pointer; }
.news-freset { padding: 6px 10px; border: 0; background: none; font: inherit; font-size: 13px; text-decoration: underline; cursor: pointer; }
@media (max-width: 1180px) {
  .news-fdrop { position: static; }
}
@media (max-width: 680px) {
  .news-fpop { position: fixed; top: auto; right: 0; bottom: 0; left: 0; width: auto; max-height: 75vh; overflow: auto; border-radius: 22px 22px 0 0; }
}
`

/** Служебный узел ленты, растянутый на строку сетки. */
function slot(id: string, cls: string, attr: string, name: string): StructureNode {
  return makeNode({ id, tagName: 'div', elementType: 'container', attributes: { class: cls, [attr]: '' }, metadata: { name } })
}

export function migrateNewsFeedBlock(input: StructureNode): MigrationResult {
  if (input.attributes?.[NEWS_FEED_ATTR] !== undefined) {
    // Блок уже лента — довносится только новая версия стилей.
    const structure = clone(input)
    const metadata = (structure.metadata ??= {}) as Record<string, unknown>
    if (!upsertCssSection(metadata, NEWS_FEED_CSS_PREFIX, NEWS_FEED_CSS_HEAD, NEWS_FEED_CSS)) {
      return { structure: input, changes: [], alreadyMigrated: true }
    }
    return { structure, changes: ['CSS-секция news-feed v2: поиск отдельной строкой, фильтры под ним'], alreadyMigrated: false }
  }
  const structure = clone(input)
  const prototype = (structure.children ?? []).find((c) => hasClass(c, 'news-card'))
  if (!prototype) throw new MigrationError('В блоке нет карточки .news-card — не из чего взять вёрстку')
  const removed = (structure.children ?? []).filter((c) => hasClass(c, 'news-card')).length
  const card = boundCard(prototype)
  const rootId = structure.id ?? 'news-feed'

  structure.attributes = { ...structure.attributes, [NEWS_FEED_ATTR]: '' }
  const layoutStripped = stripFeedLayout(structure)
  structure.children = [
    slot(`${rootId}--filters`, 'news-filters', 'data-news-filters', 'Фильтры ленты (собирает скрипт)'),
    makeNode({
      id: `${rootId}--list`,
      tagName: 'div',
      elementType: 'container',
      attributes: { class: 'news-list', 'data-news-list': '' },
      styles: contents,
      metadata: { name: 'Карточки (первые — из данных страницы)' },
      _repeat: { source: NEWS_SOURCE },
      children: [card],
    }),
    templateCard(card),
    slot(`${rootId}--status`, 'news-feed-status', 'data-news-status', 'Сообщения ленты'),
    slot(`${rootId}--more`, 'news-feed-more', 'data-news-more', 'Метка подгрузки'),
  ]
  const metadata = (structure.metadata ??= {}) as Record<string, unknown>
  metadata.globalJs = ''
  upsertCssSection(metadata, NEWS_FEED_CSS_PREFIX, NEWS_FEED_CSS_HEAD, NEWS_FEED_CSS)
  return {
    structure,
    changes: [
      `карточки из данных страницы (${NEWS_SOURCE}) вместо ${removed} вписанных руками; вёрстка — из первой`,
      'образец карточки для подгрузки, полоса фильтров, сообщения и метка подгрузки',
      'старый скрипт фильтра «Все / Акции / Новости» снят — фильтры и подгрузку ведёт news-feed-runtime',
      'CSS-секция news-feed v2',
      ...(layoutStripped ? ['встроенные колонки и отступы сетки убраны — раскладку ведёт CSS (ПК 3, планшет 2, телефон 1)'] : []),
    ],
    alreadyMigrated: false,
  }
}
