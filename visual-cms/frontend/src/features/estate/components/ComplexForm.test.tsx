// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api', () => ({
  estateApi: { listPlaceTypes: vi.fn(async () => []), updateComplex: vi.fn(async () => ({ ok: true })) },
}))
vi.mock('@/features/media/MediaPicker', () => ({ MediaPicker: () => null }))
vi.mock('@/features/media/useProjectVariantWidths', () => ({ useProjectVariantWidths: () => [] }))

import { estateApi } from '../api'
import { SECTION, sectionsFor } from '../sections'
import type { Locale } from '../types'
import { testComplex } from '../testComplex.fixture'
import { ComplexForm } from './ComplexForm'

// planGrouping есть — проверяем, что форма его не отправляет.
const COMPLEX = testComplex({ planGrouping: { areaTolerance: 0.01 } })

function mount(locale: Locale, withSlot = true) {
  const slot = document.createElement('div')
  slot.setAttribute('data-testid', 'slot')
  document.body.appendChild(slot)
  render(
    <MemoryRouter>
      <ComplexForm
        complex={COMPLEX}
        locale={locale}
        actionsSlot={withSlot ? slot : null}
        housesSection={<section id={SECTION.houses} />}
      />
    </MemoryRouter>
  )
  return slot
}

/** Разделы формы, которые попали на страницу, по порядку. */
const renderedSections = () => Array.from(document.querySelectorAll('section[id^="estate-"]')).map((s) => s.id)

beforeEach(() => {
  vi.mocked(estateApi.updateComplex).mockClear()
})
afterEach(() => {
  cleanup()
  document.querySelectorAll('[data-testid="slot"]').forEach((n) => n.remove())
})

describe('ComplexForm — разделы', () => {
  // Планировки — раздел страницы (EstateEditor) под формой; дома страница
  // отдаёт форме (housesSection), и та ставит их на место из меню.
  const formPart = (locale: Locale) =>
    sectionsFor(locale)
      .map((s) => s.id)
      .filter((id) => id !== SECTION.plans)

  it('ru: на странице ровно разделы меню, в том же порядке; дома — сразу под «Основным»', () => {
    mount('ru')
    expect(renderedSections()).toEqual(formPart('ru'))
    expect(renderedSections().slice(0, 2)).toEqual([SECTION.basic, SECTION.houses])
  })

  it('uz: без «Основное» и «Медиа» — как в меню; дома первыми', () => {
    mount('uz')
    expect(renderedSections()).toEqual(formPart('uz'))
    expect(renderedSections()[0]).toBe(SECTION.houses)
  })

  it('медиаполя — компактные строки с миниатюрой, списки — с миниатюрами', () => {
    mount('ru')
    const media = document.getElementById(SECTION.media)!
    expect(within(media).getAllByTestId('media-tile')).toHaveLength(4)
    expect(within(media).getByTestId('media-thumbs')).toBeTruthy()
    // Картинка карточки — в своём разделе.
    expect(within(document.getElementById(SECTION.card)!).getAllByTestId('media-tile')).toHaveLength(1)
  })
})

describe('ComplexForm — «Сохранить ЖК»', () => {
  it('кнопка стоит в закреплённой полосе страницы и сохраняет черновик без служебных полей', async () => {
    const slot = mount('ru')
    const save = within(slot).getByRole('button', { name: /Сохранить ЖК/ })
    expect(screen.getAllByRole('button', { name: /Сохранить ЖК/ })).toHaveLength(1)

    fireEvent.change(screen.getByLabelText('Логотип'), { target: { value: '/media/new-logo.svg' } })
    fireEvent.click(save)
    await waitFor(() => expect(estateApi.updateComplex).toHaveBeenCalledTimes(1))
    const [id, body] = vi.mocked(estateApi.updateComplex).mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(id).toBe('c1')
    expect(body.logo).toBe('/media/new-logo.svg')
    for (const key of ['id', 'houses', 'planGrouping', 'windowViews']) expect(body).not.toHaveProperty(key)
    expect(await within(slot).findByText('Сохранено')).toBeTruthy()
  })

  it('без полосы кнопка стоит над разделами', () => {
    mount('ru', false)
    expect(screen.getByRole('button', { name: /Сохранить ЖК/ })).toBeTruthy()
    expect(within(screen.getByTestId('slot')).queryByRole('button')).toBeNull()
  })
})
