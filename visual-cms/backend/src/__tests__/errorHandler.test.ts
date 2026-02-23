import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  asyncMiddleware,
  logError,
  getErrorLog,
  getErrorStats,
  validateRequired,
  validateType,
  validateEnum,
} from '../middleware/errorHandler'
import { Request, Response, NextFunction } from 'express'

// --- helpers ---
function mockReq(overrides: Partial<Request> = {}): Request {
  return { path: '/test', method: 'GET', ...overrides } as unknown as Request
}

function mockRes(): Response & { _status: number; _json: any } {
  const res: any = { _status: 200, _json: null }
  res.status = (code: number) => { res._status = code; return res }
  res.json = (data: any) => { res._json = data; return res }
  return res
}

describe('Error Classes', () => {
  it('AppError sets defaults', () => {
    const err = new AppError('boom')
    expect(err.message).toBe('boom')
    expect(err.statusCode).toBe(500)
    expect(err.code).toBe('INTERNAL_ERROR')
    expect(err.isOperational).toBe(true)
    expect(err).toBeInstanceOf(Error)
  })

  it('AppError accepts custom params', () => {
    const err = new AppError('x', 503, 'SVC_DOWN', { svc: 'db' })
    expect(err.statusCode).toBe(503)
    expect(err.code).toBe('SVC_DOWN')
    expect(err.details).toEqual({ svc: 'db' })
  })

  it('ValidationError is 400', () => {
    const err = new ValidationError('bad', { field: 'x' })
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.details).toEqual({ field: 'x' })
  })

  it('AuthenticationError is 401', () => {
    expect(new AuthenticationError().statusCode).toBe(401)
    expect(new AuthenticationError().message).toBe('Authentication required')
  })

  it('AuthorizationError is 403', () => {
    expect(new AuthorizationError().statusCode).toBe(403)
    expect(new AuthorizationError().message).toBe('Access denied')
  })

  it('NotFoundError is 404', () => {
    const err = new NotFoundError('Page', 'abc')
    expect(err.statusCode).toBe(404)
    expect(err.message).toContain('Page')
    expect(err.message).toContain('abc')
    expect(err.details).toEqual({ resource: 'Page', id: 'abc' })
  })

  it('NotFoundError without id', () => {
    const err = new NotFoundError('Resource')
    expect(err.message).toBe('Resource not found')
  })

  it('ConflictError is 409', () => {
    expect(new ConflictError('dup').statusCode).toBe(409)
  })

  it('RateLimitError is 429 with retryAfter', () => {
    const err = new RateLimitError(60)
    expect(err.statusCode).toBe(429)
    expect(err.details).toEqual({ retryAfter: 60 })
  })

  it('DatabaseError is 500', () => {
    const orig = new Error('conn refused')
    const err = new DatabaseError('db fail', orig)
    expect(err.statusCode).toBe(500)
    expect(err.details?.originalMessage).toBe('conn refused')
  })

  it('ExternalServiceError is 502', () => {
    const err = new ExternalServiceError('Stripe')
    expect(err.statusCode).toBe(502)
    expect(err.details).toEqual({ service: 'Stripe' })
  })
})

describe('errorHandler middleware', () => {
  const next: NextFunction = jest.fn()

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('handles AppError with correct status and body', () => {
    const res = mockRes()
    errorHandler(new NotFoundError('Page', '1'), mockReq(), res as any, next)
    expect(res._status).toBe(404)
    expect(res._json.success).toBe(false)
    expect(res._json.error.code).toBe('NOT_FOUND')
    expect(res._json.error.message).toContain('Page')
  })

  it('handles generic Error as 500', () => {
    const res = mockRes()
    errorHandler(new Error('crash'), mockReq(), res as any, next)
    expect(res._status).toBe(500)
    expect(res._json.error.code).toBe('INTERNAL_ERROR')
    expect(res._json.error.message).toBe('An unexpected error occurred')
  })

  it('includes path and timestamp', () => {
    const res = mockRes()
    errorHandler(new AppError('x'), mockReq({ path: '/api/test' } as any), res as any, next)
    expect(res._json.error.path).toBe('/api/test')
    expect(res._json.error.timestamp).toBeDefined()
  })

  it('handles ValidationError', () => {
    const res = mockRes()
    errorHandler(new ValidationError('bad input'), mockReq(), res as any, next)
    expect(res._status).toBe(400)
  })
})

