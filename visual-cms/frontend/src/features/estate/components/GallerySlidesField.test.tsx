// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { GallerySlidesField } from './GallerySlidesField'
import type { GalleryItem } from '../gallerySlides'

function setup(value: GalleryItem[]) {
  const onChange = vi.fn()
  render(<GallerySlidesField label="Холлы — слайды" value={value} onChange={onChange} />)
  return onChange
}

/** Кадр превью 200×100 в точке (0, 0) — клик переводится в проценты от него. */
function stubRect(el: HTMLElement) {
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) })
}

describe('GallerySlidesField', () => {
  afterEach(() => cleanup())

  it('по строке кадрирования на каждый слайд, видео — через <video> без интерфейса плеера', () => {
    setup(['/a.jpg', '/b.mp4'])
    expect(screen.getByTestId('slide-0')).toBeTruthy()
    const video = screen.getByTestId('slide-1').querySelector('video')!
    expect(video.hasAttribute('controls')).toBe(false)
    expect(video.muted).toBe(true)
  })

  it('клик по превью ставит фокус — слайд пишется объектом', () => {
    const onChange = setup(['/a.jpg', '/b.jpg'])
    const target = screen.getByTestId('focus-1')
    stubRect(target)
    fireEvent.click(target, { clientX: 50, clientY: 80 })
    expect(onChange).toHaveBeenCalledWith(['/a.jpg', { url: '/b.jpg', focus: { x: 25, y: 80 } }])
  })

  it('превью кадров показывают позицию фокуса', () => {
    setup([{ url: '/a.jpg', focus: { x: 30, y: 70 } }])
    const frames = within(screen.getByTestId('slide-0')).getAllByTestId('frame-preview')
    expect(frames).toHaveLength(2)
    for (const frame of frames) expect(frame.getAttribute('data-position')).toBe('30% 70%')
  })

  it('«Целиком» пишет fit=contain; в этом режиме фокус не ставится и точки нет', () => {
    const onChange = setup(['/a.jpg'])
    fireEvent.click(screen.getByRole('button', { name: 'Целиком' }))
    expect(onChange).toHaveBeenLastCalledWith([{ url: '/a.jpg', fit: 'contain' }])

    cleanup()
    const onChange2 = setup([{ url: '/a.jpg', fit: 'contain' }])
    expect(screen.queryByTestId('focus-dot-0')).toBeNull()
    const target = screen.getByTestId('focus-0')
    stubRect(target)
    fireEvent.click(target, { clientX: 10, clientY: 10 })
    expect(onChange2).not.toHaveBeenCalled()
  })

  it('«В центр» снимает фокус — слайд снова строка', () => {
    const onChange = setup([{ url: '/a.jpg', focus: { x: 10, y: 10 } }])
    fireEvent.click(screen.getByRole('button', { name: 'В центр' }))
    expect(onChange).toHaveBeenCalledWith(['/a.jpg'])
  })

  it('правка списка ссылок сохраняет настройки за своими фото', () => {
    const onChange = setup(['/a.jpg', { url: '/b.jpg', focus: { x: 5, y: 95 } }])
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/b.jpg\n/a.jpg\n/c.jpg' } })
    expect(onChange).toHaveBeenLastCalledWith([{ url: '/b.jpg', focus: { x: 5, y: 95 } }, '/a.jpg', '/c.jpg'])
  })

  it('пустая галерея — без блока кадрирования', () => {
    setup([])
    expect(screen.queryByTestId('slide-framing')).toBeNull()
  })
})
