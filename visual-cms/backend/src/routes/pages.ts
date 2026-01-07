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

export default router
