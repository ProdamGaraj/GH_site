import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNode, deleteNode, selectViewport, selectBreakpoints, selectRootNode, selectEditMode, moveNodeToViewport } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { Trash2, Move, Palette, Type, Code, Monitor, Tablet, Smartphone, Laptop, Watch, Settings2, ArrowRightLeft, Globe } from 'lucide-react'
import type { BlockNode } from '@/shared/types'
import { PositioningTab } from './PositioningTab'
import { ColorsTab } from './ColorsTab'
import { ContentTab } from './ContentTab'
import { CustomCSSTab } from './CustomCSSTab'
import { cn } from '@/shared/utils'
import { getNodeBreakpoint } from '../../utils/variationUtils'

interface PropertiesPanelProps {
  node: BlockNode
}

type TabType = 'positioning' | 'colors' | 'content' | 'css'

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const viewport = useAppSelector(selectViewport)
  const breakpoints = useAppSelector(selectBreakpoints)
  const rootNode = useAppSelector(selectRootNode)
  const editMode = useAppSelector(selectEditMode)
  const [activeTab, setActiveTab] = useState<TabType>('positioning')
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  
  const currentBreakpoint = breakpoints.find(bp => bp.id === viewport)
  
  // Определяем, к какому viewport принадлежит текущий элемент
  const nodeBreakpointId = rootNode ? getNodeBreakpoint(node.id, rootNode) : null
  const nodeBreakpoint = nodeBreakpointId ? breakpoints.find(bp => bp.id === nodeBreakpointId) : null
  const isBaseElement = nodeBreakpointId === null
  const isViewportSpecific = nodeBreakpointId !== null
  
  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'monitor': return Monitor
      case 'laptop': return Laptop
      case 'tablet': return Tablet
      case 'smartphone': return Smartphone
      case 'watch': return Watch
      default: return Monitor
    }
  }
  
  const ViewportIcon = viewport === 'base' ? Settings2 : (currentBreakpoint ? getIcon(currentBreakpoint.icon) : Monitor)
  
  // Определяем название и описание viewport
  const viewportName = viewport === 'base' 
    ? 'Общий' 
    : (currentBreakpoint ? `${currentBreakpoint.name} (${currentBreakpoint.width}px)` : 'Unknown viewport')
  
  const viewportDescription = viewport === 'base'
    ? 'Изменения применяются для всех viewport'
    : `Изменения применяются для ${currentBreakpoint?.name || 'этого экрана'}`

  const handleNameChange = (name: string) => {
    dispatch(updateNode({
      id: node.id,
      updates: {
        metadata: { ...node.metadata, name },
      },
    }))
  }

  const handleDelete = () => {
    console.log('handleDelete called for node:', node.id)
    const hasChildren = node.children && node.children.length > 0
    
    if (hasChildren) {
      if (confirm(`Удалить элемент и ${node.children.length} дочерних?`)) {
        dispatch(deleteNode(node.id))
      }
    } else {
      dispatch(deleteNode(node.id))
    }
  }

  const isRootElement = !node.id.includes('-') || node.metadata?.name === 'Root Container'
  
  console.log('PropertiesPanel render:', { nodeId: node.id, isRootElement, metadataName: node.metadata?.name })

  const handleMoveToViewport = (targetBreakpoint: string | null) => {
    dispatch(moveNodeToViewport({ nodeId: node.id, targetBreakpoint }))
    setShowMoveMenu(false)
  }

  const tabs = [
    { id: 'positioning' as TabType, label: 'Позиция', icon: Move },
    { id: 'colors' as TabType, label: 'Цвета', icon: Palette },
    { id: 'content' as TabType, label: 'Контент', icon: Type },
    { id: 'css' as TabType, label: 'CSS', icon: Code },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Свойства</h3>
          {!isRootElement && (
            <Button variant="ghost" size="sm" onClick={handleDelete}>
              <Trash2 size={16} className="text-red-600" />
            </Button>
          )}
        </div>
        
        {/* Viewport indicator */}
        <div className="mb-3 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <ViewportIcon size={16} className="text-primary-600" />
            <span className="text-primary-700 font-medium">
              {viewportName}
            </span>
          </div>
          <p className="text-xs text-primary-600 mt-1">
            {viewportDescription}
          </p>
        </div>
        
        {/* Element viewport ownership */}
        {!isRootElement && (
          <div className="mb-3 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                {isBaseElement ? (
                  <>
                    <Globe size={14} className="text-gray-600" />
                    <span className="text-gray-700 font-medium">Все viewport'ы</span>
                  </>
                ) : (
                  <>
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: nodeBreakpoint?.color || '#6b7280' }}
                    />
                    <span className="text-gray-700 font-medium">
                      Только {nodeBreakpoint?.name}
                    </span>
                  </>
                )}
              </div>
              
              {/* Move button */}
              <button
                onClick={() => setShowMoveMenu(!showMoveMenu)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Перенести в другой viewport"
              >
                <ArrowRightLeft size={14} className="text-gray-600" />
              </button>
            </div>
            
            {/* Move menu */}
            {showMoveMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[180px]">
                <div className="p-2 border-b border-gray-100">
                  <span className="text-xs font-medium text-gray-500">Перенести в:</span>
                </div>
                <div className="p-1">
                  {/* Move to base (all viewports) */}
                  {isViewportSpecific && (
                    <button
                      onClick={() => handleMoveToViewport(null)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 rounded transition-colors"
                    >
                      <Globe size={14} className="text-gray-600" />
                      <span>Все viewport'ы</span>
                    </button>
                  )}
                  
                  {/* Move to specific viewport */}
                  {breakpoints.map(bp => {
                    // Skip current viewport if already specific to it
                    if (nodeBreakpointId === bp.id) return null
                    
                    const BpIcon = getIcon(bp.icon)
                    return (
                      <button
                        key={bp.id}
                        onClick={() => handleMoveToViewport(bp.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 rounded transition-colors"
                      >
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: bp.color || '#6b7280' }}
                        />
                        <span>Только {bp.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">{bp.width}px</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-1">
              {isBaseElement 
                ? 'Элемент виден на всех размерах экрана' 
                : `Элемент виден только на ${nodeBreakpoint?.name}`}
            </p>
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-2">
          <Input
            label="Имя элемента"
            value={node.metadata.name || ''}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={node.tagName}
          />
          <div className="text-xs text-gray-500">
            <div className="flex justify-between py-1">
              <span>Тег:</span>
              <span className="font-mono">&lt;{node.tagName}&gt;</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'positioning' && <PositioningTab node={node} />}
        {activeTab === 'colors' && <ColorsTab node={node} />}
        {activeTab === 'content' && <ContentTab node={node} />}
        {activeTab === 'css' && <CustomCSSTab node={node} />}
      </div>
    </div>
  )
}
