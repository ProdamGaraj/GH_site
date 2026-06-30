import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { authService } from '../services/AuthService'
import { AuthenticationError, AuthorizationError } from './errorHandler'
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  readCookie,
} from '../config/auth'

/**
 * Публичные эндпоинты под /api — пара «МЕТОД ПУТЬ» (точное совпадение пути).
 * Их в рантайме зовут УЖЕ ЗАДЕПЛОЕННЫЕ сайты, поэтому они обязаны работать без
 * логина и без CSRF-токена. Всё остальное под /api требует валидной сессии.
 *
 * ВАЖНО: внутри /api/data и /api/analytics публичные и админские ручки
 * перемешаны по префиксу (например, POST /api/data/submit — публичный, а
 * GET /api/data/submissions — админский), поэтому список — точечный, не по
 * префиксу роутера.
 */
const PUBLIC_ENDPOINTS = new Set<string>([
  // Аутентификация
  'POST /api/auth/login',
  // Аналитика: скрипт-трекер и приём событий с боевых сайтов
  'GET /api/analytics/tracker.js',
  'POST /api/analytics/track',
  'POST /api/analytics/heartbeat',
  // Данные для боевых сайтов: отправка форм и получение фидов
  'POST /api/data/submit',
  'POST /api/data/fetch',
  'POST /api/data/fetch-with-binding',
  'POST /api/data/fetch-with-transforms',
  'POST /api/data/submit-with-binding',
])

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function normalizePath(path: string): string {
  // Убираем хвостовой слэш (кроме корня), чтобы '/api/data/submit/' совпадал.
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

function isPublicEndpoint(method: string, path: string): boolean {
  return PUBLIC_ENDPOINTS.has(`${method} ${normalizePath(path)}`)
}

/** Сравнение строк за постоянное время (защита от timing-атак на CSRF). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/**
 * Защита всего API-слоя. Монтируется глобально (app.use), но реагирует только
 * на пути под /api. Логика:
 *   1. не-/api пути и OPTIONS-preflight — пропускаем;
 *   2. публичный allowlist — пропускаем (без токена и без CSRF);
 *   3. иначе требуется валидный JWT из httpOnly-cookie (иначе 401);
 *   4. для мутаций дополнительно сверяем CSRF: заголовок == cookie (иначе 403).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  // Защищаем только API-поверхность; статика/health/прочее идут как раньше.
  if (req.path !== '/api' && !req.path.startsWith('/api/')) {
    return next()
  }

  // CORS preflight не несёт cookie — пропускаем (сам ответ отдаст cors-middleware).
  if (req.method === 'OPTIONS') {
    return next()
  }

  if (isPublicEndpoint(req.method, req.path)) {
    return next()
  }

  // 1) Аутентификация по JWT из cookie
  const token = readCookie(req, AUTH_COOKIE_NAME)
  if (!token) {
    throw new AuthenticationError('Authentication required')
  }
  let payload
  try {
    payload = authService.verifyToken(token)
  } catch {
    throw new AuthenticationError('Invalid or expired session')
  }
  req.user = { id: payload.sub, username: payload.username, role: payload.role }

  // 2) CSRF (double-submit) для запросов, меняющих состояние
  if (MUTATING_METHODS.has(req.method)) {
    const headerToken = req.get(CSRF_HEADER_NAME)
    const cookieToken = readCookie(req, CSRF_COOKIE_NAME)
    if (!headerToken || !cookieToken || !safeEqual(headerToken, cookieToken)) {
      throw new AuthorizationError('CSRF token mismatch')
    }
  }

  next()
}
