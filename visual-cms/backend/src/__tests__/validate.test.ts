import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { validate, validateQuery } from '../middleware/validate'
import { ValidationError } from '../middleware/errorHandler'

function mockReq(body: any = {}, query: any = {}): Partial<Request> {
  return { body, query } as Partial<Request>
}

function mockRes(): Partial<Response> {
  return {} as Partial<Response>
}

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().optional().default(0),
    email: z.string().email().optional(),
  })

  let next: jest.Mock

  beforeEach(() => {
    next = jest.fn()
  })

  // ---- validate(body) ----

  describe('validate()', () => {
    it('passes valid data and calls next()', () => {
      const req = mockReq({ name: 'Alice', age: 25 })
      validate(schema)(req as Request, mockRes() as Response, next)
      expect(next).toHaveBeenCalledWith()
      expect(req.body).toEqual({ name: 'Alice', age: 25 })
    })

    it('strips unknown fields', () => {
      const req = mockReq({ name: 'Bob', extra: 'hack', nested: { a: 1 } })
      validate(schema)(req as Request, mockRes() as Response, next)
      expect(next).toHaveBeenCalledWith()
      expect(req.body).toEqual({ name: 'Bob', age: 0 })
      expect(req.body.extra).toBeUndefined()
      expect(req.body.nested).toBeUndefined()
    })

    it('applies default values', () => {
      const req = mockReq({ name: 'Carol' })
      validate(schema)(req as Request, mockRes() as Response, next)
      expect(next).toHaveBeenCalledWith()
      expect(req.body.age).toBe(0)
    })

    it('throws ValidationError on missing required field', () => {
      const req = mockReq({})
      expect(() => {
        validate(schema)(req as Request, mockRes() as Response, next)
      }).toThrow(ValidationError)
      expect(next).not.toHaveBeenCalled()
    })

    it('throws ValidationError with correct message', () => {
      const req = mockReq({})
      try {
        validate(schema)(req as Request, mockRes() as Response, next)
        fail('should have thrown')
      } catch (err: any) {
        expect(err).toBeInstanceOf(ValidationError)
        expect(err.message).toBe('Validation failed')
        expect(err.statusCode).toBe(400)
        expect(err.code).toBe('VALIDATION_ERROR')
      }
    })

    it('includes field errors in details', () => {
      const req = mockReq({ name: '' }) // empty string fails min(1)
      try {
        validate(schema)(req as Request, mockRes() as Response, next)
        fail('should have thrown')
      } catch (err: any) {
        expect(err.details).toBeDefined()
        expect(err.details.errors).toBeDefined()
        expect(err.details.errors.name).toBeInstanceOf(Array)
        expect(err.details.errors.name.length).toBeGreaterThan(0)
      }
    })

    it('reports wrong type errors', () => {
      const req = mockReq({ name: 'X', age: 'not-a-number' })
      try {
        validate(schema)(req as Request, mockRes() as Response, next)
        fail('should have thrown')
      } catch (err: any) {
        expect(err.details.errors.age).toBeDefined()
      }
    })

    it('reports nested path errors', () => {
      const nested = z.object({
        parent: z.object({
          child: z.string().min(1),
        }),
      })
      const req = mockReq({ parent: { child: '' } })
      try {
        validate(nested)(req as Request, mockRes() as Response, next)
        fail('should have thrown')
      } catch (err: any) {
        expect(err.details.errors['parent.child']).toBeDefined()
      }
    })

    it('reports _root for refine errors', () => {
      const refined = z.object({
        a: z.string().optional(),
        b: z.string().optional(),
      }).refine(d => d.a || d.b, { message: 'Need a or b' })
      const req = mockReq({})
      try {
        validate(refined)(req as Request, mockRes() as Response, next)
        fail('should have thrown')
      } catch (err: any) {
        expect(err.details.errors['_root']).toBeDefined()
        expect(err.details.errors['_root']).toContain('Need a or b')
      }
    })
  })

  // ---- validateQuery ----

  describe('validateQuery()', () => {
    const qSchema = z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
    })

    it('passes valid query and replaces req.query', () => {
      const req = mockReq({}, { page: '1', limit: '10' })
      validateQuery(qSchema)(req as Request, mockRes() as Response, next)
      expect(next).toHaveBeenCalledWith()
      expect(req.query).toEqual({ page: '1', limit: '10' })
    })

    it('strips unknown query params', () => {
      const req = mockReq({}, { page: '1', evil: 'DROP TABLE' })
      validateQuery(qSchema)(req as Request, mockRes() as Response, next)
      expect(next).toHaveBeenCalledWith()
      expect((req.query as any).evil).toBeUndefined()
    })

    it('throws ValidationError on invalid query', () => {
      const strict = z.object({ page: z.coerce.number().int().min(1) })
      const req = mockReq({}, { page: 'abc' })
      expect(() => {
        validateQuery(strict)(req as Request, mockRes() as Response, next)
      }).toThrow(ValidationError)
      expect(next).not.toHaveBeenCalled()
    })

    it('uses correct error message for query validation', () => {
      const strict = z.object({ page: z.coerce.number().int().min(1) })
      const req = mockReq({}, { page: 'abc' })
      try {
        validateQuery(strict)(req as Request, mockRes() as Response, next)
        fail('should have thrown')
      } catch (err: any) {
        expect(err.message).toBe('Invalid query parameters')
      }
    })
  })
})