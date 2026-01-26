import { Router } from 'express'
import { BlockController } from '../controllers/BlockController'

const router = Router()
const blockController = new BlockController()

router.get('/', blockController.getAll)
router.get('/reusable', blockController.getReusable)
router.get('/:id', blockController.getById)
router.post('/', blockController.create)
router.post('/create-from-element', blockController.createFromElement)
router.put('/:id', blockController.update)
router.delete('/:id', blockController.delete)

// Template-specific routes
router.post('/:id/enable-template', blockController.enableTemplate)
router.post('/:id/disable-template', blockController.disableTemplate)
router.get('/:id/html', blockController.getHTML)
router.post('/:id/refresh-fields', blockController.refreshFields)

export default router
