import React, { useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Box, Loader2 } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { fetchBlocks, selectReusableBlocks, selectBlocksLoading } from '@/features/blocks/blocksSlice'
import type { DragItem, Block } from '@/shared/types'

export const SavedBlocksLibrary: React.FC = () => {
  const dispatch = useAppDispatch()
  const blocks = useAppSelector(selectReusableBlocks)
  const loading = useAppSelector(selectBlocksLoading)

  useEffect(() => {
    dispatch(fetchBlocks())
  }, [dispatch])

  if (loading) {
    return (
      <div className="p-4 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
        <p className="text-xs text-gray-500 mt-2">Загрузка блоков...</p>
      </div>
    )
  }

  if (blocks.length === 0) {
    return (
      <div className="p-4 text-center">
        <Box className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-xs text-gray-500">Нет сохранённых блоков</p>
        <p className="text-xs text-gray-400 mt-1">
          Создайте блоки в редакторе блоков
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {blocks.map((block) => (
        <SavedBlockItem key={block.id} block={block} />
      ))}
    </div>
  )
}

interface SavedBlockItemProps {
  block: Block
}

const SavedBlockItem: React.FC<SavedBlockItemProps> = ({ block }) => {
  const dragData: DragItem = {
    type: 'library-item',
    elementType: 'block-reference',
    tagName: 'div',
    label: block.name,
    id: block.id,
    node: block.structure,
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `saved-block-${block.id}`,
    data: dragData,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-200 rounded-md cursor-grab hover:border-primary-300 hover:shadow-sm transition-all select-none"
      style={{
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
      }}
    >
      {/* Thumbnail */}
      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
        {block.thumbnail ? (
          <img 
            src={block.thumbnail} 
            alt={block.name}
            className="w-full h-full object-cover rounded"
          />
        ) : (
          <Box className="w-5 h-5 text-gray-400" />
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {block.name}
        </div>
        {block.tags && block.tags.length > 0 && (
          <div className="flex gap-1 mt-0.5">
            {block.tags.slice(0, 2).map((tag, idx) => (
              <span 
                key={idx}
                className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
              >
                {tag}
              </span>
            ))}
            {block.tags.length > 2 && (
              <span className="text-xs text-gray-400">
                +{block.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
