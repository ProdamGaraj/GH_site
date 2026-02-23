import { Router } from 'express'
import DataSourceController from '../controllers/DataSourceController'
import { validate } from '../middleware/validate'
import {
  createDataSourceSchema,
  updateDataSourceSchema,
  testNewConnectionSchema,
} from '../schemas/dataSource.schema'
import { responseCache } from '../middleware'

const router = Router()

router.get('/', responseCache({ ttl: 30, tags: ['dataSources'] }), DataSourceController.getAll)
router.get('/:id', responseCache({ ttl: 30, tags: ['dataSources'] }), DataSourceController.getById)
router.post('/', validate(createDataSourceSchema), DataSourceController.create)
router.put('/:id', validate(updateDataSourceSchema), DataSourceController.update)
router.delete('/:id', DataSourceController.delete)

// Test new config (must be above /:id/test)
router.post('/new/test', validate(testNewConnectionSchema), DataSourceController.testNewConnection)
router.post('/:id/test', DataSourceController.testConnection)
router.post('/:id/duplicate', DataSourceController.duplicate)

export default router
