import { Router } from 'express'
import { FormController } from '../controllers/FormController'

const router = Router()
const controller = new FormController()

// ─── Forms CRUD ──────────────────────────────────────────────────
router.get('/', controller.getAll)
router.get('/:id', controller.getById)
router.post('/', controller.create)
router.put('/:id', controller.update)
router.delete('/:id', controller.delete)
router.post('/:id/duplicate', controller.duplicate)

// ─── Public submit (from published site) ─────────────────────────
router.post('/:formId/submit', controller.submit)

// ─── Destinations ────────────────────────────────────────────────
router.get('/:formId/destinations', controller.getDestinations)
router.post('/:formId/destinations', controller.createDestination)
router.put('/:formId/destinations/:destId', controller.updateDestination)
router.delete('/:formId/destinations/:destId', controller.deleteDestination)
router.post('/:formId/destinations/:destId/test', controller.testDestination)

// ─── Submissions history ─────────────────────────────────────────
router.get('/:formId/submissions', controller.getSubmissions)
router.get('/:formId/submissions/stats', controller.getSubmissionStats)

export default router
