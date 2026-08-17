import { Router } from 'express'
import { ComplexController } from '../controllers/ComplexController'
import adminRouter from './admin'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'estate-service', time: new Date().toISOString() })
})

// Публичный read (для DataSource server-fetch)
router.get('/api/complexes', ComplexController.list)
router.get('/api/complexes/:slug', ComplexController.detail)

// Админ-API (под X-Estate-Token)
router.use('/api/admin', adminRouter)

export default router
