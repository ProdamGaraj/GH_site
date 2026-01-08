import React from 'react'
import { DragOverlay as DndKitDragOverlay } from '@dnd-kit/core'
import type { BlockNode } from '@/shared/types'

interface DragOverlayProps {
  activeNode: BlockNode | null
}

export const DragOverlay: React.FC<DragOverlayProps> = ({ activeNode }) => {
  if (!activeNode) return null

  return (
    <DndKitDragOverlay dropAnimation={null}>
      <div 
        className="pointer-events-none"
        style={{
          opacity: 0.8,
          transform: 'scale(1.02)',
        }}
      >
        <DragPreview node={activeNode} />
      </div>
    </DndKitDragOverlay>
  )
}

interface DragPreviewProps {
  node: BlockNode
}

const DragPreview: React.FC<DragPreviewProps> = ({ node }) => {
  const previewStyles: React.CSSProperties = {
    maxWidth: '300px',
    maxHeight: '200px',
    overflow: 'hidden' as const,
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
    borderRadius: '4px',
    border: '2px solid #3b82f6',
    backgroundColor: node.styles.properties.backgroundColor || '#ffffff',
    display: node.styles.properties.display as React.CSSProperties['display'],
    flexDirection: node.styles.properties.flexDirection as React.CSSProperties['flexDirection'],
    padding: node.styles.properties.padding,
  }

  // Simplified preview for containers with many children
  if (node.children.length > 3) {
    return (
      <div style={previewStyles} className="p-3">
        <div className="text-xs font-medium text-gray-700 mb-2">
          {node.metadata.name || node.tagName}
        </div>
        <div className="text-xs text-gray-500">
          {node.children.length} дочерних элементов
        </div>
      </div>
    )
  }

  return (
    <div style={previewStyles}>
      {node.content && <span className="text-sm">{node.content}</span>}
      {node.children.map(child => (
        <DragPreviewChild key={child.id} node={child} />
      ))}
      {!node.content && node.children.length === 0 && (
        <div className="p-3 text-xs text-gray-400">
          {node.metadata.name || `<${node.tagName}>`}
        </div>
      )}
    </div>
  )
}

const DragPreviewChild: React.FC<{ node: BlockNode }> = ({ node }) => {
  const childStyles: React.CSSProperties = {
    maxWidth: '100%',
    padding: node.styles.properties.padding,
    backgroundColor: node.styles.properties.backgroundColor,
    color: node.styles.properties.color,
  }

  return (
    <div style={childStyles} className="text-xs">
      {node.content || node.metadata.name || `<${node.tagName}>`}
    </div>
  )
}
