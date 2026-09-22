/**
 * Импорт книги заказчика «Сайт проекты.xlsx» в `design-projects.content.ts`.
 *
 * Локальный инструмент разработчика: сама книга лежит вне git (`.gitignore`),
 * в репозиторий попадает только результат разбора. На сервере не запускается.
 *
 * Разбор — в `projectBookMapping.ts` (чистый, под тестами). Здесь только чтение
 * xlsx и печать файла.
 *
 * Запуск из estate-service:
 *   npx ts-node src/scripts/import-project-book.ts --dry-run
 *   npx ts-node src/scripts/import-project-book.ts
 *
 * Флаги:
 *   --dry-run      показать, что получилось, и не писать файл
 *   --book=<путь>  другая книга (по умолчанию «Сайт проекты.xlsx» в корне репо)
 */
import * as fs from 'fs'
import * as path from 'path'
import ExcelJS from 'exceljs'
import { SheetGrid, rowsFromGrid, mapBookSheet, isEmptyContent } from './projectBookMapping'
import { ProjectContent } from './design-projects.content'

/**
 * Лист книги → slug проекта.
 *
 * Имена листов заказчик пишет как ему удобно (обратные кавычки, пробелы,
 * разный регистр), поэтому соответствие задано явно, а не вычисляется.
 * Лист, которого здесь нет, пропускается с предупреждением — молча потерять
 * проект хуже, чем не импортировать его.
 */
const SHEET_TO_SLUG: Record<string, string> = {
  'O`zMakon Buisness': 'ozmakon-business',
  'Assalom Do`stlik': 'assalom-dostlik',
  Harizma: 'harizma',
  'O`zMahal': 'ozmahal',
}

/** Сколько колонок листа просматриваем в поисках шапки. Книга уже 10 колонок. */
const MAX_COLUMNS = 12

const OUT_FILE = path.join(__dirname, 'design-projects.content.ts')
const DEFAULT_BOOK = path.join(__dirname, '..', '..', '..', '..', 'Сайт проекты.xlsx')

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

/** Значение ячейки строкой. exceljs отдаёт число/формулу/rich text объектами. */
function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return ''
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object' && 'richText' in v && Array.isArray((v as any).richText)) {
    return (v as any).richText.map((t: any) => t.text ?? '').join('')
  }
  if (typeof v === 'object' && 'text' in v) return String((v as any).text ?? '')
  if (typeof v === 'object' && 'result' in v) return String((v as any).result ?? '')
  return ''
}

/**
 * Лист в таблицу строк.
 *
 * `eachRow` пропускает пустые строки, поэтому раскладываем по номеру строки:
 * иначе шапка, найденная по индексу, разъедется с данными.
 */
function readGrid(sheet: ExcelJS.Worksheet): SheetGrid {
  const grid: SheetGrid = []
  sheet.eachRow((row, rowNumber) => {
    const cells: string[] = []
    for (let c = 1; c <= MAX_COLUMNS; c++) cells[c - 1] = cellText(row.getCell(c))
    grid[rowNumber - 1] = cells
  })
  for (let r = 0; r < grid.length; r++) if (!grid[r]) grid[r] = []
  return grid
}

/** Значение в литерал TypeScript. JSON.stringify даёт корректные экранирования. */
function literal(value: unknown, indent: number): string {
  const pad = ' '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) => `${pad}  ${literal(v, indent + 2)}`)
    return `[\n${items.join(',\n')}\n${pad}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    const items = entries.map(([k, v]) => `${pad}  ${k}: ${literal(v, indent + 2)}`)
    return `{\n${items.join(',\n')}\n${pad}}`
  }
  return JSON.stringify(value)
}

function renderTexts(texts: Record<string, unknown>, indent: number): string {
  const pad = ' '.repeat(indent)
  const entries = Object.entries(texts)
  if (entries.length === 0) return '{}'
  const items = entries.map(([k, v]) => `${pad}  ${k}: ${literal(v, indent + 2)},`)
  return `{\n${items.join('\n')}\n${pad}}`
}

const HEADER = `/**
 * Тексты проектов из «Сайт проекты.xlsx» (файл заказчика).
 *
 * СГЕНЕРИРОВАНО скриптом \`import-project-book.ts\` — правки руками затрутся при
 * следующем импорте. Меняйте исходный xlsx и перезапускайте генератор:
 *   npx ts-node src/scripts/import-project-book.ts
 *
 * ru — базовые значения полей Complex, uz — оверлей для estate_translations
 * (jsonb-поля кладутся строкой JSON, как ожидает services/i18n).
 * Листы без данных сюда не попадают: пустое значение честнее выдумки.
 */

/** Поля Complex, которые ведёт заказчик в книге. Все опциональны: лист может быть неполным. */
export interface ProjectTexts {
  intro?: string
  aboutTitle?: string
  about?: string
  aboutExtra?: string
  yardTitle?: string
  yardText?: string
  hallTitle?: string
  hallText?: string
  locationTitle?: string
  locationText?: string
  stats?: Array<{ value: string; label: string }>
  yardFeatures?: string[]
}

export interface ProjectContent {
  /** Базовые значения (язык по умолчанию — ru). */
  ru: ProjectTexts
  /** Оверлей для estate_translations. */
  uz: ProjectTexts
}
`

function render(filled: Array<[string, ProjectContent]>, empty: string[]): string {
  const blocks = filled.map(
    ([slug, content]) =>
      `  ${JSON.stringify(slug)}: {\n` +
      `    ru: ${renderTexts(content.ru as Record<string, unknown>, 4)},\n` +
      `    uz: ${renderTexts(content.uz as Record<string, unknown>, 4)},\n` +
      `  },`
  )
  return (
    `${HEADER}\nexport const PROJECT_CONTENT: Record<string, ProjectContent> = {\n` +
    `${blocks.join('\n')}\n}\n\n` +
    `/** Листы книги без содержимого — по ним нечего заполнять. */\n` +
    `export const EMPTY_SHEETS: string[] = ${JSON.stringify(empty)}\n`
  )
}

async function main(): Promise<void> {
  const bookPath = flag('book') ?? DEFAULT_BOOK
  const dryRun = process.argv.includes('--dry-run')

  if (!fs.existsSync(bookPath)) {
    throw new Error(`Книга не найдена: ${bookPath}`)
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(bookPath)

  const filled: Array<[string, ProjectContent]> = []
  const empty: string[] = []

  for (const sheet of wb.worksheets) {
    const slug = SHEET_TO_SLUG[sheet.name]
    if (!slug) {
      console.warn(`  ! лист «${sheet.name}» не сопоставлен слагу — пропущен`)
      continue
    }
    const content = mapBookSheet(rowsFromGrid(readGrid(sheet)))
    if (isEmptyContent(content)) {
      empty.push(sheet.name)
      console.log(`  · ${sheet.name} → ${slug}: пусто`)
      continue
    }
    filled.push([slug, content])
    const ruFields = Object.keys(content.ru).length
    const uzFields = Object.keys(content.uz).length
    console.log(`  · ${sheet.name} → ${slug}: ru ${ruFields} полей, uz ${uzFields}`)
  }

  const out = render(filled, empty)
  if (dryRun) {
    console.log(`\n--dry-run: файл не тронут (${out.length} байт было бы записано).`)
    return
  }
  fs.writeFileSync(OUT_FILE, out, 'utf8')
  console.log(`\nЗаписано: ${OUT_FILE}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
