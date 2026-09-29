// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

vi.mock('../macroSyncApi', () => ({
  macroSyncApi: { status: vi.fn(), start: vi.fn(), run: vi.fn() },
}))

import { macroSyncApi } from '../macroSyncApi'
import { ProjectSyncButton } from './ProjectSyncButton'

const status = vi.mocked(macroSyncApi.status)
const start = vi.mocked(macroSyncApi.start)
const idle = { configured: true, missing: [], running: false, resumable: null, runs: [{ id: 'r1', status: 'ok' }] } as any

beforeEach(() => {
  status.mockReset().mockResolvedValue(idle)
  start.mockReset().mockResolvedValue({ started: true, resumedFrom: null })
})
afterEach(() => cleanup())

const button = () => screen.getByRole('button', { name: /Синхронизировать проект|Синхронизация идёт/ }) as HTMLButtonElement

describe('ProjectSyncButton', () => {
  it('запускает прогон только по дому проекта', async () => {
    render(<ProjectSyncButton externalHouseId={5139395} />)
    await waitFor(() => expect(button().disabled).toBe(false))
    fireEvent.click(button())
    await waitFor(() => expect(start).toHaveBeenCalledWith({ externalHouseIds: [5139395] }))
  })

  it('без ID дома в MacroCRM — неактивна, в подсказке причина', async () => {
    render(<ProjectSyncButton externalHouseId={null} />)
    await waitFor(() => expect(status).toHaveBeenCalled())
    await waitFor(() => expect(button().title).toMatch(/нет ID дома в MacroCRM/))
    expect(button().disabled).toBe(true)
  })

  it('идёт другой прогон — неактивна, крутится', async () => {
    status.mockResolvedValue({ ...idle, running: true })
    render(<ProjectSyncButton externalHouseId={1} />)
    await waitFor(() => expect(button().textContent).toMatch(/Синхронизация идёт/))
    expect(button().disabled).toBe(true)
  })

  it('прогон закончился — редактор получает сигнал обновить данные', async () => {
    const onFinished = vi.fn()
    // После запуска сервер уже показывает новый завершённый прогон (короткий прогон).
    status.mockResolvedValueOnce(idle).mockResolvedValue({ ...idle, runs: [{ id: 'r2', status: 'ok' }, { id: 'r1' }] })
    render(<ProjectSyncButton externalHouseId={1} onFinished={onFinished} />)
    await waitFor(() => expect(button().disabled).toBe(false))
    fireEvent.click(button())
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1))
  })

  it('ошибка запуска видна рядом с кнопкой', async () => {
    start.mockRejectedValue(new Error('Прогон уже идёт'))
    render(<ProjectSyncButton externalHouseId={1} />)
    await waitFor(() => expect(button().disabled).toBe(false))
    fireEvent.click(button())
    expect(await screen.findByText('Прогон уже идёт')).toBeTruthy()
  })
})
