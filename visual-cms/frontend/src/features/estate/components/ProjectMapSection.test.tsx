// @vitest-environment jsdom
import { useEffect, useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api', () => ({
  estateApi: { listPlaceTypes: vi.fn() },
}))

import { estateApi } from '../api'
import { ProjectMapSection } from './ProjectMapSection'
import type { ComplexDetail, Locale, PlaceType } from '../types'

const TYPES: PlaceType[] = [
  { key: 'school', nameRu: 'Школа', nameUz: 'Maktab', nameEn: 'School', icon: 'school', color: '#2f6fdf', order: 10, hidden: false },
  { key: 'park', nameRu: 'Парк', nameUz: '', nameEn: 'Park', icon: 'trees', color: '#3f9b4a', order: 20, hidden: true },
]

const PLACE_ID = '11111111-1111-4111-8111-111111111111'

function complex(extra: Partial<ComplexDetail> = {}): ComplexDetail {
  return {
    id: 'c1',
    translations: {},
    housePoint: { lat: 41.3111, lng: 69.2797 },
    salesOffice: null,
    places: [{ id: PLACE_ID, type: 'school', name: 'Школа №1', lat: 41.312, lng: 69.28 }],
    ...extra,
  } as unknown as ComplexDetail
}

/** Секция с настоящим состоянием формы; последняя версия формы — в form.current. */
function setup(initial: ComplexDetail, locale: Locale = 'ru') {
  const form: { current: ComplexDetail } = { current: initial }
  const Harness = () => {
    const [state, setState] = useState(initial)
    useEffect(() => {
      form.current = state
    }, [state])
    return <ProjectMapSection form={state} setForm={setState} locale={locale} />
  }
  render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>
  )
  return form
}

