/**
 * Перевод секции «Выбрать» (блок «Complex choice») с карточек квартир на
 * карточки типов планировок.
 *
 * Зачем: подсистема планировок (группировка, перенос чертежей в медиатеку,
 * агрегаты по этажам и видам из окон) построена, но к шаблону не подключена.
 * Секция повторялась по `item.apartments` — на странице Doʼstlik это 189
 * почти одинаковых карточек вместо 53 планировок, а чертежи не показывались
 * вовсе.
 *
 * Здесь только чистое преобразование дерева и скрипта блока: запись в базу —
 * в `migrate-choice-to-plantypes.ts`. Разделение ради тестов, база в них не
 * поднимается.
 *
 * Идемпотентность: повторный вызов на уже переведённой структуре ничего не
 * меняет и сообщает об этом через `alreadyMigrated`.
 */

/** Узел структуры страницы/блока. Форма задана редактором, поля необязательны. */
export interface StructureNode {
  id?: string
  tagName?: string
  content?: string
  attributes?: Record<string, string>
  children?: StructureNode[]
  metadata?: Record<string, unknown>
  styles?: { properties?: Record<string, string> }
  _repeat?: { source: string; offset?: number; limit?: number }
  [key: string]: unknown
}

export interface MigrationResult {
  structure: StructureNode
  /** Человекочитаемый список применённых правок — печатается раннером. */
  changes: string[]
  /** Структура уже переведена: правок не было. */
  alreadyMigrated: boolean
}

/** Источник повторителя карточек до и после миграции. */
const SOURCE_BEFORE = 'item.apartments'
const SOURCE_AFTER = 'item.planTypes'

/**
 * Фильтр по классу жилья заменяется фильтром по виду из окна.
 *
 * Класс лежит на комплексе и одинаков для всех его квартир — внутри одного
 * проекта фильтровать по нему нечего. Вид из окна агрегирован на типе
 * планировки и у каждого типа свой.
 */
const PANEL_BEFORE = 'apartmentClass'
const PANEL_AFTER = 'windowViews'
const PANEL_LABEL_AFTER = 'Вид из окна'
const TRIGGER_LABEL_AFTER = 'Вид из окна ⌄'

export class MigrationError extends Error {}

// --- Обход дерева ---

function walk(node: StructureNode, visit: (n: StructureNode, parent: StructureNode | null) => void): void {
  const go = (n: StructureNode, parent: StructureNode | null): void => {
    visit(n, parent)
    for (const child of n.children ?? []) go(child, n)
  }
  go(node, null)
}

function classOf(node: StructureNode): string {
  return node.attributes?.class ?? ''
}

function hasClass(node: StructureNode, name: string): boolean {
  return classOf(node).split(/\s+/).includes(name)
}

function findAll(root: StructureNode, pred: (n: StructureNode) => boolean): StructureNode[] {
  const out: StructureNode[] = []
  walk(root, (n) => {
    if (pred(n)) out.push(n)
  })
  return out
}

/**
 * Ровно один узел по признаку.
 *
 * Молчаливый промах здесь опаснее всего: движок подстановки превращает
 * непопавшее поле в пустую строку, и половинчатая миграция дала бы витрину с
 * пустыми карточками вместо явной ошибки.
 */
function findOne(root: StructureNode, pred: (n: StructureNode) => boolean, what: string): StructureNode {
  const found = findAll(root, pred)
  if (found.length !== 1) {
    throw new MigrationError(`Ожидался ровно один узел «${what}», найдено ${found.length}`)
  }
  return found[0]
}

function setAttr(node: StructureNode, key: string, value: string): void {
  if (!node.attributes) node.attributes = {}
  node.attributes[key] = value
}

function dropAttr(node: StructureNode, key: string): void {
  if (node.attributes) delete node.attributes[key]
}

function removeChild(parent: StructureNode, child: StructureNode): void {
  parent.children = (parent.children ?? []).filter((c) => c !== child)
}

// --- Карточка ---

