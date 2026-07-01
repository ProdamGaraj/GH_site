import { Request, Response } from 'express'
import { translationService } from '../services/TranslationService'
import { translationIOService } from '../services/TranslationIOService'
import { asyncHandler, NotFoundError, ValidationError } from '../middleware'

export class TranslationController {
  /**
   * GET /api/translations/:pageId/locales
   * Get all locales that have translations for a page
   */
  getPageLocales = asyncHandler(async (req: Request, res: Response) => {
    const { pageId } = req.params
    const locales = await translationService.getPageLocales(pageId)
    res.json(locales)
  })

  /**
   * GET /api/translations/:pageId/:locale
   * Get all translations for a page in a specific locale
   */
  getPageTranslations = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, locale } = req.params
    const translations = await translationService.getPageTranslations(pageId, locale)
    res.json(translations)
  })

  /**
   * GET /api/translations/:pageId/:locale/map
   * Get translations as a flat map: { [nodeId]: { [field]: value } }
   */
  getTranslationMap = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, locale } = req.params
    const map = await translationService.getTranslationMap(pageId, locale)
    res.json(map)
  })

  /**
   * GET /api/translations/:pageId/source
   * Extract all translatable fields from the page's source content
   */
  getTranslatableContent = asyncHandler(async (req: Request, res: Response) => {
    const { pageId } = req.params
    const entries = await translationService.extractTranslatableContent(pageId)
    res.json(entries)
  })

  /**
   * GET /api/translations/:pageId/progress
   * Get translation progress across all locales
   */
  getProgress = asyncHandler(async (req: Request, res: Response) => {
    const { pageId } = req.params
    const progress = await translationService.getProgress(pageId)
    res.json(progress)
  })

  /**
   * PUT /api/translations/:pageId/:locale
   * Bulk upsert translations for a page in a specific locale
   */
  bulkUpsert = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, locale } = req.params
    const { translations } = req.body
    const result = await translationService.bulkUpsert(pageId, locale, translations)
    res.json(result)
  })

  /**
   * PUT /api/translations/:pageId/:locale/:nodeId/:field
   * Upsert a single translation
   */
  upsertOne = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, locale, nodeId, field } = req.params
    const { value, status } = req.body
    const result = await translationService.upsertOne(pageId, locale, nodeId, field, value, status)
    res.json(result)
  })

  /**
   * DELETE /api/translations/:pageId/:locale/:nodeId/:field
   * Delete a single translation
   */
  deleteOne = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, locale, nodeId, field } = req.params
    const deleted = await translationService.deleteOne(pageId, locale, nodeId, field)
    if (!deleted) {
      throw new NotFoundError('Translation', `${pageId}/${locale}/${nodeId}/${field}`)
    }
    res.status(204).send()
  })

  /**
   * DELETE /api/translations/:pageId/:locale
   * Delete all translations for a page in a specific locale
   */
  deleteLocale = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, locale } = req.params
    const count = await translationService.deleteLocale(pageId, locale)
    res.json({ deleted: count })
  })

  /**
   * POST /api/translations/:pageId/copy
   * Copy translations from one locale to another
   */
  copyTranslations = asyncHandler(async (req: Request, res: Response) => {
    const { pageId } = req.params
    const { fromLocale, toLocale } = req.body
    const result = await translationService.copyTranslations(pageId, fromLocale, toLocale)
    res.json(result)
  })

  /**
   * GET /api/translations/site/:siteId/export
   * Экспорт всех переводов сайта в XLSX (для внешних переводчиков).
   */
  exportSite = asyncHandler(async (req: Request, res: Response) => {
    const { siteId } = req.params
    const { buffer, filename } = await translationIOService.exportSite(siteId)
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  })

  /**
   * POST /api/translations/site/:siteId/import  (multipart, поле "file")
   * Импорт переводов сайта из XLSX. Возвращает отчёт { imported, updated, skipped, orphans }.
   */
  importSite = asyncHandler(async (req: Request, res: Response) => {
    const { siteId } = req.params
    const file = (req as Request & { file?: { buffer: Buffer } }).file
    if (!file || !file.buffer) {
      throw new ValidationError('Файл не загружен (ожидается поле "file")')
    }
    const report = await translationIOService.importSite(siteId, file.buffer)
    res.json(report)
  })
}

export const translationController = new TranslationController()
