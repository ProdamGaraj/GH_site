// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'

vi.mock('@/features/media/MediaPicker', () => ({
  MediaPicker: ({ open, kind, onSelect }: any) =>
    open ? (
      <button type="button" data-kind={kind} onClick={() => onSelect({ url: '/media/new.mp4' })}>
        выбрать
      </button>
    ) : null,
}))
// Загрузка файлов берёт ширины экранов из стора редактора — здесь стора нет.
vi.mock('@/features/media/useProjectVariantWidths', () => ({ useProjectVariantWidths: () => [] }))

import { GallerySlidesField, HERO_FRAMES } from './GallerySlidesField'
import type { GalleryItem } from './gallerySlides'

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

  it('свои пропорции кадров (hero): превью по ним, а не по карточке слайдера', () => {
    render(<GallerySlidesField label="Hero" value={['/a.jpg']} onChange={vi.fn()} frames={HERO_FRAMES} />)
    const frames = within(screen.getByTestId('slide-0')).getAllByTestId('frame-preview')
    expect(frames.map((f) => f.style.width)).toEqual(['128px', '35px'])
    expect(screen.getByText('· ПК')).toBeTruthy()
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

  it('медиатека: фото и видео, новый слайд в конце, кадрирование старых цело', () => {
    const onChange = setup([{ url: '/a.jpg', focus: { x: 10, y: 20 } }])
    fireEvent.click(screen.getByRole('button', { name: /Медиатека/ }))
    const pick = screen.getByRole('button', { name: 'выбрать' })
    expect(pick.getAttribute('data-kind')).toBe('any')
    fireEvent.click(pick)
    expect(onChange).toHaveBeenCalledWith([{ url: '/a.jpg', focus: { x: 10, y: 20 } }, '/media/new.mp4'])
  })

  it('миниатюр списка нет — превью кадрирования уже показывают слайды', () => {
    setup(['/a.jpg'])
    expect(screen.queryByTestId('media-thumbs')).toBeNull()
  })
})

describe('GallerySlidesField: медиа по экранам', () => {
  afterEach(() => cleanup())

  const SCREENS = [
    { id: 'tablet', name: 'Tablet', width: 768 },
    { id: 'desktop-hd', name: 'Desktop HD', width: 1440 },
    { id: 'mobile', name: 'Mobile', width: 375 },
  ]

  function setupScreens(value: GalleryItem[]) {
    const onChange = vi.fn()
    render(<GallerySlidesField label="Hero — слайды" value={value} onChange={onChange} screens={SCREENS} />)
    return onChange
  }

  it('без экранов шаблона раздела нет', () => {
    setup(['/a.jpg'])
    expect(screen.queryByTestId('screens-0')).toBeNull()
  })

  it('поле на каждый экран, от широкого к узкому; пустой экран берёт экран шире или основное', () => {
    setupScreens([{ url: '/a.jpg', screens: { tablet: { url: '/t.jpg' } } }])
    const box = screen.getByTestId('screens-0')
    const labels = within(box).getAllByRole('textbox').map((el) => el.getAttribute('aria-label'))
    expect(labels).toEqual(['Desktop HD · 1440 px', 'Tablet · 768 px', 'Mobile · 375 px'])
    expect(within(screen.getByTestId('screen-0-desktop-hd')).getByText('пусто — как основное')).toBeTruthy()
    expect(within(screen.getByTestId('screen-0-mobile')).getByText('пусто — как у «Tablet»')).toBeTruthy()
    expect(box.textContent).toContain('своё у 1 из 3')
  })

  it('ссылка экрана пишется в слайд; очистка убирает экран', () => {
    const onChange = setupScreens(['/a.jpg'])
    fireEvent.change(screen.getByLabelText('Mobile · 375 px'), { target: { value: '/m.jpg' } })
    expect(onChange).toHaveBeenLastCalledWith([{ url: '/a.jpg', screens: { mobile: { url: '/m.jpg' } } }])
    cleanup()
    const onClear = setupScreens([{ url: '/a.jpg', screens: { mobile: { url: '/m.jpg' } } }])
    fireEvent.click(screen.getByLabelText('Очистить: Mobile · 375 px'))
    expect(onClear).toHaveBeenLastCalledWith(['/a.jpg'])
  })

  it('точка фокуса экрана — своя, у слайда не меняется', () => {
    const onChange = setupScreens([{ url: '/a.jpg', focus: { x: 10, y: 10 }, screens: { mobile: { url: '/m.jpg' } } }])
    const target = screen.getByTestId('screen-focus-0-mobile')
    stubRect(target)
    fireEvent.click(target, { clientX: 100, clientY: 20 })
    expect(onChange).toHaveBeenLastCalledWith([{ url: '/a.jpg', focus: { x: 10, y: 10 }, screens: { mobile: { url: '/m.jpg', focus: { x: 50, y: 20 } } } }])
  })

  it('«целиком» — фокус экрана не нужен; у слайда-блока экранов нет', () => {
    setupScreens([{ url: '/a.jpg', fit: 'contain', screens: { mobile: { url: '/m.jpg' } } }, 'block:b1'])
    expect(screen.queryByTestId('screen-focus-0-mobile')).toBeNull()
    expect(screen.queryByTestId('screens-1')).toBeNull()
  })
})
