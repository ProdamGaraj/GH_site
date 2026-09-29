// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react'

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
vi.mock('@/features/media/useProjectVariantWidths', () => ({ useProjectVariantWidths: () => [1440, 390] }))
// Загрузка в медиатеку — настоящий resolveMediaUrl, поддельный upload.
vi.mock('@/shared/api/mediaApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/mediaApi')>()),
  mediaApi: { upload: vi.fn() },
}))

import { mediaApi } from '@/shared/api/mediaApi'
import { MediaField, MediaListField } from './mediaFields'

const upload = vi.mocked(mediaApi.upload)
const file = (name: string, type: string) => new File(['x'], name, { type })
const pickFiles = (files: File[]) =>
  fireEvent.change(screen.getByTestId('media-file-input'), { target: { files } })

beforeEach(() => {
  upload.mockReset()
  vi.spyOn(window, 'alert').mockImplementation(() => undefined)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('MediaField — один файл одной строкой', () => {
  it('подпись и подсказка; адрес вручную уходит как есть', () => {
    const onChange = vi.fn()
    render(<MediaField label="Логотип" hint="svg или png" value="" onChange={onChange} />)
    expect(screen.getByText('Логотип')).toBeTruthy()
    expect(screen.getByText('svg или png')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Логотип'), { target: { value: '/media/logo.svg' } })
    expect(onChange).toHaveBeenCalledWith('/media/logo.svg')
  })

  it('пусто: в миниатюре подсказка про перетаскивание, кнопки очистки нет', () => {
    render(<MediaField label="Картинка карточки" value={null} onChange={vi.fn()} />)
    expect((screen.getByLabelText('Картинка карточки') as HTMLInputElement).value).toBe('')
    expect(within(screen.getByTestId('media-tile')).getByText('перетащите файл')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Очистить/ })).toBeNull()
  })

  it('превью картинки в миниатюре и очистка', () => {
    const onChange = vi.fn()
    render(<MediaField label="План" value="/media/plan.png" onChange={onChange} />)
    expect(screen.getByTestId('media-tile').querySelector('img')?.getAttribute('src')).toBe('/media/plan.png')
    fireEvent.click(screen.getByRole('button', { name: 'Очистить: План' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('битый адрес: вместо превью «файл не открывается»', () => {
    render(<MediaField label="План" value="/media/nope.png" onChange={vi.fn()} />)
    fireEvent.error(screen.getByTestId('media-tile').querySelector('img')!)
    expect(within(screen.getByTestId('media-tile')).getByText('файл не открывается')).toBeTruthy()
  })

  it('медиатека пишет адрес /media/…', () => {
    const onChange = vi.fn()
    render(<MediaField label="Картинка карты" value="" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Медиатека/ }))
    expect(screen.getByTestId('picker').getAttribute('data-kind')).toBe('image')
    fireEvent.click(screen.getByRole('button', { name: 'выбрать' }))
    expect(onChange).toHaveBeenCalledWith('/media/picked.jpg')
  })

  it('видео: превью первым кадром, медиатека и диалог файла — на видео', () => {
    render(<MediaField label="About-видео" kind="video" value="/media/about.mp4" onChange={vi.fn()} />)
    expect(screen.getByTestId('media-tile').querySelector('video')?.getAttribute('src')).toBe('/media/about.mp4')
    expect(screen.getByTestId('media-file-input').getAttribute('accept')).toBe('video/*')
    fireEvent.click(screen.getByRole('button', { name: /Медиатека/ }))
    expect(screen.getByTestId('picker').getAttribute('data-kind')).toBe('video')
  })

  it('«Загрузить»: картинка сжимается и режется под экраны, в поле — сжатая версия', async () => {
    upload.mockResolvedValue({ url: '/media/big.jpg', optimizedUrl: '/media/big.opt.jpg' } as any)
    const onChange = vi.fn()
    render(<MediaField label="Логотип" value="" onChange={onChange} />)
    pickFiles([file('logo.png', 'image/png')])
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('/media/big.opt.jpg'))
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ title: 'logo', optimize: true, variantWidths: [1440, 390] }))
  })

  it('файл можно перетащить на миниатюру', async () => {
    upload.mockResolvedValue({ url: '/media/dropped.jpg', optimizedUrl: null } as any)
    const onChange = vi.fn()
    render(<MediaField label="Логотип" value="" onChange={onChange} />)
    fireEvent.drop(screen.getByTestId('media-tile'), { dataTransfer: { files: [file('a.jpg', 'image/jpeg')] } })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('/media/dropped.jpg'))
  })

  it('файл не того вида — предупреждение, ничего не загружается', async () => {
    const onChange = vi.fn()
    render(<MediaField label="Логотип" value="" onChange={onChange} />)
    pickFiles([file('clip.mp4', 'video/mp4')])
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Пожалуйста, выберите изображение'))
    expect(upload).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
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

  it('медиатека дописывает файл в конец', () => {
    const onChange = vi.fn()
    render(<MediaListField label="Hero-изображения" value={urls} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Медиатека/ }))
    expect(screen.getByTestId('picker').getAttribute('data-kind')).toBe('image')
    fireEvent.click(screen.getByRole('button', { name: 'выбрать' }))
    expect(onChange).toHaveBeenCalledWith([...urls, '/media/picked.jpg'])
    expect(screen.queryByTestId('picker')).toBeNull()
  })

  it('загрузка нескольких файлов: все в конец, в порядке выбора; неудачный не мешает', async () => {
    upload
      .mockResolvedValueOnce({ url: '/media/one.jpg', optimizedUrl: null } as any)
      .mockRejectedValueOnce(new Error('413'))
      .mockResolvedValueOnce({ url: '/media/three.jpg', optimizedUrl: '/media/three.opt.jpg' } as any)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const onChange = vi.fn()
    render(<MediaListField label="Hero-изображения" value={['/media/a.jpg']} onChange={onChange} />)
    expect(screen.getByTestId('media-file-input').hasAttribute('multiple')).toBe(true)
    pickFiles([file('1.jpg', 'image/jpeg'), file('2.jpg', 'image/jpeg'), file('3.jpg', 'image/jpeg')])
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['/media/a.jpg', '/media/one.jpg', '/media/three.opt.jpg']))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(window.alert).toHaveBeenCalledWith('Ошибка загрузки: 413')
  })

  it('файлы можно перетащить на блок списка', async () => {
    upload.mockResolvedValue({ url: '/media/d.jpg', optimizedUrl: null } as any)
    const onChange = vi.fn()
    render(<MediaListField label="Hero-изображения" value={[]} onChange={onChange} />)
    expect(screen.queryByTestId('media-thumbs')).toBeNull()
    fireEvent.drop(screen.getByTestId('media-list'), { dataTransfer: { files: [file('d.jpg', 'image/jpeg')] } })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['/media/d.jpg']))
  })

  it('миниатюры можно выключить (у галерей свои превью); фото и видео', () => {
    render(<MediaListField label="Двор — слайды" kind="any" thumbnails={false} value={urls} onChange={vi.fn()} />)
    expect(screen.queryByTestId('media-thumbs')).toBeNull()
    expect(screen.getByTestId('media-file-input').getAttribute('accept')).toBe('image/*,video/*')
    fireEvent.click(screen.getByRole('button', { name: /Медиатека/ }))
    expect(screen.getByTestId('picker').getAttribute('data-kind')).toBe('any')
  })

  it('ручной ввод адресов по строкам сохраняется', () => {
    const onChange = vi.fn()
    render(<MediaListField label="Hero-изображения" value={[]} onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/media/x.jpg\n\n /media/y.jpg ' } })
    expect(onChange).toHaveBeenLastCalledWith(['/media/x.jpg', '/media/y.jpg'])
  })
})
