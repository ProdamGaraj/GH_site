import { Router } from 'express'
import DataSubmitController from '../controllers/DataSubmitController'
import { validate } from '../middleware/validate'
import { submitDataSchema } from '../schemas/dataSubmit.schema'

const router = Router()

// Submit data
router.post('/submit', validate(submitDataSchema), DataSubmitController.submit)

// Submissions history (GET - no body validation)
router.get('/submissions', DataSubmitController.getSubmissions)
router.get('/submissions/stats', DataSubmitController.getStats)
router.get('/submissions/:id', DataSubmitController.getSubmissionById)

export default router
