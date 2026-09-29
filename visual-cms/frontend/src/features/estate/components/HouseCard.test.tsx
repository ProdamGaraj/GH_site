// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'

vi.mock('../api', () => ({
  estateApi: { updateHouse: vi.fn(async () => ({ ok: true })), deleteHouse: vi.fn(async () => ({ ok: true })) },
}))
vi.mock('@/features/media/MediaPicker', () => ({ MediaPicker: () => null }))
vi.mock('@/features/media/useProjectVariantWidths', () => ({ useProjectVariantWidths: () => [] }))

import { estateApi } from '../api'
import { testComplex } from '../testComplex.fixture'
import type { House, Locale } from '../types'
import { HouseCard } from './HouseCard'

function house(over: Partial<House> = {}): House {
  return {
    id: 'h1',
    complexId: 'c1',
    order: 0,
    externalId: 5622025,
    name: 'Дустлик-4',
    floors: '16',
    deadline: '',
    crmDeadline: '2 кв. 2028',
    className: '',
    entrances: null,
    showOnSite: true,
    status: 'active',
    intro: '',
    cardImage: '',
    cardTags: [],
    filterClass: '',
    translations: {},
    apartments: [{ status: 'available' }, { status: 'sold' }] as any,
    ...over,
  }
}

const byHouses = testComplex({ catalogMode: 'houses', cardTags: ['Рассрочка'], intro: 'Текст проекта' })
const onChanged = vi.fn()

function mount(h: House, project = byHouses, locale: Locale = 'ru') {
  render(<HouseCard house={h} project={project} locale={locale} onChanged={onChanged} />)
  return screen.getByTestId('house-card')
}

beforeEach(() => {
  vi.mocked(estateApi.updateHouse).mockClear()
  onChanged.mockClear()
})
afterEach(() => cleanup())

describe('HouseCard', () => {
  it('в шапке — ID из CRM; без ID — пометка «без CRM»', () => {
    expect(within(mount(house())).getByText('CRM 5622025')).toBeTruthy()
    cleanup()
    expect(within(mount(house({ externalId: null }))).getByText('без CRM')).toBeTruthy()
  })

  it('срок сдачи: пусто — из CRM (подсказкой), вписанный — вручную с CRM рядом', () => {
    const card = mount(house())
    const deadline = within(card).getAllByRole('textbox')[1] as HTMLInputElement
    expect(deadline.placeholder).toBe('2 кв. 2028')
    expect(within(card).getByText('из CRM')).toBeTruthy()
    fireEvent.change(deadline, { target: { value: 'Сдан' } })
    expect(within(card).getByText('вручную · CRM: 2 кв. 2028')).toBeTruthy()
  })

  it('проект одной карточкой — полей карточки дома нет, есть подсказка, где переключить', () => {
    const card = mount(house(), testComplex({ catalogMode: 'project' }))
    expect(within(card).queryByTestId('house-card-fields')).toBeNull()
    expect(within(card).getByText(/«Сайт и карточка» → «На главной»/)).toBeTruthy()
  })

  it('проект домами — карточка дома с подсказками «как у проекта»', () => {
    const card = mount(house())
    const fields = within(card).getByTestId('house-card-fields')
    expect(within(fields).getByText(/пусто — как у проекта: Рассрочка/)).toBeTruthy()
    expect((within(fields).getByLabelText(/Показывать на главной/) as HTMLInputElement).checked).toBe(true)
    expect((within(fields).getByDisplayValue(/Как у проекта/) as HTMLSelectElement).value).toBe('')
  })

  it('сохранение: ID из CRM и поля карточки; срок из CRM и квартиры не отправляются', async () => {
    const card = mount(house())
    const fields = within(card).getByTestId('house-card-fields')
    fireEvent.click(within(fields).getByLabelText(/Показывать на главной/))
    fireEvent.change(within(fields).getByDisplayValue('Продаётся'), { target: { value: 'sold_out' } })
    fireEvent.click(within(card).getByRole('button', { name: /Сохранить/ }))
    await waitFor(() => expect(estateApi.updateHouse).toHaveBeenCalled())
    const [id, body] = vi.mocked(estateApi.updateHouse).mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(id).toBe('h1')
    expect(body).toMatchObject({ externalId: 5622025, showOnSite: false, status: 'sold_out' })
    for (const key of ['apartments', 'crmDeadline', 'crmServiceYear', 'crmServiceMonth', 'id', 'complexId']) {
      expect(body).not.toHaveProperty(key)
    }
    expect(onChanged).toHaveBeenCalled()
  })

  it('перевод: название, срок и тексты карточки — в translations.uz', async () => {
    const card = mount(house(), byHouses, 'uz')
    const [name] = within(card).getAllByRole('textbox')
    fireEvent.change(name, { target: { value: 'Doʼstlik-4' } })
    fireEvent.click(within(card).getByRole('button', { name: /Сохранить/ }))
    await waitFor(() => expect(estateApi.updateHouse).toHaveBeenCalled())
    const body = vi.mocked(estateApi.updateHouse).mock.calls[0][1] as any
    expect(body.translations.uz.name).toBe('Doʼstlik-4')
    expect(body.name).toBe('Дустлик-4')
  })

  it('ошибка сохранения (занятый ID) видна в шапке', async () => {
    vi.mocked(estateApi.updateHouse).mockRejectedValueOnce(new Error('Дом с ID 1 из MacroCRM уже есть'))
    const card = mount(house())
    fireEvent.click(within(card).getByRole('button', { name: /Сохранить/ }))
    expect(await within(card).findByText('Дом с ID 1 из MacroCRM уже есть')).toBeTruthy()
  })
})
