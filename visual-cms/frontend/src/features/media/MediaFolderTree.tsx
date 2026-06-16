import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Folder,
  FolderPlus,
  Pencil,
  Trash2,
  Files,
  ChevronRight,
  ChevronDown,
  Film,
  FileText,
  Loader2,
} from 'lucide-react'
import {
  mediaApi,
  mediaFolderApi,
  resolveMediaUrl,
  type MediaFolder,
  type MediaFolderCounts,
  type MediaAsset,
} from '@/shared/api/mediaApi'
import { buildFolderTree, collectDescendantIds, type FolderTreeNode } from './folderTree'
import { FolderDeleteModal } from './FolderDeleteModal'
import { cn } from '@/shared/utils'

/** null = «Все файлы»; 'root' = файлы вне папок (корень); string = конкретная папка. */
export type FolderSelection = string | 'root' | null

/** Ключ контейнера файлов: id папки или '__root__' (файлы без папки). */
type FolderKey = string

const ROOT_KEY = '__root__'
const FILES_PER_NODE = 100
const MEDIA_DND_TYPE = 'text/media-id'

interface MediaFolderTreeProps {
  folders: MediaFolder[]
  counts?: MediaFolderCounts
  selected: FolderSelection
  onSelect: (sel: FolderSelection) => void
  /** Перезагрузить папки/счётчики/сетку после CRUD или перемещения. */
  onChanged: () => void
  /** Бамп — сигнал перечитать файлы раскрытых папок (после внешних изменений). */
  refreshToken?: number
  siteId?: string | null
  readOnly?: boolean
}

/** Бейдж с кол-вом файлов (скрыт при 0/undefined). */
const CountChip: React.FC<{ n?: number }> = ({ n }) =>
  n && n > 0 ? (
    <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 text-[10px] leading-none">
      {n}
    </span>
  ) : null

