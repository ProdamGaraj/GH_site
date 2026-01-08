import React from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectNode, selectSelectedNodeId, selectDragState } from '@/features/editor/editorSlice'
import { useComputedStyles } from '../../hooks/useComputedStyles'
import { cn } from '@/shared/utils'
import type { BlockNode } from '@/shared/types'
import { CSS } from '@dnd-kit/utilities'

interface CanvasRendererProps {
  node: BlockNode
  isRoot?: boolean
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({ node, isRoot = false }) => {
  const dispatch = useAppDispatch()
  const selectedNodeId = useAppSelector(selectSelectedNodeId)
  const dragState = useAppSelector(selectDragState)
  const isSelected = selectedNodeId === node.id
  const isDragged = dragState.draggedNodeId === node.id

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

  // Droppable setup
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${node.id}`,
    disabled: !isContainer,
    data: {
      type: 'drop-zone',
      node,
      accepts: ['library-item', 'canvas-element'],
    },
  })

  // Draggable setup - don't allow dragging root node
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `drag-${node.id}`,
    disabled: isRoot,
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
    ...attributes,
    ...listeners,
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
        <CanvasRenderer key={child.id} node={child} />
      ))}
      {/* Empty state indicator for containers */}
      {isContainer && node.children.length === 0 && !node.content && (
        <div className={cn(
          "flex items-center justify-center min-h-[60px] text-xs text-gray-400 border border-dashed border-gray-300 rounded m-2",
          isOver && "border-blue-400 bg-blue-50 text-blue-500"
        )}>
          {isOver ? 'Отпустите здесь' : 'Перетащите элементы сюда'}
        </div>
      )}
    </>
  )
}
