import { Router } from 'express'
import { BlockController } from '../controllers/BlockController'
import { validate } from '../middleware/validate'
import {
  createBlockSchema,
  updateBlockSchema,
  enableTemplateSchema,
  createFromElementSchema,
} from '../schemas/block.schema'
import { responseCache } from '../middleware'

const router = Router()
const blockController = new BlockController()

router.get('/', responseCache({ ttl: 30, tags: ['blocks'] }), blockController.getAll)
router.get('/reusable', responseCache({ ttl: 30, tags: ['blocks'] }), blockController.getReusable)
router.get('/with-usages', blockController.getAllWithUsages)
router.get('/:id', responseCache({ ttl: 30, tags: ['blocks'] }), blockController.getById)
router.get('/:id/usages', blockController.getUsages)
router.post('/', validate(createBlockSchema), blockController.create)
router.post('/create-from-element', validate(createFromElementSchema), blockController.createFromElement)
router.put('/:id', validate(updateBlockSchema), blockController.update)
router.delete('/:id', blockController.delete)

// Template-specific routes
router.post('/:id/enable-template', validate(enableTemplateSchema), blockController.enableTemplate)
router.post('/:id/disable-template', blockController.disableTemplate)
router.get('/:id/html', blockController.getHTML)
router.post('/:id/refresh-fields', blockController.refreshFields)

export default router
