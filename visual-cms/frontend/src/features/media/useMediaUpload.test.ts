// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('./useProjectVariantWidths', () => ({ useProjectVariantWidths: () => [1920, 768] }))
vi.mock('@/shared/api/mediaApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/mediaApi')>()),
  mediaApi: { upload: vi.fn() },
}))

import { mediaApi } from '@/shared/api/mediaApi'
import { acceptFor, uploadKindError, uploadedUrlOf, useMediaUpload } from './useMediaUpload'

const upload = vi.mocked(mediaApi.upload)
const file = (name: string, type: string) => new File(['x'], name, { type })

describe('useMediaUpload — правила', () => {
  it('фильтр диалога файла по виду поля', () => {
    expect(acceptFor('image')).toBe('image/*')
    expect(acceptFor('video')).toBe('video/*')
    expect(acceptFor('any')).toBe('image/*,video/*')
  })

  it('вид файла: картинка в поле видео и наоборот — ошибка, «any» принимает всё', () => {
    expect(uploadKindError(file('a.mp4', 'video/mp4'), 'image')).toBe('Пожалуйста, выберите изображение')
    expect(uploadKindError(file('a.jpg', 'image/jpeg'), 'video')).toBe('Пожалуйста, выберите видео')
    expect(uploadKindError(file('a.jpg', 'image/jpeg'), 'image')).toBeNull()
    expect(uploadKindError(file('a.mp4', 'video/mp4'), 'any')).toBeNull()
  })

  it('адрес загруженного — сжатая версия, если есть', () => {
    expect(uploadedUrlOf({ url: '/media/a.jpg', optimizedUrl: '/media/a.opt.jpg' } as any)).toBe('/media/a.opt.jpg')
    expect(uploadedUrlOf({ url: '/media/a.jpg', optimizedUrl: null } as any)).toBe('/media/a.jpg')
  })
})

describe('useMediaUpload — загрузка', () => {
  beforeEach(() => {
    upload.mockReset()
    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('картинка: по умолчанию сжатие и адаптивы под экраны проекта; имя без расширения', async () => {
    upload.mockResolvedValue({ url: '/media/x.jpg' } as any)
    const { result } = renderHook(() => useMediaUpload('image'))
    let asset: unknown
    await act(async () => {
      asset = await result.current.upload(file('Фасад.day.jpg', 'image/jpeg'))
    })
    expect(asset).toEqual({ url: '/media/x.jpg' })
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Фасад.day', optimize: true, variantWidths: [1920, 768] })
    )
    expect(result.current.uploading).toBe(false)
  })

  it('галочки поля редактора выключают сжатие и адаптивы', async () => {
    upload.mockResolvedValue({ url: '/media/x.jpg' } as any)
    const { result } = renderHook(() => useMediaUpload('any'))
    await act(async () => {
      await result.current.upload(file('a.jpg', 'image/jpeg'), { optimize: false, responsive: false })
    })
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ optimize: false, variantWidths: undefined }))
  })

  it('видео — без сжатия и адаптивов', async () => {
    upload.mockResolvedValue({ url: '/media/v.mp4' } as any)
    const { result } = renderHook(() => useMediaUpload('any'))
    await act(async () => {
      await result.current.upload(file('v.mp4', 'video/mp4'))
    })
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ optimize: false, variantWidths: undefined }))
  })

  it('не тот вид файла — предупреждение и null, без запроса', async () => {
    const { result } = renderHook(() => useMediaUpload('video'))
    let asset: unknown = 'не трогали'
    await act(async () => {
      asset = await result.current.upload(file('a.jpg', 'image/jpeg'))
    })
    expect(asset).toBeNull()
    expect(upload).not.toHaveBeenCalled()
    expect(window.alert).toHaveBeenCalledWith('Пожалуйста, выберите видео')
  })

  it('ошибка сервера — предупреждение с текстом и null, флаг загрузки снят', async () => {
    upload.mockRejectedValue(new Error('Файл больше 10MB'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() => useMediaUpload('image'))
    let asset: unknown
    await act(async () => {
      asset = await result.current.upload(file('a.jpg', 'image/jpeg'))
    })
    expect(asset).toBeNull()
    expect(window.alert).toHaveBeenCalledWith('Ошибка загрузки: Файл больше 10MB')
    expect(result.current.uploading).toBe(false)
  })
})
