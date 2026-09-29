import React, { useRef, useState } from 'react'
import { FolderOpen, Loader2, Upload, X } from 'lucide-react'
import { cn } from '@/shared/utils'
import { resolveMediaUrl, type MediaAsset } from '@/shared/api/mediaApi'
import { MediaPicker } from '@/features/media/MediaPicker'
import { acceptFor, uploadedUrlOf, useMediaUpload, type UploadKind } from '@/features/media/useMediaUpload'
import { isVideoUrl } from '../gallerySlides'
import { Label, StringListField, inputCls } from './fields'

/**
 * Адрес файла из медиатеки — тот же, что пишет редактор CMS (ImageUpload):
 * `/media/…`, его отдаёт и опубликованный сайт.
 */
export function mediaUrlOf(asset: MediaAsset): string {
  return resolveMediaUrl(asset.url)
}

/** Фото или первый кадр видео (без звука и без интерфейса плеера). */
export const MediaThumb: React.FC<{
  src: string
  video: boolean
  className?: string
  style?: React.CSSProperties
  onError?: () => void
}> = ({ src, video, className, style, onError }) =>
  video ? (
    <video src={src} muted playsInline preload="metadata" className={className} style={style} onError={onError} />
  ) : (
    <img src={src} alt="" loading="lazy" draggable={false} className={className} style={style} onError={onError} />
  )

const buttonCls =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50'

/** Кнопки «Медиатека» и «Загрузить» — общие для одного файла и списка. */
const MediaButtons: React.FC<{
  onLibrary: () => void
  onUpload: () => void
  uploading: boolean
  children?: React.ReactNode
}> = ({ onLibrary, onUpload, uploading, children }) => (
  <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={onLibrary} className={buttonCls}>
      <FolderOpen size={14} /> Медиатека
    </button>
    <button type="button" onClick={onUpload} disabled={uploading} className={buttonCls}>
      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
      {uploading ? 'Загрузка…' : 'Загрузить'}
    </button>
    {children}
  </div>
)

/** Файл, перетащенный на зону: подсветка, пока его несут, и приём при отпускании. */
function useFileDrop(onFiles: (files: File[]) => void) {
  const [over, setOver] = useState(false)
  const handlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setOver(true)
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setOver(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length) onFiles(files)
    },
  }
  return { over, handlers }
}

/**
 * Один медиафайл проекта одной строкой: слева миниатюра (на неё можно
 * перетащить файл), справа адрес и кнопки — медиатека, загрузка, очистка.
 * Картинки при загрузке сжимаются и режутся под экраны проекта, как в
 * редакторе CMS по умолчанию.
 */
export const MediaField: React.FC<{
  label: string
  value: string | null | undefined
  onChange: (url: string) => void
  hint?: string
  kind?: UploadKind
}> = ({ label, value, onChange, hint, kind = 'image' }) => {
  const url = value ?? ''
  const [pickerOpen, setPickerOpen] = useState(false)
  // Адрес, превью которого не открылось: показываем подсказку, пока адрес не сменят.
  const [broken, setBroken] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const { upload, uploading } = useMediaUpload(kind)

  const uploadFile = async (file: File | undefined) => {
    if (!file) return
    const asset = await upload(file)
    if (asset) onChange(uploadedUrlOf(asset))
  }
  const drop = useFileDrop((files) => uploadFile(files[0]))

  let preview: React.ReactNode
  if (uploading) preview = <Loader2 size={20} className="animate-spin text-gray-400" />
  else if (url && broken !== url)
    preview = (
      <MediaThumb
        src={resolveMediaUrl(url)}
        video={kind === 'video' || isVideoUrl(url)}
        className="w-full h-full object-contain"
        onError={() => setBroken(url)}
      />
    )
  else preview = <span className="px-2 text-center text-[11px] leading-tight text-gray-400">{url ? 'файл не открывается' : 'перетащите файл'}</span>

  return (
    <div>
      <Label hint={hint}>{label}</Label>
      <div className="flex gap-3 items-start">
        <div
          {...drop.handlers}
          data-testid="media-tile"
          title="Перетащите файл сюда"
          className={cn(
            'w-[120px] h-[80px] shrink-0 rounded-md border overflow-hidden bg-gray-50 flex items-center justify-center',
            drop.over ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'
          )}
        >
          {preview}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <input
            className={inputCls}
            aria-label={label}
            value={url}
            placeholder="/media/…"
            onChange={(e) => onChange(e.target.value)}
          />
          <MediaButtons onLibrary={() => setPickerOpen(true)} onUpload={() => fileInput.current?.click()} uploading={uploading}>
            {url && (
              <button
                type="button"
                onClick={() => onChange('')}
                aria-label={`Очистить: ${label}`}
                className="p-1.5 text-gray-400 hover:text-red-600"
              >
                <X size={14} />
              </button>
            )}
          </MediaButtons>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        hidden
        data-testid="media-file-input"
        accept={acceptFor(kind)}
        onChange={(e) => {
          uploadFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <MediaPicker
        open={pickerOpen}
        kind={kind}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => onChange(mediaUrlOf(asset))}
      />
    </div>
  )
}

/**
 * Список медиафайлов: адреса по одному в строке (порядок строк — порядок
 * показа), миниатюры с удалением, медиатека и загрузка — файлы встают в
 * конец. Файлы можно перетащить на блок целиком. Миниатюры можно выключить,
 * если у поля свои превью.
 */
export const MediaListField: React.FC<{
  label: string
  value: string[]
  onChange: (urls: string[]) => void
  hint?: string
  kind?: UploadKind
  thumbnails?: boolean
}> = ({ label, value, onChange, hint, kind = 'image', thumbnails = true }) => {
  const [pickerOpen, setPickerOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const { upload, uploading } = useMediaUpload(kind)
  const urls = value ?? []

  // По одному: порядок в списке — порядок выбора, неудачный файл не мешает остальным.
  const uploadFiles = async (files: File[]) => {
    const added: string[] = []
    for (const file of files) {
      const asset = await upload(file)
      if (asset) added.push(uploadedUrlOf(asset))
    }
    if (added.length) onChange([...urls, ...added])
  }
  const drop = useFileDrop(uploadFiles)

  return (
    <div
      {...drop.handlers}
      data-testid="media-list"
      className={cn('rounded-md', drop.over && 'ring-2 ring-primary-200 bg-primary-50/40')}
    >
      <StringListField label={label} hint={hint} value={urls} onChange={onChange} />
      {thumbnails && urls.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" data-testid="media-thumbs">
          {urls.map((url, i) => (
            <li
              key={`${i}:${url}`}
              className="relative w-[120px] h-[80px] rounded-md overflow-hidden border border-gray-200 bg-gray-50"
              title={url}
            >
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
      <div className="mt-2">
        <MediaButtons onLibrary={() => setPickerOpen(true)} onUpload={() => fileInput.current?.click()} uploading={uploading}>
          <span className="text-xs text-gray-400">или перетащите файлы сюда</span>
        </MediaButtons>
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        data-testid="media-file-input"
        accept={acceptFor(kind)}
        onChange={(e) => {
          uploadFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <MediaPicker
        open={pickerOpen}
        kind={kind}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => onChange([...urls, mediaUrlOf(asset)])}
      />
    </div>
  )
}
