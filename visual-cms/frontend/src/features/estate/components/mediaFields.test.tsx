// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'

// Медиатека — заглушка: кнопка «выбрать» отдаёт файл, kind виден атрибутом.
vi.mock('@/features/media/MediaPicker', () => ({
  MediaPicker: ({ open, kind, onSelect, onClose }: any) =>
    open ? (
      <div data-testid="picker" data-kind={kind}>
        <button
          type="button"
          onClick={() => {
            onSelect({ url: '/media/picked.jpg', optimizedUrl: null })
            onClose()
          }}
        >
          выбрать
        </button>
      </div>
    ) : null,
}))
// Ширины адаптивов берутся из стора редактора — здесь стора нет.
vi.mock('@/features/media/useProjectVariantWidths', () => ({ useProjectVariantWidths: () => [] }))

import { MediaField, MediaListField } from './mediaFields'

afterEach(() => cleanup())

describe('MediaField — один файл', () => {
  it('подпись поля; адрес вручную уходит как есть', () => {
    const onChange = vi.fn()
    render(<MediaField label="Логотип" hint="svg или png" value="" onChange={onChange} />)
    expect(screen.getByText('Логотип')).toBeTruthy()
    expect(screen.getByText('svg или png')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Логотип'), { target: { value: '/media/logo.svg' } })
    expect(onChange).toHaveBeenCalledWith('/media/logo.svg')
  })

  it('выбор из медиатеки пишет адрес /media/…', () => {
    const onChange = vi.fn()
    render(<MediaField label="Картинка карты" value="" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Выбрать из галереи/ }))
    expect(screen.getByTestId('picker').getAttribute('data-kind')).toBe('image')
    fireEvent.click(screen.getByRole('button', { name: 'выбрать' }))
    expect(onChange).toHaveBeenCalledWith('/media/picked.jpg')
  })

  it('видео: медиатека открывается на видео, превью — <video>', () => {
    const { container } = render(<MediaField label="About-видео" kind="video" value="/media/about.mp4" onChange={vi.fn()} />)
    expect(container.querySelector('video')?.getAttribute('src')).toBe('/media/about.mp4')
    fireEvent.click(screen.getByRole('button', { name: /Выбрать из галереи/ }))
    expect(screen.getByTestId('picker').getAttribute('data-kind')).toBe('video')
  })

  it('превью картинки и очистка поля', () => {
    const onChange = vi.fn()
    render(<MediaField label="План" value="/media/plan.png" onChange={onChange} />)
    expect(screen.getByAltText('Preview').getAttribute('src')).toBe('/media/plan.png')
    fireEvent.change(screen.getByLabelText('План'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('пустое значение из API (null) — пустое поле без превью', () => {
    render(<MediaField label="Картинка карточки" value={null} onChange={vi.fn()} />)
    expect((screen.getByLabelText('Картинка карточки') as HTMLInputElement).value).toBe('')
    expect(screen.queryByAltText('Preview')).toBeNull()
  })
})

describe('MediaListField — список файлов', () => {
  const urls = ['/media/a.jpg', '/media/b.mp4', '/media/c.jpg']

  it('миниатюры по порядку списка, видео — первым кадром', () => {
    render(<MediaListField label="Hero-изображения" value={urls} onChange={vi.fn()} />)
    const thumbs = within(screen.getByTestId('media-thumbs')).getAllByRole('listitem')
    expect(thumbs.map((t) => t.getAttribute('title'))).toEqual(urls)
    expect(thumbs[1].querySelector('video')?.getAttribute('src')).toBe('/media/b.mp4')
    expect(thumbs[0].querySelector('img')?.getAttribute('src')).toBe('/media/a.jpg')
  })

  it('крестик на миниатюре убирает именно этот файл', () => {
    const onChange = vi.fn()
    render(<MediaListField label="Hero-изображения" value={urls} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Убрать 2' }))
    expect(onChange).toHaveBeenCalledWith(['/media/a.jpg', '/media/c.jpg'])
  })

  it('«Добавить из медиатеки» дописывает файл в конец', () => {
    const onChange = vi.fn()
    render(<MediaListField label="Hero-изображения" value={urls} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Добавить из медиатеки/ }))
    expect(screen.getByTestId('picker').getAttribute('data-kind')).toBe('image')
    fireEvent.click(screen.getByRole('button', { name: 'выбрать' }))
    expect(onChange).toHaveBeenCalledWith([...urls, '/media/picked.jpg'])
    expect(screen.queryByTestId('picker')).toBeNull()
  })

  it('пустой список: без миниатюр, добавление работает', () => {
    const onChange = vi.fn()
    render(<MediaListField label="Hero-изображения" value={[]} onChange={onChange} />)
    expect(screen.queryByTestId('media-thumbs')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Добавить из медиатеки/ }))
    fireEvent.click(screen.getByRole('button', { name: 'выбрать' }))
    expect(onChange).toHaveBeenCalledWith(['/media/picked.jpg'])
  })

  it('миниатюры можно выключить (у галерей свои превью)', () => {
    render(<MediaListField label="Двор — слайды" kind="any" thumbnails={false} value={urls} onChange={vi.fn()} />)
    expect(screen.queryByTestId('media-thumbs')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Добавить из медиатеки/ }))
    expect(screen.getByTestId('picker').getAttribute('data-kind')).toBe('any')
  })

  it('ручной ввод адресов по строкам сохраняется', () => {
    const onChange = vi.fn()
    render(<MediaListField label="Hero-изображения" value={[]} onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/media/x.jpg\n\n /media/y.jpg ' } })
    expect(onChange).toHaveBeenLastCalledWith(['/media/x.jpg', '/media/y.jpg'])
  })
})
