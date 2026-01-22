import { Router } from 'express'
import DataBindingController from '../controllers/DataBindingController'

const router = Router()

/**
 * Data Bindings Routes
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 2.1 Backend: Data Fetching Service
 * 
 * Endpoints:
 * - GET    /api/data-bindings              - список bindings (по blockId/pageId)
 * - GET    /api/data-bindings/:id          - один binding
 * - POST   /api/data-bindings              - создание binding
 * - PUT    /api/data-bindings/:id          - обновление binding
 * - DELETE /api/data-bindings/:id          - удаление binding
 */

// CRUD для Data Bindings
router.get('/', (req, res) => DataBindingController.getAll(req, res))
router.get('/:id', (req, res) => DataBindingController.getById(req, res))
router.post('/', (req, res) => DataBindingController.create(req, res))
router.put('/:id', (req, res) => DataBindingController.update(req, res))
router.delete('/:id', (req, res) => DataBindingController.delete(req, res))

export default router
