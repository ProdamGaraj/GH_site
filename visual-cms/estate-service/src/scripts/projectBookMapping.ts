/**
 * Разбор книги заказчика «Сайт проекты.xlsx» в тексты проекта.
 *
 * Чистый модуль: на вход — плоские строки листа, на выход — `ProjectContent`.
 * Чтение самого xlsx живёт в `import-project-book.ts`; сюда оно не тянется,
 * чтобы разбор можно было проверять тестами без файла и без зависимостей.
 *
 * Книга ведётся руками, поэтому разбор терпим к её неровностям — все они
 * встречаются в реальном файле и закреплены тестами:
 *  - в одной ячейке мешаются настоящие переводы строк и литеральные `\n`;
 *  - заголовок секции иногда есть первой строкой, иногда нет;
 *  - строки одного бокса идут без повтора его имени в колонке «Бокс».
 */

import { ProjectContent, ProjectTexts } from './design-projects.content'

/** Строка листа книги. Колонки: «Бокс», «Текст», «Текст Уз». */
export interface BookRow {
  box: string
  ru: string
  uz: string
}

/** Лист как таблица строк: `grid[r][c]`, индексы с нуля, дыры — пустые строки. */
export type SheetGrid = string[][]

/** Где на листе лежат нужные колонки. */
export interface ColumnLayout {
  headerRow: number
  box: number
  ru: number
  uz: number
}

/** Заголовки колонок книги. «Текст Ру» и «Текст» — один и тот же столбец. */
const HEADER_BOX = 'бокс'
const HEADER_RU = ['текст', 'текст ру']
const HEADER_UZ = ['текст уз']

function norm(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Находит строку шапки и номера колонок.
 *
 * Раскладка у листов разная: «O`zMakon Buisness» начинается со строки 5 и
 * колонки 5, остальные — со строки 2 и колонки 2, а заголовок русского текста
 * там «Текст» вместо «Текст Ру». Жёсткие номера колонок работали на трёх
 * листах из четырёх и молча отдавали пустоту на четвёртом.
 */
export function locateColumns(grid: SheetGrid): ColumnLayout | null {
  for (let r = 0; r < grid.length; r++) {
    const cells = grid[r] ?? []
    const box = cells.findIndex((c) => norm(c) === HEADER_BOX)
    if (box === -1) continue
    const ru = cells.findIndex((c) => HEADER_RU.includes(norm(c)))
    if (ru === -1) continue
    const uz = cells.findIndex((c) => HEADER_UZ.includes(norm(c)))
    return { headerRow: r, box, ru, uz }
  }
  return null
}

/**
 * Строки листа ниже шапки.
 *
 * Лист без узнаваемой шапки даёт пустой результат, а не молчаливый мусор из
 * случайных колонок.
 */
export function rowsFromGrid(grid: SheetGrid): BookRow[] {
  const layout = locateColumns(grid)
  if (!layout) return []
  const rows: BookRow[] = []
  for (let r = layout.headerRow + 1; r < grid.length; r++) {
    const cells = grid[r] ?? []
    rows.push({
      box: cells[layout.box] ?? '',
      ru: cells[layout.ru] ?? '',
      uz: layout.uz === -1 ? '' : cells[layout.uz] ?? '',
    })
  }
  return rows
}

/** Бокс книги: имя и все его строки подряд. */
interface BookBox {
  name: string
  rows: BookRow[]
}

/**
 * Максимальная длина строки, которую считаем заголовком секции.
 *
 * Заголовки в книге — «О проекте», «Дворовое пространство», «В центре активной
 * жизни». Абзац текста заведомо длиннее и оканчивается знаком препинания.
 */
const TITLE_MAX_LENGTH = 60

/** Знаки конца предложения: строка с ними — текст, а не заголовок. */
const SENTENCE_END = /[.!?:;]$/

/**
 * Приводит значение ячейки к предсказуемому виду.
 *
 * Литеральная последовательность «\n» превращается в перевод строки: в книге
 * она встречается вперемешку с настоящими переносами (в «О проекте» у O`zMahal
 * есть и то и другое сразу), и без нормализации абзац склеился бы в одну
 * строку с видимым «\n» посередине.
 */
