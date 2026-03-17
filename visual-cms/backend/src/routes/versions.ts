import { Router } from 'express'
import { versionController } from '../controllers/VersionController'

const router = Router({ mergeParams: true })

router.get('/', versionController.getAll)
router.get('/:versionId', versionController.getById)
router.post('/', versionController.create)
router.post('/:versionId/restore', versionController.restore)
router.put('/:versionId', versionController.updateLabel)
router.delete('/:versionId', versionController.delete)

export default router
