/**
 * Security Middleware
 * 
 * Дополнительные меры безопасности для production
 */

import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY')
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block')
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // Remove powered by header
  res.removeHeader('X-Powered-By')
  
  next()
}

/**
 * Request ID middleware для трассировки
 */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = req.headers['x-request-id'] as string || crypto.randomUUID()
  req.id = id
  res.setHeader('X-Request-ID', id)
  next()
}

/**
 * API Key validation middleware
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  // Skip API key validation for public routes
  const publicRoutes = ['/health', '/api/docs', '/api/public']
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next()
  }
  
  const apiKey = req.headers['x-api-key'] as string
  const validApiKey = process.env.API_KEY
  
  // Skip if no API key configured
  if (!validApiKey) {
    return next()
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
    })
  }
  
  next()
}

/**
 * IP whitelist middleware
 */
export const ipWhitelist = (allowedIps: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (allowedIps.length === 0) {
      return next()
    }
    
    const clientIp = req.ip || req.socket.remoteAddress || ''
    
    if (!allowedIps.includes(clientIp)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied from this IP',
      })
    }
    
    next()
  }
}

/**
 * Request sanitization middleware
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string)
      }
    })
  }
  
  next()
}

/**
 * Simple string sanitization
 */
function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
}

/**
 * CORS options builder
 */
export const buildCorsOptions = () => {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000']
  
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true)
      }
      
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true)
      }
      
      callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
    maxAge: 86400, // 24 hours
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      id?: string
      /** Заполняется requireAuth после валидации JWT-cookie. */
      user?: {
        id: string
        username: string
        role: string
      }
    }
  }
}
