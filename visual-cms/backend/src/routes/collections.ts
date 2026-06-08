import { Router } from 'express'
import CollectionController from '../controllers/CollectionController'
import { validate } from '../middleware/validate'
import {
  createCollectionSchema,
  updateCollectionSchema,
  createOverrideSchema,
  updateOverrideSchema,
} from '../schemas/collection.schema'

const router = Router()

// CRUD коллекций
router.get('/', CollectionController.getAll)
router.get('/:id', CollectionController.getById)
router.post('/', validate(createCollectionSchema), CollectionController.create)
router.put('/:id', validate(updateCollectionSchema), CollectionController.update)
router.delete('/:id', CollectionController.delete)

// Элементы коллекции (из API data source)
router.get('/:id/items', CollectionController.getItems)

// Превью цепочки запросов (основной + доп.источники на образце-элементе)
router.get('/:id/preview-request', CollectionController.previewRequest)

// CRUD overrides
router.post('/:id/overrides', validate(createOverrideSchema), CollectionController.createOverride)
router.put('/:id/overrides/:overrideId', validate(updateOverrideSchema), CollectionController.updateOverride)
router.delete('/:id/overrides/:overrideId', CollectionController.deleteOverride)

export default router
