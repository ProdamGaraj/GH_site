import { Router } from 'express'
import { previewController } from '../controllers/PreviewController'
import { validate } from '../middleware/validate'
import { renderPagePreviewSchema, renderBlockPreviewSchema } from '../schemas/preview.schema'

const router = Router()

router.post('/page', validate(renderPagePreviewSchema), previewController.renderPage)
router.post('/block', validate(renderBlockPreviewSchema), previewController.renderBlock)

export default router
