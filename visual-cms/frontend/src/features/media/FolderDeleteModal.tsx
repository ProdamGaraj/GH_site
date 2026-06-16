import React from 'react'
import { X, Trash2, FolderInput, AlertTriangle } from 'lucide-react'
import type { MediaFolder } from '@/shared/api/mediaApi'

interface FolderDeleteModalProps {
  folder: MediaFolder | null
  onClose: () => void
  onConfirm: (strategy: 'delete-contents' | 'move-to-parent') => void
}

/**
 * Подтверждение удаления папки с выбором судьбы содержимого:
 *   - удалить содержимое целиком;
 *   - переместить содержимое в родительскую папку (или в корень).
 */
export const FolderDeleteModal: React.FC<FolderDeleteModalProps> = ({ folder, onClose, onConfirm }) => {
  if (!folder) return null
  const parentLabel = folder.parentId ? 'родительскую папку' : 'корень'

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-[min(460px,92vw)] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Удалить папку «{folder.name}»
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            Папка не пуста. Выберите, что сделать с её содержимым (подпапки и файлы).
          </p>

          <button
            type="button"
            onClick={() => onConfirm('move-to-parent')}
            className="w-full flex items-start gap-3 px-3 py-3 border border-gray-200 rounded hover:border-primary-400 hover:bg-primary-50 text-left"
          >
            <FolderInput size={18} className="mt-0.5 text-primary-600 shrink-0" />
            <span>
              <span className="block text-sm font-medium text-gray-900">Переместить содержимое</span>
              <span className="block text-xs text-gray-500">
                Подпапки и файлы переедут в {parentLabel}, затем папка удалится.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onConfirm('delete-contents')}
            className="w-full flex items-start gap-3 px-3 py-3 border border-gray-200 rounded hover:border-red-400 hover:bg-red-50 text-left"
          >
            <Trash2 size={18} className="mt-0.5 text-red-600 shrink-0" />
            <span>
              <span className="block text-sm font-medium text-gray-900">Удалить со всем содержимым</span>
              <span className="block text-xs text-gray-500">
                Папка, все подпапки и файлы внутри будут удалены безвозвратно.
              </span>
            </span>
          </button>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
