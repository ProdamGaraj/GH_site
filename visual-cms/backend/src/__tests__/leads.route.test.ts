/**
 * POST /api/leads: публичный (без логина и CSRF), проверка схемы, ответы
 * браузеру и данные запроса, которые знает только сервер.
 */
jest.mock('../config/database', () => ({ AppDataSource: { getRepository: () => ({}) } }))

import express from 'express'
import request from 'supertest'
import { createLeadsRouter, LEAD_RATE_MAX } from '../routes/leads'
import { requireAuth } from '../middleware/auth'
import { errorHandler } from '../middleware/errorHandler'
import { rateLimit } from '../middleware/performance'
import { LeadValidationError, type LeadService } from '../services/leads/LeadService'

const body = {
  kind: 'callback',
  name: 'Иван',
  phone: '+998 90 123 45 67',
  page: { path: '/ru/', lang: 'ru' },
  consent: true,
}

function app(submit: jest.Mock, limiter?: express.RequestHandler) {
  const a = express()
  a.set('trust proxy', 1)
  a.use(express.json())
  a.use(requireAuth)
  const service = { submit } as unknown as LeadService
  a.use('/api/leads', createLeadsRouter({ getService: () => service, limiter: limiter ?? ((_q, _s, n) => n()) }))
  a.use(errorHandler)
  return a
}

describe('POST /api/leads', () => {
  it('публичный: без cookie и CSRF — 201 и id заявки', async () => {
    const submit = jest.fn(async () => ({ status: 'accepted', id: 'lead-1', delivery: Promise.resolve('sent') }))
    const res = await request(app(submit)).post('/api/leads').set('User-Agent', 'UA-test').send(body)
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ ok: true, id: 'lead-1' })
    const [input, meta] = submit.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>]
    expect(input).toMatchObject({ kind: 'callback', phone: '+998 90 123 45 67' })
    expect(meta).toMatchObject({ userAgent: 'UA-test', domain: '127.0.0.1' })
  })

  it('ip и домен — из заголовков прокси (nginx)', async () => {
    const submit = jest.fn(async () => ({ status: 'duplicate', id: 'lead-0' }))
    const res = await request(app(submit))
      .post('/api/leads')
      .set('X-Forwarded-For', '203.0.113.10')
      .set('X-Forwarded-Host', 'gh.uz')
      .send(body)
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ ok: true, id: 'lead-0' })
    expect((submit.mock.calls[0] as unknown[])[1]).toMatchObject({ ip: '203.0.113.10', domain: 'gh.uz' })
  })

  it('ловушка — 201 без id (бот не узнаёт, что отсеян)', async () => {
    const submit = jest.fn(async () => ({ status: 'ignored' }))
    const res = await request(app(submit)).post('/api/leads').send({ ...body, hp: 'x' })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ ok: true })
  })

  it('схема не прошла — 400, сервис не вызван', async () => {
    const submit = jest.fn()
    const res = await request(app(submit)).post('/api/leads').send({ kind: 'spam', phone: '1', page: { path: '/' } })
    expect(res.status).toBe(400)
    expect(submit).not.toHaveBeenCalled()
  })

  it('не телефон — 400 с полем', async () => {
    const submit = jest.fn(async () => {
      throw new LeadValidationError('phone', 'Некорректный номер телефона')
    })
    const res = await request(app(submit)).post('/api/leads').send(body)
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'phone', message: 'Некорректный номер телефона' })
  })

  it('прочая ошибка — 500 через общий обработчик', async () => {
    const submit = jest.fn(async () => {
      throw new Error('db down')
    })
    const res = await request(app(submit)).post('/api/leads').send(body)
    expect(res.status).toBe(500)
  })

  it('лимит с одного IP — 429', async () => {
    const submit = jest.fn(async () => ({ status: 'accepted', id: 'x', delivery: Promise.resolve('sent') }))
    const limiter = rateLimit({ windowMs: 60000, maxRequests: 2, keyGenerator: () => `lead-test:${Date.now() >> 30}` })
    const a = app(submit, limiter)
    await request(a).post('/api/leads').send(body)
    await request(a).post('/api/leads').send(body)
    const res = await request(a).post('/api/leads').send(body)
    expect(res.status).toBe(429)
    expect(submit).toHaveBeenCalledTimes(2)
    expect(LEAD_RATE_MAX).toBeGreaterThanOrEqual(5)
  })

  it('другие методы /api/leads публичными не стали', async () => {
    const res = await request(app(jest.fn())).get('/api/leads')
    expect(res.status).toBe(401)
  })
})
