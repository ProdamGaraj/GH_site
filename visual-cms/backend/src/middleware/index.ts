/**
 * Middleware Exports
 * 
 * Централизованный экспорт всех middleware.
 */

// Error Handling
export {
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
} from './errorHandler'

// Performance
export {
  requestTiming,
  getTimingStats,
  responseCache,
  rateLimit,
  compressionHint,
  etagSupport,
  queryOptimization,
} from './performance'

// Security
export {
  securityHeaders,
  requestId,
  validateApiKey,
  ipWhitelist,
  sanitizeRequest,
  buildCorsOptions,
} from './security'

// Zod Validation
export {
  validate,
  validateQuery,
} from './validate'

// Authentication
export {
  requireAuth,
} from './auth'
