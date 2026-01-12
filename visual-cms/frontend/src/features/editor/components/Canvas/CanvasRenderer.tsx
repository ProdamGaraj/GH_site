import React from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectNode, selectSelectedNodeId, selectDragState, selectViewport, selectEditMode, selectBreakpoints, selectRootNode } from '@/features/editor/editorSlice'
import { useComputedStyles } from '../../hooks/useComputedStyles'
import { cn } from '@/shared/utils'
import type { BlockNode } from '@/shared/types'
import { CSS } from '@dnd-kit/utilities'
import { getNodeStatus, getNodeBreakpoint, BlockNodeWithViewport } from '../../utils/variationUtils'

interface CanvasRendererProps {
  node: BlockNodeWithViewport
  isRoot?: boolean
  editorType?: 'page' | 'block'
  blockAlignment?: 'left' | 'center' | 'right'
  rootNode?: BlockNode  // Передаем root для проверки вариаций
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({ 
  node, 
  isRoot = false, 
  editorType = 'block', 
  blockAlignment = 'center',
  rootNode 
}) => {
  const dispatch = useAppDispatch()
  const selectedNodeId = useAppSelector(selectSelectedNodeId)
  const dragState = useAppSelector(selectDragState)
  const viewport = useAppSelector(selectViewport)
  const editMode = useAppSelector(selectEditMode)
  const breakpoints = useAppSelector(selectBreakpoints)
  const storeRootNode = useAppSelector(selectRootNode)
  const actualRootNode = rootNode || storeRootNode
  const isSelected = selectedNodeId === node.id
  const isDragged = dragState.draggedNodeId === node.id
  const isLocked = node.metadata?.locked || false
  
  // Определяем статус элемента (base, overridden, specific, hidden)
  const nodeStatus = actualRootNode && editMode === 'responsive' 
    ? getNodeStatus(node.id, actualRootNode, viewport) 
    : 'base'
  
  // В базовом режиме определяем к какому брейкпоинту принадлежит элемент
  // Используем _viewportId из эффективного дерева или ищем через getNodeBreakpoint
  const nodeBreakpointId = editMode === 'base' 
    ? (node._viewportId || (actualRootNode ? getNodeBreakpoint(node.id, actualRootNode) : null))
    : null
  
  const nodeBreakpoint = nodeBreakpointId 
    ? breakpoints.find(bp => bp.id === nodeBreakpointId)
    : null

  const computedStyles = useComputedStyles(node)

  // Only root and container elements should be droppable
  const isContainer = node.elementType === 'container' || 
    node.tagName === 'div' || 
    node.tagName === 'section' ||
    node.tagName === 'article' ||
    node.tagName === 'header' ||
    node.tagName === 'footer' ||
    node.tagName === 'main' ||
    node.tagName === 'nav' ||
    node.tagName === 'aside'

  // Droppable setup - disable drop into locked blocks
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${node.id}`,
    disabled: !isContainer || isLocked,
    data: {
      type: 'drop-zone',
      node,
      accepts: ['library-item', 'canvas-element'],
    },
  })

  // Draggable setup - don't allow dragging root node or children of locked blocks
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `drag-${node.id}`,
    disabled: isRoot || isLocked,
    data: {
      type: 'canvas-element',
      id: node.id,
      node,
      elementType: node.elementType,
      tagName: node.tagName,
      label: node.metadata.name || node.tagName,
    },
  })

  // Combine refs
  const combinedRef = (el: HTMLElement | null) => {
    setDropRef(el)
    setDragRef(el)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isDragging) {
      dispatch(selectNode(node.id))
    }
  }

  // Void elements that cannot have children
  const voidElements = ['input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']
  const isVoidElement = voidElements.includes(node.tagName?.toLowerCase() || '')

  // Style for dragging
  const dragStyle: React.CSSProperties = transform ? {
    transform: CSS.Translate.toString(transform),
  } : {}

  // Build element props
  const elementProps: any = {
    ref: combinedRef,
    style: {
      ...computedStyles,
      ...dragStyle,
      opacity: isDragging ? 0.5 : undefined,
      // Apply alignment to root element in block editor ONLY in responsive mode
      ...(isRoot && editorType === 'block' && editMode === 'responsive' ? {
        marginLeft: blockAlignment === 'center' ? 'auto' : blockAlignment === 'right' ? 'auto' : '0',
        marginRight: blockAlignment === 'center' ? 'auto' : blockAlignment === 'left' ? 'auto' : '0'
      } : {}),
      // Визуальная индикация статуса элемента в responsive режиме
      ...(nodeStatus === 'overridden' ? {
        outline: '2px dashed rgba(139, 92, 246, 0.6)',
        outlineOffset: '2px'
      } : nodeStatus === 'specific' ? {
        outline: '2px solid rgba(16, 185, 129, 0.6)',
        outlineOffset: '2px'
      } : {}),
      // Визуальная индикация специфичных элементов в базовом режиме с цветом брейкпоинта
      ...(editMode === 'base' && nodeBreakpoint ? {
        outline: `2px solid ${nodeBreakpoint.color || '#10b981'}`,
        outlineOffset: '2px'
      } : {})
    },
    className: cn(
      'canvas-element relative',
      isSelected && 'canvas-element--selected',
      isOver && !isDragged && 'canvas-element--drop-target',
      isDragging && 'canvas-element--dragging',
      isRoot && 'canvas-element--root'
    ),
    'data-element-id': node.id,
    'data-element-name': node.metadata.name || node.tagName,
    'data-layout-mode': node.layoutMode || 'flex',
    onClick: handleClick,
    // Only apply drag attributes/listeners if not root and not locked
    ...(!isRoot && !isLocked ? { ...attributes, ...listeners } : {}),
  }

  // Add attributes for specific elements
  if (node.tagName === 'input') {
    elementProps.type = node.attributes?.type || 'text'
    elementProps.placeholder = node.attributes?.placeholder || ''
    elementProps.value = node.content || ''
    elementProps.readOnly = true
  }

  if (node.tagName === 'textarea') {
    elementProps.placeholder = node.attributes?.placeholder || ''
    elementProps.value = node.content || ''
    elementProps.readOnly = true
  }

  if (node.tagName === 'img') {
    elementProps.src = node.attributes?.src || 'https://via.placeholder.com/150'
    elementProps.alt = node.attributes?.alt || ''
  }

  // Void elements don't have children
  if (isVoidElement) {
    return React.createElement(node.tagName || 'div', elementProps)
  }

  // Textarea should not have children content
  if (node.tagName === 'textarea') {
    return React.createElement(node.tagName, elementProps)
  }

  // Regular elements with children
  return React.createElement(
    node.tagName || 'div',
    elementProps,
    <>
      {node.content && <span>{node.content}</span>}
      {node.children.map((child) => (
        <CanvasRenderer 
          key={child.id} 
          node={child} 
          editorType={editorType} 
          blockAlignment={blockAlignment}
          rootNode={actualRootNode || undefined}
        />
      ))}
      {/* Empty state indicator for containers */}
      {isContainer && node.children.length === 0 && !node.content && !isRoot && (
        <div className={cn(
          "flex items-center justify-center min-h-[60px] text-xs text-gray-400 border border-dashed border-gray-300 rounded m-2",
          isOver && "border-blue-400 bg-blue-50 text-blue-500"
        )}>
          {isOver ? 'Отпустите здесь' : 'Перетащите элементы сюда'}
        </div>
      )}
      {/* Root container: always show drop zone at the bottom */}
      {isRoot && (
        <div className={cn(
          "mt-4 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50/50 hover:border-primary-300 hover:bg-primary-50/30 transition-colors min-h-[60px]",
          isOver && "border-primary-400 bg-primary-50"
        )}>
          <p className="text-gray-400 text-sm">
            {isOver ? 'Отпустите блок здесь' : 'Вставьте новый блок сюда'}
          </p>
        </div>
      )}
    </>
  )
}
