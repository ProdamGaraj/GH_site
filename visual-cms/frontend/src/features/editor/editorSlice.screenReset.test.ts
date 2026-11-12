/**
 * Снятие свойства на экране (updateNodeStyles + unsetInherited).
 *
 * Баг: во вкладке CSS на экране удаляли строку свойства, которое задано в
 * основной версии, — после «Применить» оно возвращалось. Экранная правка умеет
 * только перебивать, поэтому удаление правки ничего не давало: значение снова
 * приходило из основной версии. Теперь такое свойство снимается сбросом
 * (SCREEN_STYLE_RESET), который доезжает и до сайта.
 */
import { describe, expect, it } from 'vitest'
import editorReducer, {
  loadEditor,
  selectNode,
  selectSelectedNode,
  setEditMode,
  setActiveEditBreakpoint,
  setViewport,
  updateNodeStyles,
} from './editorSlice'
import { hideScreenResets, SCREEN_STYLE_RESET, withoutScreenResets } from './utils/screenOverrides'
import { findNodeInTree } from './utils/variationUtils'
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

// page ─ promo (основная версия: display:flex, gridTemplateColumns: 250px 1fr)
const buildTree = (variations?: BlockNode['variations']): BlockNode =>
  mk('page', {
    variations,
    children: [mk('promo', { styles: { properties: { display: 'flex', gridTemplateColumns: '250px 1fr' } } })],
  })

const onScreen = (root: BlockNode, bp: string) => {
  let state = editorReducer(undefined, loadEditor(root))
  state = editorReducer(state, setViewport(bp))
  state = editorReducer(state, setEditMode('responsive'))
  state = editorReducer(state, setActiveEditBreakpoint(bp))
  return editorReducer(state, selectNode('promo'))
}

type State = ReturnType<typeof editorReducer>
// Как видит канвас (и сайт): со значениями сброса.
const effective = (state: State) =>
  findNodeInTree(state.rootNode!, 'promo', state.viewport === 'base' ? null : state.viewport, state.editMode, state.breakpoints)!
    .styles.properties as Record<string, unknown>
// Как видят панели настроек: снятые свойства отсутствуют.
const inPanel = (state: State) => selectSelectedNode({ editor: state } as any)!.styles.properties as Record<string, unknown>
const entry = (state: State, bp: string) => state.rootNode!.variations?.[bp]?.inheritedOverrides?.promo
const viewOn = (state: State, bp: string) => editorReducer(editorReducer(state, setViewport(bp)), setActiveEditBreakpoint(bp))

