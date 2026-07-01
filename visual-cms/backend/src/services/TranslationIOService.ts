/**
 * Экспорт/импорт переводов сайта в XLSX (для внешних переводчиков).
 *
 * Формат: лист на страницу + служебный лист `_meta`.
 * Колонки листа страницы:
 *   A pageId  (скрытая, технический ключ)
 *   B nodeId  (скрытая, технический ключ)
 *   C field   (скрытая, технический ключ)
 *   D Элемент (инфо)
 *   E Поле    (инфо)
 *   F Оригинал [<defaultCode>]        (источник, только для чтения)
 *   G… <nativeName> [<code>]          (редактируемые колонки языков)
 *
 * Импорт читает строки по СКРЫТЫМ ключам (A/B/C), а язык колонки — по коду в
 * `[...]` заголовка. Ключи валидируются против актуального переводимого контента
 * страницы: неизвестные — пропускаются и попадают в orphans. Пустая ячейка —
 * игнорируется (существующий перевод не стирается). Значение == оригиналу —
 * пропускается (не плодим оверлеи). Все записи (page, locale) сохраняются
 * батчево (bulkUpsertBatched, без N+1).
 */
import ExcelJS from 'exceljs'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'
import { Site } from '../models/Site'
import { translationService, TranslationEntry } from './TranslationService'
import { languageService } from './LanguageService'

const FORMAT_VERSION = 1
const META_SHEET = '_meta'
const KEY_COLS = 3 // A,B,C — скрытые ключи
const INFO_COLS = 2 // D,E — Элемент, Поле
const FIRST_LOCALE_COL = KEY_COLS + INFO_COLS + 1 + 1 // после F (оригинал) → G = 7

export interface ImportReport {
  imported: number
  updated: number
  skipped: number // пустые/без изменений/== оригиналу
  orphans: Array<{ page?: string; nodeId: string; field: string; reason: string }>
  locales: string[]
}

/** Человекочитаемая подпись поля (в т.ч. пер-брейкпоинтного `field@bp`). */
function fieldLabel(field: string): string {
  const base: Record<string, string> = {
    content: 'Текст',
    src: 'Изображение/Видео',
    alt: 'Alt текст',
    href: 'Ссылка',
    placeholder: 'Placeholder',
    title: 'Title',
    poster: 'Poster',
    'aria-label': 'Aria Label',
    'bg:image': 'Фон (картинка)',
    'data-slide-video': 'Видео слайда',
    'meta:title': 'Meta Title',
    'meta:description': 'Meta Description',
    'meta:ogImage': 'OG Image',
  }
  const at = field.indexOf('@')
  if (at > 0) {
    const b = field.slice(0, at)
    const bp = field.slice(at + 1)
    return `${base[b] || b} (${bp})`
  }
  return base[field] || field
}

/** Подпись узла для колонки «Элемент». */
function nodeLabel(nodeId: string): string {
  if (nodeId === '__page__') return 'Страница (мета)'
  if (nodeId.startsWith('pagevar:')) return `Слайдер · ${nodeId.slice('pagevar:'.length)}`
  return nodeId.slice(0, 8)
}

/** Имя листа Excel: ≤31 символ, без запрещённых символов, уникальное. */
function safeSheetName(name: string, used: Set<string>): string {
  let base = (name || 'page').replace(/[\[\]\*\?\/\\:]/g, ' ').trim().slice(0, 28) || 'page'
  let candidate = base
  let i = 2
  while (used.has(candidate.toLowerCase()) || candidate.toLowerCase() === META_SHEET) {
    const suffix = ` ${i++}`
    candidate = base.slice(0, 28 - suffix.length) + suffix
  }
  used.add(candidate.toLowerCase())
  return candidate
}

/** Парсит код языка из заголовка колонки вида "Русский [ru]". */
function parseLocaleCode(header: unknown): string | null {
  if (typeof header !== 'string') return null
  const m = header.match(/\[([a-zA-Z-]{2,10})\]\s*$/)
  return m ? m[1] : null
}

export class TranslationIOService {
  private pageRepository = AppDataSource.getRepository(Page)
  private siteRepository = AppDataSource.getRepository(Site)

