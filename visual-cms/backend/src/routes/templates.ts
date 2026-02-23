import { Router } from 'express'
import TemplateController from '../controllers/TemplateController'
import { validate } from '../middleware/validate'
import {
  createTemplateSchema,
  updateTemplateSchema,
  detectFieldsSchema,
} from '../schemas/template.schema'
import { responseCache } from '../middleware'

const router = Router()

// Detect fields from raw HTML (must be above /:id routes)
router.post('/detect-fields', validate(detectFieldsSchema), TemplateController.detectFieldsFromHtml)

// CRUD
router.get('/', responseCache({ ttl: 60, tags: ['templates'] }), TemplateController.getAll)
router.get('/:id', responseCache({ ttl: 60, tags: ['templates'] }), TemplateController.getById)
router.post('/', validate(createTemplateSchema), TemplateController.create)
router.put('/:id', validate(updateTemplateSchema), TemplateController.update)
router.delete('/:id', TemplateController.delete)

// Additional endpoints
router.post('/:id/duplicate', TemplateController.duplicate)
router.post('/:id/detect-fields', TemplateController.detectFieldsEndpoint)

export default router
