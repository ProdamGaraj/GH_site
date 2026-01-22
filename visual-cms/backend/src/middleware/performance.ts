/**
 * Performance Middleware
 * 
 * Middleware для оптимизации производительности API.
 */

import { Request, Response, NextFunction } from 'express'
import { cacheService } from '../services/CacheService'

// ==================== TYPES ====================

interface RateLimitConfig {
  windowMs: number      // Time window in ms
  maxRequests: number   // Max requests per window
  keyGenerator?: (req: Request) => string
}

interface RequestTimingInfo {
  startTime: number
  endTime?: number
  duration?: number
  route?: string
  method?: string
  statusCode?: number
}

// ==================== REQUEST TIMING ====================

const requestTimings: Map<string, RequestTimingInfo[]> = new Map()

/**
 * Middleware для измерения времени выполнения запросов
 */
export function requestTiming(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now()
  const requestId = `${req.method}:${req.path}`

  // Override res.end to capture timing
  const originalEnd = res.end.bind(res)
  res.end = function(chunk?: any, encoding?: any, callback?: () => void): Response {
    const endTime = Date.now()
    const duration = endTime - startTime

    // Store timing info
    const info: RequestTimingInfo = {
      startTime,
      endTime,
      duration,
      route: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
    }

    // Keep last 100 timings per route
    if (!requestTimings.has(requestId)) {
      requestTimings.set(requestId, [])
    }
    const timings = requestTimings.get(requestId)!
    timings.push(info)
    if (timings.length > 100) {
      timings.shift()
    }

    // Add timing header
    res.setHeader('X-Response-Time', `${duration}ms`)

    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`)
    }

    return originalEnd(chunk, encoding, callback)
  }

  next()
}

/**
 * Получить статистику по времени выполнения
 */
export function getTimingStats(): Record<string, {
  count: number
  avgMs: number
  minMs: number
  maxMs: number
  p95Ms: number
}> {
  const stats: Record<string, any> = {}

  requestTimings.forEach((timings, route) => {
    const durations = timings
      .filter(t => t.duration !== undefined)
      .map(t => t.duration!)
      .sort((a, b) => a - b)

    if (durations.length === 0) return

    const sum = durations.reduce((a, b) => a + b, 0)
    const p95Index = Math.floor(durations.length * 0.95)

    stats[route] = {
      count: durations.length,
      avgMs: Math.round(sum / durations.length),
      minMs: durations[0],
      maxMs: durations[durations.length - 1],
      p95Ms: durations[p95Index] || durations[durations.length - 1],
    }
  })

  return stats
}

// ==================== RESPONSE CACHING ====================

interface CacheMiddlewareOptions {
  ttl?: number
  keyGenerator?: (req: Request) => string
  condition?: (req: Request) => boolean
  tags?: string[] | ((req: Request) => string[])
}

/**
 * Middleware для кэширования GET-запросов
 */
export function responseCache(options: CacheMiddlewareOptions = {}) {
  const {
    ttl = 60,
    keyGenerator = defaultCacheKeyGenerator,
    condition = () => true,
    tags,
  } = options

  return async function(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Only cache GET requests
    if (req.method !== 'GET' || !condition(req)) {
      next()
      return
    }

    const cacheKey = keyGenerator(req)

    // Check cache
    const cached = await cacheService.get<{
      statusCode: number
      headers: Record<string, string>
      body: unknown
    }>(cacheKey)

    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      Object.entries(cached.headers).forEach(([key, value]) => {
        res.setHeader(key, value)
      })
      res.status(cached.statusCode).json(cached.body)
      return
    }

    // Capture response
    const originalJson = res.json.bind(res)
    res.json = function(body: unknown): Response {
      // Cache the response
      const cacheEntry = {
        statusCode: res.statusCode,
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      }

      const cacheTags = typeof tags === 'function' ? tags(req) : tags

      cacheService.set(cacheKey, cacheEntry, { ttl, tags: cacheTags })
        .catch(err => console.error('Cache set error:', err))

      res.setHeader('X-Cache', 'MISS')
      return originalJson(body)
    }

    next()
  }
}

function defaultCacheKeyGenerator(req: Request): string {
  return `response:${req.method}:${req.originalUrl}`
}

// ==================== RATE LIMITING ====================

const rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map()

/**
 * Simple in-memory rate limiter
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs = 60000,
    maxRequests = 100,
    keyGenerator = (req: Request) => req.ip || 'unknown',
  } = config

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now()
    rateLimitStore.forEach((value, key) => {
      if (value.resetTime < now) {
        rateLimitStore.delete(key)
      }
    })
  }, windowMs)

  return function(req: Request, res: Response, next: NextFunction): void {
    const key = keyGenerator(req)
    const now = Date.now()

    let entry = rateLimitStore.get(key)

    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + windowMs }
      rateLimitStore.set(key, entry)
    }

    entry.count++

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString())
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString())
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString())

    if (entry.count > maxRequests) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetTime - now) / 1000)} seconds`,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      })
      return
    }

    next()
  }
}

// ==================== COMPRESSION HINT ====================

/**
 * Middleware для добавления подсказок о сжатии
 */
export function compressionHint(req: Request, res: Response, next: NextFunction): void {
  // Check if client accepts compression
  const acceptEncoding = req.headers['accept-encoding'] || ''
  
  if (acceptEncoding.includes('gzip') || acceptEncoding.includes('br')) {
    res.setHeader('Vary', 'Accept-Encoding')
  }

  next()
}

// ==================== ETAG SUPPORT ====================

/**
 * Middleware для поддержки ETag
 */
export function etagSupport(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res)
  
  res.json = function(body: unknown): Response {
    // Generate ETag from body
    const etag = generateETag(JSON.stringify(body))
    res.setHeader('ETag', etag)

    // Check If-None-Match
    const ifNoneMatch = req.headers['if-none-match']
    if (ifNoneMatch === etag) {
      return res.status(304).end() as Response
    }

    return originalJson(body)
  }

  next()
}

function generateETag(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `"${Math.abs(hash).toString(16)}"`
}

// ==================== QUERY OPTIMIZATION ====================

/**
 * Middleware для оптимизации query параметров
 */
export function queryOptimization(req: Request, res: Response, next: NextFunction): void {
  // Parse and validate pagination
  if (req.query.page) {
    const page = parseInt(req.query.page as string, 10)
    req.query.page = (isNaN(page) || page < 1 ? 1 : page).toString()
  }

  if (req.query.limit) {
    const limit = parseInt(req.query.limit as string, 10)
    const maxLimit = 100
    req.query.limit = (isNaN(limit) || limit < 1 ? 10 : Math.min(limit, maxLimit)).toString()
  }

  // Parse fields selection
  if (req.query.fields && typeof req.query.fields === 'string') {
    const fields = req.query.fields.split(',').map(f => f.trim()).filter(Boolean)
    ;(req as any).selectedFields = fields
  }

  next()
}

// ==================== EXPORTS ====================

export default {
  requestTiming,
  getTimingStats,
  responseCache,
  rateLimit,
  compressionHint,
  etagSupport,
  queryOptimization,
}
