import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Film, FileText, Loader2, Trash2, Upload, X, Search, Copy, Check, FolderInput, Layers, ChevronRight } from 'lucide-react'
import {
  mediaApi,
  mediaFolderApi,
  mediaAcceptAttr,
  type MediaAsset,
  type MediaKind,
  type MediaSort,
  type MediaFolder,
  type MediaFolderCounts,
  resolveMediaUrl,
} from '@/shared/api/mediaApi'
import { cn } from '@/shared/utils'
import { MediaFolderTree, type FolderSelection } from './MediaFolderTree'
import { MediaFolderPickerModal } from './MediaFolderPickerModal'
import { getFolderPath } from './folderTree'
import { useProjectVariantWidths } from './useProjectVariantWidths'

/** Копирование в буфер с fallback для незащищённого контекста (не https/localhost). */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Расширение файла в верхнем регистре для бейджа карточки документа. */
function fileExt(fileName: string): string {
  const ext = fileName.split('.').pop()
  return ext && ext !== fileName ? ext.toUpperCase() : 'DOC'
}

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
  const [sort, setSort] = useState<MediaSort>('newest')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Папки
  const [folders, setFolders] = useState<MediaFolder[]>([])
  const [folderCounts, setFolderCounts] = useState<MediaFolderCounts | undefined>(undefined)
  const [folderSel, setFolderSel] = useState<FolderSelection>(null)
  const [moveTarget, setMoveTarget] = useState<MediaAsset | null>(null)
  // Бамп — заставляет дерево перечитать файлы раскрытых папок после изменений.
  const [treeRefreshToken, setTreeRefreshToken] = useState(0)

  // Опции загрузки изображений (фичи №1 и №2)
  const [optimize, setOptimize] = useState(true)
  const [makeResponsive, setMakeResponsive] = useState(true)
  const variantWidths = useProjectVariantWidths()
  const showImageOptions = !readOnly && (kind === 'image' || kind === 'any')

  const loadFolders = useCallback(async () => {
    try {
      const resp = await mediaFolderApi.list(siteId ?? undefined)
      setFolders(resp.items)
      setFolderCounts(resp.counts)
    } catch {
      // папки некритичны для показа файлов — молча игнорируем
    }
  }, [siteId])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await mediaApi.list({
        kind: activeKind === 'any' ? undefined : activeKind,
        search: search.trim() || undefined,
        siteId: siteId ?? undefined,
        includeGlobal: true,
        folderId: folderSel === null ? undefined : folderSel,
        sort,
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
  }, [activeKind, search, siteId, folderSel, sort, page])

  useEffect(() => {
    load()
  }, [load])

  // Полное обновление после изменений: сетка + папки/счётчики + перечитка раскрытых узлов дерева.
  const refreshAll = useCallback(async () => {
    await Promise.all([load(), loadFolders()])
    setTreeRefreshToken((t) => t + 1)
  }, [load, loadFolders])

  // Куда грузим: если выбрана конкретная папка — в неё; иначе в корень.
  const uploadFolderId = typeof folderSel === 'string' && folderSel !== 'root' ? folderSel : null

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
              folderId: uploadFolderId,
              title: f.name.replace(/\.[^.]+$/, ''),
              optimize: showImageOptions ? optimize : false,
              variantWidths: showImageOptions && makeResponsive ? variantWidths : undefined,
            })
          } catch (e: any) {
            // eslint-disable-next-line no-alert
            alert(`Не удалось загрузить "${f.name}": ${e?.message || 'ошибка'}`)
          }
          setUploadProgress({ done: i + 1, total: list.length })
        }
        await refreshAll()
      } finally {
        setUploading(false)
        setUploadProgress(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [refreshAll, siteId, uploadFolderId, showImageOptions, optimize, makeResponsive, variantWidths],
  )

  const handleDelete = useCallback(
    async (asset: MediaAsset) => {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Удалить файл "${asset.fileName}"?`)) return
      try {
        await mediaApi.delete(asset.id)
        await refreshAll()
      } catch (e: any) {
        // eslint-disable-next-line no-alert
        alert(`Не удалось удалить: ${e?.message || 'ошибка'}`)
      }
    },
    [refreshAll],
  )

  const handleMove = useCallback(
    async (folderId: string | null) => {
      if (!moveTarget) return
      try {
        await mediaApi.update(moveTarget.id, { folderId })
        setMoveTarget(null)
        await refreshAll()
      } catch (e: any) {
        // eslint-disable-next-line no-alert
        alert(`Не удалось переместить: ${e?.message || 'ошибка'}`)
      }
    },
    [moveTarget, refreshAll],
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
  const folderPath = folderSel && folderSel !== 'root' ? getFolderPath(folders, folderSel) : []

  return (
    <div className="flex gap-4 items-start">
      {/* Folder sidebar */}
      <aside
        className="w-52 shrink-0 border border-gray-200 rounded bg-white p-2 overflow-y-auto"
        style={{ maxHeight: maxHeight ?? undefined }}
      >
        <MediaFolderTree
          folders={folders}
          counts={folderCounts}
          selected={folderSel}
          onSelect={(sel) => {
            setFolderSel(sel)
            setPage(1)
          }}
          onChanged={refreshAll}
          refreshToken={treeRefreshToken}
          siteId={siteId}
          readOnly={readOnly}
        />
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
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
              {(['any', 'image', 'video', 'document'] as const).map((k) => (
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
                  {k === 'any' ? 'Все' : k === 'image' ? 'Фото' : k === 'video' ? 'Видео' : 'Документы'}
                </button>
              ))}
            </div>
          )}

          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as MediaSort)
              setPage(1)
            }}
            className="px-2 py-2 text-sm border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="Сортировка"
          >
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="name">По имени</option>
            <option value="largest">Сначала большие</option>
            <option value="smallest">Сначала маленькие</option>
          </select>

          {!readOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={mediaAcceptAttr(kind)}
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

        {/* Опции загрузки изображений (фичи №1 и №2) */}
        {showImageOptions && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={optimize} onChange={(e) => setOptimize(e.target.checked)} />
              Оптимизировать (уменьшить вес без потери качества)
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={makeResponsive}
                onChange={(e) => setMakeResponsive(e.target.checked)}
              />
              Создать адаптивные размеры
              {variantWidths.length > 0 && (
                <span className="text-gray-400">({variantWidths.length} из настроек проекта)</span>
              )}
            </label>
          </div>
        )}

        {/* Breadcrumbs */}
        {(folderSel === 'root' || folderPath.length > 0) && (
          <div className="flex items-center flex-wrap gap-1 text-xs text-gray-500">
            <button type="button" onClick={() => setFolderSel(null)} className="hover:text-primary-600">
              Все файлы
            </button>
            {folderSel === 'root' && (
              <>
                <ChevronRight size={12} />
                <span className="text-gray-700">/ (корень)</span>
              </>
            )}
            {folderPath.map((f, idx) => (
              <React.Fragment key={f.id}>
                <ChevronRight size={12} />
                {idx === folderPath.length - 1 ? (
                  <span className="text-gray-700">{f.name}</span>
                ) : (
                  <button type="button" onClick={() => setFolderSel(f.id)} className="hover:text-primary-600">
                    {f.name}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

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
          {error && <div className="p-4 text-sm text-red-600">{error}</div>}

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
                  onMove={readOnly ? undefined : (a) => setMoveTarget(a)}
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

      {/* Move-to-folder modal */}
      <MediaFolderPickerModal
        open={!!moveTarget}
        folders={folders}
        currentFolderId={moveTarget?.folderId ?? null}
        onClose={() => setMoveTarget(null)}
        onPick={handleMove}
      />
    </div>
  )
}

interface MediaCardProps {
  asset: MediaAsset
  selectable: boolean
  onSelect?: (asset: MediaAsset) => void
  onDelete?: (asset: MediaAsset) => void
  onMove?: (asset: MediaAsset) => void
}

const MediaCard: React.FC<MediaCardProps> = ({ asset, selectable, onSelect, onDelete, onMove }) => {
  const url = resolveMediaUrl(asset.url)
  const thumbUrl = asset.thumbnailUrl ? resolveMediaUrl(asset.thumbnailUrl) : url
  const posterUrl = asset.posterUrl ? resolveMediaUrl(asset.posterUrl) : null
  const isVideo = asset.kind === 'video'
  const isDocument = asset.kind === 'document'
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(url)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }, [url])

  return (
    <div
      className="group relative bg-gray-50 border border-gray-200 rounded overflow-hidden flex flex-col"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '180px 200px' } as React.CSSProperties}
      draggable={!!onMove}
      onDragStart={
        onMove
          ? (e) => {
              e.dataTransfer.setData('text/media-id', asset.id)
              e.dataTransfer.effectAllowed = 'move'
            }
          : undefined
      }
    >
      <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
        {isDocument ? (
          <div className="flex flex-col items-center text-gray-400">
            <FileText size={28} />
            <span className="text-[10px] mt-1 uppercase">{fileExt(asset.fileName)}</span>
          </div>
        ) : isVideo ? (
          posterUrl ? (
            <img
              src={posterUrl}
              alt={asset.alt ?? asset.fileName}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              draggable={false}
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
            draggable={false}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        )}
        {isVideo && (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 text-white text-[10px] rounded">
            VIDEO
          </span>
        )}
        {isDocument && (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 text-white text-[10px] rounded">
            {fileExt(asset.fileName)}
          </span>
        )}
        {asset.variants.length > 0 && (
          <span
            className="absolute top-1 right-1 px-1.5 py-0.5 bg-primary-600/80 text-white text-[10px] rounded inline-flex items-center gap-0.5"
            title={`Адаптивных размеров: ${asset.variants.length}`}
          >
            <Layers size={10} /> {asset.variants.length}
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
          draggable={false}
          className="px-3 py-1.5 bg-white/90 text-gray-900 text-xs rounded shadow"
        >
          Открыть
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 bg-white/90 text-gray-900 text-xs rounded shadow inline-flex items-center gap-1"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Скопировано' : 'Копировать ссылку'}
        </button>
        {onMove && (
          <button
            type="button"
            onClick={() => onMove(asset)}
            className="px-3 py-1.5 bg-white/90 text-gray-900 text-xs rounded shadow inline-flex items-center gap-1"
          >
            <FolderInput size={12} /> В папку
          </button>
        )}
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
