// @vitest-environment jsdom
/**
 * Кнопки строки дерева слоёв: «Преобразовать в блок» — у обычного узла,
 * «Копия в библиотеку» — у экземпляра блока библиотеки (у него раньше не
 * было ни одной: карту «Complex location» нельзя было сделать отдельным блоком).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const { createFromElement } = vi.hoisted(() => ({ createFromElement: vi.fn() }))

vi.mock('@/app/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ editor: { selectedNodeId: null, breakpoints: [], rootNode: null } }),
}))
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, isDragging: false }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useMatch: () => ({ params: { id: 'page-1' } }),
}))
vi.mock('@/shared/api', () => ({ blockApi: { createFromElement } }))

import { LayerItem } from './LayerItem'

const node = (metadata: Record<string, unknown>) =>
  ({
    id: '1783408497258_9zasafbc1',
    tagName: 'section',
    elementType: 'container',
    styles: { properties: {} },
    attributes: { class: 'location-section' },
    metadata,
    children: [],
  }) as any

const row = (metadata: Record<string, unknown>) =>
  render(<LayerItem node={node(metadata)} level={2} expandedNodes={new Set()} onToggle={() => {}} parentId="p" index={0} />)

describe('LayerItem: блок из узла', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    createFromElement.mockReset()
  })

  it('обычный узел — «Преобразовать в блок», без копии', () => {
    row({ name: 'section' })
    expect(screen.getByTitle('Преобразовать в блок')).toBeTruthy()
    expect(screen.queryByLabelText('Копия в библиотеку')).toBeNull()
  })

  it('экземпляр блока библиотеки — «Копия в библиотеку»: узел уходит как есть, бэкенд возьмёт исходный блок', async () => {
    createFromElement.mockResolvedValue({ id: 'new-block' })
    vi.spyOn(window, 'prompt').mockReturnValue('Карта')
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    row({ name: 'Complex location', linkedBlockId: 'lib-1' })
    expect(screen.queryByTitle('Преобразовать в блок')).toBeNull()
    fireEvent.click(screen.getByLabelText('Копия в библиотеку'))
    await waitFor(() => expect(createFromElement).toHaveBeenCalledTimes(1))
    const arg = createFromElement.mock.calls[0][0]
    expect(arg.name).toBe('Карта')
    expect(arg.structure.metadata.linkedBlockId).toBe('lib-1')
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringContaining('«Карта» создан')))
  })

  it('отмена названия — ничего не создаётся', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    row({ name: 'Complex location', linkedBlockId: 'lib-1' })
    fireEvent.click(screen.getByLabelText('Копия в библиотеку'))
    expect(createFromElement).not.toHaveBeenCalled()
  })
})