describe('снятие свойства основной версии на экране', () => {
  it('свойство из основной версии снимается сбросом и больше не «возвращается»', () => {
    let state = onScreen(buildTree(), 'tablet')
    state = editorReducer(state, updateNodeStyles({
      nodeId: 'promo', properties: { gridTemplateColumns: '' }, breakpoint: 'tablet', unsetInherited: true,
    }))

    expect(entry(state, 'tablet')).toEqual({ styles: { gridTemplateColumns: SCREEN_STYLE_RESET } })
    expect(effective(state).gridTemplateColumns).toBe(SCREEN_STYLE_RESET)
    expect(withoutScreenResets(effective(state))).toEqual({ display: 'flex' })
    // В панелях свойства нет — поле пустое.
    expect(inPanel(state)).toEqual({ display: 'flex' })
    expect(state.isDirty).toBe(true)
  })

  it('основная версия не меняется; сброс доходит до телефона, но не до Desktop HD', () => {
    let state = onScreen(buildTree(), 'tablet')
    state = editorReducer(state, updateNodeStyles({
      nodeId: 'promo', properties: { gridTemplateColumns: '' }, breakpoint: 'tablet', unsetInherited: true,
    }))

    expect(state.rootNode!.children[0].styles.properties).toEqual({ display: 'flex', gridTemplateColumns: '250px 1fr' })
    expect(effective(viewOn(state, 'mobile')).gridTemplateColumns).toBe(SCREEN_STYLE_RESET)
    expect(effective(viewOn(state, 'desktop-hd')).gridTemplateColumns).toBe('250px 1fr')
  })

  it('свойство, заданное только правкой этого экрана, просто удаляется', () => {
    let state = onScreen(buildTree({ tablet: { inheritedOverrides: { promo: { styles: { gap: '8px' } } } } }), 'tablet')
    state = editorReducer(state, updateNodeStyles({
      nodeId: 'promo', properties: { gap: '' }, breakpoint: 'tablet', unsetInherited: true,
    }))

    expect(entry(state, 'tablet')).toEqual({ styles: {} })
    expect('gap' in effective(state)).toBe(false)
  })

  it('правка экрана поверх основной версии: удаление снимает свойство, а не открывает основное значение', () => {
    let state = onScreen(buildTree({ tablet: { inheritedOverrides: { promo: { styles: { display: 'grid' } } } } }), 'tablet')
    state = editorReducer(state, updateNodeStyles({
      nodeId: 'promo', properties: { display: '' }, breakpoint: 'tablet', unsetInherited: true,
    }))

    expect(entry(state, 'tablet')).toEqual({ styles: { display: SCREEN_STYLE_RESET } })
  })

  it('свойство пришло с более широкого экрана — тоже снимается', () => {
    let state = onScreen(buildTree({ 'desktop-hd': { inheritedOverrides: { promo: { styles: { color: 'red' } } } } }), 'tablet')
    expect(effective(state).color).toBe('red')

    state = editorReducer(state, updateNodeStyles({
      nodeId: 'promo', properties: { color: '' }, breakpoint: 'tablet', unsetInherited: true,
    }))
    expect(entry(state, 'tablet')).toEqual({ styles: { color: SCREEN_STYLE_RESET } })
    expect(entry(state, 'desktop-hd')).toEqual({ styles: { color: 'red' } })
  })

  it('повторное снятие ничего не меняет', () => {
    const action = updateNodeStyles({
      nodeId: 'promo', properties: { gridTemplateColumns: '' }, breakpoint: 'tablet', unsetInherited: true,
    })
    const once = editorReducer(onScreen(buildTree(), 'tablet'), action)
    const twice = editorReducer(once, action)
    expect(entry(twice, 'tablet')).toEqual(entry(once, 'tablet'))
  })

  it('на телефоне свойство, уже снятое на планшете, повторно не записывается', () => {
    let state = onScreen(buildTree({ tablet: { inheritedOverrides: { promo: { styles: { display: SCREEN_STYLE_RESET } } } } }), 'mobile')
    state = editorReducer(state, updateNodeStyles({
      nodeId: 'promo', properties: { display: '' }, breakpoint: 'mobile', unsetInherited: true,
    }))
    expect(entry(state, 'mobile')).toEqual({ styles: {} })
  })

  it('снятое свойство можно задать заново', () => {
    let state = onScreen(buildTree(), 'tablet')
    state = editorReducer(state, updateNodeStyles({
      nodeId: 'promo', properties: { display: '' }, breakpoint: 'tablet', unsetInherited: true,
    }))
    state = editorReducer(state, updateNodeStyles({ nodeId: 'promo', properties: { display: 'grid' }, breakpoint: 'tablet' }))
    expect(effective(state).display).toBe('grid')
  })

  it('несколько свойств разом: унаследованные снимаются, своё удаляется, остальные не трогаются', () => {
    let state = onScreen(buildTree({ tablet: { inheritedOverrides: { promo: { styles: { gap: '8px', color: 'red' } } } } }), 'tablet')
    state = editorReducer(state, updateNodeStyles({
      nodeId: 'promo',
      properties: { display: '', gridTemplateColumns: '', gap: '' },
      breakpoint: 'tablet',
      unsetInherited: true,
    }))
    expect(entry(state, 'tablet')).toEqual({
      styles: { color: 'red', display: SCREEN_STYLE_RESET, gridTemplateColumns: SCREEN_STYLE_RESET },
    })
  })
})

