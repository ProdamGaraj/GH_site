import { Router } from 'express'
import TemplateController from '../controllers/TemplateController'

const router = Router()

/**
 * Templates Routes
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 3.1 Backend: Templates API
 * 
 * Endpoints:
 * - GET    /api/templates              - список templates
 * - GET    /api/templates/:id          - один template
 * - POST   /api/templates              - создание template
 * - PUT    /api/templates/:id          - обновление template
 * - DELETE /api/templates/:id          - удаление template
 * - POST   /api/templates/:id/duplicate - дублирование template
 * - POST   /api/templates/:id/detect-fields - переопределить поля
 * - POST   /api/templates/detect-fields - определить поля из HTML (без сохранения)
 */

// CRUD для Templates
router.get('/', (req, res) => TemplateController.getAll(req, res))
router.get('/:id', (req, res) => TemplateController.getById(req, res))
router.post('/', (req, res) => TemplateController.create(req, res))
router.put('/:id', (req, res) => TemplateController.update(req, res))
router.delete('/:id', (req, res) => TemplateController.delete(req, res))

// Дополнительные endpoints
router.post('/:id/duplicate', (req, res) => TemplateController.duplicate(req, res))
router.post('/:id/detect-fields', (req, res) => TemplateController.detectFieldsEndpoint(req, res))
router.post('/detect-fields', (req, res) => TemplateController.detectFieldsFromHtml(req, res))

export default router
