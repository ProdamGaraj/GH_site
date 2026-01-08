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
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { 
  createNewEditor, 
  selectRootNode, 
  addNode, 
  moveNode,
  reorderNode,
  updateNodePosition,
  startDrag,
  endDrag,
  selectDragState,
} from '@/features/editor/editorSlice'
import { Header } from '@/shared/components/Header'
import { EditorToolbar } from '@/features/editor/components/EditorToolbar'
import { Canvas } from '@/features/editor/components/Canvas/Canvas'
import { LeftPanel } from '@/features/editor/components/LeftPanel/LeftPanel'
import { RightPanel } from '@/features/editor/components/RightPanel/RightPanel'
import { LibraryPanel } from '@/features/editor/components/LibraryPanel/LibraryPanel'
import { DragOverlay } from '@/features/editor/components/Canvas/DragOverlay'
import type { DragItem, BlockNode } from '@/shared/types'
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
  const [isLibraryOpen, setIsLibraryOpen] = useState(true)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)
  const [targetContainerRect, setTargetContainerRect] = useState<DOMRect | null>(null)
  const [targetLayoutMode, setTargetLayoutMode] = useState<'flex' | 'grid' | 'absolute' | 'table'>('flex')
  const [activeNode, setActiveNode] = useState<BlockNode | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const dropIndicatorRef = useRef<DropIndicator | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Keep ref in sync with state
  useEffect(() => {
    dropIndicatorRef.current = dropIndicator
  }, [dropIndicator])

  useEffect(() => {
    if (!id || id === 'new') {
      dispatch(createNewEditor())
    }
  }, [id, dispatch])

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
            targetParentId: sourceParentId,
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
    
    console.log('🎯 DragEnd - dropIndicator:', currentIndicator)
    console.log('🎯 DragEnd - over:', over?.id)
    console.log('🎯 DragEnd - dragData:', dragData)

    // Clear drag state
    dispatch(endDrag())
    setActiveNode(null)
    setDropIndicator(null)
    setTargetContainerRect(null)

    if (!currentIndicator) {
      // Fallback to simple drop logic if no indicator
      if (!over) return
      
      const dropTargetId = (over.id as string).replace('drop-', '')
      console.log('🎯 Fallback - dropTargetId:', dropTargetId)
      
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
    console.log('🎯 Using indicator - targetParentId:', targetParentId, 'position:', position)

    if (dragData?.type === 'library-item') {
      // Adding new element from library
      const newNodeProps: Partial<BlockNode> = {
        elementType: dragData.elementType,
        tagName: dragData.tagName,
        metadata: { name: dragData.label },
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
      
      console.log('🔧 Move logic:', {
        nodeId,
        sourceParentId,
        targetParentId,
        indicatorType,
        absoluteCoords,
        isAbsoluteElement,
        sameParent: sourceParentId === targetParentId
      })
      
      // If element has position: absolute, just update its coordinates
      if (isAbsoluteElement && absoluteCoords) {
        console.log('📍 Updating absolute element position:', absoluteCoords)
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

  if (!rootNode) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500">Загрузка редактора...</p>
          <p className="text-xs text-gray-400 mt-2">id: {id || 'new'}</p>
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
        <Header showActions={<EditorToolbar type={type} />} />
        
        <div className="flex-1 flex overflow-hidden">
          <LeftPanel />
          <LibraryPanel 
            isOpen={isLibraryOpen} 
            onToggle={() => setIsLibraryOpen(!isLibraryOpen)} 
          />
          <Canvas 
            dropIndicator={dropIndicator}
            targetContainerRect={targetContainerRect}
            targetLayoutMode={targetLayoutMode}
          />
          <RightPanel />
        </div>
      </div>
      
      {/* Drag overlay */}
      <DragOverlay activeNode={activeNode} />
    </DndContext>
  )
}
