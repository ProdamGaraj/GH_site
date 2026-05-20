/**
 * A1: health-роутер (`routes/health.ts`) реализован, но не был смонтирован
 * в app.ts → `/metrics`, `/health/live`, `/health/ready`, `/health/detailed`
 * были недостижимы.
 *
 * Этот тест пинит, что после монтирования эндпоинты доступны через реальный
 * express-app (импорт `../app`), а не только как изолированный роутер.
 */
import request from 'supertest'

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
  })),
}

const mockDataSource = {
  isInitialized: true,
  query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  getRepository: jest.fn(() => mockRepo),
}

jest.mock('../config/database', () => ({
  AppDataSource: mockDataSource,
}))

import app from '../app'

describe('A1: health & metrics endpoints смонтированы в app', () => {
  it('GET /health → 200 status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(typeof res.body.uptime).toBe('number')
  })

  it('GET /health/live → 200 alive (k8s liveness)', async () => {
    const res = await request(app).get('/health/live')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'alive' })
  })

  it('GET /health/ready → 200 ready, БД проверена (k8s readiness)', async () => {
    const res = await request(app).get('/health/ready')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ready')
    expect(res.body.checks.database).toBe(true)
    expect(mockDataSource.query).toHaveBeenCalled()
  })

  it('GET /health/ready → 503 not ready при недоступной БД', async () => {
    mockDataSource.query.mockRejectedValueOnce(new Error('db down'))
    const res = await request(app).get('/health/ready')
    expect(res.status).toBe(503)
    expect(res.body.status).toBe('not ready')
    expect(res.body.checks.database).toBe(false)
  })

  it('GET /metrics → 200 Prometheus text по умолчанию', async () => {
    const res = await request(app).get('/metrics')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/plain')
  })

  it('GET /metrics с Accept: application/json → JSON', async () => {
    const res = await request(app).get('/metrics').set('Accept', 'application/json')
    expect(res.status).toBe(200)
    expect(typeof res.body).toBe('object')
  })

  it('GET /health/detailed → 200 с system/stats', async () => {
    const res = await request(app).get('/health/detailed')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('system.memory')
    expect(res.body).toHaveProperty('stats.cache')
  })

  it('несуществующий путь всё ещё отдаёт 404 (роутер не перехватил всё)', async () => {
    const res = await request(app).get('/definitely-not-a-route-xyz')
    expect(res.status).toBe(404)
  })
})
