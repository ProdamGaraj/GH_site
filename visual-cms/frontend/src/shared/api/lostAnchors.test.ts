import { describe, it, expect, vi, afterEach } from 'vitest'
import { lostAnchorsMessage, warnLostAnchors } from './lostAnchors'

describe('lostAnchors', () => {
  afterEach(() => vi.restoreAllMocks())

  it('нет пропаж или новостей — без предупреждения', () => {
    expect(lostAnchorsMessage(undefined)).toBeNull()
    expect(lostAnchorsMessage({ keys: ['title'], news: [] })).toBeNull()
  })

  it('ключи и новости (не больше пяти, остальные — числом)', () => {
    const news = Array.from({ length: 7 }, (_, i) => ({ id: String(i), title: `Новость ${i + 1}` }))
    const message = lostAnchorsMessage({ keys: ['title', 'photo'], news })!
    expect(message).toContain('(title, photo)')
    expect(message).toContain('«Новость 5»')
    expect(message).not.toContain('«Новость 6»')
    expect(message).toContain('и ещё 2')
  })

  it('warnLostAnchors показывает предупреждение и отдаёт ответ без изменений', () => {
    const alert = vi.fn()
    vi.stubGlobal('window', { alert })
    const response = { id: 'b', _lostAnchors: { keys: ['title'], news: [{ id: 'n', title: 'Н' }] } }
    expect(warnLostAnchors(response)).toBe(response)
    expect(alert).toHaveBeenCalledTimes(1)
    expect(warnLostAnchors({ id: 'b' })).toEqual({ id: 'b' })
    expect(alert).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
