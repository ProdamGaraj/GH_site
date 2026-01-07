import { Router } from 'express'
import { BlockController } from '../controllers/BlockController'

const router = Router()
const blockController = new BlockController()

router.get('/', blockController.getAll)
router.get('/reusable', blockController.getReusable)
router.get('/:id', blockController.getById)
router.post('/', blockController.create)
router.put('/:id', blockController.update)
router.delete('/:id', blockController.delete)

export default router
