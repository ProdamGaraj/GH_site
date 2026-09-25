import { Router } from 'express'
import { AdminController } from '../controllers/AdminController'
import { SyncController } from '../controllers/SyncController'
import { requireWriteToken } from '../middleware/writeAuth'
import { validate } from '../middleware/validate'
import { syncHouseSchema } from '../schemas/sync.schema'
import {
  createComplexSchema,
  updateComplexSchema,
  createHouseSchema,
  updateHouseSchema,
  createApartmentSchema,
  updateApartmentSchema,
  previewPlanGroupsSchema,
  createPlaceTypeSchema,
  updatePlaceTypeSchema,
} from '../schemas/estate.schema'

/**
 * Админ-API модуля ЖК. Весь неймспейс под X-Estate-Token (инжектится прокси
 * /estate-api CMS). Публичный read (/api/complexes) остаётся открытым для
 * DataSource server-fetch.
 */
const router = Router()

router.use(requireWriteToken)

// Complex
router.get('/complexes', AdminController.listComplexes)
router.get('/complexes/:id', AdminController.getComplex)
router.post('/complexes', validate(createComplexSchema), AdminController.createComplex)
router.put('/complexes/:id', validate(updateComplexSchema), AdminController.updateComplex)
router.delete('/complexes/:id', AdminController.deleteComplex)
router.post(
  '/complexes/:id/plan-groups/preview',
  validate(previewPlanGroupsSchema),
  AdminController.previewPlanGroups
)

// Карта проекта: типы мест (общие для всех ЖК) и набор иконок для них.
router.get('/place-types', AdminController.listPlaceTypes)
router.post('/place-types', validate(createPlaceTypeSchema), AdminController.createPlaceType)
router.put('/place-types/:key', validate(updatePlaceTypeSchema), AdminController.updatePlaceType)
router.delete('/place-types/:key', AdminController.deletePlaceType)
router.get('/map-icons', AdminController.listMapIcons)

// House
router.post('/complexes/:complexId/houses', validate(createHouseSchema), AdminController.createHouse)
router.put('/houses/:id', validate(updateHouseSchema), AdminController.updateHouse)
router.delete('/houses/:id', AdminController.deleteHouse)

// Синхронизация дома из MacroCRM: весь дом одним запросом и одной транзакцией.
// Поштучное админ-API здесь не годится — 339 квартир дали бы 339 запросов и
// полусостояние базы при обрыве на середине.
router.get('/sync/house/:externalHouseId/state', SyncController.houseState)
router.post('/sync/house', validate(syncHouseSchema), SyncController.syncHouse)

// Apartment
router.post('/houses/:houseId/apartments', validate(createApartmentSchema), AdminController.createApartment)
router.put('/apartments/:id', validate(updateApartmentSchema), AdminController.updateApartment)
router.delete('/apartments/:id', AdminController.deleteApartment)

export default router
