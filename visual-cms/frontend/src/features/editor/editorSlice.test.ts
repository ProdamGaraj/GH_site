/**
 * Тесты на reducer'ы editorSlice, добавленные в Phase 5 (carousel work).
 *
 * Покрываем:
 *   - replaceChildren — атомарная замена children в одном history-step,
 *     корректное no-op если parentId не найден, защита от responsive-режима.
 *
 * Не покрываем legacy-reducers (addNode/deleteNode/...): они были тут до
 * нас и без тестов, расширять scope в этом sprint'е не цель.
 */
import { describe, expect, it } from 'vitest'
import editorReducer, {
  loadEditor,
  replaceChildren,
  duplicateNode,
  copyNode,
  pasteFromClipboard,
  selectNode,
  wrapNodeInLink,
  unwrapNodeFromLink,
} from './editorSlice'
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

const buildTree = (): BlockNode =>
  mk({
    id: 'root',
    children: [
      mk({
        id: 'track',
        attributes: { 'data-carousel-track': 'true' },
        children: [
          mk({ id: 'old-1', metadata: { name: 'Old Slide 1' } }),
          mk({ id: 'old-2' }),
          mk({ id: 'old-3' }),
        ],
      }),
      mk({ id: 'sibling' }),
    ],
  })

const initState = (root: BlockNode) => {
  return editorReducer(undefined, loadEditor(root))
}

describe('editorSlice.replaceChildren', () => {
  it('заменяет children указанного родителя одним массивом', () => {
    const state = initState(buildTree())
    const newChild = mk({ id: 'tpl-new', metadata: { name: 'New Template' } })

    const next = editorReducer(
      state,
      replaceChildren({ parentId: 'track', children: [newChild] })
    )

    const track = next.rootNode!.children[0]
    expect(track.id).toBe('track')
    expect(track.children).toHaveLength(1)
    expect(track.children[0].id).toBe('tpl-new')
    expect(track.children[0].metadata?.name).toBe('New Template')
    // Sibling не тронут
    expect(next.rootNode!.children[1].id).toBe('sibling')
  })

  it('пушит ровно один history-step и помечает dirty', () => {
    const state = initState(buildTree())
    const beforeLen = state.history.length

    const next = editorReducer(
      state,
      replaceChildren({ parentId: 'track', children: [mk({ id: 'x' })] })
    )

    expect(next.history.length).toBe(beforeLen + 1)
    expect(next.historyIndex).toBe(next.history.length - 1)
    expect(next.isDirty).toBe(true)
  })

  it('selectFirst=true выделяет первый из вставленных children', () => {
    const state = initState(buildTree())
    const next = editorReducer(
      state,
      replaceChildren({
        parentId: 'track',
        children: [mk({ id: 'a' }), mk({ id: 'b' })],
        selectFirst: true,
      })
    )
    expect(next.selectedNodeId).toBe('a')
  })

  it('selectFirst=false (по умолчанию) не меняет selectedNodeId', () => {
    const seeded = { ...initState(buildTree()), selectedNodeId: 'sibling' }
    const next = editorReducer(
      seeded,
      replaceChildren({ parentId: 'track', children: [mk({ id: 'a' })] })
    )
    expect(next.selectedNodeId).toBe('sibling')
  })

  it('пустой массив children = очистка трека', () => {
    const state = initState(buildTree())
    const next = editorReducer(
      state,
      replaceChildren({ parentId: 'track', children: [] })
    )
    const track = next.rootNode!.children[0]
    expect(track.children).toHaveLength(0)
  })

  it('no-op (без history-push) если parentId не найден', () => {
    const state = initState(buildTree())
    const beforeLen = state.history.length
    const next = editorReducer(
      state,
      replaceChildren({ parentId: 'does-not-exist', children: [mk({ id: 'x' })] })
    )
    // history не должна расти при не-найденном parentId
    expect(next.history.length).toBe(beforeLen)
    expect(next.isDirty).toBe(state.isDirty)
  })

  it('игнорируется в responsive-режиме (warning, без мутации)', () => {
    const seeded = { ...initState(buildTree()), editMode: 'responsive' as const }
    const beforeLen = seeded.history.length
    const next = editorReducer(
      seeded,
      replaceChildren({ parentId: 'track', children: [mk({ id: 'x' })] })
    )
    // rootNode не должен измениться
    expect(next.rootNode).toBe(seeded.rootNode)
    expect(next.history.length).toBe(beforeLen)
  })
})

/**
 * C1 — клавиатурные действия: duplicate / copy / paste.
 * Тестируем reducer'ы напрямую (без UI keydown-слоя).
 */