describe('без флага поведение прежнее', () => {
  it('пустое значение убирает правку экрана — свойство снова берётся из основной версии', () => {
    let state = onScreen(buildTree({ tablet: { inheritedOverrides: { promo: { styles: { display: 'grid' } } } } }), 'tablet')
    state = editorReducer(state, updateNodeStyles({ nodeId: 'promo', properties: { display: '' }, breakpoint: 'tablet' }))

    expect(entry(state, 'tablet')).toEqual({ styles: {} })
    expect(effective(state).display).toBe('flex')
  })

  it('в основном режиме флаг ничего не добавляет: свойство удаляется из узла', () => {
    let state = editorReducer(editorReducer(undefined, loadEditor(buildTree())), selectNode('promo'))
    state = editorReducer(state, updateNodeStyles({
      nodeId: 'promo', properties: { gridTemplateColumns: '' }, breakpoint: 'base', unsetInherited: true,
    }))
    expect(state.rootNode!.children[0].styles.properties).toEqual({ display: 'flex' })
    expect(state.rootNode!.variations).toBeUndefined()
  })
})

describe("очистка поля в панели на экране (пустое значение)", () => {
  const clear = (state: State, key: string) =>
    editorReducer(state, updateNodeStyles({ nodeId: 'promo', properties: { [key]: '' }, breakpoint: 'tablet', unsetInherited: true }))
  const type = (state: State, key: string, value: string) =>
    editorReducer(state, updateNodeStyles({ nodeId: 'promo', properties: { [key]: value }, breakpoint: 'tablet', unsetInherited: true }))

  it('очищенное поле остаётся пустым, а не возвращает значение основной версии', () => {
    const state = clear(onScreen(buildTree(), 'tablet'), 'gridTemplateColumns')
    expect(inPanel(state).gridTemplateColumns).toBeUndefined()
  })

  it('стёрли всё и набрали новое значение — остаётся только новое', () => {
    let state = clear(onScreen(buildTree(), 'tablet'), 'gridTemplateColumns')
    state = type(state, 'gridTemplateColumns', '1')
    state = type(state, 'gridTemplateColumns', '1fr')
    expect(entry(state, 'tablet')).toEqual({ styles: { gridTemplateColumns: '1fr' } })
    expect(inPanel(state).gridTemplateColumns).toBe('1fr')
  })

  it('пробел в значении сохраняется при наборе', () => {
    let state = type(onScreen(buildTree(), 'tablet'), 'gridTemplateColumns', '1fr ')
    expect(inPanel(state).gridTemplateColumns).toBe('1fr ')
    state = type(state, 'gridTemplateColumns', '1fr 2fr')
    expect(inPanel(state).gridTemplateColumns).toBe('1fr 2fr')
  })

  it('undefined — служебная уборка, сброс не пишет (padding при правке paddingTop)', () => {
    const tree = mk('page', { children: [mk('promo', { styles: { properties: { padding: '4px' } } })] })
    const state = editorReducer(onScreen(tree, 'tablet'), updateNodeStyles({
      nodeId: 'promo',
      properties: { paddingTop: '10px', padding: undefined },
      breakpoint: 'tablet',
      unsetInherited: true,
    }))
    expect(entry(state, 'tablet')).toEqual({ styles: { paddingTop: '10px' } })
    expect(effective(state)).toEqual({ padding: '4px', paddingTop: '10px' })
  })
})

describe('hideScreenResets', () => {
  it('убирает снятые свойства, остальной узел не трогает', () => {
    const node = mk('a', { styles: { properties: { display: SCREEN_STYLE_RESET, color: 'red' }, customCSS: 'x' } as any })
    const out = hideScreenResets(node)
    expect(out.styles.properties).toEqual({ color: 'red' })
    expect(out.styles.customCSS).toBe('x')
    expect(node.styles.properties).toEqual({ display: SCREEN_STYLE_RESET, color: 'red' })
  })

  it('без снятых свойств возвращает тот же узел', () => {
    const node = mk('a', { styles: { properties: { color: 'red' } } })
    expect(hideScreenResets(node)).toBe(node)
  })
})

describe('withoutScreenResets', () => {
  it('убирает только снятые свойства', () => {
    expect(withoutScreenResets({ display: SCREEN_STYLE_RESET, color: 'red', gap: '0' })).toEqual({ color: 'red', gap: '0' })
    expect(withoutScreenResets(undefined)).toEqual({})
  })
})
