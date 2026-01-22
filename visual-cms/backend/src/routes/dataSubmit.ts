import { Router } from 'express'
import DataSubmitController from '../controllers/DataSubmitController'

const router = Router()

/**
 * Data Submit Routes
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Endpoints:
 * - POST   /api/data/submit              - отправка данных
 * - GET    /api/data/submissions         - история отправок
 * - GET    /api/data/submissions/:id     - одна запись
 * - GET    /api/data/submissions/stats   - статистика
 */

// Отправка данных
router.post('/submit', (req, res) => DataSubmitController.submit(req, res))

// История отправок
router.get('/submissions', (req, res) => DataSubmitController.getSubmissions(req, res))
router.get('/submissions/stats', (req, res) => DataSubmitController.getStats(req, res))
router.get('/submissions/:id', (req, res) => DataSubmitController.getSubmissionById(req, res))

export default router
