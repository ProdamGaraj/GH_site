import React from 'react'
import type { DropIndicator } from '../../utils/dndUtils'

interface DropIndicatorOverlayProps {
  indicator: DropIndicator | null
  containerRef: React.RefObject<HTMLElement>
  targetContainerRect?: DOMRect | null
}

export const DropIndicatorOverlay: React.FC<DropIndicatorOverlayProps> = ({
  indicator,
  containerRef,
  targetContainerRect,
}) => {
  if (!indicator || !containerRef.current) return null

  const container = containerRef.current
  const containerRect = container.getBoundingClientRect()

  if (indicator.type === 'absolute-position' && indicator.absoluteCoords) {
    const parentRect = targetContainerRect || indicator.rect
    if (!parentRect) return null

    const relParent = {
      left: parentRect.left - containerRect.left + container.scrollLeft,
      top: parentRect.top - containerRect.top + container.scrollTop,
    }

    return (
      <div
        className="pointer-events-none absolute z-50"
        style={{
          left: relParent.left + indicator.absoluteCoords.x,
          top: relParent.top + indicator.absoluteCoords.y,
        }}
      >
        <div className="relative w-5 h-5" style={{ marginLeft: -10, marginTop: -10 }}>
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-blue-500 -translate-x-1/2" />
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-500 -translate-y-1/2" />
          <div className="absolute left-1/2 top-1/2 w-2 h-2 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="absolute left-3 -top-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
          {indicator.absoluteCoords.x}, {indicator.absoluteCoords.y}
        </div>
      </div>
    )
  }

  // Slot-line rendering for flow layouts (preferred path).
  if (indicator.slotLine) {
    const { x1, y1, x2, y2 } = indicator.slotLine
    const sx = container.scrollLeft - containerRect.left
    const sy = container.scrollTop - containerRect.top
    const px1 = x1 + sx
    const py1 = y1 + sy
    const px2 = x2 + sx
    const py2 = y2 + sy

    const isVertical = Math.abs(px1 - px2) < 0.5

    if (isVertical) {
      const top = Math.min(py1, py2)
      const height = Math.abs(py2 - py1)
      return (
        <div
          className="pointer-events-none absolute z-50 transition-all duration-75"
          style={{ left: px1 - 2, top, width: 4, height }}
        >
          <div className="w-1 h-full bg-blue-500 rounded-full mx-auto" />
          <div className="absolute w-2 h-2 bg-blue-500 rounded-full -top-1 left-1/2 -translate-x-1/2" />
          <div className="absolute w-2 h-2 bg-blue-500 rounded-full -bottom-1 left-1/2 -translate-x-1/2" />
        </div>
      )
    }

    const left = Math.min(px1, px2)
    const width = Math.abs(px2 - px1)
    return (
      <div
        className="pointer-events-none absolute z-50 transition-all duration-75"
        style={{ left, top: py1 - 2, width, height: 4 }}
      >
        <div className="h-1 w-full bg-blue-500 rounded-full my-auto" />
        <div className="absolute w-2 h-2 bg-blue-500 rounded-full -left-1 top-1/2 -translate-y-1/2" />
        <div className="absolute w-2 h-2 bg-blue-500 rounded-full -right-1 top-1/2 -translate-y-1/2" />
      </div>
    )
  }

  // Legacy rect-based fallback (no slotLine present — defensive).
  if (!indicator.rect) return null
  const r = {
    left: indicator.rect.left - containerRect.left + container.scrollLeft,
    top: indicator.rect.top - containerRect.top + container.scrollTop,
    width: indicator.rect.width,
    height: indicator.rect.height,
  }

  const isVertical = indicator.type === 'before' || indicator.type === 'after'
  const style: React.CSSProperties =
    indicator.type === 'before'
      ? { left: r.left - 2, top: r.top, height: r.height, width: 4 }
      : indicator.type === 'after'
      ? { left: r.left + r.width + 2, top: r.top, height: r.height, width: 4 }
      : { left: r.left + 2, top: r.top + r.height / 2, width: r.width - 4, height: 4 }

  return (
    <div className="pointer-events-none absolute z-50 transition-all duration-75" style={style}>
      <div
        className={`bg-blue-500 rounded-full ${isVertical ? 'w-1 h-full' : 'h-1 w-full'}`}
      />
    </div>
  )
}

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

  const r = {
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
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
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
