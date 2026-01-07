import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import * as Icons from 'lucide-react'
import type { LibraryItem as LibraryItemType, DragItem } from '@/shared/types'

interface LibraryItemProps {
  item: LibraryItemType
}

export const LibraryItem: React.FC<LibraryItemProps> = ({ item }) => {
  const dragData = {
    type: 'library-item',
    elementType: item.type,
    tagName: item.tagName,
    label: item.label,
  } as DragItem

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${item.type}-${item.label}`,
    data: dragData,
  })

  console.log(`LibraryItem ${item.label}: draggable setup`, { attributes, listeners, isDragging })

  const IconComponent = (Icons as any)[item.icon] || Icons.Box

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="library-item flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-200 rounded-md cursor-grab hover:border-primary-300 hover:shadow-sm transition-all select-none"
      style={{
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
      }}
    >
      <div className="p-1.5 bg-gray-50 rounded">
        <IconComponent size={16} className="text-gray-600" />
      </div>
      <span className="text-sm text-gray-700 pointer-events-none">{item.label}</span>
    </div>
  )
}
