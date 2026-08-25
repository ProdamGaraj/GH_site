import { api } from '@/shared/api'
import { ApiError } from '@/shared/api/http'

export interface AuthUser {
  id: string
  username: string
  role: string
}

/**
 * Повтор при ТРАНЗИЕНТНЫХ ошибках (429 rate-limit / 5xx / сеть). 401/403 не
 * ретраим — это реальный ответ «нет сессии». Нужен для /auth/me на старте:
 * иначе случайный 429 роняет сессию в anonymous («самовыход»).
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const status = e instanceof ApiError ? e.status : 0 // 0 = сетевая ошибка
      const transient = status === 0 || status === 429 || status >= 500
      if (!transient || i === attempts - 1) throw e
      const wait = e instanceof ApiError && e.retryAfter ? e.retryAfter * 1000 : 500 * (i + 1)
      await new Promise((r) => setTimeout(r, Math.min(wait, 2000)))
    }
  }
  throw lastErr
}

/**
 * Эндпоинты авторизации. Все ходят через общий ApiClient → apiFetch
 * (credentials + CSRF + обработка 401). /auth/login публичный; /auth/me и
 * /auth/logout требуют валидной сессии (см. backend middleware/auth.ts).
 */
export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ user: AuthUser }>('/auth/login', { username, password }),

  logout: () => api.post<{ success: boolean }>('/auth/logout'),

  me: () => withRetry(() => api.get<{ user: AuthUser }>('/auth/me')),
}
