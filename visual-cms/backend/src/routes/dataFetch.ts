import { Router } from 'express'
import DataBindingController from '../controllers/DataBindingController'
import { validate } from '../middleware/validate'
import { fetchDataSchema } from '../schemas/dataBinding.schema'

const router = Router()

router.post('/fetch', validate(fetchDataSchema), DataBindingController.fetchData)
router.post('/fetch-with-binding', DataBindingController.fetchWithBinding)
router.post('/fetch-with-transforms', DataBindingController.fetchWithTransforms)
router.post('/submit-with-binding', DataBindingController.submitWithBinding)

export default router
