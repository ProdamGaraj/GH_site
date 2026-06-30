/**
 * Tests for AuthController.login: проверка учётных данных, выставление cookie,
 * единый ответ на неверный логин/пароль (anti user-enumeration).
 */
import express, { Express } from 'express'
import request from 'supertest'

// Мок репозитория User (паттерн как в api.integration.test.ts)
const mockUserRepo = {
  findOne: jest.fn(),
  save: jest.fn((u: unknown) => Promise.resolve(u)),
  create: jest.fn((data: unknown) => data),
}

jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => mockUserRepo),
  },
}))

import { authController } from '../controllers/AuthController'
import { errorHandler } from '../middleware/errorHandler'
import { authService } from '../services/AuthService'
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME } from '../config/auth'

function buildApp(): Express {
  const app = express()
  app.use(express.json())
  app.post('/api/auth/login', authController.login)
  app.post('/api/auth/logout', authController.logout)
  app.use(errorHandler)
  return app
}

describe('AuthController.login', () => {
  const app = buildApp()
  let passwordHash: string

  beforeAll(async () => {
    passwordHash = await authService.hashPassword('correct-horse')
  })

  beforeEach(() => {
    mockUserRepo.findOne.mockReset()
    mockUserRepo.save.mockClear()
  })

  it('возвращает 400 при отсутствии полей', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin' })
    expect(res.status).toBe(400)
    expect(mockUserRepo.findOne).not.toHaveBeenCalled()
  })

  it('возвращает 401, если пользователь не найден', async () => {
    mockUserRepo.findOne.mockResolvedValue(null)
    const res = await request(app).post('/api/auth/login').send({ username: 'nope', password: 'whatever' })
    expect(res.status).toBe(401)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('возвращает 401 при неверном пароле', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'u1', username: 'admin', passwordHash, role: 'admin', isActive: true,
    })
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' })
    expect(res.status).toBe(401)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('возвращает 401 для деактивированного пользователя даже с верным паролем', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'u1', username: 'admin', passwordHash, role: 'admin', isActive: false,
    })
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'correct-horse' })
    expect(res.status).toBe(401)
  })

  it('возвращает 200, выставляет cookie и обновляет lastLoginAt при верных данных', async () => {
    const user = { id: 'u1', username: 'admin', passwordHash, role: 'admin', isActive: true }
    mockUserRepo.findOne.mockResolvedValue(user)

    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'correct-horse' })

    expect(res.status).toBe(200)
    expect(res.body.user).toEqual({ id: 'u1', username: 'admin', role: 'admin' })

    const cookies = res.headers['set-cookie'] as unknown as string[]
    expect(cookies.some((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`))).toBe(true)
    expect(cookies.some((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`))).toBe(true)
    // httpOnly только на токене, не на CSRF-cookie
    expect(cookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`))).toMatch(/HttpOnly/i)
    expect(cookies.find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`))).not.toMatch(/HttpOnly/i)

    expect(mockUserRepo.save).toHaveBeenCalledTimes(1)
    expect(mockUserRepo.save).toHaveBeenCalledWith(expect.objectContaining({ lastLoginAt: expect.any(Date) }))
  })

  it('logout чистит cookie сессии и CSRF', async () => {
    const res = await request(app).post('/api/auth/logout').send({})
    expect(res.status).toBe(200)
    const cookies = res.headers['set-cookie'] as unknown as string[]
    expect(cookies.some((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`))).toBe(true)
    expect(cookies.some((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`))).toBe(true)
  })
})
