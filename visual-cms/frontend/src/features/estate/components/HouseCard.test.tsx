// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'

vi.mock('../api', () => ({
  estateApi: { updateHouse: vi.fn(async () => ({ ok: true })), deleteHouse: vi.fn(async () => ({ ok: true })) },
}))

import { estateApi } from '../api'
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
    translations: {},
    apartments: [{ status: 'available' }, { status: 'sold' }] as any,
    ...over,
  }
}

const onChanged = vi.fn()

function mount(h: House, locale: Locale = 'ru') {
  render(<HouseCard house={h} locale={locale} onChanged={onChanged} />)
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

  it('полей проекта у дома нет: ни карточки на главной, ни страницы, ни адреса', () => {
    const card = mount(house())
    for (const testId of ['house-card-fields', 'house-card-unused', 'house-page']) {
      expect(within(card).queryByTestId(testId)).toBeNull()
    }
    expect(within(card).queryByLabelText(/Показывать на сайте/)).toBeNull()
    expect(within(card).queryByText(/Адрес страницы дома/)).toBeNull()
    // ru: ID, название, срок, класс, порядок — и больше ничего.
    expect(within(card).getAllByRole('textbox')).toHaveLength(3)
    expect(within(card).getAllByRole('spinbutton')).toHaveLength(2)
  })

  it('класс дома: своё поле дома, сохраняется в доме', async () => {
    const card = mount(house({ className: 'Комфорт' }))
    const cls = within(card).getByDisplayValue('Комфорт')
    fireEvent.change(cls, { target: { value: 'Комфорт+' } })
    fireEvent.click(within(card).getByRole('button', { name: /Сохранить/ }))
    await waitFor(() => expect(estateApi.updateHouse).toHaveBeenCalled())
    expect(vi.mocked(estateApi.updateHouse).mock.calls[0][1]).toMatchObject({ className: 'Комфорт+' })
  })

  it('сводка квартир и этажность — со ссылкой на группы планировок', () => {
    const text = within(mount(house())).getByTestId('house-apartments').textContent ?? ''
    expect(text).toMatch(/этажей 16/)
    expect(text).toMatch(/«Планировки на сайте»/)
  })

  it('сохранение: ID из CRM, название, срок; срок из CRM и квартиры не отправляются', async () => {
    const card = mount(house())
    const [name] = within(card).getAllByRole('textbox')
    fireEvent.change(name, { target: { value: 'Дустлик-4А' } })
    fireEvent.click(within(card).getByRole('button', { name: /Сохранить/ }))
    await waitFor(() => expect(estateApi.updateHouse).toHaveBeenCalled())
    const [id, body] = vi.mocked(estateApi.updateHouse).mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(id).toBe('h1')
    expect(body).toMatchObject({ externalId: 5622025, name: 'Дустлик-4А' })
    for (const key of ['apartments', 'crmDeadline', 'crmServiceYear', 'crmServiceMonth', 'id', 'complexId']) {
      expect(body).not.toHaveProperty(key)
    }
    expect(onChanged).toHaveBeenCalled()
  })

  it('перевод: название, срок и класс — в translations.uz; ID и порядок только на ru', async () => {
    const card = mount(house({ className: 'Комфорт' }), 'uz')
    expect(within(card).queryAllByRole('spinbutton')).toHaveLength(0)
    const [name, , cls] = within(card).getAllByRole('textbox') as HTMLInputElement[]
    expect(cls.placeholder).toBe('Комфорт')
    fireEvent.change(name, { target: { value: 'Doʼstlik-4' } })
    fireEvent.change(cls, { target: { value: 'Komfort' } })
    fireEvent.click(within(card).getByRole('button', { name: /Сохранить/ }))
    await waitFor(() => expect(estateApi.updateHouse).toHaveBeenCalled())
    const body = vi.mocked(estateApi.updateHouse).mock.calls[0][1] as any
    expect(body.translations.uz).toMatchObject({ name: 'Doʼstlik-4', className: 'Komfort' })
    expect(body).toMatchObject({ name: 'Дустлик-4', className: 'Комфорт' })
  })

  it('ошибка сохранения (занятый ID) видна в шапке', async () => {
    vi.mocked(estateApi.updateHouse).mockRejectedValueOnce(new Error('Дом с ID 1 из MacroCRM уже есть'))
    const card = mount(house())
    fireEvent.click(within(card).getByRole('button', { name: /Сохранить/ }))
    expect(await within(card).findByText('Дом с ID 1 из MacroCRM уже есть')).toBeTruthy()
  })
})