function migrateCard(grid: StructureNode, changes: string[]): void {
  const card = (grid.children ?? [])[0]
  if (!card || !hasClass(card, 'apartment-card')) {
    throw new MigrationError('Первый ребёнок .apartments-grid не .apartment-card — шаблон карточки не найден')
  }

  // Диапазон цены типа: фильтр сравнивает нижнюю границу, как и подпись «от …».
  setAttr(card, 'data-price', '{{$.priceMin}}')
  // Все ракурсы чертежа через «|» — модалка планировки читает этот атрибут.
  setAttr(card, 'data-plan-images', '{{$.imagesAttr}}')
  setAttr(card, 'data-windowViews', '{{$.windowViewsAttr}}')
  dropAttr(card, 'data-apartmentClass')
  changes.push('карточка: data-price → priceMin, data-plan-images → imagesAttr, +data-windowViews, −data-apartmentClass')

  const badges = findOne(card, (n) => hasClass(n, 'apartment-badges'), '.apartment-badges')
  const badgeNodes = badges.children ?? []
  if (badgeNodes.length < 2) {
    throw new MigrationError(`В .apartment-badges ожидалось 2 бейджа, найдено ${badgeNodes.length}`)
  }
  // Класс жилья — свойство комплекса, а не типа планировки.
  badgeNodes[0].content = '{{item.className}}'
  // badges[] есть только у квартиры; для типа осмысленнее диапазон площадей.
  badgeNodes[1].content = '{{$.areaLabel}}'
  changes.push('бейджи: класс → item.className, второй → areaLabel')

  const planVisual = findOne(card, (n) => hasClass(n, 'plan-visual'), '.plan-visual')
  if (!planVisual._repeat) {
    throw new MigrationError('.plan-visual без _repeat — обложку не на чем построить')
  }
  // cover — массив 0..1: нет чертежа, нет узла, а не url("") поверх заглушки.
  planVisual._repeat = { ...planVisual._repeat, source: '$.cover' }
  changes.push('обложка: _repeat $.planImages → $.cover')

  const price = findOne(card, (n) => hasClass(n, 'apartment-price'), '.apartment-price')
  const priceValue = (price.children ?? []).find((c) => c.content === '{{$.priceFormatted}}')
  if (!priceValue) throw new MigrationError('В .apartment-price нет узла с {{$.priceFormatted}}')
  priceValue.content = '{{$.priceLabel}}'
  // Старая цена — свойство конкретной квартиры. У типа диапазон, зачёркивать нечего.
  const oldPrice = (price.children ?? []).find((c) => hasClass(c, 'old-price'))
  if (oldPrice) removeChild(price, oldPrice)
  changes.push('цена: priceFormatted → priceLabel, узел .old-price удалён')

  const meta = findOne(card, (n) => hasClass(n, 'apartment-meta'), '.apartment-meta')
  const metaValue = (meta.children ?? []).find((c) => c.content === '{{$.meta}}')
  if (!metaValue) throw new MigrationError('В .apartment-meta нет узла с {{$.meta}}')
  metaValue.content = '{{$.floorsLabel}}'
  changes.push('мета: $.meta → $.floorsLabel')

  // Акция/рассрочка — поле квартиры. Тип планировки их не агрегирует.
  const offers = (card.children ?? []).find((c) => c._repeat?.source === '$.offers')
  if (offers) {
    removeChild(card, offers)
    changes.push('блок акций (_repeat $.offers) удалён')
  }
}

// --- Тулбар ---

function migrateRoomsChips(root: StructureNode, changes: string[]): void {
  const rows = findAll(root, (n) => n.attributes?.['data-filter-group'] === 'rooms')
  if (rows.length === 0) throw new MigrationError('Не найдено ни одного chip-row комнатности')

  for (const row of rows) {
    const chips = row.children ?? []
    if (chips.length === 0) throw new MigrationError('chip-row комнатности без чипсов — шаблон брать неоткуда')
    // Первый чипс становится шаблоном повторителя: остальные захардкоженные
    // («1», «2», «3», «4+») уходят. У Doʼstlik есть только 1- и 2-комнатные,
    // и чипсы «3»/«4+» фильтровали экран в пустоту.
    const template = chips[0]
    template.content = '{{$}}'
    setAttr(template, 'data-value', '{{$}}')
    setAttr(template, 'data-filter', 'rooms')
    row.children = [template]
    row._repeat = { source: 'item.planRooms' }
  }
  changes.push(`комнатность: ${rows.length} chip-row переведены на _repeat item.planRooms`)
}

function migrateClassFilterToViews(root: StructureNode, changes: string[]): void {
  const triggers = findAll(root, (n) => n.attributes?.['data-panel'] === PANEL_BEFORE && hasClass(n, 'filter-trigger'))
  const panels = findAll(root, (n) => n.attributes?.['data-panel'] === PANEL_BEFORE && hasClass(n, 'filter-panel'))
  const rows = findAll(root, (n) => n.attributes?.['data-filter-group'] === PANEL_BEFORE)

  if (triggers.length === 0 && panels.length === 0 && rows.length === 0) {
    throw new MigrationError('Фильтр класса жилья не найден — блок не тот, что ожидалось')
  }

  for (const trigger of triggers) {
    setAttr(trigger, 'data-panel', PANEL_AFTER)
    trigger.content = TRIGGER_LABEL_AFTER
  }
  for (const panel of panels) setAttr(panel, 'data-panel', PANEL_AFTER)
  for (const row of rows) {
    setAttr(row, 'data-filter-group', PANEL_AFTER)
    row._repeat = { source: 'item.planViews' }
    for (const chip of row.children ?? []) setAttr(chip, 'data-filter', PANEL_AFTER)
    // Заголовок группы — соседний h3 внутри той же .filter-group.
    const group = findAll(root, (n) => (n.children ?? []).includes(row))[0]
    const heading = (group?.children ?? []).find((c) => c.tagName === 'h3')
    if (heading) heading.content = PANEL_LABEL_AFTER
  }
  changes.push(
    `класс жилья → вид из окна: ${triggers.length} триггер(ов), ${panels.length} панель(ей), ${rows.length} chip-row`
  )
}

