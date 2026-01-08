import React, { useRef } from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectRootNode, selectDragState } from '@/features/editor/editorSlice'
import { CanvasRenderer } from './CanvasRenderer'
import type { DropIndicator } from '../../utils/dndUtils'
import { DropIndicatorOverlay, DropTargetHighlight } from './DropIndicatorOverlay'

interface CanvasProps {
  dropIndicator?: DropIndicator | null
  targetContainerRect?: DOMRect | null
  targetLayoutMode?: 'flex' | 'grid' | 'absolute' | 'table'
}

export const Canvas: React.FC<CanvasProps> = ({ 
  dropIndicator, 
  targetContainerRect,
  targetLayoutMode = 'flex'
}) => {
  const rootNode = useAppSelector(selectRootNode)
  const dragState = useAppSelector(selectDragState)
  const canvasRef = useRef<HTMLDivElement>(null)

  if (!rootNode) {
    return (
      <div className="flex-1 bg-gray-100 p-8 overflow-auto flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  return (
    <div 
      ref={canvasRef}
      className="flex-1 bg-gray-100 p-8 overflow-auto relative"
      data-canvas="true"
    >
      {/* Drop indicator overlay - positioned relative to canvas container */}
      {dragState.isDragging && dropIndicator && (
        <DropIndicatorOverlay 
          indicator={dropIndicator} 
          containerRef={canvasRef as React.RefObject<HTMLElement>}
        />
      )}
      
      {/* Target container highlight */}
      {dragState.isDragging && targetContainerRect && (
        <DropTargetHighlight
          targetRect={targetContainerRect}
          containerRef={canvasRef as React.RefObject<HTMLElement>}
          layoutMode={targetLayoutMode}
        />
      )}
      
      <div className="mx-auto relative" style={{ maxWidth: '1200px' }}>
        <CanvasRenderer node={rootNode} isRoot />
      </div>
    </div>
  )
}