describe('notFoundHandler', () => {
  it('calls next with NotFoundError', () => {
    const next = jest.fn()
    notFoundHandler(mockReq({ path: '/missing' } as any), mockRes() as any, next)
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError))
    const err = next.mock.calls[0][0] as NotFoundError
    expect(err.statusCode).toBe(404)
  })
})

describe('asyncHandler', () => {
  it('calls next on rejected promise', async () => {
    const next = jest.fn()
    const handler = asyncHandler(async () => { throw new Error('fail') })
    handler(mockReq(), mockRes() as any, next)
    await new Promise(r => setImmediate(r))
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })

  it('does not call next on success', async () => {
    const next = jest.fn()
    const handler = asyncHandler(async (_req, res) => { res.json({ ok: true }) })
    handler(mockReq(), mockRes() as any, next)
    await new Promise(r => setImmediate(r))
    expect(next).not.toHaveBeenCalled()
  })
})

describe('asyncMiddleware', () => {
  it('wraps like asyncHandler', async () => {
    const next = jest.fn()
    const mw = asyncMiddleware(async () => { throw new AppError('x') })
    mw(mockReq(), mockRes() as any, next)
    await new Promise(r => setImmediate(r))
    expect(next).toHaveBeenCalledWith(expect.any(AppError))
  })
})

describe('Error logging', () => {
  it('logError stores entries', () => {
    const before = getErrorLog().length
    logError(new NotFoundError('X'))
    expect(getErrorLog().length).toBeGreaterThan(before)
  })

  it('getErrorStats returns code counts', () => {
    logError(new ValidationError('v'))
    const stats = getErrorStats()
    expect(typeof stats).toBe('object')
    expect(stats['VALIDATION_ERROR']).toBeGreaterThanOrEqual(1)
  })
})

describe('Validation helpers', () => {
  describe('validateRequired', () => {
    it('passes when all present', () => {
      expect(() => validateRequired({ a: 1, b: 'x' }, ['a', 'b'])).not.toThrow()
    })
    it('throws for missing fields', () => {
      expect(() => validateRequired({ a: 1 }, ['a', 'b'])).toThrow(ValidationError)
    })
    it('treats null/empty as missing', () => {
      expect(() => validateRequired({ a: null, b: '' }, ['a', 'b'])).toThrow()
    })
  })

  describe('validateType', () => {
    it('passes for correct types', () => {
      expect(() => validateType('x', 'string', 'f')).not.toThrow()
      expect(() => validateType(1, 'number', 'f')).not.toThrow()
      expect(() => validateType(true, 'boolean', 'f')).not.toThrow()
      expect(() => validateType({}, 'object', 'f')).not.toThrow()
      expect(() => validateType([], 'array', 'f')).not.toThrow()
    })
    it('throws for wrong type', () => {
      expect(() => validateType('x', 'number', 'f')).toThrow(ValidationError)
    })
    it('NaN is not a valid number', () => {
      expect(() => validateType(NaN, 'number', 'f')).toThrow()
    })
    it('array is not object', () => {
      expect(() => validateType([], 'object', 'f')).toThrow()
    })
  })

  describe('validateEnum', () => {
    it('passes for valid value', () => {
      expect(() => validateEnum('a', ['a', 'b'], 'f')).not.toThrow()
    })
    it('throws for invalid value', () => {
      expect(() => validateEnum('c', ['a', 'b'], 'f')).toThrow(ValidationError)
    })
  })
})