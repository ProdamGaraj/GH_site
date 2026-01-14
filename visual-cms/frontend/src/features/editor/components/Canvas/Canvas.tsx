import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { selectRootNode, selectDragState, selectViewport, selectBreakpoints, selectZoom, selectPanOffset, selectBlockAlignment, selectEditMode, setZoom, setPanOffset } from '@/features/editor/editorSlice'
import { CanvasRenderer } from './CanvasRenderer'
import type { DropIndicator } from '../../utils/dndUtils'
import { DropIndicatorOverlay, DropTargetHighlight } from './DropIndicatorOverlay'
import { getEffectiveTree } from '../../utils/variationUtils'

interface CanvasProps {
  dropIndicator?: DropIndicator | null
  targetContainerRect?: DOMRect | null
  targetLayoutMode?: 'flex' | 'grid' | 'absolute' | 'table'
  editorType?: 'page' | 'block'
}

export const Canvas: React.FC<CanvasProps> = ({ 
  dropIndicator, 
  targetContainerRect,
  targetLayoutMode = 'flex',
  editorType = 'block'
}) => {
  const dispatch = useAppDispatch()
  const rootNode = useAppSelector(selectRootNode)
  const dragState = useAppSelector(selectDragState)
  const viewport = useAppSelector(selectViewport)
  const breakpoints = useAppSelector(selectBreakpoints)
  const zoom = useAppSelector(selectZoom)
  const panOffset = useAppSelector(selectPanOffset)
  const blockAlignment = useAppSelector(selectBlockAlignment)
  const editMode = useAppSelector(selectEditMode)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  
  const currentBreakpoint = breakpoints.find(bp => bp.id === viewport)
  
  // Получаем эффективное дерево с учетом вариаций
  // В base режиме viewport может быть 'base', используем editMode для определения
  const effectiveTree = rootNode ? getEffectiveTree(
    rootNode, 
    viewport === 'base' ? null : viewport, 
    editMode
  ) : null

  // Zoom with Ctrl + Mouse Wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = -e.deltaY
        const newZoom = Math.max(25, Math.min(500, zoom + delta * 0.1))
        dispatch(setZoom(Math.round(newZoom)))
      }
    }

    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false })
      return () => canvas.removeEventListener('wheel', handleWheel)
    }
  }, [zoom, dispatch])

  // Pan with Space + Drag or Middle Mouse Button
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Start panning on middle-click or left-click while Space is held
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
    }
  }, [panOffset, isSpacePressed])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      dispatch(setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }))
    }
  }, [isPanning, panStart, dispatch])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(true)
        if (!isPanning) {
          e.preventDefault()
          document.body.style.cursor = 'grab'
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false)
        document.body.style.cursor = 'default'
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.body.style.cursor = 'default'
    }
  }, [isPanning])

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
      className="flex-1 bg-gray-200 overflow-auto relative"
      data-canvas="true"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        cursor: isPanning ? 'grabbing' : 'default'
      }}
    >
      <div 
        className="min-h-full p-6 flex justify-center"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          transition: isPanning ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {/* Drop indicator overlay - positioned relative to canvas container */}
        {dragState.isDragging && dropIndicator && (
          <DropIndicatorOverlay 
            indicator={dropIndicator} 
            containerRef={canvasRef as React.RefObject<HTMLElement>}
            targetContainerRect={targetContainerRect}
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
        
        <div 
          className="relative"
          style={{ 
            // Фиксированная ширина viewport (как экран)
            width: editMode === 'responsive' && currentBreakpoint 
              ? `${currentBreakpoint.width}px` 
              : editorType === 'page' ? '1280px' : '800px',
            // Высота автоматическая - страница скроллится вертикально
            minHeight: 'auto',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            // Тень для визуального выделения страницы
            boxShadow: '0 4px 40px rgba(0,0,0,0.15)',
            background: 'white',
            // Применяем базовый шрифт для страницы
            fontFamily: 'Muller, sans-serif',
          }}
        >
          {/* Breakpoint size indicator - только в responsive режиме */}
          {editMode === 'responsive' && currentBreakpoint && (
            <div className="absolute -top-8 left-0 right-0 flex items-center justify-center gap-2 text-xs text-gray-500">
              <div className="bg-purple-100 px-3 py-1.5 rounded shadow-sm border border-purple-300">
                <span className="font-medium text-purple-700">Режим {currentBreakpoint.name}:</span>
                <span className="ml-1 text-purple-600">{currentBreakpoint.width}px</span>
                {currentBreakpoint.height && <span className="text-purple-600"> × {currentBreakpoint.height}px</span>}
              </div>
            </div>
          )}
          <CanvasRenderer 
            node={effectiveTree || rootNode} 
            isRoot 
            editorType={editorType} 
            blockAlignment={blockAlignment}
            rootNode={rootNode || undefined}
          />
        </div>
      </div>
    </div>
  )
}
