import React from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectNode, selectSelectedNodeId, selectDragState, selectEditMode, selectRootNode } from '@/features/editor/editorSlice'
import { useComputedStyles } from '../../hooks/useComputedStyles'
import { cn } from '@/shared/utils'
import type { BlockNode } from '@/shared/types'
import { CSS } from '@dnd-kit/utilities'
import { BlockNodeWithViewport } from '../../utils/variationUtils'

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
  const editMode = useAppSelector(selectEditMode)
  const storeRootNode = useAppSelector(selectRootNode)
  const actualRootNode = rootNode || storeRootNode
  const isSelected = selectedNodeId === node.id
  const isDragged = dragState.draggedNodeId === node.id
  const isLocked = node.metadata?.locked || false

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
      opacity: isDragging ? 0.5 : computedStyles.opacity,
      // Для root элемента в responsive режиме добавляем min-height: 100%
      ...(isRoot && editMode === 'responsive' ? {
        minHeight: '100%',
      } : {}),
      // Не переопределяем стили в page редакторе для точного отображения
      // Только для block редактора в responsive режиме применяем выравнивание
      ...(isRoot && editorType === 'block' && editMode === 'responsive' ? {
        marginLeft: blockAlignment === 'center' ? 'auto' : blockAlignment === 'right' ? 'auto' : '0',
        marginRight: blockAlignment === 'center' ? 'auto' : blockAlignment === 'left' ? 'auto' : '0'
      } : {}),
    },
    className: cn(
      'canvas-element',
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
      {/* Текстовый контент без обёртки span для корректного отображения */}
      {node.content}
      {node.children.map((child) => (
        <CanvasRenderer 
          key={child.id} 
          node={child} 
          editorType={editorType} 
          blockAlignment={blockAlignment}
          rootNode={actualRootNode || undefined}
        />
      ))}
      {/* Empty state indicator for containers - показываем только при редактировании */}
      {isContainer && node.children.length === 0 && !node.content && !isRoot && (
        <div className={cn(
          "flex items-center justify-center min-h-[40px] text-xs text-gray-400 border border-dashed border-gray-300 rounded m-1",
          isOver && "border-blue-400 bg-blue-50 text-blue-500"
        )}>
          {isOver ? 'Отпустите' : 'Пусто'}
        </div>
      )}
    </>
  )
}
