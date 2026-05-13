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
