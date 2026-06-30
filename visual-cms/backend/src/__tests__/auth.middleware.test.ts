/**
 * Tests for requireAuth middleware: публичный allowlist, защита /api по JWT-cookie
 * и проверка CSRF (double-submit) на мутациях.
 */
import express, { Express } from 'express'
import request from 'supertest'
import { requireAuth } from '../middleware/auth'
import { errorHandler } from '../middleware/errorHandler'
import { authService } from '../services/AuthService'
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME } from '../config/auth'

function buildApp(): Express {
  const app = express()
  app.use(express.json())
  app.use(requireAuth)

  // Публичный (в allowlist) — без cookie
  app.post('/api/data/submit', (_req, res) => res.json({ ok: true }))
  // Публичный GET-скрипт трекера
  app.get('/api/analytics/tracker.js', (_req, res) => res.json({ ok: true }))
  // Админский GET
  app.get('/api/pages', (req, res) => res.json({ user: req.user }))
  // Админский POST (мутация → нужен CSRF)
  app.post('/api/pages', (_req, res) => res.json({ ok: true }))
  // Не-/api путь
  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use(errorHandler)
  return app
}

const validToken = () => authService.signToken({ sub: 'u1', username: 'admin', role: 'admin' })

describe('requireAuth middleware', () => {
  const app = buildApp()

  describe('публичный allowlist и не-/api пути', () => {
    it('пропускает публичный POST /api/data/submit без cookie', async () => {
      const res = await request(app).post('/api/data/submit').send({})
      expect(res.status).toBe(200)
    })

    it('пропускает публичный GET /api/analytics/tracker.js без cookie', async () => {
      const res = await request(app).get('/api/analytics/tracker.js')
      expect(res.status).toBe(200)
    })

    it('не трогает не-/api пути (health) без cookie', async () => {
      const res = await request(app).get('/health')
      expect(res.status).toBe(200)
    })
  })

  describe('защита админских эндпоинтов (JWT)', () => {
    it('возвращает 401 на GET /api/pages без cookie', async () => {
      const res = await request(app).get('/api/pages')
      expect(res.status).toBe(401)
    })

    it('возвращает 401 при невалидном токене', async () => {
      const res = await request(app)
        .get('/api/pages')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=garbage.token.value`])
      expect(res.status).toBe(401)
    })

    it('пропускает GET /api/pages с валидным токеном и кладёт req.user', async () => {
      const res = await request(app)
        .get('/api/pages')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${validToken()}`])
      expect(res.status).toBe(200)
      expect(res.body.user).toMatchObject({ id: 'u1', username: 'admin', role: 'admin' })
    })
  })

  describe('CSRF на мутациях', () => {
    it('возвращает 403 на POST с валидным токеном, но без CSRF-заголовка', async () => {
      const res = await request(app)
        .post('/api/pages')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${validToken()}`, `${CSRF_COOKIE_NAME}=abc123`])
        .send({})
      expect(res.status).toBe(403)
    })

    it('возвращает 403 при несовпадении CSRF header и cookie', async () => {
      const res = await request(app)
        .post('/api/pages')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${validToken()}`, `${CSRF_COOKIE_NAME}=abc123`])
        .set('X-CSRF-Token', 'different')
        .send({})
      expect(res.status).toBe(403)
    })

    it('пропускает POST при совпадении CSRF header и cookie', async () => {
      const res = await request(app)
        .post('/api/pages')
        .set('Cookie', [`${AUTH_COOKIE_NAME}=${validToken()}`, `${CSRF_COOKIE_NAME}=abc123`])
        .set('X-CSRF-Token', 'abc123')
        .send({})
      expect(res.status).toBe(200)
    })

    it('требует валидный токен ДО проверки CSRF (401 без cookie)', async () => {
      const res = await request(app)
        .post('/api/pages')
        .set('Cookie', [`${CSRF_COOKIE_NAME}=abc123`])
        .set('X-CSRF-Token', 'abc123')
        .send({})
      expect(res.status).toBe(401)
    })
  })
})
