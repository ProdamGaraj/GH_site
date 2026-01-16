import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectNode, selectSelectedNodeId, deleteNode, selectBreakpoints, selectRootNode, startInlineBlockEdit } from '@/features/editor/editorSlice'
import * as Icons from 'lucide-react'
import { cn } from '@/shared/utils'
import { getNodeBreakpoint, BlockNodeWithViewport } from '../../utils/variationUtils'
import { useNavigate } from 'react-router-dom'
import { blockApi, CreateBlockDto } from '@/shared/api'
import type { BlockNode } from '@/shared/types'

interface LayerItemProps {
  node: BlockNodeWithViewport
  level: number
  expandedNodes: Set<string>
  onToggle: (nodeId: string) => void
}

// Функция для проверки, является ли узел предком или потомком выбранного узла
const isNodeInPath = (node: BlockNodeWithViewport, targetId: string): boolean => {
  if (node.id === targetId) return true
  if (node.children) {
    return node.children.some(child => isNodeInPath(child, targetId))
  }
  return false
}

export const LayerItem: React.FC<LayerItemProps> = ({ node, level, expandedNodes, onToggle }) => {
  const dispatch = useAppDispatch()
  const selectedNodeId = useAppSelector(selectSelectedNodeId)
  const breakpoints = useAppSelector(selectBreakpoints)
  const rootNode = useAppSelector(selectRootNode)
  const navigate = useNavigate()
  const [isConverting, setIsConverting] = useState(false)
  
  const isExpanded = expandedNodes.has(node.id)
  
  const isSelected = selectedNodeId === node.id
  const hasChildren = node.children && node.children.length > 0
  const isContainer = node.elementType === 'container'
  const isLocked = node.metadata?.locked || false
  
  // Определяем к какому breakpoint принадлежит элемент (если он специфичный)
  // Используем _viewportId из эффективного дерева, если есть, иначе ищем через getNodeBreakpoint
  const nodeBreakpointId = node._viewportId || (rootNode ? getNodeBreakpoint(node.id, rootNode) : null)
  const nodeBreakpoint = nodeBreakpointId ? breakpoints.find(bp => bp.id === nodeBreakpointId) : null
  
  // Элемент является viewport-специфичным если у него есть nodeBreakpoint
  const isViewportSpecific = !!nodeBreakpoint

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
      
      // Подготовить структуру блока (удалить специфичные для viewport поля)
      const cleanNode = (n: BlockNodeWithViewport): BlockNode => {
        const { _viewportId, ...rest } = n
        return {
          ...rest,
          children: n.children?.map(cleanNode) || []
        }
      }
      
      const blockName = node.metadata?.name || node.tagName || 'Блок'
      
      const blockData: CreateBlockDto = {
        name: blockName,
        type: 'section',
        structure: cleanNode(node),
        isReusable: true,
        tags: ['converted-from-page']
      }
      
      // Создать блок через API
      const createdBlock = await blockApi.create(blockData)
      
      // Перейти в редактор блока
      navigate(`/editor/block/${createdBlock.id}`)
    } catch (error) {
      console.error('Ошибка создания блока:', error)
      alert('Не удалось создать блок: ' + (error as Error).message)
    } finally {
      setIsConverting(false)
    }
  }

  const handleEditInline = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Запускаем режим inline-редактирования блока
    dispatch(startInlineBlockEdit(node.id))
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
          'group flex items-center gap-1.5 py-1.5 pr-1 rounded cursor-pointer hover:bg-gray-100 transition-colors text-sm min-h-[28px] relative',
          isSelected && 'bg-primary-50 hover:bg-primary-100'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse Arrow */}
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded transition-all"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <Icons.ChevronRight size={12} className="text-gray-900" />
          </button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        {/* Icon */}
        <div className={cn(
          'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded',
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
          'flex-1 truncate min-w-0',
          isSelected ? 'text-primary-900 font-medium' : 'text-gray-700'
        )}>
          {node.metadata?.name || node.tagName}
        </span>
        
        {/* Правая часть - абсолютное позиционирование с прозрачностью */}
        <div className="absolute right-1 top-0 bottom-0 flex items-center gap-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white">
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
              <button
                onClick={handleEditInline}
                className="flex-shrink-0 p-1 hover:bg-blue-50 rounded transition-colors"
                title="Редактировать свойства"
              >
                <Icons.Pencil size={12} className="text-blue-600" />
              </button>

              {level > 0 && (
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
          {node.children.map((child) => (
            <LayerItem 
              key={child.id} 
              node={child} 
              level={level + 1} 
              expandedNodes={expandedNodes}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
