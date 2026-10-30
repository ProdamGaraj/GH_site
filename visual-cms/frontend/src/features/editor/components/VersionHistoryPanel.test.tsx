// @vitest-environment jsdom
/**
 * История версий — общая панель страниц и блоков. У блока версия — его
 * состояние до изменения: видно, когда оно сохранено и когда заменено.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

vi.mock('@/shared/api', () => ({ versionApi: {}, blockVersionApi: {} }))

import { VersionHistoryPanel, type VersionHistoryAdapter, type VersionHistoryItem } from './VersionHistoryPanel'

const VERSIONS: VersionHistoryItem[] = [
  { id: 'v3', version: 3, source: 'restore', savedAt: '2026-10-29T13:14:53Z', createdAt: '2026-10-30T04:28:27Z' },
  { id: 'v2', version: 2, source: 'update', savedAt: '2026-10-09T05:06:49Z', createdAt: '2026-10-29T13:14:53Z' },
  { id: 'v1', version: 1, source: 'initial', label: 'Начало истории', savedAt: '2026-10-09T05:06:49Z', createdAt: '2026-10-30T05:00:00Z' },
]

function adapter(): VersionHistoryAdapter<{ id: string; structure: unknown }> {
  return {
    subjectAccusative: 'блок',
    list: vi.fn(async () => VERSIONS),
    snapshot: vi.fn(async () => ({})),
    restore: vi.fn(async (id: string) => ({ id: 'nav', structure: { restoredFrom: id } })),
    updateLabel: vi.fn(async () => ({})),
    remove: vi.fn(async () => undefined),
  }
}

describe('VersionHistoryPanel (блок)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('версии с источником и временем «сохранено · заменено»; метка вместо номера', async () => {
    render(<VersionHistoryPanel adapter={adapter()} onRestore={() => {}} onClose={() => {}} />)
    expect(await screen.findByText('До изменения')).toBeTruthy()
    expect(screen.getByText('До восстановления')).toBeTruthy()
    expect(screen.getAllByText('Начало истории').length).toBe(2) // метка и тип
    expect(screen.getByTestId('version-2').textContent).toMatch(/сохранено .* · заменено /)
  })

  it('восстановление: подтверждение про блок, адаптер, результат — наружу, список перечитан', async () => {
    const a = adapter()
    const onRestore = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<VersionHistoryPanel adapter={a} onRestore={onRestore} onClose={() => {}} />)
    fireEvent.click(await screen.findByText('v2'))
    fireEvent.click(screen.getByText('Восстановить'))
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith({ id: 'nav', structure: { restoredFrom: 'v2' } }))
    expect(confirm.mock.calls[0][0]).toMatch(/Восстановить блок/)
    expect(a.list).toHaveBeenCalledTimes(2)
  })

  it('отказ в подтверждении — ничего не восстанавливается', async () => {
    const a = adapter()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<VersionHistoryPanel adapter={a} onRestore={() => {}} onClose={() => {}} />)
    fireEvent.click(await screen.findByText('v2'))
    fireEvent.click(screen.getByText('Восстановить'))
    expect(a.restore).not.toHaveBeenCalled()
  })

  it('снимок по кнопке — через адаптер', async () => {
    const a = adapter()
    render(<VersionHistoryPanel adapter={a} onRestore={() => {}} onClose={() => {}} />)
    await screen.findByText('v2')
    fireEvent.click(screen.getByText('Создать снимок'))
    await waitFor(() => expect(a.snapshot).toHaveBeenCalled())
  })
})
