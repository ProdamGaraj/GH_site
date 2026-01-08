import React from 'react'
import type { DropIndicator } from '../../utils/dndUtils'

interface DropIndicatorOverlayProps {
  indicator: DropIndicator | null
  containerRef: React.RefObject<HTMLElement>
}

export const DropIndicatorOverlay: React.FC<DropIndicatorOverlayProps> = ({ 
  indicator,
  containerRef 
}) => {
  if (!indicator || !indicator.rect || !containerRef.current) return null

  const container = containerRef.current
  const containerRect = container.getBoundingClientRect()
  
  // Calculate position relative to the canvas container, accounting for scroll
  const relativeRect = {
    left: indicator.rect.left - containerRect.left + container.scrollLeft,
    top: indicator.rect.top - containerRect.top + container.scrollTop,
    width: indicator.rect.width,
    height: indicator.rect.height,
  }

  if (indicator.type === 'absolute-position' && indicator.absoluteCoords) {
    // Show crosshair for absolute positioning
    return (
      <div 
        className="pointer-events-none absolute z-50"
        style={{
          left: relativeRect.left + indicator.absoluteCoords.x - 10,
          top: relativeRect.top + indicator.absoluteCoords.y - 10,
        }}
      >
        {/* Crosshair */}
        <div className="relative w-5 h-5">
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-blue-500 -translate-x-1/2" />
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-500 -translate-y-1/2" />
          <div className="absolute left-1/2 top-1/2 w-2 h-2 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
        {/* Position label */}
        <div 
          className="absolute left-6 top-0 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded whitespace-nowrap"
        >
          {Math.round(indicator.absoluteCoords.x)}, {Math.round(indicator.absoluteCoords.y)}
        </div>
      </div>
    )
  }

  // Show line indicator for flex/grid layouts
  const isVertical = indicator.type === 'before' || indicator.type === 'after'
  
  return (
    <div 
      className="pointer-events-none absolute z-50 transition-all duration-75"
      style={getIndicatorStyle(indicator, relativeRect)}
    >
      <div 
        className={`
          bg-blue-500 rounded-full
          ${isVertical ? 'w-1 h-full' : 'h-1 w-full'}
        `}
      />
      {/* End dots */}
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full" />
      <div 
        className="absolute -bottom-1 w-2 h-2 bg-blue-500 rounded-full"
        style={isVertical ? { left: '-4px' } : { right: '-4px', bottom: '-4px', left: 'auto' }}
      />
    </div>
  )
}

const getIndicatorStyle = (
  indicator: DropIndicator, 
  relativeRect: { left: number; top: number; width: number; height: number }
): React.CSSProperties => {
  const padding = 2

  switch (indicator.type) {
    case 'before':
      return {
        left: relativeRect.left - padding,
        top: relativeRect.top,
        height: relativeRect.height,
        width: 4,
      }
    case 'after':
      return {
        left: relativeRect.left + relativeRect.width + padding,
        top: relativeRect.top,
        height: relativeRect.height,
        width: 4,
      }
    case 'inside':
      return {
        left: relativeRect.left + padding,
        top: relativeRect.top + relativeRect.height / 2,
        width: relativeRect.width - padding * 2,
        height: 4,
      }
    default:
      return {}
  }
}

// Highlight overlay for drop target container
interface DropTargetHighlightProps {
  targetRect: DOMRect | null
  containerRef: React.RefObject<HTMLElement>
  layoutMode: 'flex' | 'grid' | 'absolute' | 'table'
}

export const DropTargetHighlight: React.FC<DropTargetHighlightProps> = ({
  targetRect,
  containerRef,
  layoutMode,
}) => {
  if (!targetRect || !containerRef.current) return null

  const container = containerRef.current
  const containerRect = container.getBoundingClientRect()
  
  // Account for scroll position
  const relativeRect = {
    left: targetRect.left - containerRect.left + container.scrollLeft,
    top: targetRect.top - containerRect.top + container.scrollTop,
    width: targetRect.width,
    height: targetRect.height,
  }

  const borderColor = layoutMode === 'absolute' ? '#f59e0b' : '#3b82f6'
  const bgColor = layoutMode === 'absolute' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)'

  return (
    <div
      className="pointer-events-none absolute z-40 transition-all duration-100"
      style={{
        left: relativeRect.left,
        top: relativeRect.top,
        width: relativeRect.width,
        height: relativeRect.height,
        border: `2px dashed ${borderColor}`,
        backgroundColor: bgColor,
        borderRadius: '4px',
      }}
    >
      <div 
        className="absolute -top-6 left-0 text-xs px-2 py-0.5 rounded text-white"
        style={{ backgroundColor: borderColor }}
      >
        {layoutMode === 'absolute' ? 'Absolute' : layoutMode === 'grid' ? 'Grid' : 'Flex'}
      </div>
    </div>
  )
}
