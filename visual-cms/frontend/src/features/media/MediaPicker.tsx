import React from 'react'
import { MediaLibrary, MediaCloseBtn } from './MediaLibrary'
import type { MediaAsset, MediaKind } from '@/shared/api/mediaApi'
import { useOverlayClose } from '@/shared/hooks/useOverlayClose'

export interface MediaPickerProps {
  open: boolean
  kind?: MediaKind | 'any'
  siteId?: string | null
  title?: string
  onClose: () => void
  onSelect: (asset: MediaAsset) => void
}

/**
 * Modal picker for selecting a media asset from the library.
 * Reuses MediaLibrary in selectable mode + supports inline upload.
 */
export const MediaPicker: React.FC<MediaPickerProps> = ({
  open,
  kind = 'any',
  siteId,
  title,
  onClose,
  onSelect,
}) => {
  const overlay = useOverlayClose(onClose)
  if (!open) return null

  const handleSelect = (asset: MediaAsset) => {
    onSelect(asset)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      {...overlay}
    >
      <div className="bg-white rounded-lg shadow-xl w-[min(1100px,95vw)] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {title ??
              (kind === 'image'
                ? 'Выбрать изображение'
                : kind === 'video'
                ? 'Выбрать видео'
                : kind === 'document'
                ? 'Выбрать документ'
                : 'Выбрать медиа')}
          </h2>
          <MediaCloseBtn onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <MediaLibrary
            kind={kind}
            siteId={siteId}
            selectable
            onSelect={handleSelect}
            maxHeight="60vh"
          />
        </div>
      </div>
    </div>
  )
}
