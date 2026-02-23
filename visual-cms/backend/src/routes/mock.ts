import { Router } from 'express'
import { mockDataController } from '../controllers/MockDataController'
import { validate } from '../middleware/validate'
import { submitApplicationSchema } from '../schemas/mock.schema'

const router = Router()

router.get('/projects', mockDataController.getProjects)
router.get('/projects/:id', mockDataController.getProjectById)
router.get('/news', mockDataController.getNews)
router.get('/team', mockDataController.getTeam)
router.post('/applications', validate(submitApplicationSchema), mockDataController.submitApplication)
router.get('/applications', mockDataController.getApplications)

export default router
