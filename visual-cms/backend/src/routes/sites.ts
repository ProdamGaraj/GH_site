import { Router } from 'express'
import { siteController } from '../controllers/SiteController'

const router = Router()

router.get('/', siteController.getAll)
router.get('/:id', siteController.getById)
router.post('/', siteController.create)
router.put('/:id', siteController.update)
router.delete('/:id', siteController.delete)

// Site pages management
router.get('/:id/pages', siteController.getPages)
router.post('/:id/pages/:pageId', siteController.assignPage)
router.delete('/:id/pages/:pageId', siteController.unassignPage)

// Site settings
router.put('/:id/settings', siteController.updateSettings)

// Duplicate
router.post('/:id/duplicate', siteController.duplicate)

export default router
