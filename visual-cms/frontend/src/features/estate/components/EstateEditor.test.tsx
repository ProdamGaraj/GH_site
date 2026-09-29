// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../api', () => ({
  estateApi: {
    getComplex: vi.fn(),
    listPlaceTypes: vi.fn(async () => []),
    previewPlanGroups: vi.fn(async () => ({
      config: {},
      typesCount: 0,
      cardsCount: 0,
      groups: [],
      warnings: { duplicateNames: [], unknownNames: [] },
    })),
    createHouse: vi.fn(async () => ({ id: 'h2' })),
    updateComplex: vi.fn(async () => ({ ok: true })),
  },
}))
vi.mock('../macroSyncApi', () => ({
  macroSyncApi: {
    status: vi.fn(async () => ({ configured: true, missing: [], running: false, resumable: null, runs: [] })),
    start: vi.fn(),
  },
}))
vi.mock('@/features/media/MediaPicker', () => ({ MediaPicker: () => null }))
vi.mock('@/features/media/useProjectVariantWidths', () => ({ useProjectVariantWidths: () => [] }))

import { estateApi } from '../api'
import { testComplex } from '../testComplex.fixture'
import { EstateEditor } from './EstateEditor'

/** «Добавить дом»: ID из MacroCRM и кнопка. */
function addHouse(externalId: string) {
  const form = screen.getByTestId('add-house')
  fireEvent.change(within(form).getByRole('spinbutton'), { target: { value: externalId } })
  fireEvent.click(within(form).getByRole('button', { name: /Добавить дом/ }))
}

function mount() {
  render(
    <MemoryRouter initialEntries={['/estate/c1']}>
      <Routes>
        <Route path="/estate/:id" element={<EstateEditor />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.mocked(estateApi.getComplex).mockReset().mockResolvedValue(testComplex())
})
afterEach(() => cleanup())

describe('EstateEditor', () => {
  it('в закреплённой полосе — кнопка синхронизации проекта рядом с «Сохранить ЖК»', async () => {
    mount()
    const bar = await screen.findByTestId('estate-actions')
    expect(bar.parentElement!.textContent).toMatch(/Синхронизировать проект/)
    expect(bar.textContent).toMatch(/Сохранить ЖК/)
  })

  it('повторная загрузка (добавили дом) не стирает несохранённые правки формы ЖК', async () => {
    mount()
    const logo = (await screen.findByLabelText('Логотип')) as HTMLInputElement
    fireEvent.change(logo, { target: { value: '/media/draft-logo.svg' } })

    addHouse('5622025')
    await waitFor(() => expect(estateApi.getComplex).toHaveBeenCalledTimes(2))
    expect(estateApi.createHouse).toHaveBeenCalledWith('c1', { externalId: 5622025, name: '', order: 0 })

    // Экрана «Загрузка…» не было: форма та же, черновик на месте.
    expect(screen.queryByText('Загрузка…')).toBeNull()
    expect((screen.getByLabelText('Логотип') as HTMLInputElement).value).toBe('/media/draft-logo.svg')
  })

  it('ошибка повторной загрузки не прячет страницу — видна в полосе', async () => {
    mount()
    await screen.findByLabelText('Логотип')
    vi.mocked(estateApi.getComplex).mockRejectedValueOnce(new Error('estate недоступен'))
    addHouse('5622025')
    expect(await screen.findByText('estate недоступен')).toBeTruthy()
    expect(screen.getByLabelText('Логотип')).toBeTruthy()
  })

  it('«Добавить дом» без ID из CRM недоступен; занятый ID — сообщение сервера', async () => {
    mount()
    const form = await screen.findByTestId('add-house')
    expect((within(form).getByRole('button', { name: /Добавить дом/ }) as HTMLButtonElement).disabled).toBe(true)
    vi.mocked(estateApi.createHouse).mockRejectedValueOnce(
      new Error('Дом с ID 5622025 из MacroCRM уже есть: «Дустлик-4» в проекте «Doʼstlik»')
    )
    addHouse('5622025')
    expect(await within(form).findByText(/уже есть: «Дустлик-4»/)).toBeTruthy()
  })

  it('кнопка проекта синхронизирует его дома с ID из CRM', async () => {
    vi.mocked(estateApi.getComplex).mockResolvedValue(
      testComplex({
        houses: [
          { id: 'h1', externalId: 5622025, apartments: [] },
          { id: 'h2', externalId: null, apartments: [] },
        ] as any,
      })
    )
    mount()
    const sync = (await screen.findByRole('button', { name: /Синхронизировать проект/ })) as HTMLButtonElement
    await waitFor(() => expect(sync.disabled).toBe(false))
  })

  it('первая загрузка не удалась — сообщение вместо редактора', async () => {
    vi.mocked(estateApi.getComplex).mockRejectedValue(new Error('Не найден'))
    mount()
    expect(await screen.findByText('Не найден')).toBeTruthy()
  })
})
