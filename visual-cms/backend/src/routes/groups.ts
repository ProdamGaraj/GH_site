import { Router } from 'express'
import { GroupController } from '../controllers/GroupController'

const router = Router()
const groupController = new GroupController()

router.get('/', groupController.getAll)
router.get('/:id', groupController.getById)
router.post('/', groupController.create)
router.put('/:id', groupController.update)
router.delete('/:id', groupController.delete)

export default router