export const MediaFolderTree: React.FC<MediaFolderTreeProps> = ({
  folders,
  counts,
  selected,
  onSelect,
  onChanged,
  refreshToken,
  siteId,
  readOnly = false,
}) => {
  const [deleteCandidate, setDeleteCandidate] = useState<MediaFolder | null>(null)
  // Корень `/` раскрыт по умолчанию — чтобы папки были видны сразу.
  const [expanded, setExpanded] = useState<Set<FolderKey>>(new Set([ROOT_KEY]))
  const [filesByKey, setFilesByKey] = useState<Record<FolderKey, { items: MediaAsset[]; total: number }>>({})
  const [loadingKeys, setLoadingKeys] = useState<Set<FolderKey>>(new Set())
  const [dragOverKey, setDragOverKey] = useState<FolderKey | null>(null)

  const expandedRef = useRef(expanded)
  expandedRef.current = expanded

  const createParentId = typeof selected === 'string' && selected !== 'root' ? selected : null
  const selectedFolder = createParentId ? folders.find((f) => f.id === createParentId) : null

  // --- Загрузка файлов внутри узла (lazy, по раскрытию) ---
  const fetchFiles = useCallback(
    async (key: FolderKey) => {
      setLoadingKeys((prev) => new Set(prev).add(key))
      try {
        const resp = await mediaApi.list({
          folderId: key === ROOT_KEY ? 'root' : key,
          siteId: siteId ?? undefined,
          includeGlobal: true,
          limit: FILES_PER_NODE,
          sort: 'name',
        })
        setFilesByKey((prev) => ({ ...prev, [key]: { items: resp.items, total: resp.total } }))
      } catch {
        // не критично — оставляем узел без файлов
      } finally {
        setLoadingKeys((prev) => {
          const n = new Set(prev)
          n.delete(key)
          return n
        })
      }
    },
    [siteId],
  )

  const toggle = useCallback(
    (key: FolderKey) => {
      setExpanded((prev) => {
        const n = new Set(prev)
        if (n.has(key)) n.delete(key)
        else {
          n.add(key)
          if (!filesByKey[key]) fetchFiles(key)
        }
        return n
      })
    },
    [filesByKey, fetchFiles],
  )

  // Перечитываем файлы всех раскрытых узлов при внешних изменениях.
  useEffect(() => {
    if (refreshToken === undefined) return
    expandedRef.current.forEach((key) => fetchFiles(key))
  }, [refreshToken, fetchFiles])

  // Смена сайта (или первый рендер): сбрасываем кэш и читаем раскрытые узлы заново.
  useEffect(() => {
    setFilesByKey({})
    expandedRef.current.forEach((key) => fetchFiles(key))
  }, [fetchFiles])

  // --- CRUD папок ---
  const handleCreate = useCallback(
    async (parentId: string | null) => {
      // eslint-disable-next-line no-alert
      const name = window.prompt(parentId ? 'Название подпапки' : 'Название папки')?.trim()
      if (!name) return
      try {
        const created = await mediaFolderApi.create({ name, parentId, siteId: siteId ?? null })
        onChanged()
        onSelect(created.id)
      } catch (e: any) {
        // eslint-disable-next-line no-alert
        alert(`Не удалось создать папку: ${e?.message || 'ошибка'}`)
      }
    },
    [siteId, onChanged, onSelect],
  )

  const handleRename = useCallback(
    async (folder: MediaFolder) => {
      // eslint-disable-next-line no-alert
      const name = window.prompt('Новое название', folder.name)?.trim()
      if (!name || name === folder.name) return
      try {
        await mediaFolderApi.update(folder.id, { name })
        onChanged()
      } catch (e: any) {
        // eslint-disable-next-line no-alert
        alert(`Не удалось переименовать: ${e?.message || 'ошибка'}`)
      }
    },
    [onChanged],
  )

  const resetSelectionIfNeeded = useCallback(
    (folder: MediaFolder, includeDescendants: boolean) => {
      if (typeof selected !== 'string' || selected === 'root') return
      const affected = new Set<string>([folder.id])
      if (includeDescendants) {
        for (const id of collectDescendantIds(folders, folder.id)) affected.add(id)
      }
      if (affected.has(selected)) onSelect(null)
    },
    [selected, folders, onSelect],
  )

  const handleDeleteClick = useCallback(
    async (folder: MediaFolder) => {
      const hasSubfolders = folders.some((f) => f.parentId === folder.id)
      if (hasSubfolders) {
        setDeleteCandidate(folder)
        return
      }
      try {
        await mediaFolderApi.delete(folder.id)
        resetSelectionIfNeeded(folder, false)
        onChanged()
      } catch {
        setDeleteCandidate(folder)
      }
    },
    [folders, onChanged, resetSelectionIfNeeded],
  )

  const handleDeleteConfirm = useCallback(
    async (strategy: 'delete-contents' | 'move-to-parent') => {
      if (!deleteCandidate) return
      try {
        await mediaFolderApi.delete(deleteCandidate.id, strategy)
        resetSelectionIfNeeded(deleteCandidate, strategy === 'delete-contents')
        setDeleteCandidate(null)
        onChanged()
      } catch (e: any) {
        // eslint-disable-next-line no-alert
        alert(`Не удалось удалить: ${e?.message || 'ошибка'}`)
      }
    },
    [deleteCandidate, onChanged, resetSelectionIfNeeded],
  )

  // --- Drag & drop перемещения файлов ---
  const isMediaDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(MEDIA_DND_TYPE)

  const handleDropOnFolder = useCallback(
    async (e: React.DragEvent, targetFolderId: string | null) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOverKey(null)
      const id = e.dataTransfer.getData(MEDIA_DND_TYPE)
      if (!id) return
      try {
        await mediaApi.update(id, { folderId: targetFolderId })
        onChanged()
      } catch (err: any) {
        // eslint-disable-next-line no-alert
        alert(`Не удалось переместить файл: ${err?.message || 'ошибка'}`)
      }
    },
    [onChanged],
  )

  const dropTargetProps = (key: FolderKey, targetFolderId: string | null) =>
    readOnly
      ? {}
      : {
          onDragOver: (e: React.DragEvent) => {
            if (isMediaDrag(e)) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDragOverKey(key)
            }
          },
          onDragLeave: () => setDragOverKey((cur) => (cur === key ? null : cur)),
          onDrop: (e: React.DragEvent) => handleDropOnFolder(e, targetFolderId),
        }

  // --- Рендер ---
  const tree = buildFolderTree(folders)
  const rowBase = 'group/folder w-full flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer'

  const renderFileLeaf = (asset: MediaAsset, depth: number) => {
    const thumb = asset.thumbnailUrl || (asset.kind === 'image' ? asset.url : null)
    return (
      <div
        key={asset.id}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-gray-600 hover:bg-gray-50"
        style={{ paddingLeft: 8 + (depth + 1) * 14 }}
        draggable={!readOnly}
        onDragStart={(e) => {
          e.dataTransfer.setData(MEDIA_DND_TYPE, asset.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        title={asset.fileName}
      >
        <span className="w-5 h-5 shrink-0 rounded bg-gray-100 overflow-hidden flex items-center justify-center text-gray-400">
          {thumb ? (
            <img
              src={resolveMediaUrl(thumb)}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
          ) : asset.kind === 'video' ? (
            <Film size={12} />
          ) : (
            <FileText size={12} />
          )}
        </span>
        <span className="truncate">{asset.title || asset.fileName}</span>
      </div>
    )
  }

  const renderFiles = (key: FolderKey, depth: number, suppressEmpty = false) => {
    const bucket = filesByKey[key]
    const isLoading = loadingKeys.has(key)
    if (isLoading && !bucket) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400" style={{ paddingLeft: 8 + (depth + 1) * 14 }}>
          <Loader2 size={12} className="animate-spin" /> Загрузка…
        </div>
      )
    }
    if (!bucket) return null
    return (
      <>
        {bucket.items.map((a) => renderFileLeaf(a, depth))}
        {bucket.total > bucket.items.length && (
          <button
            type="button"
            onClick={() => onSelect(key === ROOT_KEY ? 'root' : key)}
            className="px-2 py-1 text-[11px] text-primary-600 hover:underline"
            style={{ paddingLeft: 8 + (depth + 1) * 14 }}
          >
            Показать все ({bucket.total})…
          </button>
        )}
        {bucket.items.length === 0 && !suppressEmpty && (
          <div className="px-2 py-1 text-[11px] text-gray-400" style={{ paddingLeft: 8 + (depth + 1) * 14 }}>
            Пусто
          </div>
        )}
      </>
    )
  }

  const renderFolderNode = (node: FolderTreeNode, extraIndent = 1): React.ReactNode => {
    const { folder } = node
    const depth = node.depth + extraIndent
    const key = folder.id
    const active = selected === folder.id
    const isOpen = expanded.has(key)
    const isDropTarget = dragOverKey === key
    return (
      <React.Fragment key={folder.id}>
        <div
          className={cn(
            rowBase,
            active ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100',
            isDropTarget && 'ring-2 ring-primary-400 bg-primary-50',
          )}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onSelect(folder.id)}
          role="button"
          {...dropTargetProps(key, folder.id)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggle(key)
            }}
            className="p-0.5 -ml-1 rounded text-gray-400 hover:text-gray-700 shrink-0"
            title={isOpen ? 'Свернуть' : 'Развернуть'}
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <Folder size={15} className="shrink-0" />
          <span className="flex-1 truncate" title={folder.name}>
            {folder.name}
          </span>
          <CountChip n={counts?.byFolder[folder.id]} />
          {!readOnly && (
            <span className="flex items-center gap-0.5">
              <button
                type="button"
                title="Переименовать"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRename(folder)
                }}
                className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-white/60"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                title="Удалить"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteClick(folder)
                }}
                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-white/60"
              >
                <Trash2 size={13} />
              </button>
            </span>
          )}
        </div>
        {isOpen && (
          <>
            {node.children.map((child) => renderFolderNode(child, extraIndent))}
            {renderFiles(key, depth, node.children.length > 0)}
          </>
        )}
      </React.Fragment>
    )
  }

  const rootOpen = expanded.has(ROOT_KEY)
  const rootDrop = dragOverKey === ROOT_KEY

  return (
    <div className="flex flex-col gap-0.5 text-gray-700">
      <div className="flex items-center justify-between px-2 mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Папки</span>
        {!readOnly && (
          <button
            type="button"
            disabled={selected === null}
            title={
              selected === null
                ? 'Выберите «/» или папку, чтобы создать'
                : selectedFolder
                  ? `Создать подпапку в «${selectedFolder.name}»`
                  : 'Создать папку в корне «/»'
            }
            onClick={() => handleCreate(createParentId)}
            className="p-1 rounded text-gray-500 hover:bg-gray-100 hover:text-primary-600 inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-500"
          >
            <FolderPlus size={15} />
            <span className="text-[11px]">{selectedFolder ? 'Подпапка' : 'Папка'}</span>
          </button>
        )}
      </div>

      {/* Все файлы — фильтр без раскрытия */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(rowBase, 'pl-7', selected === null ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100')}
      >
        <Files size={15} /> Все файлы
        <CountChip n={counts?.total} />
      </button>

      {/* Корень дерева "/" — содержит все папки и файлы без папки; drop-цель «переместить в корень» */}
      <div
        className={cn(
          rowBase,
          selected === 'root' ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100',
          rootDrop && 'ring-2 ring-primary-400 bg-primary-50',
        )}
        onClick={() => onSelect('root')}
        role="button"
        title="Корень дерева"
        {...dropTargetProps(ROOT_KEY, null)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggle(ROOT_KEY)
          }}
          className="p-0.5 -ml-1 rounded text-gray-400 hover:text-gray-700 shrink-0"
          title={rootOpen ? 'Свернуть' : 'Развернуть'}
        >
          {rootOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Folder size={15} className="shrink-0" />
        <span className="flex-1 truncate font-medium">/</span>
        <CountChip n={counts?.root} />
      </div>

      {rootOpen && (
        <>
          {/* Папки всегда выше файлов */}
          {tree.map((node) => renderFolderNode(node, 1))}
          {renderFiles(ROOT_KEY, 0, tree.length > 0)}
        </>
      )}

      <FolderDeleteModal
        folder={deleteCandidate}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
