import { Router } from 'express'
import DataBindingController from '../controllers/DataBindingController'
import { validate } from '../middleware/validate'
import {
  createDataBindingSchema,
  updateDataBindingSchema,
} from '../schemas/dataBinding.schema'

const router = Router()

router.get('/', DataBindingController.getAll)
router.get('/:id', DataBindingController.getById)
router.post('/', validate(createDataBindingSchema), DataBindingController.create)
router.put('/:id', validate(updateDataBindingSchema), DataBindingController.update)
router.delete('/:id', DataBindingController.delete)

export default router
