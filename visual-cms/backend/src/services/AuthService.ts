import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { getJwtSecret, JWT_EXPIRES_IN } from '../config/auth'

const BCRYPT_ROUNDS = 12

/**
 * Хеш для сравнения, когда пользователь не найден. Уравнивает время ответа
 * login на «нет такого юзера» и «неверный пароль» (anti user-enumeration).
 * Это валидный bcrypt-хеш случайной строки — compare всегда вернёт false.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKxGhuQ1z9Q1n0t6h0Yx0pY5l0Yx0pY5l0Yi'

export interface JwtPayload {
  /** user id */
  sub: string
  username: string
  role: string
}

export const authService = {
  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS)
  },

  /**
   * Проверка пароля. Если хеш не передан (пользователь не найден), всё равно
   * выполняем сравнение с фиктивным хешем, чтобы не выдавать наличие логина
   * по времени ответа.
   */
  async verifyPassword(plain: string, hash?: string | null): Promise<boolean> {
    if (!hash) {
      await bcrypt.compare(plain, DUMMY_HASH)
      return false
    }
    return bcrypt.compare(plain, hash)
  },

  signToken(payload: JwtPayload): string {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
  },

  /** Бросает, если токен невалиден/протух. */
  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, getJwtSecret()) as JwtPayload
  },

  /** Случайный CSRF-токен для double-submit cookie. */
  generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex')
  },
}
