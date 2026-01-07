import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectNode, selectSelectedNodeId } from '@/features/editor/editorSlice'
import { useComputedStyles } from '../../hooks/useComputedStyles'
import { cn } from '@/shared/utils'
import type { BlockNode } from '@/shared/types'

interface CanvasRendererProps {
  node: BlockNode
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const selectedNodeId = useAppSelector(selectSelectedNodeId)
  const isSelected = selectedNodeId === node.id

  console.log(`CanvasRenderer for ${node.id}: selectedNodeId=${selectedNodeId}, isSelected=${isSelected}`)

  const computedStyles = useComputedStyles(node)

  // Only root and container elements should be droppable
  const isContainer = node.elementType === 'container' || node.tagName === 'div' || node.tagName === 'section'

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    disabled: !isContainer,
    data: {
      type: 'drop-zone',
      node,
    },
  })

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log('🖱️ Click event fired for:', node.id, node.metadata.name)
    console.log('Dispatching selectNode action...')
    dispatch(selectNode(node.id))
  }

  // Void elements that cannot have children
  const voidElements = ['input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']
  const isVoidElement = voidElements.includes(node.tagName?.toLowerCase() || '')

  // Build element props
  const elementProps: any = {
    ref: setDropRef,
    style: computedStyles,
    className: cn(
      'canvas-element',
      isSelected && 'canvas-element--selected',
      isOver && 'canvas-element--drop-target'
    ),
    'data-element-id': node.id,
    'data-element-name': node.metadata.name || node.tagName,
    onClick: handleClick,
  }

  // Add attributes for specific elements
  if (node.tagName === 'input') {
    elementProps.type = node.attributes?.type || 'text'
    elementProps.placeholder = node.attributes?.placeholder || ''
    elementProps.value = node.content || ''
  }

  // Void elements don't have children
  if (isVoidElement) {
    return React.createElement(node.tagName || 'div', elementProps)
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
    </>
  )
}
