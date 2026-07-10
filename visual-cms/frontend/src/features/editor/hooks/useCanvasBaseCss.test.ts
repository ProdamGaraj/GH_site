// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCanvasBaseCss } from './useCanvasBaseCss'

const STYLE_ID = 'vcms-canvas-base-css'
const CSS = '.canvas-viewport input[type="text"] { padding: 0.75rem; }'

describe('useCanvasBaseCss', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(CSS),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.getElementById(STYLE_ID)?.remove()
  })

  it('фетчит base-css и инжектит <style> в <head>', async () => {
    renderHook(() => useCanvasBaseCss())

    await waitFor(() => expect(document.getElementById(STYLE_ID)).toBeTruthy())

    const style = document.getElementById(STYLE_ID)!
    expect(style.tagName).toBe('STYLE')
    expect(style.textContent).toBe(CSS)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/preview/base-css?scope=')
  })

  it('идемпотентно: повторный маунт не плодит второй <style> и не рефетчит', async () => {
    renderHook(() => useCanvasBaseCss())
    await waitFor(() => expect(document.getElementById(STYLE_ID)).toBeTruthy())
    fetchMock.mockClear()

    renderHook(() => useCanvasBaseCss())
    // второй маунт видит существующий <style> → ранний выход, без сети
    expect(document.querySelectorAll(`#${STYLE_ID}`).length).toBe(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
