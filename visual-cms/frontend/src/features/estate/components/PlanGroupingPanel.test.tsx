// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'

vi.mock('../api', () => ({
  estateApi: { previewPlanGroups: vi.fn(), updateComplex: vi.fn(async () => ({ ok: true })) },
}))

import { estateApi } from '../api'
import type { PlanGroupingConfig, PlanGroupingPreview } from '../types'
import { PlanGroupingPanel } from './PlanGroupingPanel'

const CRM = { priceMin: 480_000_000, priceMax: 700_000_000, areaMin: 55, areaMax: 55.2, floors: [2, 3, 5], entrances: [1, 3] }

/**
 * Сервер в миниатюре: одна группа A+B, правка и скрытие — из присланного
 * черновика, как у настоящего предпросмотра.
 */
function fakePreview(config: PlanGroupingConfig | null): PlanGroupingPreview {
  const override = config?.overrides?.A ?? null
  return {
    config: { areaTolerance: 0, groups: [], keepSeparate: [], hidden: [], overrides: {}, ...config } as any,
    typesCount: 2,
    cardsCount: 1,
    warnings: { duplicateNames: [], unknownNames: [] },
    groups: [
      {
        manual: false,
        rooms: 2,
        isStudio: false,
        ...CRM,
        ...(override ?? {}),
        apartmentsCount: 12,
        crm: CRM,
        anchor: 'A',
        hidden: (config?.hidden ?? []).includes('A'),
        overrideKey: override ? 'A' : null,
        override,
        ignoredOverrides: [],
        plans: ['A', 'B'].map((planName) => ({
          planName,
          houseId: 'h1',
          houseName: 'Корпус 1',
          areaMin: 55,
          areaMax: 55,
          floors: [2],
          entrances: [1],
          apartmentsCount: 6,
          thumb: '',
          image: '',
          imagesCount: 0,
          separated: false,
        })),
      },
    ],
  }
}

const preview = vi.mocked(estateApi.previewPlanGroups)
const lastPayload = () => preview.mock.calls[preview.mock.calls.length - 1][1]

async function mount(initial: PlanGroupingConfig | null = null) {
  render(<PlanGroupingPanel complexId="c1" initial={initial} />)
  return screen.findByTestId('plan-group')
}

beforeEach(() => {
  preview.mockReset().mockImplementation(async (_id, config) => fakePreview(config))
  vi.mocked(estateApi.updateComplex).mockClear()
})
afterEach(() => cleanup())

describe('PlanGroupingPanel — группа', () => {
  it('цена от–до, этажи, подъезды, в продаже — из CRM, без пометок «локально»', async () => {
    const card = await mount()
    expect(within(card).getByText('480 000 000 – 700 000 000 UZS')).toBeTruthy()
    expect(within(card).getByText('2–3, 5')).toBeTruthy()
    expect(within(card).getByText('1, 3')).toBeTruthy()
    expect(within(card).getByText('12')).toBeTruthy()
    expect(within(card).queryByText('локально')).toBeNull()
  })

  it('глаз скрывает группу целиком и возвращает; сохраняется в настройку', async () => {
    const card = await mount()
    fireEvent.click(within(card).getByRole('button', { name: /На сайте/ }))
    await waitFor(() => expect(lastPayload()).toMatchObject({ hidden: ['A', 'B'] }))
    await waitFor(() => expect(within(screen.getByTestId('plan-group')).getByRole('button', { name: /Скрыта/ })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /^Сохранить$/ }))
    await waitFor(() => expect(estateApi.updateComplex).toHaveBeenCalled())
    expect(vi.mocked(estateApi.updateComplex).mock.calls[0][1]).toMatchObject({ planGrouping: { hidden: ['A', 'B'] } })

    fireEvent.click(within(screen.getByTestId('plan-group')).getByRole('button', { name: /Скрыта/ }))
    await waitFor(() => expect(lastPayload()).toBeNull())
  })

  it('ручная цена: пометка «локально», рядом значение CRM, в превью — правка по якорю', async () => {
    const card = await mount()
    fireEvent.click(within(card).getByRole('button', { name: /Изменить данные/ }))
    const editor = screen.getByTestId('group-editor')
    const field = within(editor).getByLabelText('Цена от, UZS') as HTMLInputElement
    expect(field.placeholder).toBe('480 000 000')
    fireEvent.change(field, { target: { value: '450 000 000' } })

    await waitFor(() => expect(lastPayload()).toMatchObject({ overrides: { A: { priceMin: 450_000_000 } } }))
    expect(within(editor).getByText('CRM: 480 000 000')).toBeTruthy()
    await waitFor(() =>
      expect(within(screen.getByTestId('plan-group')).getByText('450 000 000 – 700 000 000 UZS')).toBeTruthy()
    )
  })

  it('недописанное значение не уходит в черновик, поле подсвечено', async () => {
    const card = await mount()
    fireEvent.click(within(card).getByRole('button', { name: /Изменить данные/ }))
    const floors = within(screen.getByTestId('group-editor')).getByLabelText('Этажи')
    const calls = preview.mock.calls.length
    fireEvent.change(floors, { target: { value: '2–' } })
    expect(floors.getAttribute('aria-invalid')).toBe('true')
    await new Promise((r) => setTimeout(r, 400))
    expect(preview.mock.calls.length).toBe(calls)
  })

  it('«от» больше «до»: ошибка у группы, сохранение закрыто, сервер не дёргаем', async () => {
    const card = await mount()
    fireEvent.click(within(card).getByRole('button', { name: /Изменить данные/ }))
    const editor = screen.getByTestId('group-editor')
    fireEvent.change(within(editor).getByLabelText('Цена до, UZS'), { target: { value: '100' } })
    fireEvent.change(within(editor).getByLabelText('Цена от, UZS'), { target: { value: '200' } })
    expect(await screen.findByText('Цена «от» больше цены «до»')).toBeTruthy()
    expect((screen.getByRole('button', { name: /^Сохранить$/ }) as HTMLButtonElement).disabled).toBe(true)
    const calls = preview.mock.calls.length
    await new Promise((r) => setTimeout(r, 400))
    expect(preview.mock.calls.length).toBe(calls)
  })

  it('«Подставить значения из CRM» снимает ручные данные группы, бейджи остаются', async () => {
    const card = await mount({ overrides: { A: { priceMin: 1, entrances: [2], badges: { ru: ['Акция'] } } } })
    expect(within(card).getAllByText('локально').length).toBeGreaterThan(0)
    expect(within(card).getByText('Акция')).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: /Подставить значения из CRM/ }))
    // Строго: в исходном запросе бейджи тоже были — ждём пересчёта после сброса.
    await waitFor(() => expect(lastPayload()!.overrides!.A).toEqual({ badges: { ru: ['Акция'] } }))
    await waitFor(() =>
      expect(within(screen.getByTestId('plan-group')).queryByRole('button', { name: /Подставить значения из CRM/ })).toBeNull()
    )
  })

  it('бейджи RU/UZ/EN через запятую', async () => {
    const card = await mount()
    fireEvent.click(within(card).getByRole('button', { name: /Изменить данные/ }))
    const editor = screen.getByTestId('group-editor')
    fireEvent.change(within(editor).getByLabelText('Бейджи RU'), { target: { value: 'Акция, Последняя планировка' } })
    fireEvent.change(within(editor).getByLabelText('Бейджи UZ'), { target: { value: 'Aksiya' } })
    await waitFor(() =>
      expect(lastPayload()).toMatchObject({
        overrides: { A: { badges: { ru: ['Акция', 'Последняя планировка'], uz: ['Aksiya'] } } },
      })
    )
  })
})
