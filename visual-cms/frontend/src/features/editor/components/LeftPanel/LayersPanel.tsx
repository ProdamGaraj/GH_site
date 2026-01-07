import React from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectRootNode } from '@/features/editor/editorSlice'
import { LayerItem } from './LayerItem'

export const LayersPanel: React.FC = () => {
  const rootNode = useAppSelector(selectRootNode)

  if (!rootNode) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">
        Нет элементов
      </div>
    )
  }

  return (
    <div className="p-3 space-y-1">
      <LayerItem node={rootNode} level={0} />
    </div>
  )
}
