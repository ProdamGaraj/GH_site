// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'

vi.mock('../api', () => ({
  estateApi: { previewPlanGroups: vi.fn(), updateComplex: vi.fn(async () => ({ ok: true })) },
}))

import { estateApi } from '../api'
import type { PlanGroupingConfig, PlanGroupingPreview } from '../types'
import { PlanGroupingPanel } from './PlanGroupingPanel'

const CRM = { areaMin: 55, areaMax: 55.2, floors: [2, 3, 5], entrances: [1, 3] }

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
  it('площадь, этажи, подъезды, в продаже — из CRM, без пометок «локально»; цены нет', async () => {
    const card = await mount()
    expect(within(card).getByText('55.00–55.20 м²')).toBeTruthy()
    expect(within(card).getByText('2–3, 5')).toBeTruthy()
    expect(within(card).getByText('1, 3')).toBeTruthy()
    expect(within(card).getByText('12')).toBeTruthy()
    expect(within(card).queryByText('локально')).toBeNull()
    expect(card.textContent).not.toMatch(/Цена|UZS/)
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

  it('ручная площадь: пометка «локально», рядом значение CRM, в превью — правка по якорю', async () => {
    const card = await mount()
    fireEvent.click(within(card).getByRole('button', { name: /Изменить данные/ }))
    const editor = screen.getByTestId('group-editor')
    const field = within(editor).getByLabelText('Площадь от, м²') as HTMLInputElement
    expect(field.placeholder).toBe('55')
    fireEvent.change(field, { target: { value: '54,5' } })

    await waitFor(() => expect(lastPayload()).toMatchObject({ overrides: { A: { areaMin: 54.5 } } }))
    expect(within(editor).getByText('CRM: 55')).toBeTruthy()
    await waitFor(() =>
      expect(within(screen.getByTestId('plan-group')).getByText('54.50–55.20 м²')).toBeTruthy()
    )
  })

  it('в редакторе группы полей цены нет', async () => {
    const card = await mount()
    fireEvent.click(within(card).getByRole('button', { name: /Изменить данные/ }))
    expect(screen.getByTestId('group-editor').textContent).not.toMatch(/Цена|UZS/)
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
    fireEvent.change(within(editor).getByLabelText('Площадь до, м²'), { target: { value: '40' } })
    fireEvent.change(within(editor).getByLabelText('Площадь от, м²'), { target: { value: '50' } })
    expect(await screen.findByText('Площадь «от» больше площади «до»')).toBeTruthy()
    expect((screen.getByRole('button', { name: /^Сохранить$/ }) as HTMLButtonElement).disabled).toBe(true)
    const calls = preview.mock.calls.length
    await new Promise((r) => setTimeout(r, 400))
    expect(preview.mock.calls.length).toBe(calls)
  })

  it('«Вернуть данные из CRM» снимает ручные данные группы, бейджи остаются', async () => {
    const card = await mount({ overrides: { A: { areaMin: 54, entrances: [2], badges: { ru: ['Акция'] } } } })
    expect(within(card).getAllByText('локально').length).toBeGreaterThan(0)
    expect(within(card).getByText('Акция')).toBeTruthy()
    const reset = within(card).getByRole('button', { name: /Вернуть данные из CRM/ }) as HTMLButtonElement
    expect(reset.disabled).toBe(false)
    fireEvent.click(reset)
    // Строго: в исходном запросе бейджи тоже были — ждём пересчёта после сброса.
    await waitFor(() => expect(lastPayload()!.overrides!.A).toEqual({ badges: { ru: ['Акция'] } }))
    // Кнопка остаётся на месте, но делать ей больше нечего.
    await waitFor(() =>
      expect(
        (within(screen.getByTestId('plan-group')).getByRole('button', { name: /Вернуть данные из CRM/ }) as HTMLButtonElement)
          .disabled
      ).toBe(true)
    )
  })

  it('«Вернуть данные из CRM» видна всегда; без ручных данных — неактивна с пояснением', async () => {
    const card = await mount()
    const reset = within(card).getByRole('button', { name: /Вернуть данные из CRM/ }) as HTMLButtonElement
    expect(reset.disabled).toBe(true)
    expect(reset.title).toBe('Все данные группы и так из CRM')
  })

  it('после синхронизации (refreshToken) превью пересчитывается, черновик цел', async () => {
    const { rerender } = render(<PlanGroupingPanel complexId="c1" initial={null} refreshToken={0} />)
    const card = await screen.findByTestId('plan-group')
    fireEvent.click(within(card).getByRole('button', { name: /На сайте/ }))
    await waitFor(() => expect(lastPayload()).toMatchObject({ hidden: ['A', 'B'] }))
    const calls = preview.mock.calls.length
    rerender(<PlanGroupingPanel complexId="c1" initial={null} refreshToken={1} />)
    await waitFor(() => expect(preview.mock.calls.length).toBeGreaterThan(calls))
    expect(lastPayload()).toMatchObject({ hidden: ['A', 'B'] })
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
