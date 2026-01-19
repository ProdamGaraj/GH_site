import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { 
  DndContext, 
  DragEndEvent, 
  DragStartEvent,
  DragOverEvent,
  DragMoveEvent,
  useSensor, 
  useSensors, 
  PointerSensor, 
  MouseSensor,
  pointerWithin,
  MeasuringStrategy,
} from '@dnd-kit/core'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { 
  createNewEditor, 
  selectRootNode, 
  addNode, 
  moveNode,
  reorderNode,
  updateNodePosition,
  updateNodeStyles,
  startDrag,
  endDrag,
  selectDragState,
  setViewport,
  selectViewport,
  selectActiveLeftPanel,
  selectActiveRightPanel,
  setActiveLeftPanel,
  setActiveRightPanel,
  selectInlineBlockEdit,
} from '@/features/editor/editorSlice'
import { Header } from '@/shared/components/Header'
import { EditorToolbar } from '@/features/editor/components/EditorToolbar'
import { Canvas } from '@/features/editor/components/Canvas/Canvas'
// import { LeftPanel } from '@/features/editor/components/LeftPanel/LeftPanel'
import { RightPanel } from '@/features/editor/components/RightPanel/RightPanel'
import { LibraryPanel } from '@/features/editor/components/LibraryPanel/LibraryPanel'
import { PageSettingsPanel } from '@/features/editor/components/PageSettings/PageSettingsPanel'
import { LeftSidebar } from '@/features/editor/components/Sidebar/LeftSidebar'
import { RightSidebar } from '@/features/editor/components/Sidebar/RightSidebar'
import { SavedBlocksLibrary } from '@/features/editor/components/SavedBlocksLibrary/SavedBlocksLibrary'
import { LayersPanel } from '@/features/editor/components/LeftPanel/LayersPanel'
import { DragOverlay } from '@/features/editor/components/Canvas/DragOverlay'
import type { DragItem, BlockNode, EditorPageSettings } from '@/shared/types'
import { 
  DropIndicator, 
  collectElementRects, 
  determineDropTarget,
  getLayoutMode,
} from '@/features/editor/utils/dndUtils'

interface EditorProps {
  type: 'page' | 'block'
}

// Helper to find node by id
const findNodeById = (node: BlockNode, id: string): BlockNode | null => {
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNodeById(child, id)
    if (found) return found
  }
  return null
}

