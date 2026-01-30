import { Router } from 'express'
import DataBindingController from '../controllers/DataBindingController'

const router = Router()

/**
 * Data Fetch Routes
 *
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 2.1 Backend: Data Fetching Service
 *
 * Endpoints:
 * - POST /api/data/fetch                  - получить данные из источника
 * - POST /api/data/fetch-with-binding     - получить данные с применением binding
 * - POST /api/data/fetch-with-transforms  - получить данные с трансформациями, фильтрами, пагинацией
 * - POST /api/data/submit-with-binding    - отправить данные через OUTPUT binding
 */

// Получаем данные из Data Source с фильтрацией/сортировкой
router.post('/fetch', (req, res) => DataBindingController.fetchData(req, res))

// Получаем данные используя существующий binding
router.post('/fetch-with-binding', (req, res) => DataBindingController.fetchWithBinding(req, res))

// Получаем данные с полными трансформациями (фильтры, поиск, сортировка, пагинация)
router.post('/fetch-with-transforms', (req, res) => DataBindingController.fetchWithTransforms(req, res))

// Отправка данных через OUTPUT binding
router.post('/submit-with-binding', (req, res) => DataBindingController.submitWithBinding(req, res))

export default router
