import { api } from '@/shared/api'

export interface AuthUser {
  id: string
  username: string
  role: string
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

  me: () => api.get<{ user: AuthUser }>('/auth/me'),
}
