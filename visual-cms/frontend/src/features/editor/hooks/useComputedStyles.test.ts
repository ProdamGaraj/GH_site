// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@/app/hooks', () => ({ useAppSelector: (select: () => unknown) => select() }))
vi.mock('../editorSlice', () => ({
  selectViewport: () => 'desktop',
  selectBreakpoints: () => [],
  selectEffectiveBrowserOffset: () => 0,
}))

import { useComputedStyles } from './useComputedStyles'

const node = (over: Record<string, unknown>) =>
  ({ id: 'n', tagName: 'div', elementType: 'container', attributes: {}, children: [], metadata: {}, styles: { properties: {} }, ...over }) as any

const styles = (n: unknown) => renderHook(() => useComputedStyles(n as any)).result.current

describe('useComputedStyles — инлайн как на сайте', () => {
  it('контейнер без своего display — без инлайн-display: CSS блока (.lead-form { display: grid }) не перебивается', () => {
    for (const tagName of ['div', 'section', 'form', 'article']) {
      expect(styles(node({ tagName, attributes: { class: 'lead-form' } }))).not.toHaveProperty('display')
    }
  })

  it('свой display узла — как есть', () => {
    expect(styles(node({ tagName: 'form', styles: { properties: { display: 'grid', gap: '10px' } } }))).toMatchObject({
      display: 'grid',
      gap: '10px',
    })
  })

  it('режим раскладки без display — как раньше', () => {
    expect(styles(node({ tagName: 'span', elementType: 'text', layoutMode: 'flex' }))).toMatchObject({ display: 'flex' })
  })
})
