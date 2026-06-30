import type { CookieOptions, Request } from 'express'
import { logger } from '../services/Logger'

/**
 * Централизованная конфигурация авторизации: секрет JWT, время жизни сессии,
 * имена и опции cookie. Один источник правды для контроллера и middleware.
 */

export const AUTH_COOKIE_NAME = 'vcms_token'
export const CSRF_COOKIE_NAME = 'vcms_csrf'
/** Заголовок, в котором фронт присылает CSRF-токен (double-submit). Lowercase — как в req.get(). */
export const CSRF_HEADER_NAME = 'x-csrf-token'

const DEV_JWT_FALLBACK = 'dev-insecure-jwt-secret-change-me'
let warnedAboutSecret = false

/**
 * Секрет для подписи JWT. В docker этого проекта NODE_ENV=development даже на
 * проде, поэтому «бросать в проде» бесполезно — вместо этого громко предупреждаем
 * и используем небезопасный дефолт, если переменная не задана. На боевом
 * окружении ОБЯЗАТЕЛЬНО выставить JWT_SECRET.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret && secret.length > 0) return secret
  if (!warnedAboutSecret) {
    logger.warn('JWT_SECRET is not set — using an insecure development fallback. Set JWT_SECRET in production!')
    warnedAboutSecret = true
  }
  return DEV_JWT_FALLBACK
}

/** Время жизни токена (формат jsonwebtoken: '7d', '12h', число секунд). */
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

/** Срок жизни cookie (мс). По умолчанию синхронен с дефолтным JWT — 7 дней. */
export const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000

/**
 * Флаг Secure для cookie. Завязан на отдельную переменную, а НЕ на NODE_ENV:
 * в этом проекте NODE_ENV=development и на проде, поэтому на боевом https
 * нужно явно выставить COOKIE_SECURE=true.
 */
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true'

/** Опции httpOnly-cookie с JWT. JS на странице её прочитать не может. */
export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  }
}

/**
 * Опции cookie с CSRF-токеном. httpOnly: false — фронт читает её и присылает
 * значение обратно в заголовке X-CSRF-Token (паттерн double-submit cookie).
 */
export function csrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  }
}

/**
 * Чтение одной cookie из заголовка запроса без сторонних зависимостей
 * (cookie-parser не нужен; запись делает нативный res.cookie()).
 */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim())
    }
  }
  return undefined
}
