// @vitest-environment jsdom
/**
 * Настройки слайда для слайдеров страницы проекта: тема шапки над слайдом и
 * слайд-блок из библиотеки. Включаются флагами — у новостей их нет.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react'

vi.mock('@/features/media/MediaPicker', () => ({ MediaPicker: () => null }))
vi.mock('@/features/media/useProjectVariantWidths', () => ({ useProjectVariantWidths: () => [] }))
vi.mock('@/shared/api', () => ({
  blockApi: { getReusable: vi.fn(async () => [{ id: 'b-promo', name: 'Promo 0%' }]) },
}))
vi.mock('@/features/editor/components/BlockPicker', () => ({
  BlockPicker: ({ isOpen, onPick, forcedMode }: any) =>
    isOpen ? (
      <button type="button" data-mode={forcedMode} onClick={() => onPick({ block: { id: 'b-promo', name: 'Promo 0%' }, mode: 'linked' })}>
        выбрать блок
      </button>
    ) : null,
}))

import { GallerySlidesField } from './GallerySlidesField'
import { blockIdOf, blockSlideUrl, readGallery, writeGallery, type GalleryItem } from './gallerySlides'

function setup(value: GalleryItem[], flags: { withTheme?: boolean; withBlocks?: boolean } = { withTheme: true, withBlocks: true }) {
  const onChange = vi.fn()
  render(<GallerySlidesField label="Hero — слайды" value={value} onChange={onChange} {...flags} />)
  return onChange
}

afterEach(() => cleanup())

describe('gallerySlides: тема и слайд-блок', () => {
  it('тема читается и пишется; без настроек — строкой', () => {
    const slides = readGallery([{ url: '/a.jpg', theme: 'light' }, { url: '/b.jpg', theme: 'sepia' }, '/c.jpg'])
    expect(slides.map((s) => s.theme)).toEqual(['light', null, null])
    expect(writeGallery(slides)).toEqual([{ url: '/a.jpg', theme: 'light' }, '/b.jpg', '/c.jpg'])
  })

  it('слайд-блок — ссылка block:<id>', () => {
    expect(blockSlideUrl('b1')).toBe('block:b1')
    expect(blockIdOf(' block:b1 ')).toBe('b1')
    expect(blockIdOf('block:')).toBeNull()
    expect(blockIdOf('/media/block.png')).toBeNull()
  })
})

describe('GallerySlidesField: тема шапки', () => {
  it('у каждого слайда — Авто / Тёмный / Светлый фон; выбор пишет theme', () => {
    const onChange = setup(['/a.jpg', { url: '/b.jpg', theme: 'dark' }])
    const second = within(screen.getByTestId('slide-1'))
    expect(second.getByRole('button', { name: 'Тёмный фон' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(screen.getByTestId('slide-0')).getByRole('button', { name: 'Светлый фон' }))
    expect(onChange).toHaveBeenLastCalledWith([{ url: '/a.jpg', theme: 'light' }, { url: '/b.jpg', theme: 'dark' }])
  })

  it('«Авто» снимает тему — слайд снова строкой', () => {
    const onChange = setup([{ url: '/a.jpg', theme: 'dark' }])
    fireEvent.click(screen.getByRole('button', { name: 'Авто' }))
    expect(onChange).toHaveBeenLastCalledWith(['/a.jpg'])
  })

  it('без флагов (новости) — ни темы, ни кнопки блока', () => {
    setup(['/a.jpg'], {})
    expect(screen.queryByRole('button', { name: 'Авто' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Блок из библиотеки/ })).toBeNull()
  })
})

describe('GallerySlidesField: слайд-блок', () => {
  it('«Блок из библиотеки» — выбор (только связанный) добавляет слайд в конец', () => {
    const onChange = setup(['/a.jpg'])
    fireEvent.click(screen.getByRole('button', { name: /Блок из библиотеки/ }))
    const pick = screen.getByRole('button', { name: 'выбрать блок' })
    expect(pick.getAttribute('data-mode')).toBe('linked')
    fireEvent.click(pick)
    expect(onChange).toHaveBeenLastCalledWith(['/a.jpg', 'block:b-promo'])
  })

  it('строка блока: название из библиотеки, без кадрирования, с темой', async () => {
    const onChange = setup(['/a.jpg', 'block:b-promo'])
    const row = within(screen.getByTestId('slide-1'))
    await waitFor(() => expect(row.getByText(/Блок «Promo 0%»/)).toBeTruthy())
    expect(row.queryByRole('button', { name: 'Целиком' })).toBeNull()
    fireEvent.click(row.getByRole('button', { name: 'Тёмный фон' }))
    expect(onChange).toHaveBeenLastCalledWith(['/a.jpg', { url: 'block:b-promo', theme: 'dark' }])
  })
})
