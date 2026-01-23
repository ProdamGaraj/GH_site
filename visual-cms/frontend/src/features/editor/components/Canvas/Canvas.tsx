import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { selectRootNode, selectDragState, selectViewport, selectBreakpoints, selectZoom, selectPanOffset, selectBlockAlignment, selectEditMode, setZoom, setPanOffset, selectCanvasColor } from '@/features/editor/editorSlice'
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
  const storedPanOffset = useAppSelector(selectPanOffset)
  const blockAlignment = useAppSelector(selectBlockAlignment)
  const editMode = useAppSelector(selectEditMode)
  const canvasColor = useAppSelector(selectCanvasColor)
  const canvasRef = useRef<HTMLDivElement>(null)
  const panContainerRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  // Локальный pan offset для плавности (без Redux при drag)
  const localPanRef = useRef({ x: storedPanOffset.x, y: storedPanOffset.y })
  
  const currentBreakpoint = breakpoints.find(bp => bp.id === viewport)
  
  // Мемоизируем эффективное дерево - пересчитывается только при изменении rootNode, viewport или editMode
  const effectiveTree = useMemo(() => {
    if (!rootNode) return null
    return getEffectiveTree(
      rootNode, 
      viewport === 'base' ? null : viewport, 
      editMode
    )
  }, [rootNode, viewport, editMode])

  // Синхронизируем localPanRef с Redux при внешних изменениях
  useEffect(() => {
    localPanRef.current = { x: storedPanOffset.x, y: storedPanOffset.y }
  }, [storedPanOffset])

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
    // Ignore events from input elements or their labels
    const target = e.target as HTMLElement
    
    // Check if target is an input element
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || 
        target.isContentEditable) {
      return
    }
    
    // Check if target is inside a label (for checkboxes/radio buttons)
    if (target.closest('label') || target.closest('input') || target.closest('textarea') || target.closest('select')) {
      return
    }
    
    // Start panning on middle-click or left-click while Space is held
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX - localPanRef.current.x, y: e.clientY - localPanRef.current.y })
    }
  }, [isSpacePressed])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && panContainerRef.current) {
      e.preventDefault() // Prevent text selection during panning
      // Обновляем через DOM напрямую - без React state/Redux
      const newX = e.clientX - panStart.x
      const newY = e.clientY - panStart.y
      localPanRef.current = { x: newX, y: newY }
      panContainerRef.current.style.transform = `translate(${newX}px, ${newY}px)`
    }
  }, [isPanning, panStart])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      // Сохраняем в Redux только когда закончили pan
      dispatch(setPanOffset(localPanRef.current))
    }
    setIsPanning(false)
  }, [isPanning, dispatch])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        // Skip if user is typing in input/textarea
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return
        }
        
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
        cursor: isPanning ? 'grabbing' : 'default',
      }}
    >
      <div 
        ref={panContainerRef}
        className="min-h-full p-6 flex justify-center"
        style={{
          transform: `translate(${storedPanOffset.x}px, ${storedPanOffset.y}px)`,
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
          className="relative canvas-viewport"
          style={{ 
            // Фиксированная ширина viewport (как экран)
            width: editMode === 'responsive' && currentBreakpoint 
              ? `${currentBreakpoint.width}px` 
              : editorType === 'page' ? '1280px' : '800px',
            // Высота фиксированная, если задана в breakpoint (для правильных пропорций)
            ...(editMode === 'responsive' && currentBreakpoint?.height ? {
              height: `${currentBreakpoint.height}px`,
              minHeight: `${currentBreakpoint.height}px`,
              maxHeight: `${currentBreakpoint.height}px`,
            } : {}),
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            // Тень для визуального выделения страницы
            boxShadow: '0 4px 40px rgba(0,0,0,0.15)',
            background: canvasColor,
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
