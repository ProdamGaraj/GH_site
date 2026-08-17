import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

/** Валидирует req.body по zod-схеме; на ошибке — 400 с деталями. */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      })
      return
    }
    req.body = result.data
    next()
  }
}
