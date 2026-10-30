// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const { getDeleted, restoreDeleted } = vi.hoisted(() => ({ getDeleted: vi.fn(), restoreDeleted: vi.fn() }))
vi.mock('@/shared/api', () => ({ blockVersionApi: { getDeleted, restoreDeleted } }))

import { DeletedBlocks } from './DeletedBlocks'

describe('DeletedBlocks', () => {
  afterEach(() => {
    cleanup()
    getDeleted.mockReset()
    restoreDeleted.mockReset()
  })

  it('по кнопке — список удалённых; восстановление убирает строку и обновляет библиотеку', async () => {
    getDeleted.mockResolvedValue([{ versionId: 'v9', blockId: 'b1', name: 'Navigation — 2 октября', deletedAt: '2026-10-30T05:00:00Z' }])
    restoreDeleted.mockResolvedValue({ id: 'b1' })
    const onRestored = vi.fn()
    render(<DeletedBlocks onRestored={onRestored} />)
    fireEvent.click(screen.getByText('Удалённые блоки'))
    expect(await screen.findByText('Navigation — 2 октября')).toBeTruthy()
    fireEvent.click(screen.getByText('Восстановить'))
    await waitFor(() => expect(onRestored).toHaveBeenCalled())
    expect(restoreDeleted).toHaveBeenCalledWith('v9')
    expect(screen.queryByText('Navigation — 2 октября')).toBeNull()
  })

  it('пусто — так и сказано', async () => {
    getDeleted.mockResolvedValue([])
    render(<DeletedBlocks onRestored={() => {}} />)
    fireEvent.click(screen.getByText('Удалённые блоки'))
    expect(await screen.findByText('Удалённых блоков нет')).toBeTruthy()
  })
})
