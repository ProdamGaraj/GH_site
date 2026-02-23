import { Router } from 'express'
import { FormController } from '../controllers/FormController'
import { validate } from '../middleware/validate'
import {
  createFormSchema,
  updateFormSchema,
  createDestinationSchema,
  updateDestinationSchema,
  submitFormSchema,
} from '../schemas/form.schema'

const router = Router()
const controller = new FormController()

// Forms CRUD
router.get('/', controller.getAll)
router.get('/:id', controller.getById)
router.post('/', validate(createFormSchema), controller.create)
router.put('/:id', validate(updateFormSchema), controller.update)
router.delete('/:id', controller.delete)
router.post('/:id/duplicate', controller.duplicate)

// Public submit (from published site)
router.post('/:formId/submit', validate(submitFormSchema), controller.submit)

// Destinations
router.get('/:formId/destinations', controller.getDestinations)
router.post('/:formId/destinations', validate(createDestinationSchema), controller.createDestination)
router.put('/:formId/destinations/:destId', validate(updateDestinationSchema), controller.updateDestination)
router.delete('/:formId/destinations/:destId', controller.deleteDestination)
router.post('/:formId/destinations/:destId/test', controller.testDestination)

// Submissions history
router.get('/:formId/submissions', controller.getSubmissions)
router.get('/:formId/submissions/stats', controller.getSubmissionStats)

export default router
