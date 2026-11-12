/**
 * Паритет «редактор = сайт» для экранных правок:
 *  - выбранный узел читается с учётом «чужих» записей и каскада экранов
 *    (selectSelectedNode → findNodeInTree → resolveScreenOverrides);
 *  - правка узла на экране сначала собирает «чужие» записи к родителю
 *    (adoptStrayOverrides), иначе более поздняя из них перебила бы правку.
 */
import { describe, expect, it } from 'vitest'
import editorReducer, {
  loadEditor,
  deleteNode,
  selectNode,
  selectSelectedNode,
  setEditMode,
  setActiveEditBreakpoint,
  setNodeMediaOverride,
  setViewport,
  updateNodeStyles,
} from './editorSlice'
import { getEffectiveTree } from './utils/variationUtils'
import type { BlockNode } from '@/shared/types'

const mk = (id: string, overrides: Partial<BlockNode> = {}): BlockNode => ({
  id,
  tag: 'div',
  tagName: 'div',
  elementType: 'container',
  styles: { properties: {} },
  children: [],
  attributes: {},
  metadata: {},
  ...overrides,
})

/**
 * Реальный случай: правку секции promo держит элемент другого блока.
 *
 * page
 * ├─ complexes ─ wrap   (tablet: promo → display:grid — «чужая» запись)
 * └─ promo (display:flex, gridTemplateColumns: 250px 1fr)
 */
const buildTree = (): BlockNode =>
  mk('page', {
    children: [
      mk('complexes', {
        children: [
          mk('wrap', { variations: { tablet: { inheritedOverrides: { promo: { styles: { display: 'grid' } } } } } }),
        ],
      }),
      mk('promo', { styles: { properties: { display: 'flex', gridTemplateColumns: '250px 1fr' } } }),
    ],
  })

const onScreen = (root: BlockNode, bp: string) => {
  let state = editorReducer(undefined, loadEditor(root))
  state = editorReducer(state, setViewport(bp))
  state = editorReducer(state, setEditMode('responsive'))
  state = editorReducer(state, setActiveEditBreakpoint(bp))
  return state
}

const selected = (state: ReturnType<typeof editorReducer>) => selectSelectedNode({ editor: state } as any)

const find = (root: BlockNode, id: string): BlockNode | null => {
  if (root.id === id) return root
  for (const child of root.children) {
    const found = find(child, id)
    if (found) return found
  }
  return null
}
const entry = (root: BlockNode, holderId: string, bp: string, targetId: string) =>
  find(root, holderId)?.variations?.[bp]?.inheritedOverrides?.[targetId]

describe('выбранный узел видит то же, что сайт', () => {
  it('«чужая» планшетная запись видна на планшете', () => {
    const state = editorReducer(onScreen(buildTree(), 'tablet'), selectNode('promo'))
    expect(selected(state)?.styles.properties).toMatchObject({ display: 'grid', gridTemplateColumns: '250px 1fr' })
  })

  it('она же доходит до телефона (каскад экранов)', () => {
    const state = editorReducer(onScreen(buildTree(), 'mobile'), selectNode('promo'))
    expect(selected(state)?.styles.properties.display).toBe('grid')
  })

  it('на Desktop HD и в базовом режиме её нет', () => {
    const hd = editorReducer(onScreen(buildTree(), 'desktop-hd'), selectNode('promo'))
    expect(selected(hd)?.styles.properties.display).toBe('flex')

    const base = editorReducer(editorReducer(undefined, loadEditor(buildTree())), selectNode('promo'))
    expect(selected(base)?.styles.properties.display).toBe('flex')
  })
})

