import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNode, deleteNode, selectViewport, selectBreakpoints, selectRootNode, selectSelectedNode, moveNodeToViewport } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { Trash2, ArrowRightLeft, Globe, Monitor, Tablet, Smartphone, Laptop, Watch, Settings2 } from 'lucide-react'
import { getNodeBreakpoint } from '../../utils/variationUtils'

export const ElementPropertiesPanel: React.FC = () => {
  const dispatch = useAppDispatch()
  const viewport = useAppSelector(selectViewport)
  const breakpoints = useAppSelector(selectBreakpoints)
  const rootNode = useAppSelector(selectRootNode)
  const selectedNode = useAppSelector(selectSelectedNode)
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  if (!selectedNode) {
    return (
      <div className="p-4">
        <p className="text-gray-500 text-sm">Выберите элемент</p>
      </div>
    )
  }

  const currentBreakpoint = breakpoints.find(bp => bp.id === viewport)
  
  // Определяем, к какому viewport принадлежит текущий элемент
  const nodeBreakpointId = rootNode ? getNodeBreakpoint(selectedNode.id, rootNode) : null
  const nodeBreakpoint = nodeBreakpointId ? breakpoints.find(bp => bp.id === nodeBreakpointId) : null
  const isBaseElement = nodeBreakpointId === null
  const isRootElement = !selectedNode.id.includes('-') || selectedNode.metadata?.name === 'Root Container'
  
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
      id: selectedNode.id,
      updates: {
        metadata: { ...selectedNode.metadata, name },
      },
    }))
  }

  const handleDelete = () => {
    const hasChildren = selectedNode.children && selectedNode.children.length > 0
    
    if (hasChildren) {
      if (confirm(`Удалить элемент и ${selectedNode.children.length} дочерних?`)) {
        dispatch(deleteNode(selectedNode.id))
      }
    } else {
      dispatch(deleteNode(selectedNode.id))
    }
  }

  const handleMoveToViewport = (targetBreakpoint: string | null) => {
    dispatch(moveNodeToViewport({ nodeId: selectedNode.id, targetBreakpoint }))
    setShowMoveMenu(false)
  }

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
        
        {/* Element Name */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Имя элемента
          </label>
          <Input
            value={selectedNode.metadata?.name || ''}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Введите имя элемента"
          />
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
                  <button
                    onClick={() => handleMoveToViewport(null)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
                      isBaseElement
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    disabled={isBaseElement}
                  >
                    <Globe size={14} />
                    <span>Все viewport'ы</span>
                  </button>
                  
                  {/* Move to specific breakpoints */}
                  {breakpoints.map((bp) => {
                    const Icon = getIcon(bp.icon)
                    const isCurrentBp = nodeBreakpointId === bp.id
                    
                    return (
                      <button
                        key={bp.id}
                        onClick={() => handleMoveToViewport(bp.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
                          isCurrentBp
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        disabled={isCurrentBp}
                      >
                        <Icon size={14} />
                        <span>{bp.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
