/**
 * XLSX экспорт/импорт переводов сайта (T3):
 *  - round-trip: экспорт → правка → импорт возвращает нужные записи;
 *  - пустая ячейка игнорируется; значение == оригиналу пропускается;
 *  - неизвестный ключ → orphan;
 *  - формула-инъекция (=1+2) переживает round-trip как ЛИТЕРАЛ (XLSX-строка, не формула);
 *  - siteId из _meta не совпал → ошибка.
 */
import ExcelJS from 'exceljs'

// --- Моки (паттерн как в auth.login.test.ts: имена с префиксом mock*) ---
const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
}
jest.mock('../config/database', () => ({
  AppDataSource: { getRepository: jest.fn(() => mockRepo) },
}))

const mockLangs = [
  { code: 'ru', nativeName: 'Русский', isDefault: true, isActive: true },
  { code: 'en', nativeName: 'English', isDefault: false, isActive: true },
]
jest.mock('../services/LanguageService', () => ({
  languageService: { getActive: jest.fn(async () => mockLangs) },
}))

const mockExtract = jest.fn()
const mockGetPageTranslations = jest.fn()
const mockBulkUpsert = jest.fn()
jest.mock('../services/TranslationService', () => ({
  translationService: {
    extractTranslatableContent: (...a: unknown[]) => mockExtract(...a),
    getPageTranslations: (...a: unknown[]) => mockGetPageTranslations(...a),
    bulkUpsertBatched: (...a: unknown[]) => mockBulkUpsert(...a),
  },
}))

import { translationIOService } from '../services/TranslationIOService'

const SITE = { id: 'site-1', slug: 'demo' }
const PAGES = [{ id: 'p1', name: 'Home', slug: 'index' }]
const SOURCE = [
  { nodeId: 'n1', field: 'content', value: 'Привет' },
  { nodeId: 'n2', field: 'src', value: '/base.jpg' },
  { nodeId: 'img1', field: 'src@tablet', value: '/base-tablet.jpg' },
]

const LOCALE_COL = 7 // G — первая колонка языка (en)

beforeEach(() => {
  jest.clearAllMocks()
  mockRepo.findOne.mockResolvedValue(SITE)
  mockRepo.find.mockResolvedValue(PAGES)
  mockExtract.mockResolvedValue(SOURCE)
  mockGetPageTranslations.mockResolvedValue([])
  mockBulkUpsert.mockImplementation(async (_p: string, _l: string, entries: unknown[]) => ({
    inserted: (entries as unknown[]).length,
    updated: 0,
    unchanged: 0,
  }))
})

/** Загружает буфер, находит лист страницы (не _meta) и правит колонку en. */
async function editEnColumn(
  buffer: Buffer,
  edits: Record<number, string>, // rowNumber → значение en
  extraRows: Array<[string, string, string, string]> = [], // [pageId,nodeId,field,en]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  const ws = wb.worksheets.find((w) => w.name !== '_meta')!
  for (const [rowNum, val] of Object.entries(edits)) {
    ws.getRow(Number(rowNum)).getCell(LOCALE_COL).value = val
  }
  let next = ws.rowCount + 1
  for (const [pageId, nodeId, field, en] of extraRows) {
    const row = ws.getRow(next++)
    row.getCell(1).value = pageId
    row.getCell(2).value = nodeId
    row.getCell(3).value = field
    row.getCell(LOCALE_COL).value = en
  }
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}

