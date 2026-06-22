import React from 'react'
import { Folder, FolderOpen, X } from 'lucide-react'
import type { MediaFolder } from '@/shared/api/mediaApi'
import { buildFolderTree, flattenTree } from './folderTree'
import { cn } from '@/shared/utils'
import { useOverlayClose } from '@/shared/hooks/useOverlayClose'

interface MediaFolderPickerModalProps {
  open: boolean
  folders: MediaFolder[]
  /** Текущая папка ассета (для подсветки). */
  currentFolderId: string | null
  title?: string
  onClose: () => void
  onPick: (folderId: string | null) => void
}

/** Лёгкая модалка выбора папки (для перемещения файла). */
export const MediaFolderPickerModal: React.FC<MediaFolderPickerModalProps> = ({
  open,
  folders,
  currentFolderId,
  title = 'Переместить в папку',
  onClose,
  onPick,
}) => {
  const overlay = useOverlayClose(onClose)
  if (!open) return null
  const flat = flattenTree(buildFolderTree(folders))

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50"
      {...overlay}
    >
      <div className="bg-white rounded-lg shadow-xl w-[min(460px,92vw)] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => onPick(null)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-2 rounded text-sm',
              currentFolderId === null ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100',
            )}
          >
            <FolderOpen size={15} /> / (корень)
          </button>
          {flat.map(({ folder, depth }) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => onPick(folder.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-2 rounded text-sm',
                currentFolderId === folder.id ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100',
              )}
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              <Folder size={15} className="shrink-0" />
              <span className="truncate" title={folder.name}>
                {folder.name}
              </span>
            </button>
          ))}
          {folders.length === 0 && (
            <div className="px-2 py-3 text-xs text-gray-400">Папок пока нет — создайте их в медиатеке.</div>
          )}
        </div>
      </div>
    </div>
  )
}
