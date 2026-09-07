/**
 * Обёртка над fetch для авторизованных запросов к нашему API.
 *
 *  - credentials: 'include' — отправляет httpOnly-cookie сессии (нужно явно для
 *    кросс-ориджин туннелей; для same-origin поведение и так такое).
 *  - X-CSRF-Token на мутациях — double-submit: значение берётся из читаемой
 *    cookie vcms_csrf, которую сервер выставил при логине.
 *  - 401 → единый колбэк (разлогин + редирект на /login), регистрируется в
 *    точке входа приложения, чтобы не тянуть store в этот модуль (нет циклов).
 *
 * Возвращает «сырой» Response — это drop-in замена fetch на админских ручках.
 * НЕ использовать для запросов к ВНЕШНИМ доменам (нельзя слать наши cookie).
 */

import { describeNetworkFailure, NETWORK_FAILURE_STATUS } from './errorMessages'

export const CSRF_COOKIE_NAME = 'vcms_csrf'
export const CSRF_HEADER_NAME = 'X-CSRF-Token'

/**
 * Ошибка API с HTTP-статусом. Наследует Error (message сохранён), плюс несёт
 * status и retryAfter (секунды для 429) — чтобы UI мог различать случаи.
 */
export class ApiError extends Error {
  status: number
  retryAfter?: number
  details?: unknown

  constructor(message: string, status: number, opts?: { retryAfter?: number; details?: unknown }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfter = opts?.retryAfter
    this.details = opts?.details
  }
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  for (const part of document.cookie.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim())
    }
  }
  return undefined
}

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

/** Регистрируется один раз при старте приложения (см. app/store или main). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers ?? {})

  if (MUTATING_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE_NAME)
    if (csrf && !headers.has(CSRF_HEADER_NAME)) {
      headers.set(CSRF_HEADER_NAME, csrf)
    }
  }

  // Отказ самого fetch (нет сети, не резолвится хост) — единственный случай,
  // который стоит звать сетевой ошибкой. Заворачиваем в ApiError, чтобы вызывающий
  // код получил читаемый текст, а не «Failed to fetch».
  let response: Response
  try {
    response = await fetch(input, {
      ...init,
      credentials: 'include',
      headers,
    })
  } catch (err) {
    throw new ApiError(describeNetworkFailure(err), NETWORK_FAILURE_STATUS)
  }

  if (response.status === 401) {
    onUnauthorized?.()
  }

  return response
}
