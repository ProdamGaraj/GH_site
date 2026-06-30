import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { User } from '../models/User'
import { authService } from '../services/AuthService'
import { asyncHandler, AuthenticationError, ValidationError } from '../middleware'
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  authCookieOptions,
  csrfCookieOptions,
} from '../config/auth'

function publicUser(user: User) {
  return { id: user.id, username: user.username, role: user.role }
}

export class AuthController {
  /**
   * POST /api/auth/login — проверка логина/пароля. На успех выдаёт JWT в
   * httpOnly-cookie + CSRF-токен в читаемой cookie.
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body ?? {}
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      throw new ValidationError('username and password are required')
    }

    const repo = AppDataSource.getRepository(User)
    const user = await repo.findOne({ where: { username } })

    // Единое сообщение и постоянное время ответа — не выдаём наличие логина.
    const passwordOk = await authService.verifyPassword(password, user?.passwordHash)
    if (!user || !user.isActive || !passwordOk) {
      throw new AuthenticationError('Invalid credentials')
    }

    user.lastLoginAt = new Date()
    await repo.save(user)

    const token = authService.signToken({ sub: user.id, username: user.username, role: user.role })
    const csrfToken = authService.generateCsrfToken()
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions())
    res.cookie(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions())

    res.json({ user: publicUser(user) })
  })

  /** POST /api/auth/logout — чистит cookie сессии и CSRF. */
  logout = asyncHandler(async (_req: Request, res: Response) => {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' })
    res.clearCookie(CSRF_COOKIE_NAME, { path: '/' })
    res.json({ success: true })
  })

  /**
   * GET /api/auth/me — текущий пользователь. requireAuth уже провалидировал
   * cookie и заполнил req.user; сюда дойдём только при валидной сессии.
   */
  me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AuthenticationError()
    }
    res.json({ user: req.user })
  })
}

export const authController = new AuthController()