describe('TranslationIOService — экспорт', () => {
  it('строит лист на страницу со скрытыми ключами и колонкой языка', async () => {
    const { buffer, filename } = await translationIOService.exportSite('site-1')
    expect(filename).toBe('translations-demo.xlsx')

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)
    const ws = wb.worksheets.find((w) => w.name !== '_meta')!
    // Заголовок: A..F технические/инфо + G = English [en]
    expect(ws.getRow(1).getCell(LOCALE_COL).value).toBe('English [en]')
    // Ключи первой строки данных.
    expect(ws.getRow(2).getCell(1).value).toBe('p1')
    expect(ws.getRow(2).getCell(2).value).toBe('n1')
    expect(ws.getRow(2).getCell(3).value).toBe('content')
    // Ключевые колонки скрыты.
    expect(ws.getColumn(1).hidden).toBe(true)
  })

  it('не даёт Excel «восстанавливать»: первый лист видимый, _meta скрыт и последний', async () => {
    const { buffer } = await translationIOService.exportSite('site-1')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

    // Активная вкладка (index 0) — НЕ скрытый _meta.
    expect(wb.worksheets[0].name).not.toBe('_meta')
    expect(wb.worksheets[0].state).toBe('visible')
    // _meta присутствует, скрыт и не первый.
    const meta = wb.getWorksheet('_meta')!
    expect(meta.state).toBe('veryHidden')
    expect(wb.worksheets[wb.worksheets.length - 1].name).toBe('_meta')
  })

  it('сайт без переводимого контента: есть видимый лист (не только скрытый _meta)', async () => {
    mockExtract.mockResolvedValue([]) // ни одного переводимого поля
    const { buffer } = await translationIOService.exportSite('site-1')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer)

    const visible = wb.worksheets.filter((w) => w.state === 'visible')
    expect(visible.length).toBeGreaterThanOrEqual(1)
    expect(wb.worksheets[0].state).toBe('visible')
  })
})

describe('TranslationIOService — импорт', () => {
  it('round-trip: заполненные ячейки языка сохраняются батчево', async () => {
    const { buffer } = await translationIOService.exportSite('site-1')
    // Переводчик заполнил en: строка 2 (n1/content) и строка 4 (img1/src@tablet).
    const edited = await editEnColumn(buffer, { 2: 'Hello', 4: '/en-tablet.jpg' })

    const report = await translationIOService.importSite('site-1', edited)

    expect(mockBulkUpsert).toHaveBeenCalledTimes(1)
    const [pageId, locale, entries] = mockBulkUpsert.mock.calls[0]
    expect(pageId).toBe('p1')
    expect(locale).toBe('en')
    expect(entries).toEqual(
      expect.arrayContaining([
        { nodeId: 'n1', field: 'content', value: 'Hello' },
        { nodeId: 'img1', field: 'src@tablet', value: '/en-tablet.jpg' },
      ]),
    )
    expect(report.imported).toBe(2)
    expect(report.locales).toEqual(['en'])
  })

  it('пустая ячейка игнорируется (перевод не стирается)', async () => {
    const { buffer } = await translationIOService.exportSite('site-1')
    // Ничего не заполняем.
    const report = await translationIOService.importSite('site-1', buffer)
    expect(mockBulkUpsert).not.toHaveBeenCalled()
    expect(report.imported).toBe(0)
  })

  it('значение == оригиналу пропускается', async () => {
    const { buffer } = await translationIOService.exportSite('site-1')
    const edited = await editEnColumn(buffer, { 2: 'Привет' }) // == оригинал n1
    const report = await translationIOService.importSite('site-1', edited)
    expect(mockBulkUpsert).not.toHaveBeenCalled()
    expect(report.skipped).toBeGreaterThan(0)
  })

  it('неизвестный ключ → orphan, не сохраняется', async () => {
    const { buffer } = await translationIOService.exportSite('site-1')
    const edited = await editEnColumn(buffer, {}, [['p1', 'ghost', 'content', 'X']])
    const report = await translationIOService.importSite('site-1', edited)
    expect(mockBulkUpsert).not.toHaveBeenCalled()
    expect(report.orphans).toEqual([
      expect.objectContaining({ nodeId: 'ghost', field: 'content', reason: 'unknown-key' }),
    ])
  })

  it('формула-инъекция переживает round-trip как литерал', async () => {
    const { buffer } = await translationIOService.exportSite('site-1')
    const edited = await editEnColumn(buffer, { 2: '=1+2' })

    // Значение читается назад как строка '=1+2', а не как формула.
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(edited as unknown as ExcelJS.Buffer)
    const ws = wb.worksheets.find((w) => w.name !== '_meta')!
    const cell = ws.getRow(2).getCell(LOCALE_COL)
    expect(cell.formula).toBeUndefined()
    expect(cell.value).toBe('=1+2')

    await translationIOService.importSite('site-1', edited)
    const entries = mockBulkUpsert.mock.calls[0][2]
    expect(entries).toContainEqual({ nodeId: 'n1', field: 'content', value: '=1+2' })
  })

  it('siteId из _meta не совпал → ошибка', async () => {
    const { buffer } = await translationIOService.exportSite('site-1')
    await expect(translationIOService.importSite('site-2', buffer)).rejects.toThrow(
      'Файл относится к другому сайту',
    )
  })
})
