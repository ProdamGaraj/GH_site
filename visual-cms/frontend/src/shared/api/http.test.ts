// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, setUnauthorizedHandler, CSRF_HEADER_NAME, CSRF_COOKIE_NAME } from './http'

describe('apiFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  const headersOf = () => new Headers(fetchMock.mock.calls[0][1].headers)

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true })
    vi.stubGlobal('fetch', fetchMock)
    // Сбрасываем CSRF-cookie между тестами.
    document.cookie = `${CSRF_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setUnauthorizedHandler(() => {})
  })

  it('всегда шлёт credentials: include', async () => {
    await apiFetch('/api/pages')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('добавляет X-CSRF-Token из cookie на мутациях', async () => {
    document.cookie = `${CSRF_COOKIE_NAME}=tok123; path=/`
    await apiFetch('/api/pages', { method: 'POST' })
    expect(headersOf().get(CSRF_HEADER_NAME)).toBe('tok123')
  })

  it('НЕ добавляет CSRF-заголовок на GET', async () => {
    document.cookie = `${CSRF_COOKIE_NAME}=tok123; path=/`
    await apiFetch('/api/pages', { method: 'GET' })
    expect(headersOf().get(CSRF_HEADER_NAME)).toBeNull()
  })

  it('не шлёт CSRF-заголовок, если cookie отсутствует', async () => {
    await apiFetch('/api/pages', { method: 'POST' })
    expect(headersOf().get(CSRF_HEADER_NAME)).toBeNull()
  })

  it('вызывает обработчик 401 при статусе 401', async () => {
    fetchMock.mockResolvedValue({ status: 401, ok: false })
    const onUnauth = vi.fn()
    setUnauthorizedHandler(onUnauth)
    await apiFetch('/api/pages')
    expect(onUnauth).toHaveBeenCalledTimes(1)
  })

  it('НЕ вызывает обработчик 401 при успешном ответе', async () => {
    const onUnauth = vi.fn()
    setUnauthorizedHandler(onUnauth)
    await apiFetch('/api/pages')
    expect(onUnauth).not.toHaveBeenCalled()
  })
})
