import { useCallback, useState } from 'react'
import { mediaApi, resolveMediaUrl, type MediaAsset } from '@/shared/api/mediaApi'
import { useProjectVariantWidths } from './useProjectVariantWidths'

/** Какие файлы принимает поле. */
export type UploadKind = 'image' | 'video' | 'any'

/** Фильтр диалога выбора файла под вид поля. */
export function acceptFor(kind: UploadKind): string {
  return kind === 'image' ? 'image/*' : kind === 'video' ? 'video/*' : 'image/*,video/*'
}

/** Файл не того вида — текст для человека; подходит — null. */
export function uploadKindError(file: File, kind: UploadKind): string | null {
  if (kind === 'image' && !file.type.startsWith('image/')) return 'Пожалуйста, выберите изображение'
  if (kind === 'video' && !file.type.startsWith('video/')) return 'Пожалуйста, выберите видео'
  return null
}

/** Адрес загруженного файла: сжатая версия, если сервер её сделал (легче, без потери качества). */
export function uploadedUrlOf(asset: MediaAsset): string {
  return resolveMediaUrl(asset.optimizedUrl || asset.url)
}

export interface UploadOptions {
  /** Сжать без потери качества. По умолчанию да. */
  optimize?: boolean
  /** Нарезать адаптивные размеры под экраны проекта. По умолчанию да. */
  responsive?: boolean
}

/**
 * Загрузка файла в медиатеку CMS — общая для поля картинки редактора и полей
 * estate. Проверяет вид файла, для картинок включает сжатие и адаптивные
 * размеры под экраны проекта. Ошибку показывает сама и отдаёт null.
 */
export function useMediaUpload(kind: UploadKind) {
  const variantWidths = useProjectVariantWidths()
  const [uploading, setUploading] = useState(false)

  const upload = useCallback(
    async (file: File, options: UploadOptions = {}): Promise<MediaAsset | null> => {
      const kindError = uploadKindError(file, kind)
      if (kindError) {
        alert(kindError)
        return null
      }
      const { optimize = true, responsive = true } = options
      // Сжатие и адаптивы — только для картинок; бэкенд прочее и так пропускает.
      const imageOptions = file.type.startsWith('image/') && kind !== 'video'

      setUploading(true)
      try {
        return await mediaApi.upload({
          file,
          title: file.name.replace(/\.[^.]+$/, ''),
          optimize: imageOptions ? optimize : false,
          variantWidths: imageOptions && responsive ? variantWidths : undefined,
        })
      } catch (error: any) {
        console.error('Upload error:', error)
        alert(`Ошибка загрузки: ${error?.message || ''}`)
        return null
      } finally {
        setUploading(false)
      }
    },
    [kind, variantWidths]
  )

  return { upload, uploading }
}
