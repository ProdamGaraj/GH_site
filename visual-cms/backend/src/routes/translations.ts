import { Router } from 'express'
import { translationController } from '../controllers/TranslationController'
import { validate } from '../middleware/validate'
import { bulkTranslationSchema, upsertTranslationSchema, copyTranslationsSchema } from '../schemas/translation.schema'

const router = Router()

// GET /api/translations/:pageId/source - extract translatable fields
router.get('/:pageId/source', translationController.getTranslatableContent)

// GET /api/translations/:pageId/locales - list translated locales
router.get('/:pageId/locales', translationController.getPageLocales)

// GET /api/translations/:pageId/progress - translation progress stats
router.get('/:pageId/progress', translationController.getProgress)

// POST /api/translations/:pageId/copy - copy translations between locales
router.post('/:pageId/copy', validate(copyTranslationsSchema), translationController.copyTranslations)

// GET /api/translations/:pageId/:locale - get all translations for locale
router.get('/:pageId/:locale', translationController.getPageTranslations)

// GET /api/translations/:pageId/:locale/map - get as a flat map
router.get('/:pageId/:locale/map', translationController.getTranslationMap)

// PUT /api/translations/:pageId/:locale - bulk upsert translations
router.put('/:pageId/:locale', validate(bulkTranslationSchema), translationController.bulkUpsert)

// DELETE /api/translations/:pageId/:locale - delete all translations for locale
router.delete('/:pageId/:locale', translationController.deleteLocale)

// PUT /api/translations/:pageId/:locale/:nodeId/:field - upsert single
router.put('/:pageId/:locale/:nodeId/:field', validate(upsertTranslationSchema), translationController.upsertOne)

// DELETE /api/translations/:pageId/:locale/:nodeId/:field - delete single
router.delete('/:pageId/:locale/:nodeId/:field', translationController.deleteOne)

export default router
