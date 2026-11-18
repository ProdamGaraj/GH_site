/**
 * Запросы привязок (docs/request-pipeline-architecture.md):
 *   POST /api/data/submit            — сайт, без логина: id привязки + значения;
 *   POST /api/data/requests/preview  — редактор: что уйдёт (без отправки);
 *   POST /api/data/requests/test     — редактор: отправить и показать ответ;
 *   GET  /api/data/requests/effective/:bindingId — редактор: запрос привязки
 *        (для старых привязок — прочитанный из старого вида);
 *   GET  /api/data/submissions…      — журнал (редактор).
 * Публичен только /submit (middleware/auth.ts PUBLIC_ENDPOINTS).
 */
import { Router, type Request, type RequestHandler, type Response } from 'express'
import DataSubmitController from '../controllers/DataSubmitController'
import { AppDataSource } from '../config/database'
import { asyncHandler, NotFoundError } from '../middleware'
import { rateLimit } from '../middleware/performance'
import { validate } from '../middleware/validate'
import { DataBinding } from '../models/DataBinding'
import { DataSource } from '../models/DataSource'
import { publicSubmitSchema, requestEditorSchema } from '../schemas/dataSubmit.schema'
import { logger } from '../services/Logger'
import type { ServerMeta, VisitorInput } from '../services/requests/context'
import { createRequestPipeline } from '../services/requests/pipelineDeps'
import type { PublicRequestInput, RequestPipeline } from '../services/requests/RequestPipeline'
import { requestSpecOf, type RequestSpec } from '../services/requests/spec'

/** Отправок с одного IP за окно (сайт). */
export const SUBMIT_RATE_WINDOW_MS = 10 * 60 * 1000
export const SUBMIT_RATE_MAX = 30

let pipeline: RequestPipeline | null = null
function defaultPipeline(): RequestPipeline {
  if (!pipeline) pipeline = createRequestPipeline((level, message) => logger[level](message))
  return pipeline
}

export interface DataSubmitRouterOptions {
  getPipeline?: () => RequestPipeline
  limiter?: RequestHandler
  loadSource?: (id: string) => Promise<DataSource | null>
  loadBinding?: (id: string) => Promise<DataBinding | null>
}

function serverMeta(req: Request): ServerMeta {
  return { ip: req.ip ?? '', domain: req.hostname ?? '', userAgent: req.get('user-agent') ?? '' }
}

export function createDataSubmitRouter(options: DataSubmitRouterOptions = {}): Router {
  const getPipeline = options.getPipeline ?? defaultPipeline
  const loadSource = options.loadSource ?? ((id) => AppDataSource.getRepository(DataSource).findOne({ where: { id } }))
  const loadBinding = options.loadBinding ?? ((id) => AppDataSource.getRepository(DataBinding).findOne({ where: { id } }))
  const limiter =
    options.limiter ??
    rateLimit({
      windowMs: SUBMIT_RATE_WINDOW_MS,
      maxRequests: SUBMIT_RATE_MAX,
      // Префикс: хранилище лимитов общее с глобальным лимитом API.
      keyGenerator: (req) => `submit:${req.ip || 'unknown'}`,
    })

  const router = Router()

  router.post(
    '/submit',
    limiter,
    validate(publicSubmitSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const outcome = await getPipeline().submitPublic(req.body as PublicRequestInput, {
        ...serverMeta(req),
        referrer: req.get('referer') ?? undefined,
        sessionId: req.get('x-session-id') ?? undefined,
      })
      switch (outcome.kind) {
        case 'done':
          res.json({
            status: 'done',
            submissionId: outcome.submissionId,
            ...(outcome.data !== undefined ? { data: outcome.data, variable: outcome.variable } : {}),
          })
          return
        case 'unusable':
          res.status(404).json({
            status: 'failed',
            error: { code: 'FORM_NOT_CONFIGURED', message: 'Форма не настроена. Сообщите администратору сайта.' },
          })
          return
        case 'invalid':
          res.status(400).json({
            status: 'failed',
            error: { code: 'INVALID_INPUT', message: 'Проверьте введённые данные.' },
          })
          return
        case 'failed':
          res.status(502).json({
            status: 'failed',
            submissionId: outcome.submissionId,
            error: { code: 'DELIVERY_FAILED', message: 'Не удалось отправить данные. Попробуйте позже.' },
          })
          return
      }
    }),
  )

  // ─── Редактор (requireAuth: сессия + CSRF) ──────────────────────────

  const editorRequest = async (req: Request): Promise<{ source: DataSource; spec: RequestSpec; input: VisitorInput }> => {
    const body = req.body as { dataSourceId: string; request: RequestSpec } & Partial<VisitorInput>
    const source = await loadSource(body.dataSourceId)
    if (!source) throw new NotFoundError('DataSource', body.dataSourceId)
    return { source, spec: body.request, input: { data: body.data ?? {}, page: body.page, visitor: body.visitor } }
  }

  router.post(
    '/requests/preview',
    validate(requestEditorSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { source, spec, input } = await editorRequest(req)
      res.json(getPipeline().preview(source, spec, input, serverMeta(req)))
    }),
  )

  router.post(
    '/requests/test',
    validate(requestEditorSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { source, spec, input } = await editorRequest(req)
      res.json(await getPipeline().test(source, spec, input, serverMeta(req)))
    }),
  )

  router.get(
    '/requests/effective/:bindingId',
    asyncHandler(async (req: Request, res: Response) => {
      const binding = await loadBinding(req.params.bindingId)
      if (!binding) throw new NotFoundError('DataBinding', req.params.bindingId)
      res.json({ request: requestSpecOf(binding) })
    }),
  )

  router.get('/submissions', DataSubmitController.getSubmissions)
  router.get('/submissions/stats', DataSubmitController.getStats)
  router.get('/submissions/:id', DataSubmitController.getSubmissionById)

  return router
}

export default createDataSubmitRouter()
