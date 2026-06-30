import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import routes from './routes'
import healthRouter from './routes/health'
import swaggerRouter from './docs/swagger'
import {
  errorHandler,
  notFoundHandler,
  requestTiming,
  rateLimit,
  compressionHint,
  queryOptimization,
  getTimingStats,
  getErrorStats,
  requireAuth,
} from './middleware'
import { cacheService } from './services/CacheService'

dotenv.config()

const app = express()

// За nginx-реверс-прокси: доверяем X-Forwarded-* (req.secure/протокол, IP).
app.set('trust proxy', 1)

// Performance middleware
app.use(requestTiming)
app.use(compressionHint)
app.use(queryOptimization)

// Rate limiting
app.use(rateLimit({
  windowMs: 60000, // 1 minute
  maxRequests: 100, // 100 requests per minute
}))

// Security middleware - CORS with specific origins
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}))
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "cdn.redoc.ly"],
      styleSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "fonts.gstatic.com", "fonts.googleapis.com"],
      connectSrc: ["'self'"],
    },
  },
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Auth-защита всего API-слоя. Должна стоять ДО роутов и swagger: пропускает
// только публичный allowlist (см. middleware/auth.ts), остальное под /api
// требует валидной JWT-cookie. Не-/api пути (health, статика) не трогает.
app.use(requireAuth)

// API Documentation (Swagger UI) — под защитой (виден только залогиненным)
app.use('/api/docs', swaggerRouter)

// Routes
app.use('/api', routes)

// Health & metrics: /health, /health/live, /health/ready, /health/detailed,
// /metrics (Prometheus). Ранее routes/health.ts был реализован, но не
// смонтирован (KNOWN_ISSUES A1).
app.use(healthRouter)

// Stats endpoint (development only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/stats', (req, res) => {
    res.json({
      timing: getTimingStats(),
      errors: getErrorStats(),
      cache: cacheService.getStats(),
    })
  })
}

// 404 handler
app.use(notFoundHandler)

// Error handling
app.use(errorHandler)

export default app