describe('updateNodeStyles — правка перебивает «чужую» запись', () => {
  it('правка на планшете действует: «чужая» запись собрана к родителю', () => {
    let state = editorReducer(onScreen(buildTree(), 'tablet'), selectNode('promo'))
    state = editorReducer(state, updateNodeStyles({ nodeId: 'promo', properties: { display: 'flex' } }))

    const root = state.rootNode!
    expect(entry(root, 'page', 'tablet', 'promo')).toEqual({ styles: { display: 'flex' } })
    expect(entry(root, 'wrap', 'tablet', 'promo')).toBeUndefined()
    expect(selected(state)?.styles.properties.display).toBe('flex')
    expect(state.isDirty).toBe(true)
  })

  it('правка другого свойства сохраняет значение «чужой» записи', () => {
    let state = onScreen(buildTree(), 'tablet')
    state = editorReducer(state, updateNodeStyles({ nodeId: 'promo', properties: { gap: '8px' } }))

    expect(entry(state.rootNode!, 'page', 'tablet', 'promo')).toEqual({ styles: { display: 'grid', gap: '8px' } })
    expect(entry(state.rootNode!, 'wrap', 'tablet', 'promo')).toBeUndefined()
  })

  it('очистка свойства на планшете возвращает базовое значение', () => {
    let state = editorReducer(onScreen(buildTree(), 'tablet'), selectNode('promo'))
    state = editorReducer(state, updateNodeStyles({ nodeId: 'promo', properties: { display: '' } }))

    expect(entry(state.rootNode!, 'page', 'tablet', 'promo')).toEqual({ styles: {} })
    expect(selected(state)?.styles.properties.display).toBe('flex')
  })

  it('правка на телефоне не трогает планшетную «чужую» запись, но перебивает её на телефоне', () => {
    let state = editorReducer(onScreen(buildTree(), 'mobile'), selectNode('promo'))
    state = editorReducer(state, updateNodeStyles({ nodeId: 'promo', properties: { display: 'block' } }))

    const root = state.rootNode!
    expect(entry(root, 'wrap', 'tablet', 'promo')).toEqual({ styles: { display: 'grid' } })
    expect(entry(root, 'page', 'mobile', 'promo')).toEqual({ styles: { display: 'block' } })
    expect(selected(state)?.styles.properties.display).toBe('block')
  })

  it('без «чужих» записей правка пишется как раньше', () => {
    const tree = mk('page', { children: [mk('box', { children: [mk('leaf')] })] })
    let state = onScreen(tree, 'tablet')
    state = editorReducer(state, updateNodeStyles({ nodeId: 'leaf', properties: { color: 'red' } }))
    expect(entry(state.rootNode!, 'box', 'tablet', 'leaf')).toEqual({ styles: { color: 'red' } })
  })
})

describe('deleteNode / setNodeMediaOverride — тоже собирают «чужие» записи', () => {
  it('скрытие на экране: «чужой» display не возвращает узел', () => {
    let state = onScreen(buildTree(), 'tablet')
    state = editorReducer(state, deleteNode('promo'))

    const root = state.rootNode!
    expect(entry(root, 'wrap', 'tablet', 'promo')).toBeUndefined()
    expect(entry(root, 'page', 'tablet', 'promo')?.hidden).toBe(true)
    const tree = getEffectiveTree(root, 'tablet', 'responsive', state.breakpoints)
    expect(tree.children.map((c) => c.id)).toEqual(['complexes'])
  })

  it('медиа-правка экрана собирает «чужую» запись и добавляет картинку', () => {
    const tree = mk('page', {
      children: [
        mk('holder', { variations: { tablet: { inheritedOverrides: { pic: { attributes: { src: '/old.png' } } } } } }),
        mk('pic', { tagName: 'img', attributes: { src: '/base.png' } }),
      ],
    })
    let state = editorReducer(undefined, loadEditor(tree))
    state = editorReducer(state, setNodeMediaOverride({ nodeId: 'pic', breakpoint: 'tablet', slot: 'src', value: '/new.png' }))

    expect(entry(state.rootNode!, 'holder', 'tablet', 'pic')).toBeUndefined()
    expect(entry(state.rootNode!, 'page', 'tablet', 'pic')?.attributes).toEqual({ src: '/new.png' })
  })
})
