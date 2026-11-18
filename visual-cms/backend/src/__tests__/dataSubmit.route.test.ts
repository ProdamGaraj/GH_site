/**
 * Маршруты запросов привязок: публичный /submit (только id привязки и
 * значения), ответы сайту без деталей сервиса; превью/тест/запрос привязки —
 * только редактору.
 */
jest.mock('../config/database', () => ({ AppDataSource: { getRepository: () => ({}) } }))

import express from 'express'
import request from 'supertest'
import { requireAuth } from '../middleware/auth'
import { errorHandler } from '../middleware/errorHandler'
import { createDataSubmitRouter } from '../routes/dataSubmit'
import { authService } from '../services/AuthService'
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME } from '../config/auth'
import { PUBLIC_SUBMIT_MAX_BYTES, PUBLIC_SUBMIT_MAX_FIELDS, type PublicOutcome, type RequestPipeline } from '../services/requests/RequestPipeline'
import type { DataBinding } from '../models/DataBinding'
import type { DataSource } from '../models/DataSource'

const BINDING_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_ID = '22222222-2222-4222-8222-222222222222'

function app(outcome: PublicOutcome = { kind: 'done', submissionId: 'sub-1' }, limiter?: express.RequestHandler) {
  const pipeline = {
    submitPublic: jest.fn(async () => outcome),
    preview: jest.fn(() => ({ issues: [], request: { method: 'GET', url: 'https://x' } })),
    test: jest.fn(async () => ({ issues: [], result: { ok: true } })),
  }
  const loadSource = jest.fn(async (id: string) => (id === SOURCE_ID ? ({ id, type: 'rest-api', config: {} } as unknown as DataSource) : null))
  const loadBinding = jest.fn(async (id: string) =>
    id === BINDING_ID ? ({ id, config: { outputConfig: { endpoint: { path: '/x', method: 'POST' }, payloadMappings: [] } } } as unknown as DataBinding) : null,
  )
  const a = express()
  a.set('trust proxy', 1)
  a.use(express.json())
  a.use(requireAuth)
  a.use(
    '/api/data',
    createDataSubmitRouter({
      getPipeline: () => pipeline as unknown as RequestPipeline,
      limiter: limiter ?? ((_q, _s, n) => n()),
      loadSource,
      loadBinding,
    }),
  )
  a.use(errorHandler)
  return { a, pipeline }
}

const editor = (r: request.Test) =>
  r
    .set('Cookie', [`${AUTH_COOKIE_NAME}=${authService.signToken({ sub: 'u1', username: 'admin', role: 'admin' })}`, `${CSRF_COOKIE_NAME}=c1`])
    .set('X-CSRF-Token', 'c1')

