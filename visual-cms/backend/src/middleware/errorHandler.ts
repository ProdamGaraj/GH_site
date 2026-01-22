/**
 * Error Handling System
 * 
 * Централизованная система обработки ошибок.
 */

import { Request, Response, NextFunction } from 'express'

// ==================== ERROR CLASSES ====================

/**
 * Базовый класс для API ошибок
 */
export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly isOperational: boolean
  public readonly details?: Record<string, unknown>

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true
    this.details = details

    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Ошибка валидации (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

/**
 * Ошибка аутентификации (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
  }
}

/**
 * Ошибка авторизации (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR')
  }
}

/**
 * Ресурс не найден (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`
    super(message, 404, 'NOT_FOUND', { resource, id })
  }
}

/**
 * Конфликт данных (409)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', details)
  }
}

/**
 * Превышен лимит запросов (429)
 */
export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter })
  }
}

/**
 * Ошибка базы данных (500)
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', originalError?: Error) {
    super(message, 500, 'DATABASE_ERROR', {
      originalMessage: originalError?.message,
    })
  }
}

/**
 * Ошибка внешнего сервиса (502)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message || `External service '${service}' is unavailable`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      { service }
    )
  }
}

// ==================== ERROR RESPONSE FORMATTER ====================

interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
    timestamp: string
    path?: string
    requestId?: string
  }
}

function formatErrorResponse(
  error: AppError | Error,
  req?: Request
): ErrorResponse {
  const isAppError = error instanceof AppError
  
  return {
    success: false,
    error: {
      code: isAppError ? error.code : 'INTERNAL_ERROR',
      message: isAppError ? error.message : 'An unexpected error occurred',
      details: isAppError ? error.details : undefined,
      timestamp: new Date().toISOString(),
      path: req?.path,
      requestId: (req as any)?.id,
    },
  }
}

// ==================== ERROR MIDDLEWARE ====================

/**
 * Middleware для обработки 404 ошибок
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  next(new NotFoundError('Endpoint', req.path))
}

/**
 * Главный middleware для обработки ошибок
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  if (!(error instanceof AppError) || !error.isOperational) {
    console.error('Unhandled error:', error)
  } else if (process.env.NODE_ENV !== 'production') {
    console.error(`[${(error as AppError).code}] ${error.message}`)
  }

  // Determine status code
  let statusCode = 500
  if (error instanceof AppError) {
    statusCode = error.statusCode
  } else if ((error as any).statusCode) {
    statusCode = (error as any).statusCode
  }

  // Handle specific error types
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401
  } else if (error.name === 'SyntaxError' && (error as any).type === 'entity.parse.failed') {
    statusCode = 400
  }

  // Send response
  const response = formatErrorResponse(error, req)
  
  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    (response.error as any).stack = error.stack.split('\n')
  }

  res.status(statusCode).json(response)
}

// ==================== ASYNC WRAPPER ====================

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>

/**
 * Wrapper для async route handlers
 * Автоматически ловит rejected promises
 */
export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Wrapper для async middleware
 */
export function asyncMiddleware(fn: AsyncHandler) {
  return asyncHandler(fn)
}

// ==================== ERROR LOGGER ====================

interface ErrorLogEntry {
  timestamp: Date
  code: string
  message: string
  statusCode: number
  path?: string
  method?: string
  userId?: string
  requestId?: string
  stack?: string
}

const errorLog: ErrorLogEntry[] = []
const MAX_ERROR_LOG = 1000

/**
 * Логирование ошибок
 */
export function logError(error: Error, req?: Request): void {
  const entry: ErrorLogEntry = {
    timestamp: new Date(),
    code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
    message: error.message,
    statusCode: error instanceof AppError ? error.statusCode : 500,
    path: req?.path,
    method: req?.method,
    userId: (req as any)?.user?.id,
    requestId: (req as any)?.id,
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
  }

  errorLog.push(entry)
  
  // Keep log bounded
  if (errorLog.length > MAX_ERROR_LOG) {
    errorLog.shift()
  }
}

/**
 * Получить лог ошибок
 */
export function getErrorLog(limit = 100): ErrorLogEntry[] {
  return errorLog.slice(-limit)
}

/**
 * Получить статистику ошибок
 */
export function getErrorStats(): Record<string, number> {
  const stats: Record<string, number> = {}
  
  errorLog.forEach(entry => {
    stats[entry.code] = (stats[entry.code] || 0) + 1
  })
  
  return stats
}

// ==================== VALIDATION HELPERS ====================

/**
 * Проверка обязательных полей
 */
export function validateRequired(
  data: Record<string, unknown>,
  fields: string[]
): void {
  const missing = fields.filter(field => {
    const value = data[field]
    return value === undefined || value === null || value === ''
  })

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing }
    )
  }
}

/**
 * Проверка типа поля
 */
export function validateType(
  value: unknown,
  expectedType: 'string' | 'number' | 'boolean' | 'object' | 'array',
  fieldName: string
): void {
  let isValid = false

  switch (expectedType) {
    case 'string':
      isValid = typeof value === 'string'
      break
    case 'number':
      isValid = typeof value === 'number' && !isNaN(value)
      break
    case 'boolean':
      isValid = typeof value === 'boolean'
      break
    case 'object':
      isValid = typeof value === 'object' && value !== null && !Array.isArray(value)
      break
    case 'array':
      isValid = Array.isArray(value)
      break
  }

  if (!isValid) {
    throw new ValidationError(
      `Invalid type for '${fieldName}': expected ${expectedType}`,
      { field: fieldName, expected: expectedType, received: typeof value }
    )
  }
}

/**
 * Проверка enum значения
 */
export function validateEnum(
  value: unknown,
  allowedValues: readonly string[],
  fieldName: string
): void {
  if (!allowedValues.includes(value as string)) {
    throw new ValidationError(
      `Invalid value for '${fieldName}': must be one of ${allowedValues.join(', ')}`,
      { field: fieldName, allowed: allowedValues, received: value }
    )
  }
}

// ==================== EXPORTS ====================

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  notFoundHandler,
  errorHandler,
  asyncHandler,
  asyncMiddleware,
  logError,
  getErrorLog,
  getErrorStats,
  validateRequired,
  validateType,
  validateEnum,
}
