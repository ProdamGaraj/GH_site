// @vitest-environment jsdom
/**
 * Инлайн-стили узла на канвасе экрана: viewport-единицы считаются от экрана
 * канваса, а не от окна редактора. Баг: hero-секция с `min-height: 100svh` на
 * канвасе телефона была высотой с окно редактора (два «экрана»), фон слайда
 * растягивался.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@/app/hooks', () => ({ useAppSelector: (select: () => unknown) => select() }))
vi.mock('../editorSlice', () => ({
  selectViewport: () => 'mobile',
  selectBreakpoints: () => [
    { id: 'desktop-hd', name: 'Desktop HD', width: 1440, height: 900 },
    { id: 'mobile', name: 'Mobile', width: 375, height: 667 },
  ],
  // «Хром» браузера: видимая высота телефона = 667 − 160 = 507.
  selectEffectiveBrowserOffset: () => 160,
}))

import { useComputedStyles } from './useComputedStyles'

const node = (properties: Record<string, unknown>) =>
  ({ id: 'n', tagName: 'section', elementType: 'container', attributes: {}, children: [], metadata: {}, styles: { properties } }) as any

const styles = (properties: Record<string, unknown>) =>
  renderHook(() => useComputedStyles(node(properties))).result.current as Record<string, unknown>

describe('useComputedStyles — viewport-единицы от экрана канваса', () => {
  it('100svh / 100dvh / 100vh — видимая высота экрана', () => {
    expect(styles({ minHeight: '100svh' }).minHeight).toBe('507px')
    expect(styles({ minHeight: '100dvh' }).minHeight).toBe('507px')
    expect(styles({ minHeight: '100vh' }).minHeight).toBe('507px')
  })

  it('vw — от ширины экрана; vh и vw в одном значении — оба', () => {
    expect(styles({ width: '50vw' }).width).toBe('187.5px')
    expect(styles({ minHeight: 'calc(100svh - 4vw)' }).minHeight).toBe('calc(507px - 15px)')
  })

  it('значения без viewport-единиц и нестроковые — как есть', () => {
    expect(styles({ width: '100%', opacity: 0.5, gap: 'clamp(16px, 2rem, 28px)' })).toMatchObject({
      width: '100%',
      opacity: 0.5,
      gap: 'clamp(16px, 2rem, 28px)',
    })
  })
})
