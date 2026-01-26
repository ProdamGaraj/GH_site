import React, { useMemo, useState, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
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

  // Инициализация: разворачиваем только первый уровень (в auto, чтобы работал автоколлапс)
  useEffect(() => {
    if (effectiveTree && manuallyExpanded.size === 0 && autoExpanded.size === 0) {
      const firstLevel = getFirstLevelIds(effectiveTree)
      setAutoExpanded(new Set(firstLevel))
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
      // Новый путь к выбранному элементу
      const newAutoExpanded = new Set(pathToSelected)
      
      // Автоматически сворачиваем элементы которые:
      // 1. Были в autoExpanded (автоматически развёрнуты)
      // 2. НЕ в manuallyExpanded (не развёрнуты вручную)
      // 3. НЕ в новом пути (не нужны для нового выбранного элемента)
      setManuallyExpanded(prev => {
        const next = new Set(prev)
        // Удаляем из ручных те, что были только в авто
        autoExpanded.forEach(id => {
          if (!newAutoExpanded.has(id) && !prev.has(id)) {
            // Элемент был только в авто и больше не нужен - ничего не делаем
          }
        })
        return next
      })
      
      // Заменяем autoExpanded новым путём
      setAutoExpanded(newAutoExpanded)
    }
  }, [selectedNodeId, effectiveTree])

  const handleToggleNode = (nodeId: string) => {
    const isCurrentlyExpanded = expandedNodes.has(nodeId)
    
    if (isCurrentlyExpanded) {
      // Сворачиваем: удаляем из обоих наборов
      setManuallyExpanded(prev => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
      setAutoExpanded(prev => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
    } else {
      // Разворачиваем: добавляем в ручные
      setManuallyExpanded(prev => {
        const next = new Set(prev)
        next.add(nodeId)
        return next
      })
    }
  }

  if (!effectiveTree) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">
        Нет элементов
      </div>
    )
  }
  
  // Drop zone вверху списка (вставка в начало)
  const { setNodeRef: setTopDropRef, isOver: isOverTop } = useDroppable({
    id: 'layers-list-top',
    data: {
      type: 'layers-list-edge',
      position: 'top',
      parentId: effectiveTree.id,
      targetIndex: 0,
    },
  })
  
  // Drop zone внизу списка (вставка в конец)
  const { setNodeRef: setBottomDropRef, isOver: isOverBottom } = useDroppable({
    id: 'layers-list-bottom',
    data: {
      type: 'layers-list-edge',
      position: 'bottom',
      parentId: effectiveTree.id,
      targetIndex: effectiveTree.children?.length || 0,
    },
  })

  return (
    <div className="p-1 space-y-1 min-w-max">
      {/* Drop zone вверху */}
      <div
        ref={setTopDropRef}
        className={`h-8 -mx-1 transition-all ${
          isOverTop ? 'bg-primary-100 border-2 border-primary-400 border-dashed rounded' : ''
        }`}
      >
        {isOverTop && (
          <div className="flex items-center justify-center h-full text-xs text-primary-600 font-medium">
            Вставить в начало
          </div>
        )}
      </div>
      
      <LayerItem 
        node={effectiveTree} 
        level={0} 
        expandedNodes={expandedNodes}
        onToggle={handleToggleNode}
        parentId={null}
        index={0}
        isLastChild={false}
      />
      
      {/* Drop zone внизу */}
      <div
        ref={setBottomDropRef}
        className={`h-8 -mx-1 transition-all ${
          isOverBottom ? 'bg-primary-100 border-2 border-primary-400 border-dashed rounded' : ''
        }`}
      >
        {isOverBottom && (
          <div className="flex items-center justify-center h-full text-xs text-primary-600 font-medium">
            Вставить в конец
          </div>
        )}
      </div>
    </div>
  )
}
