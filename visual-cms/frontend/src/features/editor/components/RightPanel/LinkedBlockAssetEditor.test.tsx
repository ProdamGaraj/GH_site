// @vitest-environment jsdom
/**
 * «CSS блока» / «JS блока» в редакторе страницы: правка общего CSS/JS
 * библиотечного блока, которому принадлежит выбранный элемент. Реальный
 * editor-reducer — проверяем, что правка доходит до ВСЕХ вставок блока.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import editorReducer, { loadEditor, selectNode } from '@/features/editor/editorSlice'
import type { BlockNode } from '@/shared/types'

// Вкладки узла здесь не нужны.
const { stub } = vi.hoisted(() => ({ stub: () => null }))
vi.mock('./CustomCSSTab', () => ({ CustomCSSTab: stub }))
vi.mock('./ScriptsTab', () => ({ ScriptsTab: stub }))

import { CSSPanel } from './CSSPanel'
import { ScriptsPanel } from './ScriptsPanel'

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

const lead = (id: string) =>
  n(id, {
    tagName: 'section',
    metadata: { linkedBlockId: 'lib-lead', name: 'CallMeBlock', globalCss: '.lead-card{}', globalJs: 'lead()' } as any,
    children: [n(`${id}-form`)],
  })

const pageTree = (): BlockNode =>
  n('page', {
    metadata: { globalCss: '.page{}', globalJs: 'page()' },
    children: [lead('lead-1'), n('plain'), lead('lead-2')],
  })

function setup(selected: string, tree: BlockNode = pageTree()) {
  const store = configureStore({ reducer: { editor: editorReducer } })
  store.dispatch(loadEditor(tree))
  store.dispatch(selectNode(selected))
  return store
}

const findMeta = (root: BlockNode, id: string): any => {
  const find = (x: BlockNode): BlockNode | null => (x.id === id ? x : x.children.map(find).find(Boolean) || null)
  return find(root)?.metadata
}

describe('CSSPanel: CSS библиотечного блока в редакторе страницы', () => {
  afterEach(() => cleanup())

  it('элемент внутри linked-блока → поле «CSS блока «CallMeBlock»» с CSS блока', () => {
    const store = setup('lead-1-form')
    render(<Provider store={store}><CSSPanel editorType="page" /></Provider>)
    const box = screen.getByLabelText('CSS блока «CallMeBlock»') as HTMLTextAreaElement
    expect(box.value).toBe('.lead-card{}')
    // Корневое поле подписано как CSS страницы и показывает CSS страницы.
    expect((screen.getByLabelText('Общий CSS страницы') as HTMLTextAreaElement).value).toBe('.page{}')
  })

  it('сообщает, что блок вставлен несколько раз', () => {
    const store = setup('lead-1')
    render(<Provider store={store}><CSSPanel editorType="page" /></Provider>)
    expect(screen.getByText(/вставлен на эту страницу 2 раз/)).toBeTruthy()
  })

  it('правка пишется во ВСЕ вставки блока; CSS страницы не меняется; страница грязная', () => {
    const store = setup('lead-1-form')
    render(<Provider store={store}><CSSPanel editorType="page" /></Provider>)
    fireEvent.change(screen.getByLabelText('CSS блока «CallMeBlock»'), { target: { value: '.lead-card{color:red}' } })

    const root = store.getState().editor.rootNode!
    expect(findMeta(root, 'lead-1').globalCss).toBe('.lead-card{color:red}')
    expect(findMeta(root, 'lead-2').globalCss).toBe('.lead-card{color:red}')
    expect(findMeta(root, 'page').globalCss).toBe('.page{}')
    expect(store.getState().editor.isDirty).toBe(true)
  })

  it('очистка поля удаляет CSS у всех вставок', () => {
    const store = setup('lead-2')
    render(<Provider store={store}><CSSPanel editorType="page" /></Provider>)
    fireEvent.change(screen.getByLabelText('CSS блока «CallMeBlock»'), { target: { value: '' } })
    const root = store.getState().editor.rootNode!
    expect(findMeta(root, 'lead-1').globalCss).toBeUndefined()
    expect(findMeta(root, 'lead-2').globalCss).toBeUndefined()
  })

  it('обычный элемент страницы → поля CSS блока нет', () => {
    const store = setup('plain')
    render(<Provider store={store}><CSSPanel editorType="page" /></Provider>)
    expect(screen.queryByTestId('linked-block-globalCss')).toBeNull()
    expect(screen.getByLabelText('Общий CSS страницы')).toBeTruthy()
  })

  it('редактор блока → поля CSS вложенного блока нет, корень подписан как CSS блока', () => {
    const store = setup('lead-1-form')
    render(<Provider store={store}><CSSPanel editorType="block" /></Provider>)
    expect(screen.queryByTestId('linked-block-globalCss')).toBeNull()
    expect(screen.getByLabelText('Общий CSS блока')).toBeTruthy()
  })

  it('элемент вложенного блока → поле внутреннего блока', () => {
    const tree = n('page', {
      children: [
        n('catalog', {
          metadata: { linkedBlockId: 'lib-catalog', name: 'Catalog', globalCss: '.catalog{}' } as any,
          children: [
            n('card', {
              metadata: { linkedBlockId: 'lib-card', name: 'Card', globalCss: '.card{}' } as any,
              children: [n('title')],
            }),
          ],
        }),
      ],
    })
    const store = setup('title', tree)
    render(<Provider store={store}><CSSPanel editorType="page" /></Provider>)
    expect((screen.getByLabelText('CSS блока «Card»') as HTMLTextAreaElement).value).toBe('.card{}')
    expect(screen.queryByLabelText('CSS блока «Catalog»')).toBeNull()
  })
})

describe('ScriptsPanel: JS библиотечного блока в редакторе страницы', () => {
  afterEach(() => cleanup())

  it('показывает JS блока и пишет правку во все вставки, не трогая CSS', () => {
    const store = setup('lead-1-form')
    render(<Provider store={store}><ScriptsPanel editorType="page" /></Provider>)
    const box = screen.getByLabelText('JS блока «CallMeBlock»') as HTMLTextAreaElement
    expect(box.value).toBe('lead()')
    fireEvent.change(box, { target: { value: 'lead2()' } })

    const root = store.getState().editor.rootNode!
    expect(findMeta(root, 'lead-1').globalJs).toBe('lead2()')
    expect(findMeta(root, 'lead-2').globalJs).toBe('lead2()')
    expect(findMeta(root, 'lead-1').globalCss).toBe('.lead-card{}')
    expect(findMeta(root, 'page').globalJs).toBe('page()')
  })

  it('обычный элемент → поля JS блока нет', () => {
    const store = setup('plain')
    render(<Provider store={store}><ScriptsPanel editorType="page" /></Provider>)
    expect(screen.queryByTestId('linked-block-globalJs')).toBeNull()
    expect(screen.getByLabelText('Общий JS страницы')).toBeTruthy()
  })
})
