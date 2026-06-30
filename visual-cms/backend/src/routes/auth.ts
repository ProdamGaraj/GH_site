import { Router } from 'express'
import { authController } from '../controllers/AuthController'
import { rateLimit } from '../middleware'

const router = Router()

// Жёсткий лимит на логин — защита от перебора паролей (поверх глобального лимита).
const loginLimiter = rateLimit({ windowMs: 60_000, maxRequests: 10 })

router.post('/login', loginLimiter, authController.login)
router.post('/logout', authController.logout)
router.get('/me', authController.me)

export default router
