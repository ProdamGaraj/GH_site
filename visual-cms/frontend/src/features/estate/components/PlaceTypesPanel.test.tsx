// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'

vi.mock('../api', () => ({
  estateApi: {
    listPlaceTypes: vi.fn(),
    listMapIcons: vi.fn(),
    updatePlaceType: vi.fn(),
    deletePlaceType: vi.fn(),
    createPlaceType: vi.fn(),
  },
}))

import { estateApi } from '../api'
import { ApiError } from '@/shared/api/http'
import { PlaceTypesPanel } from './PlaceTypesPanel'
import type { PlaceType } from '../types'

const SCHOOL: PlaceType = { key: 'school', nameRu: 'Школа', nameUz: '', nameEn: 'School', icon: 'school', color: '#2f6fdf', order: 10, hidden: false }
const ICONS = [
  { key: 'school', label: 'Школа', svg: '<svg data-icon="school"></svg>' },
  { key: 'trees', label: 'Парк', svg: '<svg data-icon="trees"></svg>' },
  { key: 'map-pin', label: 'Точка', svg: '<svg data-icon="map-pin"></svg>' },
]

async function mount() {
  render(<PlaceTypesPanel />)
  await waitFor(() => expect(screen.getByTestId('type-school')).toBeTruthy())
  return within(screen.getByTestId('type-school'))
}

describe('PlaceTypesPanel', () => {
  beforeEach(() => {
    vi.mocked(estateApi.listPlaceTypes).mockReset().mockResolvedValue([SCHOOL])
    vi.mocked(estateApi.listMapIcons).mockReset().mockResolvedValue(ICONS)
    vi.mocked(estateApi.updatePlaceType).mockReset()
    vi.mocked(estateApi.deletePlaceType).mockReset()
    vi.mocked(estateApi.createPlaceType).mockReset()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('правка: «Сохранить» активна только при изменениях; в запрос — поля без ключа', async () => {
    const row = await mount()
    const save = row.getByLabelText('Сохранить тип') as HTMLButtonElement
    expect(save.disabled).toBe(true)
    vi.mocked(estateApi.updatePlaceType).mockResolvedValue({ ...SCHOOL, nameUz: 'Maktab' })

    fireEvent.change(row.getByLabelText('Название UZ'), { target: { value: 'Maktab' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)

    await waitFor(() => expect(estateApi.updatePlaceType).toHaveBeenCalledTimes(1))
    const [key, body] = vi.mocked(estateApi.updatePlaceType).mock.calls[0]
    expect(key).toBe('school')
    expect(body).toEqual({ nameRu: 'Школа', nameUz: 'Maktab', nameEn: 'School', icon: 'school', color: '#2f6fdf', order: 10, hidden: false })
    expect(body).not.toHaveProperty('key')
  })

  it('кривой цвет или пустое название — сохранить нельзя', async () => {
    const row = await mount()
    fireEvent.change(row.getByLabelText('Цвет, hex'), { target: { value: 'синий' } })
    expect((row.getByLabelText('Сохранить тип') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(row.getByLabelText('Цвет, hex'), { target: { value: '#123456' } })
    fireEvent.change(row.getByLabelText('Название'), { target: { value: ' ' } })
    expect((row.getByLabelText('Сохранить тип') as HTMLButtonElement).disabled).toBe(true)
  })

  it('иконка выбирается из набора estate', async () => {
    const row = await mount()
    fireEvent.click(row.getByLabelText('Иконка: Школа'))
    fireEvent.click(row.getByLabelText('Парк'))
    expect(row.getByLabelText('Иконка: Парк')).toBeTruthy()
    expect((row.getByLabelText('Сохранить тип') as HTMLButtonElement).disabled).toBe(false)
  })

  it('удаление занятого типа: сервер отвечает 409 — показываем ЖК и совет скрыть, строка остаётся', async () => {
    vi.mocked(estateApi.deletePlaceType).mockRejectedValue(
      new ApiError('Тип используется', 409, { details: { complexes: ['Doʼstlik', 'Ozmakon'] } })
    )
    const row = await mount()
    fireEvent.click(row.getByLabelText('Удалить тип'))
    await waitFor(() => expect(window.alert).toHaveBeenCalled())
    const text = vi.mocked(window.alert).mock.calls[0][0] as string
    expect(text).toContain('Doʼstlik, Ozmakon')
    expect(text).toContain('скрыт')
    expect(screen.getByTestId('type-school')).toBeTruthy()
  })

  it('удаление свободного типа убирает строку', async () => {
    vi.mocked(estateApi.deletePlaceType).mockResolvedValue({ ok: true })
    const row = await mount()
    fireEvent.click(row.getByLabelText('Удалить тип'))
    await waitFor(() => expect(screen.queryByTestId('type-school')).toBeNull())
  })

  it('новый тип: ключ проверяется до отправки, занятый ключ — подсказка', async () => {
    await mount()
    const box = within(screen.getByTestId('new-type'))
    const add = box.getByRole('button', { name: /Добавить/ }) as HTMLButtonElement
    fireEvent.change(box.getByLabelText('Название нового типа'), { target: { value: 'Детский клуб' } })

    fireEvent.change(box.getByLabelText('Ключ нового типа'), { target: { value: 'клуб' } })
    expect(box.getByText(/латиница/)).toBeTruthy()
    expect(add.disabled).toBe(true)

    fireEvent.change(box.getByLabelText('Ключ нового типа'), { target: { value: 'school' } })
    expect(box.getByText(/уже есть/)).toBeTruthy()
    expect(add.disabled).toBe(true)

    const created = { ...SCHOOL, key: 'kids-club', nameRu: 'Детский клуб', icon: 'map-pin', color: '#5a6b85', order: 0, nameEn: '' }
    vi.mocked(estateApi.createPlaceType).mockResolvedValue(created)
    fireEvent.change(box.getByLabelText('Ключ нового типа'), { target: { value: 'kids-club' } })
    expect(add.disabled).toBe(false)
    fireEvent.click(add)
    await waitFor(() => expect(screen.getByTestId('type-kids-club')).toBeTruthy())
    expect(vi.mocked(estateApi.createPlaceType).mock.calls[0][0]).toMatchObject({ key: 'kids-club', nameRu: 'Детский клуб' })
  })
})
