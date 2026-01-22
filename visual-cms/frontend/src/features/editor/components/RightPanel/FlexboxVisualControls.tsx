/**
 * FlexboxVisualControls - Visual controls for Flexbox properties
 * 
 * Визуальные кнопки для быстрого выбора flexbox свойств
 */

import React from 'react'
import { cn } from '@/shared/utils'
import {
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalSpaceBetween,
  AlignHorizontalSpaceAround,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  WrapText,
  Rows,
  Columns,
} from 'lucide-react'

interface FlexboxVisualControlsProps {
  direction: string
  justifyContent: string
  alignItems: string
  flexWrap: string
  gap: string
  onChange: (property: string, value: string) => void
}

// Button component for visual selector
const VisualButton: React.FC<{
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}> = ({ active, onClick, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={cn(
      "p-2 rounded border transition-all",
      active
        ? "bg-primary-100 border-primary-500 text-primary-700"
        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
    )}
  >
    {children}
  </button>
)

export const FlexboxVisualControls: React.FC<FlexboxVisualControlsProps> = ({
  direction,
  justifyContent,
  alignItems,
  flexWrap,
  gap,
  onChange,
}) => {
  const isRow = direction === '' || direction === 'row' || direction === 'row-reverse'

  return (
    <div className="space-y-4">
      {/* Direction */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Direction</label>
        <div className="flex gap-1">
          <VisualButton
            active={direction === 'row' || direction === ''}
            onClick={() => onChange('flexDirection', 'row')}
            title="Row"
          >
            <ArrowRight size={16} />
          </VisualButton>
          <VisualButton
            active={direction === 'row-reverse'}
            onClick={() => onChange('flexDirection', 'row-reverse')}
            title="Row Reverse"
          >
            <ArrowLeft size={16} />
          </VisualButton>
          <VisualButton
            active={direction === 'column'}
            onClick={() => onChange('flexDirection', 'column')}
            title="Column"
          >
            <ArrowDown size={16} />
          </VisualButton>
          <VisualButton
            active={direction === 'column-reverse'}
            onClick={() => onChange('flexDirection', 'column-reverse')}
            title="Column Reverse"
          >
            <ArrowUp size={16} />
          </VisualButton>
        </div>
      </div>

      {/* Justify Content */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">
          {isRow ? 'Горизонтальное' : 'Вертикальное'} выравнивание
        </label>
        <div className="flex gap-1 flex-wrap">
          <VisualButton
            active={justifyContent === 'flex-start' || justifyContent === ''}
            onClick={() => onChange('justifyContent', 'flex-start')}
            title="Start"
          >
            {isRow ? <AlignHorizontalJustifyStart size={16} /> : <AlignVerticalJustifyStart size={16} />}
          </VisualButton>
          <VisualButton
            active={justifyContent === 'center'}
            onClick={() => onChange('justifyContent', 'center')}
            title="Center"
          >
            {isRow ? <AlignHorizontalJustifyCenter size={16} /> : <AlignVerticalJustifyCenter size={16} />}
          </VisualButton>
          <VisualButton
            active={justifyContent === 'flex-end'}
            onClick={() => onChange('justifyContent', 'flex-end')}
            title="End"
          >
            {isRow ? <AlignHorizontalJustifyEnd size={16} /> : <AlignVerticalJustifyEnd size={16} />}
          </VisualButton>
          <VisualButton
            active={justifyContent === 'space-between'}
            onClick={() => onChange('justifyContent', 'space-between')}
            title="Space Between"
          >
            {isRow ? <AlignHorizontalSpaceBetween size={16} /> : <Rows size={16} />}
          </VisualButton>
          <VisualButton
            active={justifyContent === 'space-around'}
            onClick={() => onChange('justifyContent', 'space-around')}
            title="Space Around"
          >
            {isRow ? <AlignHorizontalSpaceAround size={16} /> : <Columns size={16} />}
          </VisualButton>
        </div>
      </div>

      {/* Align Items */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">
          {isRow ? 'Вертикальное' : 'Горизонтальное'} выравнивание
        </label>
        <div className="flex gap-1">
          <VisualButton
            active={alignItems === 'stretch' || alignItems === ''}
            onClick={() => onChange('alignItems', 'stretch')}
            title="Stretch"
          >
            <div className="w-4 h-4 flex flex-col justify-between">
              <div className="h-px bg-current" />
              <div className="h-px bg-current" />
              <div className="h-px bg-current" />
            </div>
          </VisualButton>
          <VisualButton
            active={alignItems === 'flex-start'}
            onClick={() => onChange('alignItems', 'flex-start')}
            title="Start"
          >
            {isRow ? <AlignVerticalJustifyStart size={16} /> : <AlignHorizontalJustifyStart size={16} />}
          </VisualButton>
          <VisualButton
            active={alignItems === 'center'}
            onClick={() => onChange('alignItems', 'center')}
            title="Center"
          >
            {isRow ? <AlignVerticalJustifyCenter size={16} /> : <AlignHorizontalJustifyCenter size={16} />}
          </VisualButton>
          <VisualButton
            active={alignItems === 'flex-end'}
            onClick={() => onChange('alignItems', 'flex-end')}
            title="End"
          >
            {isRow ? <AlignVerticalJustifyEnd size={16} /> : <AlignHorizontalJustifyEnd size={16} />}
          </VisualButton>
        </div>
      </div>

      {/* Flex Wrap */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Перенос</label>
        <div className="flex gap-1">
          <VisualButton
            active={flexWrap === 'nowrap' || flexWrap === ''}
            onClick={() => onChange('flexWrap', 'nowrap')}
            title="No Wrap"
          >
            <div className="w-4 h-4 flex items-center">
              <div className="flex gap-0.5">
                <div className="w-1 h-3 bg-current rounded-sm" />
                <div className="w-1 h-3 bg-current rounded-sm" />
                <div className="w-1 h-3 bg-current rounded-sm" />
              </div>
            </div>
          </VisualButton>
          <VisualButton
            active={flexWrap === 'wrap'}
            onClick={() => onChange('flexWrap', 'wrap')}
            title="Wrap"
          >
            <WrapText size={16} />
          </VisualButton>
          <VisualButton
            active={flexWrap === 'wrap-reverse'}
            onClick={() => onChange('flexWrap', 'wrap-reverse')}
            title="Wrap Reverse"
          >
            <WrapText size={16} className="rotate-180" />
          </VisualButton>
        </div>
      </div>

      {/* Gap */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-2 block">Gap</label>
        <div className="flex gap-1">
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
          placeholder="Custom (e.g., 1rem)"
          className="mt-2 w-full px-2 py-1 text-xs border border-gray-200 rounded"
        />
      </div>
    </div>
  )
}

export default FlexboxVisualControls
