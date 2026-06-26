import React, { useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectNode, selectSelectedNodeId, deleteNode, selectBreakpoints, selectRootNode, convertNodeToLinkedBlock } from '@/features/editor/editorSlice'
import * as Icons from 'lucide-react'
import { cn } from '@/shared/utils'
import { getNodeBreakpoint, BlockNodeWithViewport } from '../../utils/variationUtils'
import { useNavigate, useMatch } from 'react-router-dom'

interface LayerItemProps {
  node: BlockNodeWithViewport
  level: number
  expandedNodes: Set<string>
  onToggle: (nodeId: string) => void
  parentId: string | null // ID родительского узла для обработки drop
  index: number // Индекс в массиве children родителя
  isLastChild?: boolean // Является ли последним дочерним элементом
}

interface LayerDragData {
  type: 'layer-item'
  nodeId: string
  node: BlockNodeWithViewport
  parentId: string | null
  index: number
}

// Функция для проверки, является ли узел предком или потомком выбранного узла
const isNodeInPath = (node: BlockNodeWithViewport, targetId: string): boolean => {
  if (node.id === targetId) return true
  if (node.children) {
    return node.children.some(child => isNodeInPath(child, targetId))
  }
  return false
}

export const LayerItem: React.FC<LayerItemProps> = ({ node, level, expandedNodes, onToggle, parentId = null, index = 0, isLastChild = false }) => {
  const dispatch = useAppDispatch()
  const selectedNodeId = useAppSelector(selectSelectedNodeId)
  const breakpoints = useAppSelector(selectBreakpoints)
  const rootNode = useAppSelector(selectRootNode)
  const navigate = useNavigate()
  // Преобразование в блок доступно только в редакторе СОХРАНЁННОЙ страницы:
  // связь (linkedBlockId) пишется в БД, а после конвертации мы уходим в редактор
  // блока. Для новой (ещё не сохранённой) страницы id === 'new' — не настоящий.
  const pageMatch = useMatch('/editor/page/:id')
  const pageId = pageMatch?.params.id && pageMatch.params.id !== 'new' ? pageMatch.params.id : undefined
  const [isConverting, setIsConverting] = useState(false)
  
  const isExpanded = expandedNodes.has(node.id)
  
  const isSelected = selectedNodeId === node.id
  const hasChildren = node.children && node.children.length > 0
  const isContainer = node.elementType === 'container'
  const isLocked = node.metadata?.locked || false
  const isRoot = level === 0 // Корневой элемент нельзя перетаскивать
  
  // Определяем к какому breakpoint принадлежит элемент (если он специфичный)
  // Используем _viewportId из эффективного дерева, если есть, иначе ищем через getNodeBreakpoint
  const nodeBreakpointId = node._viewportId || (rootNode ? getNodeBreakpoint(node.id, rootNode) : null)
  const nodeBreakpoint = nodeBreakpointId ? breakpoints.find(bp => bp.id === nodeBreakpointId) : null
  
  // Элемент является viewport-специфичным если у него есть nodeBreakpoint
  const isViewportSpecific = !!nodeBreakpoint

  // === Drag-and-Drop Setup ===
  const dragData: LayerDragData = {
    type: 'layer-item',
    nodeId: node.id,
    node,
    parentId,
    index,
  }

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `layer-drag-${node.id}`,
    disabled: isRoot || isLocked,
    data: dragData,
  })

  // Single drop zone for this item - position will be determined by cursor position
  const { setNodeRef: setDropRef, isOver, active } = useDroppable({
    id: `layer-drop-${node.id}`,
    disabled: isRoot && !hasChildren, // Root can accept drops inside if it has children
    data: {
      type: 'layer-droppable',
      nodeId: node.id,
      parentId,
      index,
      isContainer: isContainer || hasChildren,
      isRoot,
    },
  })

  // Combine refs
  const combinedRef = (el: HTMLDivElement | null) => {
    setDragRef(el)
    setDropRef(el)
  }

  // Determine drop position based on mouse position when hovering
  const [dropPosition, setDropPosition] = React.useState<'before' | 'after' | 'inside' | null>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isOver || !active) {
      setDropPosition(null)
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const mouseY = e.clientY
    const relativeY = mouseY - rect.top
    const height = rect.height

    // For root element, only allow 'inside'
    if (isRoot) {
      setDropPosition('inside')
      return
    }

    // Divide into zones: top 30% = before, middle 40% = inside (for containers), bottom 30% = after
    // Для последнего элемента расширяем зону "after" до 50% чтобы было проще попасть
    const afterThreshold = isLastChild ? 0.5 : 0.7
    
    if (relativeY < height * 0.3) {
      setDropPosition('before')
    } else if (relativeY > height * afterThreshold) {
      setDropPosition('after')
    } else if (isContainer || hasChildren) {
      setDropPosition('inside')
    } else {
      // For non-containers, use before/after based on which is closer
      setDropPosition(relativeY < height * 0.5 ? 'before' : 'after')
    }
  }

  const handleMouseLeave = () => {
    setDropPosition(null)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch(selectNode(node.id))
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggle(node.id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Don't allow deletion of locked elements
    if (isLocked) {
      return
    }
    
    const hasChildren = node.children && node.children.length > 0
    
    if (hasChildren) {
      if (confirm(`Удалить элемент и ${node.children.length} дочерних?`)) {
        dispatch(deleteNode(node.id))
      }
    } else {
      dispatch(deleteNode(node.id))
    }
  }

  const handleConvertToBlock = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (isConverting) return

    try {
      setIsConverting(true)
      // Единый путь: создать блок, связать узел (linkedBlockId) и сохранить страницу.
      // Guard внутри thunk'а не плодит дубль, если узел уже связан.
      const result = await dispatch(
        convertNodeToLinkedBlock({ nodeId: node.id, pageId })
      ).unwrap()
      navigate(`/editor/block/${result.blockId}`)
    } catch (error) {
      console.error('Ошибка создания блока:', error)
      alert('Не удалось создать блок: ' + (error as Error).message)
    } finally {
      setIsConverting(false)
    }
  }

  // Get icon based on element type
  const getIcon = () => {
    // Special icon for html-code elements
    if (node.elementType === 'html-code') {
      return Icons.Code
    }
    
    const iconMap: Record<string, keyof typeof Icons> = {
      div: 'Box',
      section: 'Layout',
      article: 'FileText',
      header: 'LayoutDashboard',
      footer: 'Columns',
      input: 'TextCursor',
      textarea: 'AlignLeft',
      button: 'MousePointer2',
      h1: 'Heading1',
      h2: 'Heading2',
      h3: 'Heading3',
      p: 'Type',
      img: 'Image',
      a: 'Link',
    }
    
    const iconName = iconMap[node.tagName || 'div'] || 'Box'
    return (Icons as any)[iconName] || Icons.Box
  }

  const IconComponent = getIcon()

  return (
    <div style={{ opacity: isDragging ? 0.4 : 1 }}>
      {/* Drop indicator BEFORE */}
      {!isRoot && dropPosition === 'before' && isOver && (
        <div className="h-0.5 bg-primary-500 mx-2 my-0.5 rounded-full" />
      )}

      <div
        ref={combinedRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'group flex items-center gap-1.5 py-1.5 pr-1 rounded cursor-pointer hover:bg-gray-100 transition-colors text-sm min-h-[28px] relative',
          isSelected && 'bg-primary-50 hover:bg-primary-100',
          dropPosition === 'inside' && isOver && (isContainer || hasChildren) && 'bg-primary-100 ring-2 ring-primary-400'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {/* Drag Handle - отдельно слева */}
        {!isRoot && !isLocked && (
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-gray-200 rounded transition-all z-10 opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Icons.GripVertical size={12} className="text-gray-500" />
          </div>
        )}
        
        {/* Expand/Collapse Arrow */}
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded transition-all z-10"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <Icons.ChevronRight size={12} className="text-gray-900" />
          </button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        {/* Icon */}
        <div className={cn(
          'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded z-10',
          isContainer ? 'bg-primary-100' : 'bg-gray-100'
        )}>
          <IconComponent 
            size={14} 
            className={cn(
              isContainer ? 'text-primary-600' : 'text-gray-600'
            )} 
          />
        </div>

        {/* Name */}
        <span className={cn(
          'flex-1 truncate min-w-0 z-10',
          isSelected ? 'text-primary-900 font-medium' : 'text-gray-700'
        )}>
          {node.metadata?.name || node.tagName}
        </span>
        
        {/* Правая часть - абсолютное позиционирование с прозрачностью */}
        <div className="absolute right-1 top-0 bottom-0 flex items-center gap-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white z-20 pointer-events-none group-hover:pointer-events-auto">
          {/* Viewport-specific indicator */}
          {isViewportSpecific && nodeBreakpoint && (
            <span 
              className="flex-shrink-0 px-1.5 py-0.5 text-xs rounded font-medium"
              style={{ 
                backgroundColor: `${nodeBreakpoint.color}20` || '#10b98120',
                color: nodeBreakpoint.color || '#10b981',
                border: `1px solid ${nodeBreakpoint.color || '#10b981'}`
              }}
              title={`Только для ${nodeBreakpoint.name}`}
            >
              {nodeBreakpoint.name.slice(0, 3)}
            </span>
          )}

          {/* Lock indicator */}
          {isLocked && (
            <Icons.Lock size={12} className="flex-shrink-0 text-orange-500" aria-label="Заблокированный блок" />
          )}

          {/* Action buttons */}
          {!isLocked && (
            <>
              {/* Преобразовать в блок: только в редакторе сохранённой страницы
                  (нужен pageId для записи связи) и только для ещё не связанных
                  узлов (у связанного linkedBlockId уже есть — повтор не нужен). */}
              {level > 0 && pageId && !node.metadata?.linkedBlockId && (
                <button
                  onClick={handleConvertToBlock}
                  className="flex-shrink-0 p-1 hover:bg-green-50 rounded transition-colors"
                  disabled={isConverting}
                  title="Преобразовать в блок"
                >
                  {isConverting ? (
                    <Icons.Loader2 size={12} className="text-green-600 animate-spin" />
                  ) : (
                    <Icons.Package size={12} className="text-green-600" />
                  )}
                </button>
              )}

              {level > 0 && (
                <button
                  onClick={handleDelete}
                  className="flex-shrink-0 p-1 hover:bg-red-50 rounded transition-colors"
                >
                  <Icons.Trash2 size={12} className="text-red-600" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child, idx) => (
            <LayerItem 
              key={child.id} 
              node={child} 
              level={level + 1} 
              expandedNodes={expandedNodes}
              isLastChild={idx === node.children.length - 1}
              onToggle={onToggle}
              parentId={node.id}
              index={idx}
            />
          ))}
        </div>
      )}

      {/* Drop indicator AFTER */}
      {dropPosition === 'after' && isOver && (
        <div className="h-0.5 bg-primary-500 mx-2 my-0.5 rounded-full" />
      )}
    </div>
  )
}
