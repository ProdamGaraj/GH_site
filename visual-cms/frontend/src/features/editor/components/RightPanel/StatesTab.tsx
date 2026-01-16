import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateNode, selectStatePreviewMode, setStatePreviewMode } from '@/features/editor/editorSlice'
import type { BlockNode, CSSProperties, StateStyles } from '@/shared/types'
import { ChevronDown, ChevronRight, Trash2, MousePointer, Hand, Focus, Ban, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/shared/utils'
import { ColorPicker } from '@/shared/components/ColorPicker'

interface StatesTabProps {
  node: BlockNode
}

type StateType = 'hover' | 'active' | 'focus' | 'disabled'

interface StateConfig {
  id: StateType
  label: string
  icon: React.ElementType
  description: string
}

const STATE_CONFIGS: StateConfig[] = [
  { id: 'hover', label: 'Hover', icon: MousePointer, description: 'При наведении курсора' },
  { id: 'active', label: 'Active', icon: Hand, description: 'При клике/нажатии' },
  { id: 'focus', label: 'Focus', icon: Focus, description: 'При фокусе (для форм)' },
  { id: 'disabled', label: 'Disabled', icon: Ban, description: 'Отключённое состояние' },
]

// Common CSS properties for hover/state effects
const COMMON_PROPERTIES = [
  { key: 'backgroundColor', label: 'Фон', type: 'color' },
  { key: 'color', label: 'Цвет текста', type: 'color' },
  { key: 'borderColor', label: 'Цвет рамки', type: 'color' },
  { key: 'opacity', label: 'Прозрачность', type: 'range', min: 0, max: 1, step: 0.1 },
  { key: 'transform', label: 'Трансформация', type: 'select', options: [
    { value: '', label: 'Нет' },
    { value: 'scale(1.05)', label: 'Увеличить (5%)' },
    { value: 'scale(1.1)', label: 'Увеличить (10%)' },
    { value: 'scale(0.95)', label: 'Уменьшить (5%)' },
    { value: 'translateY(-2px)', label: 'Поднять (2px)' },
    { value: 'translateY(-4px)', label: 'Поднять (4px)' },
    { value: 'rotate(5deg)', label: 'Повернуть (5°)' },
  ]},
  { key: 'boxShadow', label: 'Тень', type: 'select', options: [
    { value: '', label: 'Нет' },
    { value: '0 2px 4px rgba(0,0,0,0.1)', label: 'Лёгкая' },
    { value: '0 4px 8px rgba(0,0,0,0.15)', label: 'Средняя' },
    { value: '0 8px 16px rgba(0,0,0,0.2)', label: 'Сильная' },
    { value: '0 0 0 3px rgba(59,130,246,0.5)', label: 'Обводка (синяя)' },
  ]},
  { key: 'filter', label: 'Фильтр', type: 'select', options: [
    { value: '', label: 'Нет' },
    { value: 'brightness(1.1)', label: 'Ярче' },
    { value: 'brightness(0.9)', label: 'Темнее' },
    { value: 'saturate(1.2)', label: 'Насыщеннее' },
    { value: 'grayscale(1)', label: 'Ч/Б' },
    { value: 'blur(2px)', label: 'Размытие' },
  ]},
]

// Preset hover effects
const HOVER_PRESETS = [
  { 
    name: 'Подсветка', 
    styles: { backgroundColor: 'rgba(59,130,246,0.1)' },
    transition: { duration: 200, easing: 'ease', properties: ['background-color'] }
  },
  { 
    name: 'Поднятие', 
    styles: { transform: 'translateY(-4px)', boxShadow: '0 8px 16px rgba(0,0,0,0.15)' },
    transition: { duration: 300, easing: 'ease-out', properties: ['transform', 'box-shadow'] }
  },
  { 
    name: 'Масштаб', 
    styles: { transform: 'scale(1.05)' },
    transition: { duration: 200, easing: 'ease', properties: ['transform'] }
  },
  { 
    name: 'Яркость', 
    styles: { filter: 'brightness(1.1)' },
    transition: { duration: 200, easing: 'ease', properties: ['filter'] }
  },
  { 
    name: 'Обводка', 
    styles: { boxShadow: '0 0 0 3px rgba(59,130,246,0.5)' },
    transition: { duration: 150, easing: 'ease', properties: ['box-shadow'] }
  },
]

export const StatesTab: React.FC<StatesTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const [expandedStates, setExpandedStates] = useState<StateType[]>(['hover'])
  const statePreviewMode = useAppSelector(selectStatePreviewMode)
  
  const states = node.styles.states || {}
  const transition = node.styles.stateTransition || { duration: 200, easing: 'ease', properties: ['all'] }

  const toggleState = (state: StateType) => {
    setExpandedStates(prev => 
      prev.includes(state) 
        ? prev.filter(s => s !== state)
        : [...prev, state]
    )
  }

  const updateStateStyle = (state: StateType, property: string, value: string) => {
    const currentStates = node.styles.states || {}
    const currentStateStyles = currentStates[state] || {}
    
    const newStateStyles = value 
      ? { ...currentStateStyles, [property]: value }
      : Object.fromEntries(Object.entries(currentStateStyles).filter(([k]) => k !== property))
    
    const newStates: StateStyles = {
      ...currentStates,
      [state]: Object.keys(newStateStyles).length > 0 ? newStateStyles : undefined,
    }
    
    // Remove undefined states
    Object.keys(newStates).forEach(key => {
      if (newStates[key as StateType] === undefined) {
        delete newStates[key as StateType]
      }
    })
    
    dispatch(updateNode({
      id: node.id,
      updates: {
        styles: {
          ...node.styles,
          states: Object.keys(newStates).length > 0 ? newStates : undefined,
        },
      },
    }))
  }

  const updateTransition = (updates: Partial<typeof transition>) => {
    dispatch(updateNode({
      id: node.id,
      updates: {
        styles: {
          ...node.styles,
          stateTransition: { ...transition, ...updates },
        },
      },
    }))
  }

  const applyPreset = (preset: typeof HOVER_PRESETS[0]) => {
    dispatch(updateNode({
      id: node.id,
      updates: {
        styles: {
          ...node.styles,
          states: { ...states, hover: preset.styles },
          stateTransition: preset.transition,
        },
      },
    }))
  }

  const clearState = (state: StateType) => {
    const newStates = { ...states }
    delete newStates[state]
    
    dispatch(updateNode({
      id: node.id,
      updates: {
        styles: {
          ...node.styles,
          states: Object.keys(newStates).length > 0 ? newStates : undefined,
        },
      },
    }))
  }

  const hasStateStyles = (state: StateType) => {
    return states[state] && Object.keys(states[state]!).length > 0
  }

  // Переключение режима превью состояния
  const togglePreviewMode = (state: StateType) => {
    if (statePreviewMode === state) {
      dispatch(setStatePreviewMode('none'))
    } else {
      dispatch(setStatePreviewMode(state))
    }
  }

  return (
    <div className="space-y-4">
      {/* Режим превью состояний */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Eye size={14} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Превью состояний</span>
        </div>
        <p className="text-xs text-blue-700 mb-3">
          Включите режим для просмотра стилей состояния на всех элементах
        </p>
        <div className="flex flex-wrap gap-2">
          {STATE_CONFIGS.map((config) => {
            const Icon = config.icon
            const isActive = statePreviewMode === config.id
            const hasStyles = hasStateStyles(config.id)
            
            return (
              <button
                key={config.id}
                onClick={() => togglePreviewMode(config.id)}
                disabled={!hasStyles}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all",
                  isActive 
                    ? "bg-blue-600 text-white shadow-md" 
                    : hasStyles 
                      ? "bg-white text-gray-700 border border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
                title={hasStyles ? config.description : `Нет стилей для ${config.label}`}
              >
                <Icon size={12} />
                {config.label}
                {isActive && <EyeOff size={10} className="ml-1" />}
              </button>
            )
          })}
          
          {statePreviewMode !== 'none' && (
            <button
              onClick={() => dispatch(setStatePreviewMode('none'))}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <EyeOff size={12} />
              Выключить
            </button>
          )}
        </div>
      </div>

      {/* Hover Presets */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Быстрые эффекты hover</h4>
        <div className="grid grid-cols-2 gap-2">
          {HOVER_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="px-3 py-2 text-xs text-left bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-gray-700"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Transition Settings */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Настройки перехода</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Длительность (мс)</label>
            <input
              type="number"
              value={transition.duration}
              onChange={(e) => updateTransition({ duration: parseInt(e.target.value) || 0 })}
              className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              min={0}
              max={2000}
              step={50}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Плавность</label>
            <select
              value={transition.easing}
              onChange={(e) => updateTransition({ easing: e.target.value })}
              className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="ease">Ease</option>
              <option value="ease-in">Ease In</option>
              <option value="ease-out">Ease Out</option>
              <option value="ease-in-out">Ease In-Out</option>
              <option value="linear">Linear</option>
              <option value="cubic-bezier(0.68, -0.55, 0.265, 1.55)">Bounce</option>
            </select>
          </div>
        </div>
      </div>

      {/* State Sections */}
      <div className="border-t pt-4 space-y-2">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Состояния</h4>
        
        {STATE_CONFIGS.map((config) => {
          const Icon = config.icon
          const isExpanded = expandedStates.includes(config.id)
          const hasStyles = hasStateStyles(config.id)
          const stateStyles = states[config.id] || {}
          
          return (
            <div key={config.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* State Header */}
              <button
                onClick={() => toggleState(config.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-left transition-colors",
                  hasStyles ? "bg-primary-50" : "bg-gray-50 hover:bg-gray-100"
                )}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Icon size={14} className={hasStyles ? "text-primary-600" : "text-gray-500"} />
                  <span className={cn(
                    "text-sm font-medium",
                    hasStyles ? "text-primary-700" : "text-gray-700"
                  )}>
                    {config.label}
                  </span>
                  {hasStyles && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">
                      {Object.keys(stateStyles).length}
                    </span>
                  )}
                </div>
                {hasStyles && (
                  <button
                    onClick={(e) => { e.stopPropagation(); clearState(config.id) }}
                    className="p-1 hover:bg-red-100 rounded transition-colors"
                    title="Очистить"
                  >
                    <Trash2 size={12} className="text-red-500" />
                  </button>
                )}
              </button>
              
              {/* State Content */}
              {isExpanded && (
                <div className="p-3 space-y-3 bg-white border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">{config.description}</p>
                  
                  {COMMON_PROPERTIES.map((prop) => (
                    <div key={prop.key}>
                      <label className="block text-xs text-gray-600 mb-1">{prop.label}</label>
                      
                      {prop.type === 'color' && (
                        <ColorPicker
                          value={stateStyles[prop.key as keyof CSSProperties] || ''}
                          onChange={(value: string) => updateStateStyle(config.id, prop.key, value)}
                          placeholder="Не задано"
                        />
                      )}
                      
                      {prop.type === 'range' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={prop.min}
                            max={prop.max}
                            step={prop.step}
                            value={parseFloat(stateStyles[prop.key as keyof CSSProperties] || '1')}
                            onChange={(e) => updateStateStyle(config.id, prop.key, e.target.value)}
                            className="flex-1"
                          />
                          <span className="text-xs text-gray-500 w-8">
                            {stateStyles[prop.key as keyof CSSProperties] || '1'}
                          </span>
                        </div>
                      )}
                      
                      {prop.type === 'select' && (
                        <select
                          value={stateStyles[prop.key as keyof CSSProperties] || ''}
                          onChange={(e) => updateStateStyle(config.id, prop.key, e.target.value)}
                          className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          {prop.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                  
                  {/* Custom property input */}
                  <div className="pt-2 border-t border-gray-100">
                    <label className="block text-xs text-gray-600 mb-1">Своё CSS свойство</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="свойство"
                        className="flex-1 px-2 py-1 text-xs bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const input = e.currentTarget
                            const valueInput = input.nextElementSibling as HTMLInputElement
                            if (input.value && valueInput?.value) {
                              updateStateStyle(config.id, input.value, valueInput.value)
                              input.value = ''
                              valueInput.value = ''
                            }
                          }
                        }}
                      />
                      <input
                        type="text"
                        placeholder="значение"
                        className="flex-1 px-2 py-1 text-xs bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const valueInput = e.currentTarget
                            const propInput = valueInput.previousElementSibling as HTMLInputElement
                            if (propInput?.value && valueInput.value) {
                              updateStateStyle(config.id, propInput.value, valueInput.value)
                              propInput.value = ''
                              valueInput.value = ''
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
