import { Router } from 'express'
import DataSourceController from '../controllers/DataSourceController'

const router = Router()

/**
 * Data Sources Routes
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 1.1 Backend: API endpoints
 * 
 * Endpoints:
 * - GET    /api/data-sources         - список источников (с фильтрацией и пагинацией)
 * - GET    /api/data-sources/:id     - один источник
 * - POST   /api/data-sources         - создание
 * - PUT    /api/data-sources/:id     - обновление
 * - DELETE /api/data-sources/:id     - удаление
 * - POST   /api/data-sources/:id/test      - тестирование подключения
 * - POST   /api/data-sources/:id/duplicate - дублирование
 */

// GET /api/data-sources - Получить список с фильтрацией и пагинацией
router.get('/', (req, res) => DataSourceController.getAll(req, res))

// GET /api/data-sources/:id - Получить один источник
router.get('/:id', (req, res) => DataSourceController.getById(req, res))

// POST /api/data-sources - Создать новый источник
router.post('/', (req, res) => DataSourceController.create(req, res))

// PUT /api/data-sources/:id - Обновить источник
router.put('/:id', (req, res) => DataSourceController.update(req, res))

// DELETE /api/data-sources/:id - Удалить источник
router.delete('/:id', (req, res) => DataSourceController.delete(req, res))

// POST /api/data-sources/new/test - Тестировать новую конфигурацию (без сохранения)
// Важно: этот маршрут должен быть ПЕРЕД :id/test, иначе 'new' будет интерпретировано как id
router.post('/new/test', (req, res) => DataSourceController.testNewConnection(req, res))

// POST /api/data-sources/:id/test - Тестировать подключение существующего источника
router.post('/:id/test', (req, res) => DataSourceController.testConnection(req, res))

// POST /api/data-sources/:id/duplicate - Дублировать источник
router.post('/:id/duplicate', (req, res) => DataSourceController.duplicate(req, res))

export default router
