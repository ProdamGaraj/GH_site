import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'
import { ValidationError } from './errorHandler'

/**
 * Format Zod errors into a clean { field: messages[] } map
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_root'
    if (!formatted[path]) {
      formatted[path] = []
    }
    formatted[path].push(issue.message)
  }

  return formatted
}

/**
 * Validate request body against a Zod schema.
 *
 * On success: replaces req.body with parsed (stripped) data and calls next().
 * On failure: throws ValidationError with structured field errors.
 *
 * Usage in routes:
 *   router.post('/', validate(createGroupSchema), controller.create)
 */
export const validate = (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      const errors = formatZodErrors(result.error)
      throw new ValidationError('Validation failed', { errors })
    }

    // Replace body with parsed data (unknown fields stripped, types coerced)
    req.body = result.data
    next()
  }

/**
 * Validate request query params against a Zod schema.
 */
export const validateQuery = (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query)

    if (!result.success) {
      const errors = formatZodErrors(result.error)
      throw new ValidationError('Invalid query parameters', { errors })
    }

    req.query = result.data
    next()
  }
