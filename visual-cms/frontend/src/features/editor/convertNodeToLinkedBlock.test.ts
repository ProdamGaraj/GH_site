import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'

// Мокаем API до импорта слайса (editorSlice импортирует blockApi/pageApi).
const createMock = vi.fn()
const pageUpdateMock = vi.fn()
vi.mock('@/shared/api', () => ({
  blockApi: { create: (...args: unknown[]) => createMock(...args) },
  pageApi: { update: (...args: unknown[]) => pageUpdateMock(...args) },
}))

import editorReducer, { convertNodeToLinkedBlock, loadRootNode } from './editorSlice'
import type { BlockNode } from '@/shared/types'

const makeStore = () => configureStore({ reducer: { editor: editorReducer } })

const node = (overrides: Partial<BlockNode> = {}): BlockNode =>
  ({
    id: 'n1',
    tag: 'section',
    tagName: 'section',
    elementType: 'container',
    styles: { properties: {} },
    attributes: {},
    metadata: { name: 'Промо' },
    children: [{ id: 'c1', tagName: 'p', content: 'текст', children: [], styles: { properties: {} }, attributes: {}, metadata: {} } as BlockNode],
    ...overrides,
  }) as BlockNode

const root = (child: BlockNode): BlockNode =>
  ({
    id: 'root',
    tag: 'div',
    tagName: 'div',
    elementType: 'container',
    styles: { properties: {} },
    attributes: {},
    metadata: {},
    children: [child],
  }) as BlockNode

describe('convertNodeToLinkedBlock', () => {
  beforeEach(() => {
    createMock.mockReset()
    pageUpdateMock.mockReset()
    createMock.mockResolvedValue({ id: 'lib-new' })
    pageUpdateMock.mockResolvedValue({})
  })

  it('создаёт блок, проставляет linkedBlockId на узел и сохраняет страницу', async () => {
    const store = makeStore()
    store.dispatch(loadRootNode(root(node())))

    const res = await store.dispatch(convertNodeToLinkedBlock({ nodeId: 'n1', pageId: 'page-1' })).unwrap()

    expect(res).toEqual({ blockId: 'lib-new', created: true })
    // блок создан из структуры узла, имя сохранено
    expect(createMock).toHaveBeenCalledTimes(1)
    const created = createMock.mock.calls[0][0]
    expect(created.name).toBe('Промо')
    expect(created.isReusable).toBe(true)
    expect(created.structure.children).toHaveLength(1)
    // узел в state получил связь
    const updatedNode = store.getState().editor.rootNode!.children[0]
    expect(updatedNode.metadata?.linkedBlockId).toBe('lib-new')
    // страница сохранена под нужным id, в структуре есть linkedBlockId
    expect(pageUpdateMock).toHaveBeenCalledTimes(1)
    expect(pageUpdateMock.mock.calls[0][0]).toBe('page-1')
    expect(JSON.stringify(pageUpdateMock.mock.calls[0][1].structure)).toContain('lib-new')
  })

  it('срезает linkedBlockId/styleOverrides с корня структуры блока (cleanForLibrary)', async () => {
    const store = makeStore()
    // узел сам по себе не связан, но содержит styleOverrides — в библиотеку он попасть не должен
    const n = node({ metadata: { name: 'Промо', styleOverrides: { x: 1 } } as any })
    store.dispatch(loadRootNode(root(n)))

    await store.dispatch(convertNodeToLinkedBlock({ nodeId: 'n1', pageId: 'page-1' })).unwrap()

    const created = createMock.mock.calls[0][0]
    expect(created.structure.metadata.linkedBlockId).toBeUndefined()
    expect(created.structure.metadata.styleOverrides).toBeUndefined()
  })

  it('guard: уже связанный узел не создаёт дубль, возвращает существующий id', async () => {
    const store = makeStore()
    store.dispatch(loadRootNode(root(node({ metadata: { name: 'Промо', linkedBlockId: 'lib-existing' } }))))

    const res = await store.dispatch(convertNodeToLinkedBlock({ nodeId: 'n1', pageId: 'page-1' })).unwrap()

    expect(res).toEqual({ blockId: 'lib-existing', created: false })
    expect(createMock).not.toHaveBeenCalled()
    expect(pageUpdateMock).not.toHaveBeenCalled()
  })

  it('без pageId отклоняется и НЕ создаёт блок (нельзя связать несохранённую страницу)', async () => {
    const store = makeStore()
    store.dispatch(loadRootNode(root(node())))

    await expect(
      store.dispatch(convertNodeToLinkedBlock({ nodeId: 'n1', pageId: undefined })).unwrap()
    ).rejects.toThrow(/сохраните страницу/i)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('несуществующий узел → отклоняется без создания', async () => {
    const store = makeStore()
    store.dispatch(loadRootNode(root(node())))

    await expect(
      store.dispatch(convertNodeToLinkedBlock({ nodeId: 'missing', pageId: 'page-1' })).unwrap()
    ).rejects.toThrow(/узел не найден/i)
    expect(createMock).not.toHaveBeenCalled()
  })
})
