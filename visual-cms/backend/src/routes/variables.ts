/**
 * Variables Router
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 6: Reactive Variables
 * 
 * API endpoints для управления переменными.
 */

import { Router } from 'express'
import { VariablesController } from '../controllers/VariablesController'

const router = Router()

// ==================== ROUTES ====================

/**
 * GET /api/variables
 * Получить все переменные с фильтрацией
 * Query params: pageId, scope, type, isActive, search
 */
router.get('/', VariablesController.getAll)

/**
 * GET /api/variables/page/:pageId
 * Получить все переменные страницы (включая global)
 * Query params: includeGlobal
 */
router.get('/page/:pageId', VariablesController.getByPage)

/**
 * GET /api/variables/:id
 * Получить одну переменную
 */
router.get('/:id', VariablesController.getOne)

/**
 * POST /api/variables
 * Создать переменную
 */
router.post('/', VariablesController.create)

/**
 * POST /api/variables/bulk
 * Создать несколько переменных
 */
router.post('/bulk', VariablesController.bulkCreate)

/**
 * PUT /api/variables/reorder
 * Изменить порядок переменных
 */
router.put('/reorder', VariablesController.reorder)

/**
 * PUT /api/variables/:id
 * Обновить переменную
 */
router.put('/:id', VariablesController.update)

/**
 * DELETE /api/variables/:id
 * Удалить переменную
 */
router.delete('/:id', VariablesController.delete)

/**
 * POST /api/variables/:id/validate
 * Валидировать значение переменной
 */
router.post('/:id/validate', VariablesController.validateValue)

export default router
