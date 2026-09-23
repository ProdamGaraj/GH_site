/**
 * Фильтры секции «Выбрать» (блок «Complex choice»), версия 4.
 *
 * Что было не так на странице проекта:
 * - панель фильтров рисовалась под карточками планировок, а на коротком
 *   каталоге её обрезала секция (`overflow: hidden`);
 * - панели открывались под всем тулбаром и на фиксированном left —
 *   «оторванными» от кнопок; «Все фильтры» уезжали вправо, поля цены
 *   в них обрезались (v3: панель ставится под своей кнопкой; v4: на
 *   десктопе комнатность и цена строкой, панели только на телефоне);
 * - между фильтрами и карточками стоял баннер «Оставить заявку» с
 *   невидимым названием проекта, линия и большой отступ (v4: убраны);
 * - клик по чипсу в панели не срабатывал вовсе: stopPropagation на панели
 *   глушил делегат на тулбаре;
 * - варианты не сужались: при цене «до 400 млн» оставался чипс «2», хотя
 *   двухкомнатных в этой цене нет;
 * - цена карточки сравнивалась только по минимуму, а после склейки
 *   планировок у карточки диапазон — «от 600 млн» отсекал карточку 376–700;
 * - «⌄» был символом в тексте кнопки и рисовался запасным шрифтом, криво;
 * - пустые группы («Срок сдачи» без сроков) висели в «Все фильтры»;
 * - «квартир нет» писалось по-русски и на узбекской версии.
 *
 * Здесь только чистое преобразование структуры блока и строк переводов:
 * запись в базу — в `migrate-choice-filters.ts`.
 *
 * Идемпотентность: каждая правка проверяет, не применена ли она уже, и
 * повторный вызов ничего не меняет.
 */
import {
  MigrationError,
  MigrationResult,
  StructureNode,
  findAll,
  findOne,
  hasClass,
  setAttr,
  walk,
} from './choiceToPlanTypes'
import {
  FILTERS_CSS,
  FILTERS_CSS_HEAD,
  FILTERS_CSS_MARKER,
  FILTERS_JS,
  FILTERS_JS_HEAD,
  FILTERS_JS_MARKER,
} from './choiceFilters.assets'

/** Верхняя граница цены карточки: после склейки планировок это диапазон. */
const PRICE_MAX_ATTR = 'data-price-max'
const PRICE_MAX_BINDING = '{{$.priceMax}}'

/** «Комнатность ⌄» → «Комнатность». Галочку теперь рисует CSS. */
const CHEVRON_RE = /\s*⌄\s*$/

export function stripChevron(text: string): string {
  return text.replace(CHEVRON_RE, '')
}

export function hasChevron(text: string | null | undefined): boolean {
  return typeof text === 'string' && CHEVRON_RE.test(text)
}

/**
 * Ставит текущую версию скрипта фильтров вместо любой прежней.
 *
 * Скрипт фильтров — последний в globalJs блока: от его заголовка до конца
 * строки. Меняем хвост целиком, а не точечными заменами: частичная склейка
 * двух версий была бы хуже любой из них.
 */
export function migrateFiltersJs(js: string, changes: string[]): string {
  if (js.includes(FILTERS_JS_MARKER)) return js
  const start = js.indexOf(FILTERS_JS_HEAD)
  if (start === -1) {
    throw new MigrationError('В globalJs не найден скрипт фильтров — скрипт блока изменился')
  }
  const tail = js.slice(start).trimEnd()
  if (!tail.endsWith('})();')) {
    throw new MigrationError('Скрипт фильтров не последний в globalJs — после него есть другой код')
  }
  changes.push('globalJs: скрипт фильтров v4 (десктоп — строкой, телефон — панель под кнопкой, сужение вариантов, цена диапазоном, счётчик, ru/uz/en)')
  return js.slice(0, start) + FILTERS_JS
}

/**
 * Ставит текущую CSS-секцию фильтров. Прежняя версия секции (она всегда в
 * конце globalCss) заменяется до конца; если секции нет — дописывается.
 */
export function migrateFiltersCss(css: string, changes: string[]): string {
  if (css.includes(FILTERS_CSS_MARKER)) return css
  const start = css.indexOf(FILTERS_CSS_HEAD)
  const base = start === -1 ? css : css.slice(0, start)
  changes.push('globalCss: строка фильтров на десктопе, панель под кнопкой на телефоне, без линии и отступа над карточками')
  return base.trimEnd() + '\n' + FILTERS_CSS
}

/**
 * Баннер «<проект> · Оставить заявку» между фильтрами и карточками.
 *
 * Его фон — картинка проекта, которой в шаблоне нет, поэтому название
 * проекта выходило белым по белому, а оставалась одна кнопка-переход к
 * форме посреди пустого места. Форма заявки и так ниже на странице.
 */
export function removeChoiceBanner(structure: StructureNode, changes: string[]): void {
  walk(structure, (node) => {
    const banners = (node.children ?? []).filter(
      (child) => child.attributes?.id === 'choiceBanner' || hasClass(child, 'complex-banner')
    )
    if (banners.length === 0) return
    node.children = node.children!.filter((child) => !banners.includes(child))
    changes.push('баннер «Оставить заявку» над карточками убран')
  })
}

export function migrateChoiceFilters(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const card = findOne(
    structure,
    (n) => hasClass(n, 'apartment-card') && n.attributes?.['data-price'] !== undefined,
    '.apartment-card с data-price'
  )
  if (card.attributes?.[PRICE_MAX_ATTR] === undefined) {
    setAttr(card, PRICE_MAX_ATTR, PRICE_MAX_BINDING)
    changes.push(`карточка: ${PRICE_MAX_ATTR}="${PRICE_MAX_BINDING}"`)
  }

  removeChoiceBanner(structure, changes)

  const triggers = findAll(structure, (n) => hasClass(n, 'filter-trigger'))
  for (const trigger of triggers) {
    if (hasChevron(trigger.content)) {
      const before = trigger.content!
      trigger.content = stripChevron(before)
      changes.push(`кнопка «${trigger.content}»: символ ⌄ убран`)
    }
  }

  const metadata = (structure.metadata ??= {})
  const js = metadata.globalJs
  if (typeof js !== 'string' || js.length === 0) {
    throw new MigrationError('У блока нет globalJs — это не «Complex choice»?')
  }
  metadata.globalJs = migrateFiltersJs(js, changes)
  metadata.globalCss = migrateFiltersCss(typeof metadata.globalCss === 'string' ? metadata.globalCss : '', changes)

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}

/** Строка перевода, как её отдаёт таблица translations. */
export interface TranslationRow {
  id: string
  nodeId: string
  field: string
  value: string
}

/**
 * Переводы кнопок фильтра несут тот же «⌄» («Narx ⌄»). Без чистки на
 * узбекской версии было бы две галочки: символ и CSS.
 *
 * Берутся только узлы-кнопки фильтра блока: у других узлов символ, если
 * встретится, — это чужой контент.
 */
export function chevronTranslationFixes(
  structure: StructureNode,
  rows: TranslationRow[]
): Array<{ id: string; before: string; after: string }> {
  const triggerIds = new Set(
    findAll(structure, (n) => hasClass(n, 'filter-trigger'))
      .map((n) => n.id)
      .filter((id): id is string => typeof id === 'string')
  )
  return rows
    .filter((row) => row.field === 'content' && triggerIds.has(row.nodeId) && hasChevron(row.value))
    .map((row) => ({ id: row.id, before: row.value, after: stripChevron(row.value) }))
}
