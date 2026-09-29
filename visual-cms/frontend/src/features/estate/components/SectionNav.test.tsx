// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { ESTATE_SECTIONS, SECTION, sectionsFor } from '../sections'
import { READING_TOLERANCE, SectionNav } from './SectionNav'

afterEach(() => cleanup())

describe('sectionsFor — меню по языку', () => {
  it('ru — все разделы по порядку страницы', () => {
    expect(sectionsFor('ru').map((s) => s.id)).toEqual(Object.values(SECTION))
  })

  it('uz/en — без разделов, у которых нет перевода', () => {
    for (const locale of ['uz', 'en'] as const) {
      const ids = sectionsFor(locale).map((s) => s.id)
      expect(ids).not.toContain(SECTION.basic)
      expect(ids).not.toContain(SECTION.media)
      expect(ids).toContain(SECTION.card)
      expect(ids).toContain(SECTION.houses)
    }
  })

  it('id разделов не повторяются', () => {
    const ids = ESTATE_SECTIONS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

/** Разделы на странице с заданной позицией верха (getBoundingClientRect). */
function mountSections(tops: Record<string, number>) {
  for (const [id, top] of Object.entries(tops)) {
    const el = document.createElement('section')
    el.id = id
    el.getBoundingClientRect = () => ({ top }) as DOMRect
    el.scrollIntoView = vi.fn()
    document.body.appendChild(el)
  }
  return () => Object.keys(tops).forEach((id) => document.getElementById(id)?.remove())
}

describe('SectionNav', () => {
  const sections = [
    { id: 'a', label: 'Основное' },
    { id: 'b', label: 'Тексты' },
    { id: 'c', label: 'Медиа' },
  ]

  it('линия чтения — верх закреплённого меню (с тем же отступом встаёт раздел)', () => {
    const cleanupSections = mountSections({ a: -500, b: 150, c: 900 })
    render(<SectionNav sections={sections} />)
    // Меню закреплено на 150px: раздел b доехал до него — текущий.
    const list = screen.getByRole('list')
    list.getBoundingClientRect = () => ({ top: 150 }) as DOMRect
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByRole('link', { name: 'Тексты' }).getAttribute('aria-current')).toBe('location')
    cleanupSections()
  })

  it('клик прокручивает к разделу и не меняет адрес', () => {
    const cleanupSections = mountSections({ a: 200, b: 900, c: 1600 })
    render(<SectionNav sections={sections} />)
    const link = screen.getByRole('link', { name: 'Тексты' })
    const event = fireEvent.click(link)
    expect(event).toBe(false) // preventDefault — без #b в адресе
    expect(document.getElementById('b')!.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    cleanupSections()
  })

  // Верх меню в jsdom — 0, линия чтения — READING_TOLERANCE.
  it('текущий — последний раздел, чей верх поднялся до линии чтения', () => {
    const cleanupSections = mountSections({ a: -800, b: READING_TOLERANCE - 10, c: 700 })
    render(<SectionNav sections={sections} />)
    expect(screen.getByRole('link', { name: 'Тексты' }).getAttribute('aria-current')).toBe('location')
    expect(screen.getByRole('link', { name: 'Основное' }).getAttribute('aria-current')).toBeNull()
    cleanupSections()
  })

  it('вверху страницы — первый раздел; при прокрутке подсветка переезжает', () => {
    const cleanupSections = mountSections({ a: 180, b: 900, c: 1600 })
    render(<SectionNav sections={sections} />)
    expect(screen.getByRole('link', { name: 'Основное' }).getAttribute('aria-current')).toBe('location')
    expect(screen.getByRole('link', { name: 'Тексты' }).getAttribute('aria-current')).toBeNull()

    // Прокрутили: верх «Медиа» у линии чтения. Прокрутка контейнера не всплывает — ловим перехватом.
    document.getElementById('a')!.getBoundingClientRect = () => ({ top: -1500 }) as DOMRect
    document.getElementById('b')!.getBoundingClientRect = () => ({ top: -600 }) as DOMRect
    document.getElementById('c')!.getBoundingClientRect = () => ({ top: READING_TOLERANCE }) as DOMRect
    act(() => {
      document.getElementById('c')!.dispatchEvent(new Event('scroll'))
    })
    expect(screen.getByRole('link', { name: 'Медиа' }).getAttribute('aria-current')).toBe('location')
    cleanupSections()
  })
})
