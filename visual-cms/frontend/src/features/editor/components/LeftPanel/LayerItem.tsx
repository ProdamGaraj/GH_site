import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectNode, selectSelectedNodeId, deleteNode } from '@/features/editor/editorSlice'
import * as Icons from 'lucide-react'
import type { BlockNode } from '@/shared/types'
import { cn } from '@/shared/utils'

interface LayerItemProps {
  node: BlockNode
  level: number
}

export const LayerItem: React.FC<LayerItemProps> = ({ node, level }) => {
  const dispatch = useAppDispatch()
  const selectedNodeId = useAppSelector(selectSelectedNodeId)
  const [isExpanded, setIsExpanded] = useState(true)
  
  const isSelected = selectedNodeId === node.id
  const hasChildren = node.children && node.children.length > 0
  const isContainer = node.elementType === 'container'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch(selectNode(node.id))
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    const hasChildren = node.children && node.children.length > 0
    
    if (hasChildren) {
      if (confirm(`Удалить элемент и ${node.children.length} дочерних?`)) {
        dispatch(deleteNode(node.id))
      }
    } else {
      dispatch(deleteNode(node.id))
    }
  }

  // Get icon based on element type
  const getIcon = () => {
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
    <div>
      <div
        className={cn(
          'group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 transition-colors text-sm',
          isSelected && 'bg-primary-50 hover:bg-primary-100'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse Arrow */}
        {hasChildren && (
          <button
            onClick={handleToggle}
            className="p-0.5 hover:bg-gray-200 rounded transition-transform"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <Icons.ChevronRight size={14} />
          </button>
        )}
        
        {!hasChildren && <div className="w-5" />}

        {/* Icon */}
        <div className={cn(
          'p-1 rounded',
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
          'flex-1 truncate',
          isSelected ? 'text-primary-900 font-medium' : 'text-gray-700'
        )}>
          {node.metadata.name || node.tagName}
        </span>

        {/* Delete button - hidden for root */}
        {level > 0 && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
          >
            <Icons.Trash2 size={12} className="text-red-600" />
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <LayerItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
