import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Film, Loader2, Trash2, Upload, X, Search } from 'lucide-react'
import { mediaApi, type MediaAsset, type MediaKind, resolveMediaUrl } from '@/shared/api/mediaApi'
import { cn } from '@/shared/utils'

export interface MediaLibraryProps {
  /** Restrict by kind. 'any' = both. */
  kind?: MediaKind | 'any'
  /** When true, clicking an asset triggers `onSelect` instead of opening details. */
  selectable?: boolean
  /** Called when user clicks "Select" on an asset (selectable mode). */
  onSelect?: (asset: MediaAsset) => void
  /** When provided, list is filtered by this site (plus globals). */
  siteId?: string | null
  /** Max grid height for embedded usage (e.g. picker modal). */
  maxHeight?: string
  /** Hide the upload area (read-only). */
  readOnly?: boolean
}

const PAGE_SIZE = 12

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  kind = 'any',
  selectable = false,
  onSelect,
  siteId,
  maxHeight,
  readOnly = false,
}) => {
  const [items, setItems] = useState<MediaAsset[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeKind, setActiveKind] = useState<MediaKind | 'any'>(kind)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await mediaApi.list({
        kind: activeKind === 'any' ? undefined : activeKind,
        search: search.trim() || undefined,
        siteId: siteId ?? undefined,
        includeGlobal: true,
        page,
        limit: PAGE_SIZE,
      })
      setItems(resp.items)
      setTotal(resp.total)
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить медиа')
    } finally {
      setLoading(false)
    }
  }, [activeKind, search, siteId, page])

  useEffect(() => {
    load()
  }, [load])

  const handleUploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      if (list.length === 0) return
      setUploading(true)
      setUploadProgress({ done: 0, total: list.length })
      try {
        for (let i = 0; i < list.length; i++) {
          const f = list[i]
          try {
            await mediaApi.upload({
              file: f,
              siteId: siteId ?? undefined,
              title: f.name.replace(/\.[^.]+$/, ''),
            })
          } catch (e: any) {
            // eslint-disable-next-line no-alert
            alert(`Не удалось загрузить "${f.name}": ${e?.message || 'ошибка'}`)
          }
          setUploadProgress({ done: i + 1, total: list.length })
        }
        await load()
      } finally {
        setUploading(false)
        setUploadProgress(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [load, siteId],
  )

  const handleDelete = useCallback(
    async (asset: MediaAsset) => {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Удалить файл "${asset.fileName}"?`)) return
      try {
        await mediaApi.delete(asset.id)
        await load()
      } catch (e: any) {
        // eslint-disable-next-line no-alert
        alert(`Не удалось удалить: ${e?.message || 'ошибка'}`)
      }
    },
    [load],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (e.dataTransfer.files?.length) handleUploadFiles(e.dataTransfer.files)
    },
    [handleUploadFiles],
  )

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Поиск по имени, alt, заголовку…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {kind === 'any' && (
          <div className="flex border border-gray-300 rounded overflow-hidden text-sm">
            {(['any', 'image', 'video'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setActiveKind(k)
                  setPage(1)
                }}
                className={cn(
                  'px-3 py-2 transition-colors',
                  activeKind === k ? 'bg-primary-100 text-primary-700' : 'bg-white text-gray-600 hover:bg-gray-50',
                )}
              >
                {k === 'any' ? 'Все' : k === 'image' ? 'Фото' : 'Видео'}
              </button>
            ))}
          </div>
        )}

        {!readOnly && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={
                kind === 'image'
                  ? 'image/*'
                  : kind === 'video'
                  ? 'video/*'
                  : 'image/*,video/*'
              }
              multiple
              hidden
              onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-60"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading
                ? uploadProgress
                  ? `Загрузка ${uploadProgress.done}/${uploadProgress.total}…`
                  : 'Загрузка…'
                : 'Загрузить'}
            </button>
          </>
        )}
      </div>

      {/* Drop zone wrapper */}
      <div
        onDragEnter={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={readOnly ? undefined : handleDrop}
        className={cn(
          'relative rounded border border-dashed border-gray-300 bg-white',
          dragActive && !readOnly && 'border-primary-500 bg-primary-50',
        )}
        style={{ maxHeight, overflow: maxHeight ? 'auto' : undefined }}
      >
        {error && (
          <div className="p-4 text-sm text-red-600">{error}</div>
        )}

        {loading ? (
          <div className="p-12 flex items-center justify-center text-gray-500">
            <Loader2 className="animate-spin mr-2" size={16} /> Загрузка…
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ImageIcon size={32} className="mx-auto mb-2 text-gray-300" />
            <div>Медиа пока нет.</div>
            {!readOnly && <div className="text-xs mt-1">Перетащите файлы сюда или нажмите «Загрузить».</div>}
          </div>
        ) : (
          <div className="p-3 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {items.map((asset) => (
              <MediaCard
                key={asset.id}
                asset={asset}
                selectable={selectable}
                onSelect={onSelect}
                onDelete={readOnly ? undefined : handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pager */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Всего: {total}. Стр. {page} из {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface MediaCardProps {
  asset: MediaAsset
  selectable: boolean
  onSelect?: (asset: MediaAsset) => void
  onDelete?: (asset: MediaAsset) => void
}

const MediaCard: React.FC<MediaCardProps> = ({ asset, selectable, onSelect, onDelete }) => {
  const url = resolveMediaUrl(asset.url)
  const thumbUrl = asset.thumbnailUrl ? resolveMediaUrl(asset.thumbnailUrl) : url
  const posterUrl = asset.posterUrl ? resolveMediaUrl(asset.posterUrl) : null
  const isVideo = asset.kind === 'video'

  return (
    <div
      className="group relative bg-gray-50 border border-gray-200 rounded overflow-hidden flex flex-col"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '180px 200px' } as React.CSSProperties}
    >
      <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
        {isVideo ? (
          posterUrl ? (
            <img
              src={posterUrl}
              alt={asset.alt ?? asset.fileName}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex flex-col items-center text-gray-400">
              <Film size={28} />
              <span className="text-[10px] mt-1 uppercase">video</span>
            </div>
          )
        ) : (
          <img
            src={thumbUrl}
            alt={asset.alt ?? asset.fileName}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        )}
        {isVideo && (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 text-white text-[10px] rounded">
            VIDEO
          </span>
        )}
      </div>
      <div className="px-2 py-1.5 text-[11px] text-gray-700 truncate" title={asset.fileName}>
        {asset.title || asset.fileName}
      </div>
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
        {selectable && (
          <button
            type="button"
            onClick={() => onSelect?.(asset)}
            className="px-3 py-1.5 bg-white text-gray-900 text-xs rounded shadow"
          >
            Выбрать
          </button>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-white/90 text-gray-900 text-xs rounded shadow"
        >
          Открыть
        </a>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(asset)}
            className="px-3 py-1.5 bg-red-600 text-white text-xs rounded shadow inline-flex items-center gap-1"
          >
            <Trash2 size={12} /> Удалить
          </button>
        )}
      </div>
    </div>
  )
}

/** Lightweight icon-less close button used in modals. */
export const MediaCloseBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="p-1 rounded hover:bg-gray-100 text-gray-500"
    aria-label="Закрыть"
  >
    <X size={18} />
  </button>
)
