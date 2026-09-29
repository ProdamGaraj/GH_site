import React, { useState } from 'react'
import { FolderOpen, X } from 'lucide-react'
import { resolveMediaUrl, type MediaAsset } from '@/shared/api/mediaApi'
import { MediaPicker } from '@/features/media/MediaPicker'
import { ImageUpload } from '@/features/editor/components/RightPanel/ImageUpload'
import { isVideoUrl } from '../gallerySlides'
import { Label, StringListField } from './fields'

type MediaKind = 'image' | 'video' | 'any'

/**
 * Адрес файла из медиатеки — тот же, что пишет редактор CMS (ImageUpload):
 * `/media/…`, его отдаёт и опубликованный сайт.
 */
export function mediaUrlOf(asset: MediaAsset): string {
  return resolveMediaUrl(asset.url)
}

/** Фото или первый кадр видео (без звука и без интерфейса плеера). */
export const MediaThumb: React.FC<{ src: string; video: boolean; className?: string; style?: React.CSSProperties }> = ({
  src,
  video,
  className,
  style,
}) =>
  video ? (
    <video src={src} muted playsInline preload="metadata" className={className} style={style} />
  ) : (
    <img src={src} alt="" loading="lazy" draggable={false} className={className} style={style} />
  )

/**
 * Один медиафайл проекта: адрес вручную, загрузка файла или выбор из
 * медиатеки CMS, с превью. Внутри — тот же ImageUpload, что в редакторе.
 */
export const MediaField: React.FC<{
  label: string
  value: string | null | undefined
  onChange: (url: string) => void
  hint?: string
  kind?: MediaKind
}> = ({ label, value, onChange, hint, kind = 'image' }) => (
  <div>
    <Label hint={hint}>{label}</Label>
    <ImageUpload label="" ariaLabel={label} value={value ?? ''} onChange={onChange} kind={kind} placeholder="/media/…" />
  </div>
)

/**
 * Список медиафайлов: адреса по одному в строке (порядок строк — порядок
 * показа), кнопка «Добавить из медиатеки» (там же загрузка) и миниатюры с
 * удалением. Миниатюры можно выключить, если у поля свои превью.
 */
export const MediaListField: React.FC<{
  label: string
  value: string[]
  onChange: (urls: string[]) => void
  hint?: string
  kind?: MediaKind
  thumbnails?: boolean
}> = ({ label, value, onChange, hint, kind = 'image', thumbnails = true }) => {
  const [pickerOpen, setPickerOpen] = useState(false)
  const urls = value ?? []

  return (
    <div>
      <StringListField label={label} hint={hint} value={urls} onChange={onChange} />
      {thumbnails && urls.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" data-testid="media-thumbs">
          {urls.map((url, i) => (
            <li key={`${i}:${url}`} className="relative w-24 h-16 rounded overflow-hidden bg-gray-100" title={url}>
              <MediaThumb src={resolveMediaUrl(url)} video={isVideoUrl(url)} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(urls.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 p-0.5 bg-white/80 rounded shadow hover:bg-white"
                aria-label={`Убрать ${i + 1}`}
              >
                <X size={12} className="text-gray-600" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800"
      >
        <FolderOpen size={14} /> Добавить из медиатеки
      </button>
      <MediaPicker
        open={pickerOpen}
        kind={kind}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => onChange([...urls, mediaUrlOf(asset)])}
      />
    </div>
  )
}