export const Editor: React.FC<EditorProps> = ({ type }) => {
  const { id } = useParams()
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)
  const dragState = useAppSelector(selectDragState)
  const viewport = useAppSelector(selectViewport) as 'desktop' | 'tablet' | 'mobile'
  const activeLeftPanel = useAppSelector(selectActiveLeftPanel)
  const activeRightPanel = useAppSelector(selectActiveRightPanel)
  const inlineBlockEdit = useAppSelector(selectInlineBlockEdit)
  const [leftPanelWidth, setLeftPanelWidth] = useState(280)
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [isResizingRight, setIsResizingRight] = useState(false)
  // const [isLibraryOpen, setIsLibraryOpen] = useState(true)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)
  const [targetContainerRect, setTargetContainerRect] = useState<DOMRect | null>(null)
  const [targetLayoutMode, setTargetLayoutMode] = useState<'flex' | 'grid' | 'absolute' | 'table'>('flex')
  const [activeNode, setActiveNode] = useState<BlockNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [pageSettings, setPageSettings] = useState<EditorPageSettings>({
    name: '',
    slug: '',
    status: 'draft' as 'draft' | 'published' | 'archived',
    metaTitle: '',
    metaDescription: '',
    keywords: '',
    ogImage: '',
    scripts: [],
  })
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const dropIndicatorRef = useRef<DropIndicator | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  
  // Viewport widths
  const viewportWidths = {
    desktop: '1440px',
    tablet: '768px',
    mobile: '375px',
  }

  // Keep ref in sync with state
  useEffect(() => {
    dropIndicatorRef.current = dropIndicator
  }, [dropIndicator])

  // Handle left panel resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingLeft) return
      const newWidth = e.clientX
      if (newWidth >= 200 && newWidth <= 600) {
        setLeftPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizingLeft(false)
    }

    if (isResizingLeft) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingLeft])

  // Handle right panel resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRight) return
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= 280 && newWidth <= 600) {
        setRightPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizingRight(false)
    }

    if (isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingRight])

  useEffect(() => {
    const loadEditor = async () => {
      // Проверяем есть ли импортированный контент
      const importedContentStr = sessionStorage.getItem('importedContent')
      if (importedContentStr && (!id || id === 'new')) {
        try {
          const importedContent = JSON.parse(importedContentStr)
          sessionStorage.removeItem('importedContent') // Очищаем после использования
          
          // Загружаем импортированную структуру
          const { loadEditor: loadEditorAction } = await import('@/features/editor/editorSlice')
          dispatch(loadEditorAction(importedContent.node))
          
          // Устанавливаем имя для страницы
          if (type === 'page' && importedContent.name) {
            setPageSettings(prev => ({
              ...prev,
              name: importedContent.name,
              slug: importedContent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            }))
          }
          return
        } catch (e) {
          console.error('Failed to load imported content:', e)
          sessionStorage.removeItem('importedContent')
        }
      }
      
      if (!id || id === 'new') {
        dispatch(createNewEditor())
      } else if (type === 'block') {
        // Load existing block
        setLoading(true)
        try {
          const { fetchBlockById } = await import('@/features/blocks/blocksSlice')
          const result = await dispatch(fetchBlockById(id)).unwrap()
          
          // Load the block structure into editor
          const { loadEditor: loadEditorAction } = await import('@/features/editor/editorSlice')
          dispatch(loadEditorAction(result.structure))
        } catch (error) {
          console.error('Failed to load block:', error)
        } finally {
          setLoading(false)
        }
      } else if (type === 'page') {
        // Load existing page
        setLoading(true)
        try {
          const { fetchPageById } = await import('@/features/pages/pagesSlice')
          const result = await dispatch(fetchPageById(id)).unwrap()
          
          // Load the page structure into editor
          const { loadEditor: loadEditorAction } = await import('@/features/editor/editorSlice')
          dispatch(loadEditorAction(result.structure))
          
          // Load page settings
          setPageSettings({
            name: result.name,
            slug: result.slug,
            status: result.status || 'draft',
            metaTitle: result.metadata?.title || '',
            metaDescription: result.metadata?.description || '',
            keywords: result.metadata?.keywords?.join(', ') || '',
            ogImage: result.metadata?.ogImage || '',
          })
        } catch (error) {
          console.error('Failed to load page:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    
    loadEditor()
  }, [id, type, dispatch])
  
  // Set default right panel for page editor
  useEffect(() => {
    if (type === 'page') {
      dispatch(setActiveRightPanel('pageSettings'))
    }
  }, [type, dispatch])

  // Update root container styles based on editor type and viewport
  useEffect(() => {
    if (!rootNode) return
    
    if (type === 'page') {
      // Page editor: fixed width by viewport, height by content
      dispatch(updateNodeStyles({
        nodeId: rootNode.id,
        properties: {
          width: viewportWidths[viewport],
          minHeight: '100px',
          height: 'auto',
        }
      }))
    } else {
      // Block editor: fit-content
      dispatch(updateNodeStyles({
        nodeId: rootNode.id,
        properties: {
          width: 'fit-content',
          minWidth: '200px',
          minHeight: '100px',
        }
      }))
    }
  }, [type, viewport, rootNode?.id, dispatch])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active, activatorEvent } = event
    const dragData = active.data.current as DragItem

    if (dragData?.type === 'canvas-element' && dragData.node) {
      dispatch(startDrag({ nodeId: dragData.node.id }))
      setActiveNode(dragData.node)
      
      // Calculate offset from cursor to element's top-left corner
      const mouseEvent = activatorEvent as MouseEvent
      if (mouseEvent) {
        const element = document.querySelector(`[data-element-id="${dragData.node.id}"]`)
        if (element) {
          const rect = element.getBoundingClientRect()
          dragOffsetRef.current = {
            x: mouseEvent.clientX - rect.left,
            y: mouseEvent.clientY - rect.top,
          }
        }
      }
    } else if (dragData?.type === 'library-item') {
      // For library items, we don't have a node yet - use default offset
      dragOffsetRef.current = { x: 20, y: 20 }
      setActiveNode(null)
    }
  }, [dispatch])

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!rootNode) return

    const { active, activatorEvent } = event
    const dragData = active.data.current as DragItem
    
    // Get mouse position
    const mouseEvent = activatorEvent as MouseEvent
    if (!mouseEvent) return
    
    const mousePosition = {
      x: mouseEvent.clientX + (event.delta?.x || 0),
      y: mouseEvent.clientY + (event.delta?.y || 0),
    }

    // Collect all element rects
    const canvasElement = document.querySelector('[data-canvas="true"]')
    if (!canvasElement) return

    const elementRects = collectElementRects(canvasElement as HTMLElement)
    
    // Check if dragged element has position: absolute
    const draggedNode = dragData?.type === 'canvas-element' ? dragData.node : null
    const isAbsoluteElement = draggedNode?.styles?.properties?.position === 'absolute'
    
    // Determine drop target (pass drag offset for absolute positioning)
    const draggedId = draggedNode?.id
    let indicator = determineDropTarget(
      rootNode, 
      mousePosition, 
      draggedId || '', 
      elementRects,
      dragOffsetRef.current
    )
    
    // If element has position: absolute, check if it's within parent bounds
    if (isAbsoluteElement && indicator && draggedNode) {
      // Get the element's current parent
      const sourceParentId = dragState.sourceParentId
      const sourceParentRect = sourceParentId ? elementRects.get(sourceParentId) : null
      const draggedRect = elementRects.get(draggedNode.id)
      
      if (sourceParentRect && draggedRect) {
        const offset = dragOffsetRef.current
        const elementWidth = draggedRect.width
        const elementHeight = draggedRect.height
        
        // Calculate potential position relative to source parent
        const potentialX = mousePosition.x - sourceParentRect.left - offset.x
        const potentialY = mousePosition.y - sourceParentRect.top - offset.y
        
        // Check if element would stay within parent bounds
        const isWithinParent = 
          potentialX >= -elementWidth / 2 &&
          potentialY >= -elementHeight / 2 &&
          potentialX <= sourceParentRect.width - elementWidth / 2 &&
          potentialY <= sourceParentRect.height - elementHeight / 2
        
        if (isWithinParent) {
          // Clamp coordinates to parent bounds (integer values)
          const clampedX = Math.round(Math.max(0, Math.min(potentialX, sourceParentRect.width - elementWidth)))
          const clampedY = Math.round(Math.max(0, Math.min(potentialY, sourceParentRect.height - elementHeight)))
          
          indicator = {
            ...indicator,
            type: 'absolute-position',
            targetParentId: sourceParentId || '',
            absoluteCoords: {
              x: clampedX,
              y: clampedY,
            }
          }
        }
        // If outside parent bounds, keep the indicator as-is (will trigger parent change mode)
      }
    }
    
    if (indicator) {
      setDropIndicator(indicator)
      
      // Get target container rect for highlight
      const targetParentRect = elementRects.get(indicator.targetParentId)
      setTargetContainerRect(targetParentRect || null)
      
      // Get layout mode
      const targetParent = findNodeById(rootNode, indicator.targetParentId)
      if (targetParent) {
        setTargetLayoutMode(getLayoutMode(targetParent))
      }
    }
  }, [rootNode, dragState.sourceParentId])

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // This is handled by DragMove for more precise control
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const dragData = active.data.current as DragItem

    // Use ref to get the latest indicator value
    const currentIndicator = dropIndicatorRef.current

    // Clear drag state
    dispatch(endDrag())
    setActiveNode(null)
    setDropIndicator(null)
    setTargetContainerRect(null)

    if (!currentIndicator) {
      // Fallback to simple drop logic if no indicator
      if (!over) return
      
      const dropTargetId = (over.id as string).replace('drop-', '')
      
      if (dragData?.type === 'library-item') {
        dispatch(addNode({
          parentId: dropTargetId,
          node: {
            elementType: dragData.elementType,
            tagName: dragData.tagName,
            metadata: { name: dragData.label },
          },
        }))
      }
      return
    }

    const { targetParentId, position, absoluteCoords, type: indicatorType } = currentIndicator

    if (dragData?.type === 'library-item') {
      // Adding new element from library
      let newNodeProps: Partial<BlockNode>
      
      // If dragging a saved block (with structure), clone it
      if (dragData.node) {
        // Clone the entire block structure with new IDs
        // Lock only children, not the root container
        // dragData.id contains the library block ID
        const libraryBlockId = dragData.id
        
        const cloneNodeWithNewIds = (node: BlockNode, isRoot = true): BlockNode => {
          return {
            ...node,
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            metadata: {
              ...node.metadata,
              locked: !isRoot, // Lock children but not root
              name: isRoot ? `${node.metadata?.name || 'Блок'} (копия)` : node.metadata?.name,
              // Сохраняем связь с блоком в библиотеке для корневого элемента
              linkedBlockId: isRoot ? libraryBlockId : node.metadata?.linkedBlockId,
            },
            children: node.children.map(child => cloneNodeWithNewIds(child, false)),
          }
        }
        
        newNodeProps = cloneNodeWithNewIds(dragData.node, true)
      } else {
        // Regular library item
        newNodeProps = {
          elementType: dragData.elementType,
          tagName: dragData.tagName,
          metadata: { name: dragData.label },
        }
      }

      // If dropping into absolute container, set position
      if (indicatorType === 'absolute-position' && absoluteCoords) {
        newNodeProps.styles = {
          properties: {
            position: 'absolute',
            left: `${absoluteCoords.x}px`,
            top: `${absoluteCoords.y}px`,
          },
        }
      }

      dispatch(addNode({
        parentId: targetParentId,
        node: newNodeProps,
        position: position,
      }))
    } else if (dragData?.type === 'canvas-element' && dragData.node) {
      // Moving existing element
      const nodeId = dragData.node.id
      const draggedNode = dragData.node
      const sourceParentId = dragState.sourceParentId
      
      // Check if the dragged element itself has position: absolute
      const isAbsoluteElement = draggedNode.styles?.properties?.position === 'absolute'
      
      // If element has position: absolute, just update its coordinates
      if (isAbsoluteElement && absoluteCoords) {
        dispatch(updateNodePosition({
          nodeId,
          position: absoluteCoords,
        }))
        return
      }
      
      // Check if it's a reorder within the same parent
      if (sourceParentId === targetParentId) {
        if (position !== undefined) {
          // Reorder within same flex/grid container
          dispatch(reorderNode({
            nodeId,
            parentId: targetParentId,
            newIndex: position,
          }))
        }
      } else {
        // Move to different parent
        dispatch(moveNode({
          nodeId,
          targetParentId,
          position: indicatorType === 'absolute-position' ? undefined : position,
          absolutePosition: absoluteCoords,
        }))
      }
    }
  }, [dispatch, dragState.sourceParentId])

  const handleDragCancel = useCallback(() => {
    dispatch(endDrag())
    setActiveNode(null)
    setDropIndicator(null)
    setTargetContainerRect(null)
  }, [dispatch])

  if (!rootNode || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          {loading ? (
            <>
              <div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-gray-500">Загрузка блока...</p>
            </>
          ) : (
            <>
              <p className="text-gray-500">Инициализация редактора...</p>
              <p className="text-xs text-gray-400 mt-2">id: {id || 'new'}</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
    >
      <div className="h-screen flex flex-col bg-gray-100" ref={canvasContainerRef}>
        <EditorToolbar 
          type={type} 
          viewport={viewport}
          onViewportChange={(newViewport) => dispatch(setViewport(newViewport))}
          pageSettings={type === 'page' ? pageSettings : undefined}
        >
          {({ centerContent, rightContent }) => (
            <Header 
              centerActions={centerContent}
              rightActions={rightContent}
            />
          )}
        </EditorToolbar>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar with Icons */}
          <LeftSidebar mode={type} />
          
          {/* Left Panel Content */}
          {activeLeftPanel && (
            <div 
              className="bg-white border-r border-gray-200 flex flex-col relative"
              style={{ width: `${leftPanelWidth}px` }}
            >
              <button
                onClick={() => dispatch(setActiveLeftPanel(null))}
                className="absolute -right-3 top-4 z-10 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                title="Скрыть панель"
              >
                <ChevronLeft size={14} className="text-gray-600" />
              </button>
              
              {/* Resize handle */}
              <div
                onMouseDown={() => setIsResizingLeft(true)}
                className="absolute right-0 top-0 bottom-0 w-1 hover:w-2 bg-transparent hover:bg-blue-400 cursor-col-resize transition-all z-20"
                title="Изменить ширину"
              />
              
              {activeLeftPanel === 'layers' && (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {type === 'page' ? 'Структура страницы' : 'Структура блока'}
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto overflow-x-auto">
                    <LayersPanel />
                  </div>
                </>
              )}
              
              {activeLeftPanel === 'library' && (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 text-sm">Библиотека элементов</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Перетащите элементы на холст</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    <LibraryPanel isOpen={true} onToggle={() => {}} />
                  </div>
                </>
              )}
              
              {activeLeftPanel === 'savedBlocks' && type === 'page' && (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 text-sm">Сохраненные блоки</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    <SavedBlocksLibrary />
                  </div>
                </>
              )}
            </div>
          )}
          
          <Canvas 
            dropIndicator={dropIndicator}
            targetContainerRect={targetContainerRect}
            targetLayoutMode={targetLayoutMode}
            editorType={type}
          />
          
          {/* Right Panel Content */}
          {activeRightPanel && (
            <div 
              className="bg-white border-l border-gray-200 flex flex-col relative"
              style={{ width: `${rightPanelWidth}px` }}
            >
              {/* Resize handle on left edge */}
              <div
                onMouseDown={() => setIsResizingRight(true)}
                className="absolute left-0 top-0 bottom-0 w-1 hover:w-2 bg-transparent hover:bg-blue-400 cursor-col-resize transition-all z-20"
                title="Изменить ширину"
              />
              
              <button
                onClick={() => dispatch(setActiveRightPanel(null))}
                className="absolute -left-3 top-4 z-10 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                title="Скрыть панель"
              >
                <ChevronRight size={14} className="text-gray-600" />
              </button>
              
              <div className="flex-1 overflow-y-auto overflow-x-auto">
                {type === 'page' && activeRightPanel === 'pageSettings' && !inlineBlockEdit.nodeId && (
                  <PageSettingsPanel 
                    settings={pageSettings}
                    onChange={setPageSettings}
                  />
                )}
                
                {/* Показываем панель свойств элемента */}
                {(activeRightPanel === 'properties' || inlineBlockEdit.nodeId) && (
                  <RightPanel 
                    pageSettings={type === 'page' ? pageSettings : undefined}
                    onPageSettingsChange={type === 'page' ? setPageSettings : undefined}
                    pageId={id}
                  />
                )}
              </div>
            </div>
          )}
          
          {/* Right Sidebar with Icons */}
          <RightSidebar mode={type} />
        </div>
      </div>
      
      {/* Drag overlay */}
      <DragOverlay activeNode={activeNode} />
    </DndContext>
  )
}
