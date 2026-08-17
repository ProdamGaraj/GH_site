import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import routes from './routes'
import { logger } from './services/Logger'

dotenv.config()

const app = express()
app.set('trust proxy', 1)

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Estate-Token'],
  })
)
app.use(helmet())
app.use(express.json({ limit: '2mb' }))

app.use(routes)

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Общий обработчик ошибок
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err instanceof Error ? err : undefined)
  res.status(500).json({ error: 'Internal error' })
})

export default app