// --- Скрипт блока ---

/**
 * Точное сравнение значения не годится после перехода на типы планировок:
 * карточка типа объединяет квартиры с разными видами из окон, и атрибут
 * становится множеством («двор|бульвар»). Заодно уходит спецслучай «4+» —
 * чипсы комнатности теперь строятся по данным проекта и перечисляют всё, что
 * в нём есть.
 */
/**
 * Ищем по коду, а не по точному тексту с комментарием: комментарий переживает
 * переформатирование редактором, а условие — нет.
 *
 * Захватывает необязательный комментарий перед `if`, сам спецслучай
 * комнатности и ветку точного сравнения до закрывающей скобки.
 */
const MATCHES_BEFORE_RE =
  /([ \t]*)(?:\/\*[\s\S]*?\*\/\s*\n[ \t]*)?if \(field === 'rooms'\) \{[\s\S]*?\} else if \(set\.indexOf\(raw\) === -1\) \{[\s\S]*?\n[ \t]*\}/

const MATCHES_AFTER = `$1/* Карточка типа планировки объединяет квартиры с разными видами из
$1   окон и этажами, поэтому значение атрибута — множество через «|».
$1   Совпадение хотя бы по одному элементу и есть попадание. Чипсы
$1   строятся по данным проекта и перечисляют всё, что в нём есть,
$1   поэтому спецслучай «4+» больше не нужен. */
$1var values = raw.split('|');
$1var hit = set.some(function (v) { return values.indexOf(v) !== -1; });
$1if (!hit) return false;`

/** Признак уже применённой правки matches(). */
const MATCHES_DONE = "var values = raw.split('|');"

/**
 * Прячет триггер фильтра, в панели которого не оказалось ни одного чипса.
 *
 * Чипсы разворачиваются из данных проекта, а `_repeat` умеет обнулить детей,
 * но не убрать сам узел. Без этого у проекта без видов из окон (или с
 * незаполненным сроком сдачи у корпусов) кнопка открывала бы пустую панель —
 * выглядит как поломка.
 */
const HIDE_EMPTY_SNIPPET = `
  /* display, а не [hidden]: правило вида .filter-trigger { display: flex }
     перебивает скрытие из браузерной таблицы стилей. */
  triggers.forEach(function (trigger) {
    var panel = toolbar.querySelector('.filter-panel[data-panel="' + trigger.getAttribute('data-panel') + '"]');
    if (!panel) return;
    var usable = panel.querySelector('[data-filter][data-value]') || panel.querySelector('.range-box');
    if (!usable) trigger.style.display = 'none';
  });
`

/** Куда вставляется сокрытие пустых панелей: сразу после сбора panels. */
const HIDE_ANCHOR = `  var panels = toolbar.querySelectorAll('.filter-panel');`

export function migrateGlobalJs(js: string, changes: string[]): string {
  let out = js

  if (!out.includes(MATCHES_DONE)) {
    if (!MATCHES_BEFORE_RE.test(out)) {
      throw new MigrationError('В globalJs не найден ожидаемый блок matches() — скрипт блока изменился')
    }
    out = out.replace(MATCHES_BEFORE_RE, MATCHES_AFTER)
    changes.push('globalJs: matches() сравнивает множества через «|», спецслучай «4+» убран')
  }

  if (!out.includes("trigger.style.display = 'none'")) {
    if (!out.includes(HIDE_ANCHOR)) {
      throw new MigrationError('В globalJs не найдено место для сокрытия пустых панелей фильтра')
    }
    out = out.replace(HIDE_ANCHOR, HIDE_ANCHOR + '\n' + HIDE_EMPTY_SNIPPET)
    changes.push('globalJs: триггер с пустой панелью скрывается')
  }

  return out
}

// --- Точка входа ---

export function migrateChoiceStructure(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const grid = findOne(structure, (n) => hasClass(n, 'apartments-grid'), '.apartments-grid')
  const source = grid._repeat?.source
  if (source === SOURCE_AFTER) {
    return { structure: input, changes: [], alreadyMigrated: true }
  }
  if (source !== SOURCE_BEFORE) {
    throw new MigrationError(`У .apartments-grid неожиданный _repeat.source: ${String(source)}`)
  }

  grid._repeat = { ...grid._repeat!, source: SOURCE_AFTER }
  changes.push(`грид: _repeat ${SOURCE_BEFORE} → ${SOURCE_AFTER}`)

  migrateCard(grid, changes)
  migrateRoomsChips(structure, changes)
  migrateClassFilterToViews(structure, changes)

  const js = structure.metadata?.globalJs
  if (typeof js === 'string' && js.length > 0) {
    structure.metadata!.globalJs = migrateGlobalJs(js, changes)
  }

  return { structure, changes, alreadyMigrated: false }
}