describe('editorSlice — C1: duplicate / copy / paste', () => {
  it('duplicateNode: создаёт sibling с новыми id сразу после оригинала', () => {
    const state = initState(buildTree())
    // track имеет children: [old-1, old-2, old-3]; дублируем old-2
    const next = editorReducer(state, duplicateNode('old-2'))
    const track = next.rootNode!.children[0]
    expect(track.children).toHaveLength(4)
    expect(track.children[0].id).toBe('old-1')
    expect(track.children[1].id).toBe('old-2') // оригинал на месте
    // дубликат — следом, с новым id (не равен old-2)
    expect(track.children[2].id).not.toBe('old-2')
    expect(track.children[3].id).toBe('old-3')
    // дубль выбран
    expect(next.selectedNodeId).toBe(track.children[2].id)
    expect(next.isDirty).toBe(true)
  })

  it('duplicateNode: не дублирует root (нет родителя)', () => {
    const state = initState(buildTree())
    const beforeLen = state.history.length
    const next = editorReducer(state, duplicateNode('root'))
    expect(next.history.length).toBe(beforeLen)
    expect(next.rootNode).toBe(state.rootNode)
  })

  it('duplicateNode: вложенные children тоже получают новые id', () => {
    const tree = mk({
      id: 'root',
      children: [
        mk({ id: 'parent', children: [mk({ id: 'child' })] }),
      ],
    })
    const state = initState(tree)
    const next = editorReducer(state, duplicateNode('parent'))
    const dup = next.rootNode!.children[1]
    expect(dup.id).not.toBe('parent')
    expect(dup.children).toHaveLength(1)
    expect(dup.children[0].id).not.toBe('child')
  })

  it('copyNode → pasteFromClipboard: вставляет sibling после selectedNodeId с новым id', () => {
    let s = initState(buildTree())
    s = editorReducer(s, copyNode('old-1'))
    expect(s.clipboard).not.toBeNull()
    expect(s.clipboard!.id).toBe('old-1') // id в буфере — оригинальный

    // Выбираем old-3 и вставляем — должно вставиться siblingом после old-3
    s = editorReducer(s, selectNode('old-3'))
    s = editorReducer(s, pasteFromClipboard())
    const track = s.rootNode!.children[0]
    expect(track.children).toHaveLength(4)
    expect(track.children[2].id).toBe('old-3')
    // вставленный — следом, с НОВЫМ id (перегенерация при paste)
    expect(track.children[3].id).not.toBe('old-1')
    expect(s.selectedNodeId).toBe(track.children[3].id)
  })

  it('pasteFromClipboard: no-op если буфер пуст или нет выбранного', () => {
    const empty = initState(buildTree())
    // Нет выбранного — no-op
    const next1 = editorReducer(empty, pasteFromClipboard())
    expect(next1.rootNode).toBe(empty.rootNode)

    // Выбран, но буфер пуст — тоже no-op
    const withSel = editorReducer(empty, selectNode('old-1'))
    const next2 = editorReducer(withSel, pasteFromClipboard())
    expect(next2.rootNode).toBe(withSel.rootNode)
  })

  it('pasteFromClipboard: при выборе root добавляет последним child root', () => {
    let s = initState(buildTree())
    s = editorReducer(s, copyNode('sibling'))
    s = editorReducer(s, selectNode('root'))
    s = editorReducer(s, pasteFromClipboard())
    // root изначально имел [track, sibling]; теперь должен иметь третьего ребёнка
    expect(s.rootNode!.children).toHaveLength(3)
    expect(s.rootNode!.children[2].id).not.toBe('sibling') // новый id
  })
})

describe('editorSlice — блок-ссылка для void-элементов (wrap/unwrap)', () => {
  /** root → container → img + sibling */
  const buildImgTree = (): BlockNode =>
    mk({
      id: 'root',
      children: [
        mk({
          id: 'container',
          children: [
            mk({ id: 'img-1', elementType: 'image', tagName: 'img', attributes: { src: '/logo.png' } }),
            mk({ id: 'img-sibling' }),
          ],
        }),
      ],
    })

  it('wrapNodeInLink: оборачивает img в <a> с isLinkWrapper на той же позиции', () => {
    const s = editorReducer(initState(buildImgTree()), wrapNodeInLink('img-1'))
    const container = s.rootNode!.children[0]
    expect(container.children).toHaveLength(2)
    const wrapper = container.children[0]
    expect(wrapper.tagName).toBe('a')
    expect(wrapper.metadata?.isLinkWrapper).toBe(true)
    expect(wrapper.children).toHaveLength(1)
    expect(wrapper.children[0].id).toBe('img-1')
    // Sibling остался на месте
    expect(container.children[1].id).toBe('img-sibling')
    expect(s.isDirty).toBe(true)
  })

  it('wrapNodeInLink: повторный вызов на уже обёрнутом — no-op', () => {
    const wrapped = editorReducer(initState(buildImgTree()), wrapNodeInLink('img-1'))
    const next = editorReducer(wrapped, wrapNodeInLink('img-1'))
    expect(next.rootNode).toBe(wrapped.rootNode)
  })

  it('wrapNodeInLink: root и несуществующий узел — no-op', () => {
    const s = initState(buildImgTree())
    expect(editorReducer(s, wrapNodeInLink('root')).rootNode).toBe(s.rootNode)
    expect(editorReducer(s, wrapNodeInLink('no-such')).rootNode).toBe(s.rootNode)
  })

  it('unwrapNodeFromLink: возвращает img на место обёртки и выделяет его', () => {
    const wrapped = editorReducer(initState(buildImgTree()), wrapNodeInLink('img-1'))
    const s = editorReducer(wrapped, unwrapNodeFromLink('img-1'))
    const container = s.rootNode!.children[0]
    expect(container.children).toHaveLength(2)
    expect(container.children[0].id).toBe('img-1')
    expect(container.children[1].id).toBe('img-sibling')
    expect(s.selectedNodeId).toBe('img-1')
  })

  it('unwrapNodeFromLink: не трогает обычный <a>-родитель без isLinkWrapper', () => {
    const tree = mk({
      id: 'root',
      children: [mk({ id: 'manual-a', tagName: 'a', children: [mk({ id: 'img-1', tagName: 'img' })] })],
    })
    const s = initState(tree)
    expect(editorReducer(s, unwrapNodeFromLink('img-1')).rootNode).toBe(s.rootNode)
  })

  it('wrap + unwrap: каждый шаг пушит history-step', () => {
    const s0 = initState(buildImgTree())
    const s1 = editorReducer(s0, wrapNodeInLink('img-1'))
    expect(s1.history.length).toBe(s0.history.length + 1)
    const s2 = editorReducer(s1, unwrapNodeFromLink('img-1'))
    expect(s2.history.length).toBe(s1.history.length + 1)
  })
})
