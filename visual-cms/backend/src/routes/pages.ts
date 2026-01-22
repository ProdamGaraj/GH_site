import { Router } from 'express'
import { PageController } from '../controllers/PageController'

const router = Router()
const pageController = new PageController()

router.get('/', pageController.getAll)
router.get('/:id', pageController.getById)
router.post('/', pageController.create)
router.put('/:id', pageController.update)
router.delete('/:id', pageController.delete)
router.post('/:id/publish', pageController.publish)

// Data Binding routes (Stage 3.5 & 3.6)
router.get('/:id/data-settings', pageController.getDataSettings)
router.put('/:id/data-settings', pageController.updateDataSettings)
router.put('/:id/data-sources', pageController.updateDataSources)
router.put('/:id/variables', pageController.updateVariables)

export default router
