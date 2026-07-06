/**
 * Тесты фикса «сломалось удаление элементов» (C1/C4):
 *
 *  - deleteNode в responsive-режиме пишет hidden-override в variations
 *    РОДИТЕЛЯ (раньше — всегда в root, а рендер читает из родителя →
 *    удаление глубоких элементов было тихим no-op);
 *  - deleteNode по несуществующему id (клон repeater'а) не трогает
 *    history/isDirty;
 *  - selectNode маппит id клона repeater'а (`X-clone-N`) на узел-шаблон;
 *  - normalizeLegacyRootOverrides переносит легаси root-overrides к родителям
 *    (вызывается из loadEditor).
 */
import { describe, expect, it } from 'vitest'
import editorReducer, {
  loadEditor,
  deleteNode,
  selectNode,
  setEditMode,
  setActiveEditBreakpoint,
} from './editorSlice'
import { getEffectiveTree, normalizeLegacyRootOverrides } from './utils/variationUtils'
import type { BlockNode } from '@/shared/types'

const mk = (overrides: Partial<BlockNode> = {}): BlockNode => ({
  id: 'n',
  tag: 'div',
  tagName: 'div',
  elementType: 'container',
  styles: { properties: {} },
  children: [],
  attributes: {},
  metadata: {},
  ...overrides,
})

// root → section → wrapper → leaf (leaf — «глубокий» элемент)
const buildTree = (): BlockNode =>
  mk({
    id: 'root',
    children: [
      mk({
        id: 'section',
        children: [
          mk({
            id: 'wrapper',
            children: [mk({ id: 'leaf', tagName: 'p', elementType: 'text' })],
          }),
        ],
      }),
      mk({ id: 'top-child' }),
    ],
  })

const initState = (root: BlockNode) => editorReducer(undefined, loadEditor(root))

const responsiveState = (root: BlockNode, bp = 'mobile') => {
  let state = initState(root)
  state = editorReducer(state, setEditMode('responsive'))
  state = editorReducer(state, setActiveEditBreakpoint(bp))
  return state
}

describe('deleteNode — responsive режим', () => {
  it('глубокий элемент: hidden-override пишется в variations РОДИТЕЛЯ, не root', () => {
    const state = responsiveState(buildTree())
    const next = editorReducer(state, deleteNode('leaf'))

    const root = next.rootNode!
    const wrapper = root.children[0].children[0]
    expect(wrapper.variations?.mobile?.inheritedOverrides?.leaf?.hidden).toBe(true)
    // На root ничего не записано
    expect(root.variations?.mobile?.inheritedOverrides?.leaf).toBeUndefined()
    expect(next.isDirty).toBe(true)
    expect(next.selectedNodeId).toBeNull()
  })

  it('скрытый элемент реально пропадает из effective-дерева этого breakpoint', () => {
    const state = responsiveState(buildTree())
    const next = editorReducer(state, deleteNode('leaf'))

    const effective = getEffectiveTree(next.rootNode!, 'mobile', 'responsive')
    const wrapper = effective.children[0].children[0]
    expect(wrapper.children.find(c => c.id === 'leaf')).toBeUndefined()

    // В base-режиме элемент остаётся (удалили только для mobile)
    const base = getEffectiveTree(next.rootNode!, null, 'base')
    expect(base.children[0].children[0].children.find(c => c.id === 'leaf')).toBeDefined()
  })

  it('прямой ребёнок root: override пишется в root (root и есть родитель)', () => {
    const state = responsiveState(buildTree())
    const next = editorReducer(state, deleteNode('top-child'))
    expect(next.rootNode!.variations?.mobile?.inheritedOverrides?.['top-child']?.hidden).toBe(true)
  })
})

