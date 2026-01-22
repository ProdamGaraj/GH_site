/**
 * GridVisualControls - Visual controls for CSS Grid properties
 * 
 * Визуальные кнопки и пресеты для Grid layout
 */

import React, { useState } from 'react'
import { cn } from '@/shared/utils'
import {
  Columns,
  Rows,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
} from 'lucide-react'

interface GridVisualControlsProps {
  gridTemplateColumns: string
  gridTemplateRows: string
  gap: string
  justifyItems: string
  alignItems: string
  onChange: (property: string, value: string) => void
}

// Button component for visual selector
const VisualButton: React.FC<{
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
  className?: string
}> = ({ active, onClick, title, children, className }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={cn(
      "p-2 rounded border transition-all",
      active
        ? "bg-primary-100 border-primary-500 text-primary-700"
        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300",
      className
    )}
  >
    {children}
  </button>
)

// Grid preview component
const GridPreview: React.FC<{
  columns: number
  rows: number
  active: boolean
  onClick: () => void
  title: string
}> = ({ columns, rows, active, onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={cn(
      "p-2 rounded border transition-all",
      active
        ? "bg-primary-100 border-primary-500"
        : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
    )}
  >
    <div 
      className="w-8 h-8 gap-0.5" 
      style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {Array.from({ length: columns * rows }).map((_, i) => (
        <div 
          key={i} 
          className={cn(
            "rounded-sm",
            active ? "bg-primary-400" : "bg-gray-300"
          )}
        />
      ))}
    </div>
  </button>
)

// Presets for common grid layouts
const GRID_PRESETS = [
  { name: '2 колонки', columns: 'repeat(2, 1fr)', rows: 'auto', cols: 2, rowCount: 1 },
  { name: '3 колонки', columns: 'repeat(3, 1fr)', rows: 'auto', cols: 3, rowCount: 1 },
  { name: '4 колонки', columns: 'repeat(4, 1fr)', rows: 'auto', cols: 4, rowCount: 1 },
  { name: '2x2', columns: 'repeat(2, 1fr)', rows: 'repeat(2, 1fr)', cols: 2, rowCount: 2 },
  { name: '3x2', columns: 'repeat(3, 1fr)', rows: 'repeat(2, 1fr)', cols: 3, rowCount: 2 },
  { name: 'Sidebar', columns: '250px 1fr', rows: 'auto', cols: 2, rowCount: 1 },
  { name: 'Sidebar + Content + Aside', columns: '200px 1fr 200px', rows: 'auto', cols: 3, rowCount: 1 },
  { name: 'Auto-fill', columns: 'repeat(auto-fill, minmax(200px, 1fr))', rows: 'auto', cols: 3, rowCount: 1 },
]

export const GridVisualControls: React.FC<GridVisualControlsProps> = ({
  gridTemplateColumns,
  gridTemplateRows,
  gap,
  justifyItems,
  alignItems,
  onChange,
}) => {
  const [showCustom, setShowCustom] = useState(false)

  // Find active preset
  const activePreset = GRID_PRESETS.find(
    p => p.columns === gridTemplateColumns && p.rows === gridTemplateRows
  )

  return (
    <div className="space-y-4">
      {/* Grid Presets */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Grid пресеты</label>
        <div className="grid grid-cols-4 gap-1">
          {GRID_PRESETS.slice(0, 5).map((preset) => (
            <GridPreview
              key={preset.name}
              columns={preset.cols}
              rows={preset.rowCount}
              active={activePreset?.name === preset.name}
              onClick={() => {
                onChange('gridTemplateColumns', preset.columns)
                onChange('gridTemplateRows', preset.rows)
              }}
              title={preset.name}
            />
          ))}
        </div>
        
        {/* Named presets */}
        <div className="flex flex-wrap gap-1 mt-2">
          {GRID_PRESETS.slice(5).map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                onChange('gridTemplateColumns', preset.columns)
                onChange('gridTemplateRows', preset.rows)
              }}
              className={cn(
                "px-2 py-1 text-xs rounded border transition-all",
                activePreset?.name === preset.name
                  ? "bg-primary-100 border-primary-500 text-primary-700"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Grid Template */}
      <div>
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className="text-xs text-primary-600 hover:text-primary-700 mb-2"
        >
          {showCustom ? '▼ Скрыть кастомные' : '▶ Кастомные значения'}
        </button>
        
        {showCustom && (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Columns</label>
              <input
                type="text"
                value={gridTemplateColumns || ''}
                onChange={(e) => onChange('gridTemplateColumns', e.target.value)}
                placeholder="repeat(3, 1fr)"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Rows</label>
              <input
                type="text"
                value={gridTemplateRows || ''}
                onChange={(e) => onChange('gridTemplateRows', e.target.value)}
                placeholder="auto"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
              />
            </div>
          </div>
        )}
      </div>

      {/* Justify Items */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Горизонтальное выравнивание элементов</label>
        <div className="flex gap-1">
          <VisualButton
            active={justifyItems === 'stretch' || justifyItems === ''}
            onClick={() => onChange('justifyItems', 'stretch')}
            title="Stretch"
          >
            <Columns size={16} />
          </VisualButton>
          <VisualButton
            active={justifyItems === 'start'}
            onClick={() => onChange('justifyItems', 'start')}
            title="Start"
          >
            <AlignHorizontalJustifyStart size={16} />
          </VisualButton>
          <VisualButton
            active={justifyItems === 'center'}
            onClick={() => onChange('justifyItems', 'center')}
            title="Center"
          >
            <AlignHorizontalJustifyCenter size={16} />
          </VisualButton>
          <VisualButton
            active={justifyItems === 'end'}
            onClick={() => onChange('justifyItems', 'end')}
            title="End"
          >
            <AlignHorizontalJustifyEnd size={16} />
          </VisualButton>
        </div>
      </div>

      {/* Align Items */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Вертикальное выравнивание элементов</label>
        <div className="flex gap-1">
          <VisualButton
            active={alignItems === 'stretch' || alignItems === ''}
            onClick={() => onChange('alignItems', 'stretch')}
            title="Stretch"
          >
            <Rows size={16} />
          </VisualButton>
          <VisualButton
            active={alignItems === 'start'}
            onClick={() => onChange('alignItems', 'start')}
            title="Start"
          >
            <AlignVerticalJustifyStart size={16} />
          </VisualButton>
          <VisualButton
            active={alignItems === 'center'}
            onClick={() => onChange('alignItems', 'center')}
            title="Center"
          >
            <AlignVerticalJustifyCenter size={16} />
          </VisualButton>
          <VisualButton
            active={alignItems === 'end'}
            onClick={() => onChange('alignItems', 'end')}
            title="End"
          >
            <AlignVerticalJustifyEnd size={16} />
          </VisualButton>
        </div>
      </div>

      {/* Gap */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Gap</label>
        <div className="flex gap-1 flex-wrap">
          {['0', '4px', '8px', '12px', '16px', '24px', '32px'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange('gap', value)}
              className={cn(
                "px-2 py-1 text-xs rounded border transition-all",
                gap === value
                  ? "bg-primary-100 border-primary-500 text-primary-700"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              {value === '0' ? '0' : parseInt(value)}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={gap || ''}
          onChange={(e) => onChange('gap', e.target.value)}
          placeholder="Custom (e.g., 1rem 2rem)"
          className="mt-2 w-full px-2 py-1 text-xs border border-gray-200 rounded"
        />
      </div>
    </div>
  )
}

export default GridVisualControls
