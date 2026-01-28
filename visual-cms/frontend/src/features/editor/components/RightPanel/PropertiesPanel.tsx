import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNode, deleteNode, selectViewport, selectBreakpoints, selectRootNode, moveNodeToViewport, selectActiveRightPanelTab, setActiveRightPanelTab } from '@/features/editor/editorSlice'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { Trash2, Move, Palette, Type, Code, Monitor, Tablet, Smartphone, Laptop, Watch, Settings2, ArrowRightLeft, Globe, MousePointer, Sparkles, FileCode, Database } from 'lucide-react'
import type { BlockNode, EditorPageSettings } from '@/shared/types'
import { PositioningTab } from './PositioningTab'
import { ColorsTab } from './ColorsTab'
import { ContentTab } from './ContentTab'
import { CustomCSSTab } from './CustomCSSTab'
import { StatesTab } from './StatesTab'
import { AnimationsTab } from './AnimationsTab'
import { ScriptsTab } from './ScriptsTab'
import { SmartDataBindingTab } from '@/features/dataBindings/components/SmartDataBindingTab'
import { DetectedFieldsViewer } from '@/features/blocks/components/DetectedFieldsViewer'
import { TemplateBlockControls } from '@/features/blocks/components/TemplateBlockControls'
import { CreateBlockFromElement } from '@/features/blocks/components/CreateBlockFromElement'
import { cn } from '@/shared/utils'
import { getNodeBreakpoint } from '../../utils/variationUtils'

interface PropertiesPanelProps {
  node: BlockNode
  isPageRoot?: boolean
  pageSettings?: EditorPageSettings
  onPageSettingsChange?: (settings: EditorPageSettings) => void
  pageId?: string
  currentBlockData?: any // Данные блока для показа Template информации
}

type TabType = 'positioning' | 'colors' | 'content' | 'states' | 'animations' | 'scripts' | 'data' | 'css'

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ node, isPageRoot, pageSettings, onPageSettingsChange, pageId, currentBlockData }) => {
  const dispatch = useAppDispatch()
  const viewport = useAppSelector(selectViewport)
  const breakpoints = useAppSelector(selectBreakpoints)
  const rootNode = useAppSelector(selectRootNode)
  const activeTab = useAppSelector(selectActiveRightPanelTab)
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

  const handleMoveToViewport = (targetBreakpoint: string | null) => {
    dispatch(moveNodeToViewport({ nodeId: node.id, targetBreakpoint }))
    setShowMoveMenu(false)
  }

  const tabs = [
    { id: 'positioning' as TabType, label: 'Позиция', icon: Move },
    { id: 'colors' as TabType, label: 'Цвета', icon: Palette },
    { id: 'content' as TabType, label: 'Контент', icon: Type },
    { id: 'states' as TabType, label: 'Hover', icon: MousePointer },
    { id: 'animations' as TabType, label: 'Анимации', icon: Sparkles },
    { id: 'scripts' as TabType, label: 'Скрипты', icon: FileCode },
    { id: 'data' as TabType, label: 'Данные', icon: Database },
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
        
        {/* Element Name */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Имя элемента
          </label>
          <Input
            value={node.metadata?.name || ''}
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

          {/* Кнопка создания блока из элемента */}
          {!isRootElement && !currentBlockData?.id && (
            <div className="pt-2">
              <CreateBlockFromElement 
                element={node}
                onSuccess={(blockId) => {
                  console.log('Created block:', blockId)
                  // Можно перейти к редактированию нового блока
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => dispatch(setActiveRightPanelTab(tab.id))}
              className={cn(
                'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
              title={tab.label}
            >
              <Icon size={14} />
              <span className="truncate w-full text-center">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'positioning' && <PositioningTab node={node} />}
        {activeTab === 'colors' && <ColorsTab node={node} />}
        {activeTab === 'content' && <ContentTab node={node} />}
        {activeTab === 'states' && <StatesTab node={node} />}
        {activeTab === 'animations' && <AnimationsTab node={node} />}
        {activeTab === 'scripts' && (
          <ScriptsTab 
            node={node} 
            isPageRoot={isPageRoot} 
            pageSettings={pageSettings}
            onPageSettingsChange={onPageSettingsChange}
          />
        )}
        {activeTab === 'data' && (
          <div className="space-y-6">
            {/* Template Mode Controls - только для блоков с UUID */}
            {currentBlockData && currentBlockData.id && (
              <TemplateBlockControls
                blockId={currentBlockData.id}
                blockName={currentBlockData.name || node.metadata.name || 'Unnamed Block'}
                isTemplate={currentBlockData.isTemplate || false}
                templateCategory={currentBlockData.templateCategory}
                detectedFieldsCount={currentBlockData.detectedFields?.length || 0}
                onToggle={() => {
                  // Перезагрузить данные блока после изменения
                  window.location.reload()
                }}
              />
            )}
            
            {/* Data Binding Tab - только если есть реальный блок */}
            {currentBlockData && currentBlockData.id ? (
              <SmartDataBindingTab 
                blockId={currentBlockData.id}
                pageId={pageId}
              />
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Data Binding доступен только для блоков, а не для элементов внутри блока.
                </p>
                <p className="text-xs text-yellow-600 mt-2">
                  Выберите блок целиком для настройки привязки данных.
                </p>
              </div>
            )}
          </div>
        )}
        {activeTab === 'css' && <CustomCSSTab node={node} />}
        
        {/* Template Fields - показываем если это Template блок */}
        {currentBlockData?.isTemplate && currentBlockData?.detectedFields && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-purple-600" />
              <h3 className="text-sm font-medium text-gray-900">Template Fields</h3>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                {currentBlockData.detectedFields.length}
              </span>
            </div>
            <div className="text-xs text-gray-500 mb-3">
              Поля автоматически определяются из элементов с metadata.name
            </div>
            <DetectedFieldsViewer fields={currentBlockData.detectedFields} />
          </div>
        )}
      </div>
    </div>
  )
}
