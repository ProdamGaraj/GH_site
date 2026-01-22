/**
 * Metrics & Health Routes
 * 
 * Эндпоинты для мониторинга и health checks
 */

import { Router, Request, Response } from 'express'
import { metricsService } from '../services/MetricsService'
import { cacheService } from '../services/CacheService'
import { getTimingStats, getErrorStats } from '../middleware'
import { AppDataSource } from '../config/database'

const router = Router()

/**
 * GET /metrics - Prometheus format metrics
 */
router.get('/metrics', (req: Request, res: Response) => {
  const acceptHeader = req.headers.accept || ''
  
  if (acceptHeader.includes('application/json')) {
    res.json(metricsService.getJsonMetrics())
  } else {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(metricsService.getPrometheusMetrics())
  }
})

/**
 * GET /health - Basic health check
 */
router.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

/**
 * GET /health/live - Kubernetes liveness probe
 */
router.get('/health/live', (req: Request, res: Response) => {
  res.json({ status: 'alive' })
})

/**
 * GET /health/ready - Kubernetes readiness probe
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  const checks: Record<string, boolean> = {}
  let healthy = true

  // Database check
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.query('SELECT 1')
      checks.database = true
    } else {
      checks.database = false
      healthy = false
    }
  } catch {
    checks.database = false
    healthy = false
  }

  // Cache check (optional, don't fail if redis is down)
  try {
    const stats = cacheService.getStats()
    checks.cache = stats.size >= 0
  } catch {
    checks.cache = false
  }

  const statusCode = healthy ? 200 : 503

  res.status(statusCode).json({
    status: healthy ? 'ready' : 'not ready',
    checks,
    timestamp: new Date().toISOString(),
  })
})

/**
 * GET /health/detailed - Detailed health with all metrics
 */
router.get('/health/detailed', async (req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {}
  let healthy = true

  // Database check with latency
  const dbStart = Date.now()
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.query('SELECT 1')
      checks.database = {
        status: 'healthy',
        latency: Date.now() - dbStart,
      }
    } else {
      checks.database = { status: 'not initialized' }
      healthy = false
    }
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: (error as Error).message,
    }
    healthy = false
  }

  // Memory check
  const memory = process.memoryUsage()
  const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(memory.heapTotal / 1024 / 1024)
  const heapUsagePercent = Math.round((memory.heapUsed / memory.heapTotal) * 100)
  
  checks.memory = {
    status: heapUsagePercent < 90 ? 'healthy' : 'warning',
    latency: 0,
  }

  res.json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    checks,
    system: {
      memory: {
        heapUsed: `${heapUsedMB}MB`,
        heapTotal: `${heapTotalMB}MB`,
        usage: `${heapUsagePercent}%`,
        external: `${Math.round(memory.external / 1024 / 1024)}MB`,
      },
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
    },
    stats: {
      timing: getTimingStats(),
      errors: getErrorStats(),
      cache: cacheService.getStats(),
    },
  })
})

export default router
