/**
 * POST /api/leads — заявка с опубликованного сайта (публичный, без логина).
 *
 * Сайт и API на одном домене (nginx проксирует /api), поэтому CORS не нужен.
 * Защита от мусора: схема с лимитами длины, ловушка для ботов, отдельный
 * лимит запросов с одного IP и склейка повторов в LeadService.
 */
import { Router, type Request, type RequestHandler, type Response } from 'express'
import { asyncHandler } from '../middleware'
import { rateLimit } from '../middleware/performance'
import { validate } from '../middleware/validate'
import { leadInputSchema, type LeadInput } from '../schemas/lead.schema'
import { logger } from '../services/Logger'
import { LeadService, LeadValidationError } from '../services/leads/LeadService'
import { createLeadService } from '../services/leads/leadDeps'

/** Не больше 10 заявок за 10 минут с одного IP: человеку хватит, перебору — нет. */
export const LEAD_RATE_WINDOW_MS = 10 * 60 * 1000
export const LEAD_RATE_MAX = 10

let service: LeadService | null = null

/** Сервис создаётся при первой заявке: к этому моменту база уже поднята. */
function defaultService(): LeadService {
  if (!service) service = createLeadService(process.env, (level, message) => logger[level](message))
  return service
}

export interface LeadsRouterOptions {
  getService?: () => LeadService
  limiter?: RequestHandler
}

export function createLeadsRouter(options: LeadsRouterOptions = {}): Router {
  const getService = options.getService ?? defaultService
  const limiter =
    options.limiter ??
    rateLimit({
      windowMs: LEAD_RATE_WINDOW_MS,
      maxRequests: LEAD_RATE_MAX,
      // Префикс: хранилище лимитов общее с глобальным лимитом API.
      keyGenerator: (req) => `lead:${req.ip || 'unknown'}`,
    })

  const router = Router()
  router.post(
    '/',
    limiter,
    validate(leadInputSchema),
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const outcome = await getService().submit(req.body as LeadInput, {
          ip: req.ip ?? null,
          userAgent: req.get('user-agent') ?? null,
          domain: req.hostname ?? null,
        })
        // Доставка в CRM идёт после ответа; её итог пишется в базу.
        res.status(201).json(outcome.status === 'ignored' ? { ok: true } : { ok: true, id: outcome.id })
      } catch (err) {
        if (err instanceof LeadValidationError) {
          res.status(400).json({ error: err.field, message: err.message })
          return
        }
        throw err
      }
    })
  )
  return router
}

export default createLeadsRouter()
