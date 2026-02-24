import { Router } from 'express'
import { languageController } from '../controllers/LanguageController'
import { validate } from '../middleware/validate'
import { createLanguageSchema, updateLanguageSchema, reorderLanguagesSchema } from '../schemas/translation.schema'

const router = Router()

// GET /api/languages - all languages
router.get('/', languageController.getAll)

// GET /api/languages/active - only active languages
router.get('/active', languageController.getActive)

// POST /api/languages/seed - seed default languages
router.post('/seed', languageController.seedDefaults)

// PUT /api/languages/reorder - reorder languages
router.put('/reorder', validate(reorderLanguagesSchema), languageController.reorder)

// GET /api/languages/:id
router.get('/:id', languageController.getById)

// POST /api/languages
router.post('/', validate(createLanguageSchema), languageController.create)

// PUT /api/languages/:id
router.put('/:id', validate(updateLanguageSchema), languageController.update)

// DELETE /api/languages/:id
router.delete('/:id', languageController.delete)

export default router