export function normalizeCell(raw: string | undefined | null): string {
  if (!raw) return ''
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Непустые строки значения по порядку. */
function lines(value: string): string[] {
  return value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/** Абзацы значения: пустая строка либо одиночный перенос разделяют их одинаково. */
function paragraphs(value: string): string[] {
  return lines(value)
}

/**
 * Первая строка — заголовок секции?
 *
 * Книга непоследовательна: у O`zMahal «О проекте» начинается с заголовка, у
 * Harizma — сразу с текста. Признак заголовка — короткая строка без знака
 * конца предложения, при этом за ней обязан идти хоть какой-то текст.
 */
export function looksLikeTitle(line: string, rest: string[]): boolean {
  if (!line || rest.length === 0) return false
  if (line.length > TITLE_MAX_LENGTH) return false
  return !SENTENCE_END.test(line)
}

export interface Section {
  title: string
  body: string[]
}

/**
 * Делит значение секции на заголовок и абзацы.
 *
 * `fallbackTitle` — имя бокса из книги. Оно берётся, когда заголовка в ячейке
 * нет: это всё ещё текст заказчика, а не выдумка. Для перевода fallback не
 * применяется — пустой заголовок в оверлее означает «показать русский».
 */
export function splitSection(value: string, fallbackTitle = ''): Section {
  const parts = paragraphs(value)
  if (parts.length === 0) return { title: fallbackTitle, body: [] }

  const [first, ...rest] = parts
  if (looksLikeTitle(first, rest)) return { title: first, body: rest }
  return { title: fallbackTitle, body: parts }
}

/**
 * Пара «значение / подпись» из ячейки бокса «Основные пункты».
 *
 * В книге они лежат в одной ячейке двумя строками: «Бизнес» и «Класс жилья».
 */
export function parseStat(value: string): { value: string; label: string } | null {
  const parts = lines(value)
  if (parts.length === 0) return null
  return { value: parts[0], label: parts.slice(1).join(' ') }
}

/**
 * Группирует строки листа по боксам.
 *
 * Имя бокса стоит только в первой его строке; последующие строки продолжают
 * текущий бокс. Строки до первого именованного бокса (шапка таблицы)
 * отбрасываются.
 */
export function groupByBox(rows: BookRow[]): BookBox[] {
  const boxes: BookBox[] = []
  for (const row of rows) {
    const name = row.box.trim()
    if (name) {
      const last = boxes[boxes.length - 1]
      // Бокс «Заявка» в книге продублирован пустой строкой — не плодим пустышки.
      if (last && last.name === name) last.rows.push(row)
      else boxes.push({ name, rows: [row] })
    } else if (boxes.length > 0) {
      boxes[boxes.length - 1].rows.push(row)
    }
  }
  return boxes
}

/** Имя бокса → поля ProjectTexts. Боксы вне списка игнорируются. */
type Locale = 'ru' | 'uz'

function pick(row: BookRow, locale: Locale): string {
  return normalizeCell(locale === 'ru' ? row.ru : row.uz)
}

function applySection(
  texts: ProjectTexts,
  box: BookBox,
  locale: Locale,
  titleKey: 'aboutTitle' | 'yardTitle' | 'hallTitle' | 'locationTitle',
  textKey: 'about' | 'yardText' | 'hallText' | 'locationText',
  extraKey?: 'aboutExtra'
): void {
  const value = pick(box.rows[0], locale)
  if (!value) return
  // Для перевода запасного заголовка нет: пустое поле в оверлее = показать ru.
  const section = splitSection(value, locale === 'ru' ? box.name : '')
  if (section.title) texts[titleKey] = section.title
  if (section.body.length === 0) return
  if (extraKey) {
    texts[textKey] = section.body[0]
    const extra = section.body.slice(1).join('\n\n')
    if (extra) texts[extraKey] = extra
  } else {
    texts[textKey] = section.body.join('\n\n')
  }
}

/** Заголовок, под которым в книге лежит вступление проекта. */
const BOX_HEADER = 'Header'
const BOX_STATS = 'Основные пункты'
const BOX_ABOUT = 'О проекте'
const BOX_YARD = 'Благоустройство'
const BOX_FEATURES = 'УТП'
const BOX_HALL = 'Дизайнерские холлы'
const BOX_MAP = 'Карта'

/**
 * Один язык листа в `ProjectTexts`.
 *
 * Боксы «Выборка» и «Заявка» не отображаются: первый пуст, второй дублирует
 * имя проекта, которое блок берёт из `{{item.name}}`.
 */
export function mapSheet(rows: BookRow[], locale: Locale): ProjectTexts {
  const texts: ProjectTexts = {}

  for (const box of groupByBox(rows)) {
    switch (box.name) {
      case BOX_HEADER: {
        const intro = pick(box.rows[0], locale)
        if (intro) texts.intro = intro
        break
      }
      case BOX_STATS: {
        const stats = box.rows
          .map((row) => parseStat(pick(row, locale)))
          .filter((s): s is { value: string; label: string } => s !== null)
        if (stats.length) texts.stats = stats
        break
      }
      case BOX_ABOUT:
        applySection(texts, box, locale, 'aboutTitle', 'about', 'aboutExtra')
        break
      case BOX_YARD:
        applySection(texts, box, locale, 'yardTitle', 'yardText')
        break
      case BOX_FEATURES: {
        const features = box.rows.map((row) => pick(row, locale)).filter(Boolean)
        if (features.length) texts.yardFeatures = features
        break
      }
      case BOX_HALL:
        applySection(texts, box, locale, 'hallTitle', 'hallText')
        break
      case BOX_MAP:
        applySection(texts, box, locale, 'locationTitle', 'locationText')
        break
      default:
        break
    }
  }

  return texts
}

/** Лист книги в пару ru/uz. */
export function mapBookSheet(rows: BookRow[]): ProjectContent {
  return { ru: mapSheet(rows, 'ru'), uz: mapSheet(rows, 'uz') }
}

/** Пуст ли разбор: по такому листу заполнять нечего. */
export function isEmptyContent(content: ProjectContent): boolean {
  return Object.keys(content.ru).length === 0
}
