import { Router } from 'express'
import { blockVersionController } from '../controllers/BlockVersionController'

/** /api/blocks/:blockId/versions */
export const blockVersionsRouter = Router({ mergeParams: true })
blockVersionsRouter.get('/', blockVersionController.getAll)
blockVersionsRouter.get('/:versionId', blockVersionController.getById)
blockVersionsRouter.post('/', blockVersionController.create)
blockVersionsRouter.post('/:versionId/restore', blockVersionController.restore)
blockVersionsRouter.put('/:versionId', blockVersionController.updateLabel)
blockVersionsRouter.delete('/:versionId', blockVersionController.delete)

/** /api/block-versions — удалённые блоки */
export const deletedBlocksRouter = Router()
deletedBlocksRouter.get('/deleted', blockVersionController.getDeleted)
deletedBlocksRouter.post('/deleted/:versionId/restore', blockVersionController.restoreDeleted)