  /** Экспорт всех переводов сайта в XLSX-буфер. */
  async exportSite(siteId: string): Promise<{ buffer: Buffer; filename: string }> {
    const site = await this.siteRepository.findOne({ where: { id: siteId } })
    if (!site) throw new Error('Сайт не найден')

    const pages = await this.pageRepository.find({ where: { siteId }, order: { name: 'ASC' } })

    const languages = await languageService.getActive()
    const defaultLang = languages.find((l) => l.isDefault) || languages[0]
    const targetLangs = languages.filter((l) => !l.isDefault)

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Visual CMS'
    wb.created = new Date()

    // Служебный лист для валидации при импорте.
    const meta = wb.addWorksheet(META_SHEET)
    meta.state = 'veryHidden'
    meta.addRow(['version', FORMAT_VERSION])
    meta.addRow(['siteId', siteId])
    meta.addRow(['siteSlug', site.slug])
    meta.addRow(['defaultLocale', defaultLang?.code || ''])
    meta.addRow(['locales', targetLangs.map((l) => l.code).join(',')])

    const usedNames = new Set<string>()

    for (const page of pages) {
      const source = await translationService.extractTranslatableContent(page.id)
      if (source.length === 0) continue

      // Текущие переводы страницы: (nodeId::field) → { locale → value }.
      const current = new Map<string, Record<string, string>>()
      for (const lang of targetLangs) {
        const rows = await translationService.getPageTranslations(page.id, lang.code)
        for (const r of rows) {
          const k = `${r.nodeId}::${r.field}`
          const byLoc = current.get(k) || {}
          byLoc[lang.code] = r.value
          current.set(k, byLoc)
        }
      }

      const ws = wb.addWorksheet(safeSheetName(page.name || page.slug, usedNames))

      // Заголовок.
      const header = ['pageId', 'nodeId', 'field', 'Элемент', 'Поле', `Оригинал [${defaultLang?.code || ''}]`]
      for (const lang of targetLangs) header.push(`${lang.nativeName} [${lang.code}]`)
      ws.addRow(header)

      for (const entry of source) {
        const k = `${entry.nodeId}::${entry.field}`
        const byLoc = current.get(k) || {}
        const row: (string | undefined)[] = [
          page.id,
          entry.nodeId,
          entry.field,
          nodeLabel(entry.nodeId),
          fieldLabel(entry.field),
          entry.value,
        ]
        for (const lang of targetLangs) row.push(byLoc[lang.code] ?? '')
        ws.addRow(row)
      }

      // Скрываем технические ключевые колонки; фиксируем строку заголовка.
      for (let c = 1; c <= KEY_COLS; c++) ws.getColumn(c).hidden = true
      ws.getColumn(4).width = 16
      ws.getColumn(5).width = 22
      ws.getColumn(6).width = 40
      for (let c = FIRST_LOCALE_COL; c <= header.length; c++) ws.getColumn(c).width = 40
      ws.getRow(1).font = { bold: true }
      ws.views = [{ state: 'frozen', ySplit: 1 }]
    }

    const arrayBuffer = await wb.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer)
    const filename = `translations-${site.slug || siteId}.xlsx`
    return { buffer, filename }
  }

  /** Импорт переводов сайта из XLSX-буфера. */
  async importSite(siteId: string, buffer: Buffer): Promise<ImportReport> {
    const site = await this.siteRepository.findOne({ where: { id: siteId } })
    if (!site) throw new Error('Сайт не найден')

    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)
    } catch {
      throw new Error('Не удалось прочитать XLSX-файл')
    }

    // Валидация служебного листа: файл должен относиться к этому сайту.
    const meta = wb.getWorksheet(META_SHEET)
    if (meta) {
      const metaSiteId = String(meta.getRow(2).getCell(2).value ?? '')
      if (metaSiteId && metaSiteId !== siteId) {
        throw new Error('Файл относится к другому сайту')
      }
    }

    const languages = await languageService.getActive()
    const validLocales = new Set(languages.filter((l) => !l.isDefault).map((l) => l.code))

    // Разрешённые ключи по странице: (pageId) → Map<nodeId::field, original>.
    const validKeysCache = new Map<string, Map<string, string>>()
    const getValidKeys = async (pageId: string): Promise<Map<string, string>> => {
      let m = validKeysCache.get(pageId)
      if (!m) {
        m = new Map()
        for (const e of await translationService.extractTranslatableContent(pageId)) {
          m.set(`${e.nodeId}::${e.field}`, e.value)
        }
        validKeysCache.set(pageId, m)
      }
      return m
    }

    // Накопитель: (pageId, locale) → entries.
    const buckets = new Map<string, { pageId: string; locale: string; entries: TranslationEntry[] }>()
    const report: ImportReport = { imported: 0, updated: 0, skipped: 0, orphans: [], locales: [] }
    const seenLocales = new Set<string>()

    for (const ws of wb.worksheets) {
      if (ws.name === META_SHEET) continue
      const headerRow = ws.getRow(1)

      // Карта колонок языков: индекс → код (только валидные target-локали).
      const localeCols: Array<{ col: number; code: string }> = []
      headerRow.eachCell((cell: ExcelJS.Cell, col: number) => {
        if (col < FIRST_LOCALE_COL) return
        const code = parseLocaleCode(cell.value)
        if (code && validLocales.has(code)) {
          localeCols.push({ col, code })
          seenLocales.add(code)
        }
      })
      if (localeCols.length === 0) continue

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r)
        const pageId = cellString(row.getCell(1).value)
        const nodeId = cellString(row.getCell(2).value)
        const field = cellString(row.getCell(3).value)
        if (!pageId || !nodeId || !field) continue

        const validKeys = await getValidKeys(pageId)
        const key = `${nodeId}::${field}`
        const original = validKeys.get(key)
        if (original === undefined) {
          report.orphans.push({ page: ws.name, nodeId, field, reason: 'unknown-key' })
          continue
        }

        for (const { col, code } of localeCols) {
          const value = cellString(row.getCell(col).value)
          if (value === '' ) {
            report.skipped++ // пустая ячейка — игнор
            continue
          }
          if (value === original) {
            report.skipped++ // совпадает с оригиналом — не сохраняем
            continue
          }
          const bkey = `${pageId}::${code}`
          let bucket = buckets.get(bkey)
          if (!bucket) {
            bucket = { pageId, locale: code, entries: [] }
            buckets.set(bkey, bucket)
          }
          bucket.entries.push({ nodeId, field, value })
        }
      }
    }

    // Батчевое сохранение по (page, locale).
    for (const { pageId, locale, entries } of buckets.values()) {
      const res = await translationService.bulkUpsertBatched(pageId, locale, entries)
      report.imported += res.inserted
      report.updated += res.updated
      report.skipped += res.unchanged
    }

    report.locales = [...seenLocales]
    return report
  }
}

/** Приводит значение ячейки ExcelJS к строке (учитывая richText/hyperlink/number). */
function cellString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    const v = value as { text?: string; richText?: Array<{ text: string }>; result?: unknown }
    if (typeof v.text === 'string') return v.text.trim()
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('').trim()
    if (v.result !== undefined) return cellString(v.result)
  }
  return ''
}

export const translationIOService = new TranslationIOService()
