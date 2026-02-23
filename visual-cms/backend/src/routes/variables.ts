import { Router } from 'express'
import { VariablesController } from '../controllers/VariablesController'
import { validate } from '../middleware/validate'
import {
  createVariableSchema,
  updateVariableSchema,
  bulkCreateVariablesSchema,
  reorderVariablesSchema,
  validateValueSchema,
} from '../schemas/variable.schema'

const router = Router()

// GET endpoints (no body validation needed)
router.get('/', VariablesController.getAll)
router.get('/page/:pageId', VariablesController.getByPage)
router.get('/:id', VariablesController.getOne)

// Mutation endpoints with validation
router.post('/', validate(createVariableSchema), VariablesController.create)
router.post('/bulk', validate(bulkCreateVariablesSchema), VariablesController.bulkCreate)
router.put('/reorder', validate(reorderVariablesSchema), VariablesController.reorder)
router.put('/:id', validate(updateVariableSchema), VariablesController.update)
router.delete('/:id', VariablesController.delete)
router.post('/:id/validate', validate(validateValueSchema), VariablesController.validateValue)

export default router