describe('ProjectMapSection — данные (ru)', () => {
  beforeEach(() => {
    vi.mocked(estateApi.listPlaceTypes).mockReset().mockResolvedValue(TYPES)
  })
  afterEach(() => cleanup())

  it('точка дома: разобранные координаты уходят в форму, кривые — нет, с подсказкой', async () => {
    const form = setup(complex())
    const field = screen.getByLabelText('Точка дома')
    expect((field as HTMLInputElement).value).toBe('41.3111, 69.2797')

    fireEvent.change(field, { target: { value: '41.5, 69.5' } })
    await waitFor(() => expect(form.current.housePoint).toEqual({ lat: 41.5, lng: 69.5 }))

    fireEvent.change(field, { target: { value: '41,5, 69,5' } })
    expect(form.current.housePoint).toEqual({ lat: 41.5, lng: 69.5 })
    expect(screen.getByText(/Не похоже на координаты/)).toBeTruthy()
  })

  it('очищенная точка дома — null (карты на странице не будет)', async () => {
    const form = setup(complex())
    fireEvent.change(screen.getByLabelText('Точка дома'), { target: { value: '' } })
    await waitFor(() => expect(form.current.housePoint).toBeNull())
  })

  it('отдел продаж: адрес доступен только с координатами и хранится вместе с ними', async () => {
    const form = setup(complex())
    expect((screen.getByPlaceholderText('сначала координаты') as HTMLInputElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Отдел продаж'), { target: { value: '41.32, 69.29' } })
    await waitFor(() => expect(form.current.salesOffice).toEqual({ lat: 41.32, lng: 69.29, address: '' }))
    fireEvent.change(screen.getByPlaceholderText('ул. Навои, 1'), { target: { value: 'ул. Навои, 1' } })
    await waitFor(() => expect(form.current.salesOffice).toEqual({ lat: 41.32, lng: 69.29, address: 'ул. Навои, 1' }))
  })

  it('новое место добавляется только целиком: тип, название, координаты', async () => {
    const form = setup(complex({ places: [] }))
    await waitFor(() => expect(screen.getAllByRole('option', { name: 'Школа' }).length).toBeGreaterThan(0))
    const row = screen.getByTestId('new-place')
    const add = within(row).getByRole('button', { name: /Добавить/ })
    expect((add as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(within(row).getByLabelText('Тип места'), { target: { value: 'school' } })
    fireEvent.change(within(row).getByLabelText('Название нового места'), { target: { value: '  Школа №12 ' } })
    fireEvent.change(within(row).getByLabelText('Координаты'), { target: { value: '41.3, 69.2' } })
    expect((add as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(add)

    await waitFor(() => expect(form.current.places).toHaveLength(1))
    expect(form.current.places![0]).toMatchObject({ type: 'school', name: 'Школа №12', lat: 41.3, lng: 69.2 })
    expect(form.current.places![0].id).toMatch(/^[0-9a-f-]{36}$/)
    expect((within(row).getByLabelText('Название нового места') as HTMLInputElement).value).toBe('')
  })

  it('скрытый тип подписан в выборе; удаление и перестановка мест', async () => {
    const second = { id: '22222222-2222-4222-8222-222222222222', type: 'park', name: 'Парк', lat: 41.31, lng: 69.27 }
    const form = setup(complex({ places: [complex().places![0], second] }))
    await waitFor(() => expect(screen.getAllByRole('option', { name: 'Парк (скрыт с карты)' }).length).toBeGreaterThan(0))

    fireEvent.click(within(screen.getByTestId(`place-${PLACE_ID}`)).getByLabelText('Ниже'))
    await waitFor(() => expect(form.current.places!.map((p) => p.name)).toEqual(['Парк', 'Школа №1']))

    fireEvent.click(within(screen.getByTestId(`place-${PLACE_ID}`)).getByLabelText('Удалить место'))
    await waitFor(() => expect(form.current.places!.map((p) => p.name)).toEqual(['Парк']))
  })

  it('пустое название места не принимается: при уходе с поля возвращается прежнее', async () => {
    const form = setup(complex())
    const name = within(screen.getByTestId(`place-${PLACE_ID}`)).getByLabelText('Название места') as HTMLInputElement
    fireEvent.change(name, { target: { value: '   ' } })
    fireEvent.blur(name)
    expect(name.value).toBe('Школа №1')
    expect(form.current.places![0].name).toBe('Школа №1')

    fireEvent.change(name, { target: { value: 'Школа №7' } })
    fireEvent.blur(name)
    await waitFor(() => expect(form.current.places![0].name).toBe('Школа №7'))
  })

  it('типы не загрузились — сообщение, форма работает', async () => {
    vi.mocked(estateApi.listPlaceTypes).mockRejectedValue(new Error('estate недоступен'))
    setup(complex())
    await waitFor(() => expect(screen.getByText('estate недоступен')).toBeTruthy())
    expect(screen.getByLabelText('Точка дома')).toBeTruthy()
  })
})

describe('ProjectMapSection — переводы (uz)', () => {
  beforeEach(() => {
    vi.mocked(estateApi.listPlaceTypes).mockReset().mockResolvedValue(TYPES)
  })
  afterEach(() => cleanup())

  it('названия мест подписаны по-русски, перевод пишется словарём по id', async () => {
    const form = setup(complex(), 'uz')
    const input = screen.getByLabelText('Школа №1')
    fireEvent.change(input, { target: { value: 'Maktab №1' } })
    await waitFor(() => expect(form.current.translations.uz?.placeNames).toEqual({ [PLACE_ID]: 'Maktab №1' }))
    fireEvent.change(input, { target: { value: ' ' } })
    await waitFor(() => expect(form.current.translations.uz?.placeNames).toBeUndefined())
  })

  it('адрес отдела продаж — перевод с русским в подсказке; без отдела поля нет', async () => {
    const form = setup(complex({ salesOffice: { lat: 41.32, lng: 69.29, address: 'ул. Навои, 1' } }), 'uz')
    const address = screen.getByPlaceholderText('ул. Навои, 1')
    fireEvent.change(address, { target: { value: 'Navoiy koʻchasi, 1' } })
    await waitFor(() => expect(form.current.translations.uz?.salesOfficeAddress).toBe('Navoiy koʻchasi, 1'))

    cleanup()
    setup(complex(), 'uz')
    expect(screen.queryByText('Адрес отдела продаж')).toBeNull()
  })
})
