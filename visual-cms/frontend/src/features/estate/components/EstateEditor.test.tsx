// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
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

    fireEvent.click(screen.getByRole('button', { name: /Добавить дом/ }))
    await waitFor(() => expect(estateApi.getComplex).toHaveBeenCalledTimes(2))

    // Экрана «Загрузка…» не было: форма та же, черновик на месте.
    expect(screen.queryByText('Загрузка…')).toBeNull()
    expect((screen.getByLabelText('Логотип') as HTMLInputElement).value).toBe('/media/draft-logo.svg')
  })

  it('ошибка повторной загрузки не прячет страницу — видна в полосе', async () => {
    mount()
    await screen.findByLabelText('Логотип')
    vi.mocked(estateApi.getComplex).mockRejectedValueOnce(new Error('estate недоступен'))
    fireEvent.click(screen.getByRole('button', { name: /Добавить дом/ }))
    expect(await screen.findByText('estate недоступен')).toBeTruthy()
    expect(screen.getByLabelText('Логотип')).toBeTruthy()
  })

  it('первая загрузка не удалась — сообщение вместо редактора', async () => {
    vi.mocked(estateApi.getComplex).mockRejectedValue(new Error('Не найден'))
    mount()
    expect(await screen.findByText('Не найден')).toBeTruthy()
  })
})
