/**
 * Тесты reducer'а setNodeMediaOverride — запись медиа матрицы «экран × язык»
 * для БАЗОВОГО языка (дерево/variations). Локали пишутся отдельно (переводы).
 */
import { describe, expect, it } from 'vitest'
import editorReducer, { loadEditor, setNodeMediaOverride } from './editorSlice'
import type { BlockNode } from '@/shared/types'

const mk = (o: Partial<BlockNode> = {}): BlockNode => ({
  id: 'n',
  tag: 'div',
  tagName: 'div',
  elementType: 'container',
  styles: { properties: {} },
  children: [],
  attributes: {},
  metadata: {},
  ...o,
})

const tree = (): BlockNode =>
  mk({
    id: 'root',
    children: [
      mk({ id: 'img1', tagName: 'img', elementType: 'image', attributes: { src: '/base.jpg' } }),
      mk({ id: 'hero', styles: { properties: { backgroundImage: 'url("/base.png")' } } }),
    ],
  })

const init = () => editorReducer(undefined, loadEditor(tree()))

function findById(root: BlockNode | null, id: string): BlockNode | undefined {
  if (!root) return undefined
  if (root.id === id) return root
  for (const c of root.children || []) {
    const f = findById(c, id)
    if (f) return f
  }
  return undefined
}

describe('setNodeMediaOverride', () => {
  it('базовый экран + src → пишет attributes.src в сам узел', () => {
    const s = editorReducer(init(), setNodeMediaOverride({ nodeId: 'img1', breakpoint: null, slot: 'src', value: '/x.jpg' }))
    expect(findById(s.rootNode, 'img1')?.attributes.src).toBe('/x.jpg')
    expect(s.isDirty).toBe(true)
  })

  it('экран mobile + src → пишет override в variations родителя (root)', () => {
    const s = editorReducer(init(), setNodeMediaOverride({ nodeId: 'img1', breakpoint: 'mobile', slot: 'src', value: '/m.jpg' }))
    expect(s.rootNode?.variations?.mobile?.inheritedOverrides?.img1?.attributes?.src).toBe('/m.jpg')
    // базовый src не тронут
    expect(findById(s.rootNode, 'img1')?.attributes.src).toBe('/base.jpg')
  })

  it('базовый экран + bg → оборачивает в url() в styles.properties', () => {
    const s = editorReducer(init(), setNodeMediaOverride({ nodeId: 'hero', breakpoint: null, slot: 'bg', value: '/bg.png' }))
    expect(findById(s.rootNode, 'hero')?.styles.properties.backgroundImage).toBe('url("/bg.png")')
  })

  it('экран tablet + bg → override backgroundImage в variations', () => {
    const s = editorReducer(init(), setNodeMediaOverride({ nodeId: 'hero', breakpoint: 'tablet', slot: 'bg', value: '/bgt.png' }))
    expect(s.rootNode?.variations?.tablet?.inheritedOverrides?.hero?.styles?.backgroundImage).toBe('url("/bgt.png")')
  })

  it('пустое значение удаляет базовый src', () => {
    let s = editorReducer(init(), setNodeMediaOverride({ nodeId: 'img1', breakpoint: null, slot: 'src', value: '/x.jpg' }))
    s = editorReducer(s, setNodeMediaOverride({ nodeId: 'img1', breakpoint: null, slot: 'src', value: '' }))
    expect(findById(s.rootNode, 'img1')?.attributes.src).toBeUndefined()
  })
})
