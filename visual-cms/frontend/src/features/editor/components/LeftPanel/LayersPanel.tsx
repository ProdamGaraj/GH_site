import React, { useMemo } from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectRootNode, selectViewport, selectEditMode } from '@/features/editor/editorSlice'
import { LayerItem } from './LayerItem'
import { getEffectiveTree } from '@/features/editor/utils/variationUtils'

export const LayersPanel: React.FC = () => {
  const rootNode = useAppSelector(selectRootNode)
  const viewport = useAppSelector(selectViewport)
  const editMode = useAppSelector(selectEditMode)

  // Получаем эффективное дерево с учётом вариаций
  const effectiveTree = useMemo(() => {
    if (!rootNode) return null
    // В режиме responsive показываем дерево с вариациями для активного viewport
    const breakpoint = viewport === 'base' ? null : viewport
    return getEffectiveTree(rootNode, breakpoint, editMode)
  }, [rootNode, viewport, editMode])

  if (!effectiveTree) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">
        Нет элементов
      </div>
    )
  }

  return (
    <div className="p-3 space-y-1">
      <LayerItem node={effectiveTree} level={0} />
    </div>
  )
}
