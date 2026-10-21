// @vitest-environment jsdom
/**
 * Корень дерева для панели свойств — тот, кого RightPanel пометил isPageRoot.
 * Раньше корнем считался узел с id без дефиса, и у узлов импортированных
 * страниц (id «1783408497258_9zasafbc1») пропадали «Создать блок из
 * элемента» и удаление.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('@/app/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      editor: {
        viewport: 'desktop-hd',
        breakpoints: [{ id: 'desktop-hd', name: 'Desktop HD', width: 1440 }],
        rootNode: { id: 'root', tagName: 'div', children: [] },
        activeRightPanelTab: 'positioning',
      },
    }),
}))
// Вкладки панели здесь не нужны.
const { stub } = vi.hoisted(() => ({ stub: () => null }))
vi.mock('./PositioningTab', () => ({ PositioningTab: stub }))
vi.mock('./ColorsTab', () => ({ ColorsTab: stub }))
vi.mock('./ContentTab', () => ({ ContentTab: stub }))
vi.mock('./CustomCSSTab', () => ({ CustomCSSTab: stub }))
vi.mock('./StatesTab', () => ({ StatesTab: stub }))
vi.mock('./AnimationsTab', () => ({ AnimationsTab: stub }))
vi.mock('./ScriptsTab', () => ({ ScriptsTab: stub }))
vi.mock('@/features/dataBindings/components/SmartDataBindingTab', () => ({ SmartDataBindingTab: stub }))
vi.mock('@/features/dataBindings/components/OutputBindingSubTab', () => ({ OutputBindingSubTab: stub }))
vi.mock('@/features/blocks/components/DetectedFieldsViewer', () => ({ DetectedFieldsViewer: stub }))
vi.mock('@/features/blocks/components/TemplateBlockControls', () => ({ TemplateBlockControls: stub }))

import { PropertiesPanel } from './PropertiesPanel'

const node = (id: string) =>
  ({ id, tagName: 'section', elementType: 'container', styles: { properties: {} }, attributes: {}, metadata: { name: 'section' }, children: [] }) as any

describe('PropertiesPanel: корень дерева', () => {
  afterEach(() => cleanup())

  it('узел с id без дефиса (импорт) — не корень: можно создать блок', () => {
    render(<PropertiesPanel node={node('1783408497258_9zasafbc1')} isPageRoot={false} />)
    expect(screen.getByText('Создать блок из элемента')).toBeTruthy()
  })

  it('корень дерева — без создания блока', () => {
    render(<PropertiesPanel node={node('root')} isPageRoot />)
    expect(screen.queryByText('Создать блок из элемента')).toBeNull()
  })

  it('в режиме редактирования блока создать блок из его элемента нельзя', () => {
    render(<PropertiesPanel node={node('1783408497258_9zasafbc1')} isPageRoot={false} currentBlockData={{ id: 'b1' }} />)
    expect(screen.queryByText('Создать блок из элемента')).toBeNull()
  })
})
