import React, { useMemo, useState, useEffect } from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectRootNode, selectViewport, selectEditMode, selectSelectedNodeId } from '@/features/editor/editorSlice'
import { LayerItem } from './LayerItem'
import { getEffectiveTree } from '@/features/editor/utils/variationUtils'
import type { BlockNodeWithViewport } from '@/features/editor/utils/variationUtils'

// Функция для получения пути до узла
const getPathToNode = (node: BlockNodeWithViewport, targetId: string, path: string[] = []): string[] | null => {
  if (node.id === targetId) {
    return [...path, node.id]
  }
  
  if (node.children) {
    for (const child of node.children) {
      const childPath = getPathToNode(child, targetId, [...path, node.id])
      if (childPath) return childPath
    }
  }
  
  return null
}

// Функция для получения всех ID первого уровня
const getFirstLevelIds = (node: BlockNodeWithViewport): string[] => {
  return [node.id, ...(node.children?.map(child => child.id) || [])]
}

export const LayersPanel: React.FC = () => {
  const rootNode = useAppSelector(selectRootNode)
  const viewport = useAppSelector(selectViewport)
  const editMode = useAppSelector(selectEditMode)
  const selectedNodeId = useAppSelector(selectSelectedNodeId)
  
  // Разделяем ручное и автоматическое разворачивание
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set())
  const [autoExpanded, setAutoExpanded] = useState<Set<string>>(new Set())
  
  // Объединяем оба набора для итогового состояния
  const expandedNodes = useMemo(() => {
    return new Set([...manuallyExpanded, ...autoExpanded])
  }, [manuallyExpanded, autoExpanded])

  // Получаем эффективное дерево с учётом вариаций
  const effectiveTree = useMemo(() => {
    if (!rootNode) return null
    // В режиме responsive показываем дерево с вариациями для активного viewport
    const breakpoint = viewport === 'base' ? null : viewport
    return getEffectiveTree(rootNode, breakpoint, editMode)
  }, [rootNode, viewport, editMode])

  // Инициализация: разворачиваем только первый уровень
  useEffect(() => {
    if (effectiveTree && manuallyExpanded.size === 0 && autoExpanded.size === 0) {
      const firstLevel = getFirstLevelIds(effectiveTree)
      setManuallyExpanded(new Set(firstLevel))
    }
  }, [effectiveTree])

  // При изменении выбранного узла - обновляем ТОЛЬКО автоматически развёрнутые узлы
  useEffect(() => {
    if (!effectiveTree || !selectedNodeId) {
      setAutoExpanded(new Set())
      return
    }
    
    const pathToSelected = getPathToNode(effectiveTree, selectedNodeId)
    if (pathToSelected) {
      // Заменяем autoExpanded новым путём
      setAutoExpanded(new Set(pathToSelected))
    }
  }, [selectedNodeId, effectiveTree])

  const handleToggleNode = (nodeId: string) => {
    setManuallyExpanded(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  if (!effectiveTree) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">
        Нет элементов
      </div>
    )
  }

  return (
    <div className="p-1 space-y-1 min-w-max">
      <LayerItem 
        node={effectiveTree} 
        level={0} 
        expandedNodes={expandedNodes}
        onToggle={handleToggleNode}
      />
    </div>
  )
}
