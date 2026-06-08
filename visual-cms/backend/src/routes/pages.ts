import { Router } from 'express'
import { PageController } from '../controllers/PageController'
import { validate } from '../middleware/validate'
import {
  createPageSchema,
  updatePageSchema,
  updatePageDataSourcesSchema,
  updatePageVariablesSchema,
  updateDataSettingsSchema,
  savePreflightSchema,
} from '../schemas/page.schema'
import { responseCache } from '../middleware'

const router = Router()
const pageController = new PageController()

router.get('/', responseCache({ ttl: 30, tags: ['pages'] }), pageController.getAll)
router.get('/:id', pageController.getById)
router.post('/', validate(createPageSchema), pageController.create)
router.put('/:id', validate(updatePageSchema), pageController.update)
router.post('/:id/save-preflight', validate(savePreflightSchema), pageController.savePreflight)
router.delete('/:id', pageController.delete)
router.post('/:id/publish', pageController.publish)

// Data Binding routes (Stage 3.5 & 3.6)
router.get('/:id/data-settings', pageController.getDataSettings)
router.put('/:id/data-settings', validate(updateDataSettingsSchema), pageController.updateDataSettings)
router.put('/:id/data-sources', validate(updatePageDataSourcesSchema), pageController.updateDataSources)
router.put('/:id/variables', validate(updatePageVariablesSchema), pageController.updateVariables)

// Доп.источники данных страницы (пикер привязок + превью)
router.get('/:id/input-bindings', pageController.getInputBindings)
router.get('/:id/request-preview', pageController.previewRequest)

export default router