describe('deleteNode — base режим', () => {
  it('удаляет узел из дерева и пишет history', () => {
    const state = initState(buildTree())
    const historyBefore = state.history.length
    const next = editorReducer(state, deleteNode('wrapper'))

    expect(next.rootNode!.children[0].children).toHaveLength(0)
    expect(next.history.length).toBe(historyBefore + 1)
    expect(next.isDirty).toBe(true)
  })

  it('несуществующий id (клон repeater) — полный no-op: без history и dirty', () => {
    const state = initState(buildTree())
    const next = editorReducer(state, deleteNode('leaf-clone-0'))

    expect(next.history.length).toBe(state.history.length)
    expect(next.isDirty).toBe(false)
    // Дерево не изменилось
    expect(next.rootNode!.children[0].children[0].children[0].id).toBe('leaf')
  })
})

describe('selectNode — нормализация id клонов repeater', () => {
  it('id клона `leaf-clone-2` маппится на узел-шаблон leaf', () => {
    const state = initState(buildTree())
    const next = editorReducer(state, selectNode('leaf-clone-2'))
    expect(next.selectedNodeId).toBe('leaf')
  })

  it('вложенный клон `leaf-clone-2000-clone-1` тоже маппится на шаблон', () => {
    const state = initState(buildTree())
    const next = editorReducer(state, selectNode('leaf-clone-2000-clone-1'))
    expect(next.selectedNodeId).toBe('leaf')
  })

  it('обычный существующий id не трогаем', () => {
    const state = initState(buildTree())
    const next = editorReducer(state, selectNode('wrapper'))
    expect(next.selectedNodeId).toBe('wrapper')
  })

  it('неизвестный id без -clone- остаётся как есть', () => {
    const state = initState(buildTree())
    const next = editorReducer(state, selectNode('ghost'))
    expect(next.selectedNodeId).toBe('ghost')
  })
})

describe('normalizeLegacyRootOverrides', () => {
  it('переносит легаси root-override глубокого узла к родителю', () => {
    const tree = buildTree()
    tree.variations = {
      mobile: { inheritedOverrides: { leaf: { hidden: true } } },
    }

    const fixed = normalizeLegacyRootOverrides(tree)
    expect(fixed.variations?.mobile?.inheritedOverrides?.leaf).toBeUndefined()
    const wrapper = fixed.children[0].children[0]
    expect(wrapper.variations?.mobile?.inheritedOverrides?.leaf?.hidden).toBe(true)
  })

  it('override прямого ребёнка root остаётся на root', () => {
    const tree = buildTree()
    tree.variations = {
      mobile: { inheritedOverrides: { 'top-child': { hidden: true } } },
    }
    const fixed = normalizeLegacyRootOverrides(tree)
    expect(fixed.variations?.mobile?.inheritedOverrides?.['top-child']?.hidden).toBe(true)
    // Ничего не переносили — возвращён исходный объект
    expect(fixed).toBe(tree)
  })

  it('при конфликте приоритет у существующего override родителя', () => {
    const tree = buildTree()
    tree.variations = {
      mobile: { inheritedOverrides: { leaf: { styles: { display: 'none' } } } },
    }
    const wrapper = tree.children[0].children[0]
    wrapper.variations = {
      mobile: { inheritedOverrides: { leaf: { styles: { display: 'flex' } } } },
    }

    const fixed = normalizeLegacyRootOverrides(tree)
    const fixedWrapper = fixed.children[0].children[0]
    expect(fixedWrapper.variations?.mobile?.inheritedOverrides?.leaf?.styles?.display).toBe('flex')
  })

  it('loadEditor прогоняет структуру через миграцию', () => {
    const tree = buildTree()
    tree.variations = {
      mobile: { inheritedOverrides: { leaf: { hidden: true } } },
    }
    const state = initState(tree)
    const wrapper = state.rootNode!.children[0].children[0]
    expect(wrapper.variations?.mobile?.inheritedOverrides?.leaf?.hidden).toBe(true)
    expect(state.rootNode!.variations?.mobile?.inheritedOverrides?.leaf).toBeUndefined()
  })

  it('структура без variations возвращается как есть', () => {
    const tree = buildTree()
    expect(normalizeLegacyRootOverrides(tree)).toBe(tree)
  })
})
