/**
 * Роуты для тестирования Template блоков
 */

import { Router } from 'express'
import { templateTestController } from '../controllers/TemplateTestController'

const router = Router()

/**
 * POST /api/template-test/render
 * Рендерит Template блок с тестовыми данными
 */
router.post('/render', (req, res) => templateTestController.renderTemplate(req, res))

/**
 * POST /api/template-test/preview
 * Генерирует preview для Template блока
 */
router.post('/preview', (req, res) => templateTestController.generatePreview(req, res))

export default router
