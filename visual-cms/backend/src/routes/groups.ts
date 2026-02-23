import { Router } from 'express'
import { GroupController } from '../controllers/GroupController'
import { validate } from '../middleware/validate'
import { createGroupSchema, updateGroupSchema } from '../schemas/group.schema'
import { responseCache } from '../middleware'

const router = Router()
const groupController = new GroupController()

router.get('/', responseCache({ ttl: 60, tags: ['groups'] }), groupController.getAll)
router.get('/:id', responseCache({ ttl: 60, tags: ['groups'] }), groupController.getById)
router.post('/', validate(createGroupSchema), groupController.create)
router.put('/:id', validate(updateGroupSchema), groupController.update)
router.delete('/:id', groupController.delete)

export default router
