// @vitest-environment jsdom
/**
 * Вкладка «CSS код»: основная версия + блок @media на каждый экран — всегда,
 * какой бы экран ни был открыт на канвасе. Реальный editor-reducer; Monaco
 * заменён обычным textarea.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
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
    variations: { tablet: { inheritedOverrides: { promo: { styles: { display: 'grid' } } } } },
    children: [
      n('promo', { styles: { properties: { display: 'flex', gridTemplateColumns: '250px 1fr' } } }),
      n('other', { styles: { properties: { color: 'red' } } }),
    ],
  })

// Экраны редактора по умолчанию: FHD 1920, HD 1440, Tablet 768, Mobile 375.
const FULL = [
  '  display: flex;',
  '  grid-template-columns: 250px 1fr;',
  '',
  '/* Desktop FHD (1920px) */',
  '@media (min-width: 1920px) {',
  '}',
  '',
  '/* Desktop HD (1440px) */',
  '@media (max-width: 1919px) {',
  '}',
  '',
  '/* Tablet (768px) */',
  '@media (max-width: 1439px) {',
  '  display: grid;',
  '}',
  '',
  '/* Mobile (375px) */',
  '@media (max-width: 767px) {',
  '}',
].join('\n')

function setup(bp: string | null, selected = 'promo') {
  const store = configureStore({ reducer: { editor: editorReducer } })
  store.dispatch(loadEditor(tree()))
  if (bp) {
    store.dispatch(setViewport(bp))
    store.dispatch(setEditMode('responsive'))
    store.dispatch(setActiveEditBreakpoint(bp))
  }
  store.dispatch(selectNode(selected))
  return store
}

// Как в панели: вкладка получает выбранный узел.
const Harness = () => {
  const node = useAppSelector(selectSelectedNode)
  return node ? <CustomCSSTab node={node} /> : null
}

const mount = (store: ReturnType<typeof setup>) =>
  render(<Provider store={store}><Harness /></Provider>)

const text = () => (screen.getByLabelText('css') as HTMLTextAreaElement).value
const type = (css: string) => fireEvent.change(screen.getByLabelText('css'), { target: { value: css } })
const apply = (css: string) => {
  type(css)
  fireEvent.click(screen.getByText('Применить'))
}
const root = (store: ReturnType<typeof setup>) => store.getState().editor.rootNode!
const promoBase = (store: ReturnType<typeof setup>) => root(store).children[0].styles.properties
const screenEntry = (store: ReturnType<typeof setup>, bp: string) =>
  root(store).variations?.[bp]?.inheritedOverrides?.promo

describe('CustomCSSTab — основная версия и экраны одним текстом', () => {
  afterEach(() => cleanup())

  it('основной режим: показывает основную версию и блоки всех экранов', () => {
    mount(setup(null))
    expect(text()).toBe(FULL)
  })

  it('на любом экране текст тот же: основная версия не смешана с правками экрана', () => {
    for (const bp of ['tablet', 'mobile', 'desktop-fhd']) {
      mount(setup(bp))
      expect(text()).toBe(FULL)
      cleanup()
    }
  })

  it('правка блока экрана пишется в этот экран, даже когда открыт другой', () => {
    const store = setup('mobile')
    mount(store)
    apply(FULL.replace('  display: grid;', '  display: block;\n  gap: 4px;'))

    expect(screenEntry(store, 'tablet')).toEqual({ styles: { display: 'block', gap: '4px' } })
    expect(screenEntry(store, 'mobile')).toBeUndefined()
    expect(promoBase(store)).toEqual({ display: 'flex', gridTemplateColumns: '250px 1fr' })
    expect(store.getState().editor.isDirty).toBe(true)
  })

  it('правка основной версии с экрана меняет основную версию, а не экран', () => {
    const store = setup('tablet')
    mount(store)
    apply(FULL.replace('  grid-template-columns: 250px 1fr;\n', ''))

    expect(promoBase(store)).toEqual({ display: 'flex' })
    expect(screenEntry(store, 'tablet')).toEqual({ styles: { display: 'grid' } })
    // Удалённая строка не возвращается.
    expect(text()).not.toContain('grid-template-columns')
  })

  it('строка, удалённая из блока экрана, снимает правку и не возвращается', () => {
    const store = setup('tablet')
    mount(store)
    apply(FULL.replace('  display: grid;\n', ''))

    expect(screenEntry(store, 'tablet')).toBeUndefined()
    expect(text()).toBe(FULL.replace('  display: grid;\n', ''))
  })

  it('свойство можно убрать на одном экране сбросом revert', () => {
    const store = setup('tablet')
    mount(store)
    apply(FULL.replace('  display: grid;', '  display: grid;\n  grid-template-columns: revert;'))

    expect(screenEntry(store, 'tablet')).toEqual({ styles: { display: 'grid', gridTemplateColumns: 'revert' } })
    expect(promoBase(store).gridTemplateColumns).toBe('250px 1fr')
    expect(text()).toContain('  grid-template-columns: revert;')
  })

  it('ошибка разбора: ничего не применяется, текст и сообщение остаются', () => {
    const store = setup(null)
    mount(store)
    const broken = `${FULL}\n@media (max-width: 900px) {\n  color: red;\n}`
    apply(broken)

    expect(screen.getByText(/Нет экрана с условием @media \(max-width: 900px\)/)).toBeTruthy()
    expect(text()).toBe(broken)
    expect(promoBase(store)).toEqual({ display: 'flex', gridTemplateColumns: '250px 1fr' })
    expect(store.getState().editor.isDirty).toBe(false)
  })

  it('после исправления ошибки текст применяется и сообщение исчезает', () => {
    const store = setup(null)
    mount(store)
    apply('color red')
    expect(screen.getByText(/не удалось разобрать/)).toBeTruthy()

    apply('  color: red;')
    expect(screen.queryByText(/не удалось разобрать/)).toBeNull()
    expect(promoBase(store)).toEqual({ color: 'red' })
  })

  it('«Применить» без правок не помечает страницу изменённой', () => {
    const store = setup('tablet')
    mount(store)
    fireEvent.click(screen.getByText('Применить'))
    expect(store.getState().editor.isDirty).toBe(false)
  })

  it('«Форматировать» приводит текст к каноническому виду', () => {
    mount(setup(null))
    type('display:flex;grid-template-columns:250px 1fr\n@media (max-width:1439px){display:grid}')
    fireEvent.click(screen.getByTitle('Форматировать'))
    expect(text()).toBe(FULL)
  })

  it('выбор другого элемента сбрасывает несохранённый текст прежнего', () => {
    const store = setup(null)
    mount(store)
    type('  display: block;')
    act(() => {
      store.dispatch(selectNode('other'))
    })
    expect(text().startsWith('  color: red;')).toBe(true)
  })

  it('корень страницы: только свойства, без блоков экранов', () => {
    const store = setup('tablet', 'page')
    mount(store)
    expect(text()).toBe('')
    apply('  color: blue;')
    expect(root(store).styles.properties).toEqual({ color: 'blue' })
    expect(text()).toBe('  color: blue;')
  })
})