describe('POST /api/data/submit — сайт', () => {
  it('без логина: id привязки, значения, страница, визит → 200 done; сервису — сведения о запросе', async () => {
    const { a, pipeline } = app()
    const body = {
      outputBindingId: BINDING_ID,
      data: { name: 'Иван' },
      trigger: 'form_submit',
      page: { path: '/ru/', lang: 'ru', title: 'Главная' },
      visitor: { referrer: 'https://google.com', utm: { source: 'ig' } },
    }
    const res = await request(a)
      .post('/api/data/submit')
      .set('User-Agent', 'UA-test')
      .set('Referer', 'https://gh.uz/ru/')
      .set('X-Forwarded-For', '203.0.113.10')
      .send(body)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'done', submissionId: 'sub-1' })
    expect(pipeline.submitPublic).toHaveBeenCalledWith(body, {
      ip: '203.0.113.10',
      domain: '127.0.0.1',
      userAgent: 'UA-test',
      referrer: 'https://gh.uz/ru/',
      sessionId: undefined,
    })
  })

  it('разрешённые поля ответа и переменная страницы', async () => {
    const { a } = app({ kind: 'done', submissionId: 's', data: [{ price: 1 }], variable: 'prices' })
    const res = await request(a).post('/api/data/submit').send({ outputBindingId: BINDING_ID, data: {} })
    expect(res.body).toEqual({ status: 'done', submissionId: 's', data: [{ price: 1 }], variable: 'prices' })
  })

  it.each([
    ['адрес', { endpoint: 'http://estate-service:5100/admin' }],
    ['источник', { dataSourceId: SOURCE_ID }],
    ['маппинг', { fieldMapping: { a: 'b' } }],
    ['метод', { method: 'DELETE' }],
    ['спецификация запроса', { request: { version: 1, connector: 'rest' } }],
  ])('%s из браузера → 400, конвейер не вызван', async (_name, extra) => {
    const { a, pipeline } = app()
    expect((await request(a).post('/api/data/submit').send({ outputBindingId: BINDING_ID, data: {}, ...extra })).status).toBe(400)
    expect(pipeline.submitPublic).not.toHaveBeenCalled()
  })

  it('без id привязки / id не uuid → 400', async () => {
    const { a } = app()
    expect((await request(a).post('/api/data/submit').send({ data: {} })).status).toBe(400)
    expect((await request(a).post('/api/data/submit').send({ outputBindingId: 'MACRO', data: {} })).status).toBe(400)
  })

  it(`больше ${PUBLIC_SUBMIT_MAX_FIELDS} полей или ${PUBLIC_SUBMIT_MAX_BYTES} байт → 400`, async () => {
    const { a, pipeline } = app()
    const many = Object.fromEntries(Array.from({ length: PUBLIC_SUBMIT_MAX_FIELDS + 1 }, (_, i) => [`f${i}`, 1]))
    expect((await request(a).post('/api/data/submit').send({ outputBindingId: BINDING_ID, data: many })).status).toBe(400)
    const big = { t: 'я'.repeat(PUBLIC_SUBMIT_MAX_BYTES / 2) }
    expect((await request(a).post('/api/data/submit').send({ outputBindingId: BINDING_ID, data: big })).status).toBe(400)
    expect(pipeline.submitPublic).not.toHaveBeenCalled()
  })

  it('привязка не годится → 404, причина наружу не уходит', async () => {
    const { a } = app({ kind: 'unusable', reason: 'binding is inactive' })
    const res = await request(a).post('/api/data/submit').send({ outputBindingId: BINDING_ID, data: {} })
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ status: 'failed', error: { code: 'FORM_NOT_CONFIGURED', message: 'Форма не настроена. Сообщите администратору сайта.' } })
  })

  it('недопустимые данные → 400 «проверьте данные»', async () => {
    const { a } = app({ kind: 'invalid', reason: 'dots' })
    const res = await request(a).post('/api/data/submit').send({ outputBindingId: BINDING_ID, data: {} })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ status: 'failed', error: { code: 'INVALID_INPUT', message: 'Проверьте введённые данные.' } })
  })

  it('сервис не принял → 502, id записи журнала', async () => {
    const { a } = app({ kind: 'failed', submissionId: 'sub-9' })
    const res = await request(a).post('/api/data/submit').send({ outputBindingId: BINDING_ID, data: {} })
    expect(res.status).toBe(502)
    expect(res.body).toEqual({ status: 'failed', submissionId: 'sub-9', error: { code: 'DELIVERY_FAILED', message: 'Не удалось отправить данные. Попробуйте позже.' } })
  })

  it('лимит запросов', async () => {
    const limiter = jest.fn((_q: express.Request, res: express.Response) => {
      res.status(429).end()
    })
    const { a, pipeline } = app(undefined, limiter)
    expect((await request(a).post('/api/data/submit').send({ outputBindingId: BINDING_ID, data: {} })).status).toBe(429)
    expect(pipeline.submitPublic).not.toHaveBeenCalled()
  })
})

describe('редактор: превью, тест, запрос привязки', () => {
  const body = { dataSourceId: SOURCE_ID, request: { version: 1, connector: 'rest', rest: { method: 'GET', path: '/x' } }, data: { q: '1' } }

  it.each([
    ['post', '/api/data/requests/preview'],
    ['post', '/api/data/requests/test'],
    ['get', `/api/data/requests/effective/${BINDING_ID}`],
    ['get', '/api/data/submissions'],
  ])('%s %s без сессии → 401', async (method, path) => {
    const { a } = app()
    const r = method === 'get' ? request(a).get(path) : request(a).post(path).send(body)
    expect((await r).status).toBe(401)
  })

  it('preview: источник по id, спецификация и значения — в конвейер', async () => {
    const { a, pipeline } = app()
    const res = await editor(request(a).post('/api/data/requests/preview')).send(body)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ issues: [], request: { method: 'GET', url: 'https://x' } })
    expect(pipeline.preview).toHaveBeenCalledWith(
      expect.objectContaining({ id: SOURCE_ID }),
      body.request,
      { data: { q: '1' }, page: undefined, visitor: undefined },
      expect.objectContaining({ userAgent: expect.any(String) }),
    )
  })

  it('test: тот же разбор, ответ конвейера', async () => {
    const { a, pipeline } = app()
    const res = await editor(request(a).post('/api/data/requests/test')).send(body)
    expect(res.body).toEqual({ issues: [], result: { ok: true } })
    expect(pipeline.test).toHaveBeenCalledTimes(1)
  })

  it('неизвестный источник → 404', async () => {
    const { a } = app()
    const res = await editor(request(a).post('/api/data/requests/preview')).send({ ...body, dataSourceId: '99999999-9999-4999-8999-999999999999' })
    expect(res.status).toBe(404)
  })

  it('без спецификации → 400', async () => {
    const { a } = app()
    expect((await editor(request(a).post('/api/data/requests/preview')).send({ dataSourceId: SOURCE_ID })).status).toBe(400)
  })

  it('effective: старая привязка → прочитанная спецификация; нет привязки → 404', async () => {
    const { a } = app()
    const res = await editor(request(a).get(`/api/data/requests/effective/${BINDING_ID}`))
    expect(res.status).toBe(200)
    expect(res.body.request).toMatchObject({ connector: 'rest', rest: { method: 'POST', path: '/x', body: { format: 'json', value: '{{form}}' } } })
    expect((await editor(request(a).get('/api/data/requests/effective/99999999-9999-4999-8999-999999999999'))).status).toBe(404)
  })
})
