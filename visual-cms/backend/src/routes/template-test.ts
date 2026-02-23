import { Router } from 'express'
import { templateTestController } from '../controllers/TemplateTestController'
import { validate } from '../middleware/validate'
import { renderTemplateSchema } from '../schemas/templateTest.schema'

const router = Router()

router.post('/render', validate(renderTemplateSchema), templateTestController.renderTemplate)
router.post('/preview', validate(renderTemplateSchema), templateTestController.generatePreview)

export default router
