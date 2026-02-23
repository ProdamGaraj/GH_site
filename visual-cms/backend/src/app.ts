import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import routes from './routes'
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
} from './middleware'
import { cacheService } from './services/CacheService'

dotenv.config()

const app = express()

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
  allowedHeaders: ['Content-Type', 'Authorization']
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

// API Documentation (Swagger UI)
app.use('/api/docs', swaggerRouter)

// Routes
app.use('/api', routes)

// Health check with stats
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  })
})

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
