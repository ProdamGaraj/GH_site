import { Router } from 'express'
import { ComplexController } from '../controllers/ComplexController'
import { LeadContextController } from '../controllers/LeadContextController'
import adminRouter from './admin'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'estate-service', time: new Date().toISOString() })
})

// Публичный read (для DataSource server-fetch)
router.get('/api/complexes', ComplexController.list)
router.get('/api/complexes/:slug', ComplexController.detail)

// Контекст заявки с сайта (зовёт бэкенд CMS: дома проекта, планировка карточки)
router.get('/api/lead-context', LeadContextController.context)

// Админ-API (под X-Estate-Token)
router.use('/api/admin', adminRouter)

export default router
