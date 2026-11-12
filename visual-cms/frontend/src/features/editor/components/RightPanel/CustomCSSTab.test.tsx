// @vitest-environment jsdom
/**
 * Вкладка CSS на экране: удалённая строка свойства основной версии не должна
 * возвращаться после «Применить». Реальный editor-reducer; Monaco заменён
 * обычным textarea.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import editorReducer, {
  loadEditor,
  selectNode,
  selectSelectedNode,
  setActiveEditBreakpoint,
  setEditMode,
  setViewport,
} from '@/features/editor/editorSlice'
import { useAppSelector } from '@/app/hooks'
import { SCREEN_STYLE_RESET } from '@/features/editor/utils/screenOverrides'
import type { BlockNode } from '@/shared/types'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="css" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

import { CustomCSSTab } from './CustomCSSTab'

const n = (id: string, overrides: Partial<BlockNode> = {}): BlockNode =>
  ({
    id,
    tag: 'div',
    tagName: 'div',
    elementType: 'container',
    styles: { properties: {} },
    attributes: {},
    metadata: {},
    children: [],
    ...overrides,
  }) as BlockNode

const tree = (): BlockNode =>
  n('page', {
    children: [n('promo', { styles: { properties: { display: 'flex', gridTemplateColumns: '250px 1fr' } } })],
  })

function setup(bp: string | null) {
  const store = configureStore({ reducer: { editor: editorReducer } })
  store.dispatch(loadEditor(tree()))
  if (bp) {
    store.dispatch(setViewport(bp))
    store.dispatch(setEditMode('responsive'))
    store.dispatch(setActiveEditBreakpoint(bp))
  }
  store.dispatch(selectNode('promo'))
  return store
}

// Как в панели: вкладка получает выбранный узел с итоговыми стилями экрана.
const Harness = () => {
  const node = useAppSelector(selectSelectedNode)
  return node ? <CustomCSSTab node={node} /> : null
}

const mount = (store: ReturnType<typeof setup>) =>
  render(<Provider store={store}><Harness /></Provider>)

const text = () => (screen.getByLabelText('css') as HTMLTextAreaElement).value
const apply = (css: string) => {
  fireEvent.change(screen.getByLabelText('css'), { target: { value: css } })
  fireEvent.click(screen.getByText('Применить'))
}
const tabletEntry = (store: ReturnType<typeof setup>) =>
  store.getState().editor.rootNode!.variations?.tablet?.inheritedOverrides?.promo

describe('CustomCSSTab на экране', () => {
  afterEach(() => cleanup())

  it('показывает стили основной версии', () => {
    mount(setup('tablet'))
    expect(text()).toBe('  display: flex;\n  grid-template-columns: 250px 1fr;')
  })

  it('удалённая строка основной версии не возвращается после «Применить»', () => {
    const store = setup('tablet')
    mount(store)
    apply('  display: flex;')

    expect(text()).toBe('  display: flex;')
    expect(tabletEntry(store)?.styles).toMatchObject({ gridTemplateColumns: SCREEN_STYLE_RESET })
    // Основная версия не тронута.
    expect(store.getState().editor.rootNode!.children[0].styles.properties).toEqual({
      display: 'flex',
      gridTemplateColumns: '250px 1fr',
    })
  })

  it('повторное «Применить» без правок ничего не возвращает', () => {
    const store = setup('tablet')
    mount(store)
    apply('  display: flex;')
    apply('  display: flex;')
    expect(text()).toBe('  display: flex;')
  })

  it('удалённое свойство можно вернуть, вписав строку заново', () => {
    const store = setup('tablet')
    mount(store)
    apply('  display: flex;')
    apply('  display: flex;\n  grid-template-columns: 1fr 1fr;')

    expect(text()).toContain('grid-template-columns: 1fr 1fr;')
    expect(tabletEntry(store)?.styles).toMatchObject({ gridTemplateColumns: '1fr 1fr' })
  })

  it('изменённое значение пишется правкой экрана', () => {
    const store = setup('tablet')
    mount(store)
    apply('  display: grid;\n  grid-template-columns: 250px 1fr;')
    expect(tabletEntry(store)?.styles).toMatchObject({ display: 'grid' })
    expect(text()).toContain('display: grid;')
  })

  it('основной режим: удалённая строка удаляется из узла, сбросов нет', () => {
    const store = setup(null)
    mount(store)
    apply('  display: flex;')

    const root = store.getState().editor.rootNode!
    expect(root.children[0].styles.properties).toEqual({ display: 'flex' })
    expect(root.variations).toBeUndefined()
    expect(text()).toBe('  display: flex;')
  })
})
