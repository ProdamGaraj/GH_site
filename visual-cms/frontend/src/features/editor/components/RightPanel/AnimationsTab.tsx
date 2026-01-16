import React, { useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode } from '@/features/editor/editorSlice'
import type { BlockNode, Animation, AnimationPreset, AnimationTrigger } from '@/shared/types'
import { 
  ChevronDown, ChevronRight, Plus, Trash2, Play, Copy,
  Eye, MousePointer, Pointer, RefreshCw, Sparkles
} from 'lucide-react'
import { cn } from '@/shared/utils'

interface AnimationsTabProps {
  node: BlockNode
}

// Animation presets with their keyframes
const ANIMATION_PRESETS: Record<AnimationPreset, { name: string; keyframes: string }> = {
  'fade-in': { name: 'Появление', keyframes: 'from { opacity: 0; } to { opacity: 1; }' },
  'fade-out': { name: 'Исчезновение', keyframes: 'from { opacity: 1; } to { opacity: 0; }' },
  'slide-up': { name: 'Слайд вверх', keyframes: 'from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); }' },
  'slide-down': { name: 'Слайд вниз', keyframes: 'from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); }' },
  'slide-left': { name: 'Слайд влево', keyframes: 'from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); }' },
  'slide-right': { name: 'Слайд вправо', keyframes: 'from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); }' },
  'zoom-in': { name: 'Увеличение', keyframes: 'from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); }' },
  'zoom-out': { name: 'Уменьшение', keyframes: 'from { opacity: 0; transform: scale(1.2); } to { opacity: 1; transform: scale(1); }' },
  'bounce': { name: 'Подпрыгивание', keyframes: '0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); }' },
  'shake': { name: 'Тряска', keyframes: '0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); }' },
  'pulse': { name: 'Пульсация', keyframes: '0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); }' },
  'spin': { name: 'Вращение', keyframes: 'from { transform: rotate(0deg); } to { transform: rotate(360deg); }' },
  'flip-x': { name: 'Переворот X', keyframes: 'from { transform: perspective(400px) rotateX(90deg); opacity: 0; } to { transform: perspective(400px) rotateX(0); opacity: 1; }' },
  'flip-y': { name: 'Переворот Y', keyframes: 'from { transform: perspective(400px) rotateY(90deg); opacity: 0; } to { transform: perspective(400px) rotateY(0); opacity: 1; }' },
  'custom': { name: 'Своя анимация', keyframes: '' },
}

const TRIGGER_OPTIONS: { value: AnimationTrigger; label: string; icon: React.ElementType }[] = [
  { value: 'load', label: 'При загрузке', icon: Play },
  { value: 'scroll-into-view', label: 'При прокрутке', icon: Eye },
  { value: 'hover', label: 'При наведении', icon: MousePointer },
  { value: 'click', label: 'При клике', icon: Pointer },
  { value: 'loop', label: 'Постоянно', icon: RefreshCw },
]

const EASING_OPTIONS = [
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
  { value: 'linear', label: 'Linear' },
  { value: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', label: 'Bounce' },
  { value: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', label: 'Elastic' },
]

const generateAnimationId = () => `anim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export const AnimationsTab: React.FC<AnimationsTabProps> = ({ node }) => {
  const dispatch = useAppDispatch()
  const [expandedAnimations, setExpandedAnimations] = useState<string[]>([])
  
  const animations = node.animations || []

  const toggleAnimation = (id: string) => {
    setExpandedAnimations(prev => 
      prev.includes(id) 
        ? prev.filter(a => a !== id)
        : [...prev, id]
    )
  }

  const addAnimation = (preset: AnimationPreset = 'fade-in') => {
    const newAnimation: Animation = {
      id: generateAnimationId(),
      name: ANIMATION_PRESETS[preset].name,
      trigger: 'load',
      preset,
      duration: 500,
      delay: 0,
      easing: 'ease-out',
      iterationCount: 1,
      direction: 'normal',
      fillMode: 'both',
    }
    
    dispatch(updateNode({
      id: node.id,
      updates: {
        animations: [...animations, newAnimation],
      },
    }))
    
    setExpandedAnimations(prev => [...prev, newAnimation.id])
  }

  const updateAnimation = (animationId: string, updates: Partial<Animation>) => {
    dispatch(updateNode({
      id: node.id,
      updates: {
        animations: animations.map(a => 
          a.id === animationId ? { ...a, ...updates } : a
        ),
      },
    }))
  }

  const deleteAnimation = (animationId: string) => {
    dispatch(updateNode({
      id: node.id,
      updates: {
        animations: animations.filter(a => a.id !== animationId),
      },
    }))
  }

  const duplicateAnimation = (animation: Animation) => {
    const newAnimation: Animation = {
      ...animation,
      id: generateAnimationId(),
      name: `${animation.name} (копия)`,
    }
    
    dispatch(updateNode({
      id: node.id,
      updates: {
        animations: [...animations, newAnimation],
      },
    }))
  }

  return (
    <div className="space-y-4">
      {/* Quick Add */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Добавить анимацию</h4>
        <div className="grid grid-cols-3 gap-2">
          {(['fade-in', 'slide-up', 'zoom-in', 'bounce', 'pulse', 'spin'] as AnimationPreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => addAnimation(preset)}
              className="px-2 py-2 text-xs text-center text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
              title={ANIMATION_PRESETS[preset].name}
            >
              <Sparkles size={14} className="mx-auto mb-1 text-gray-500" />
              {ANIMATION_PRESETS[preset].name}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => addAnimation('custom')}
          className="w-full mt-2 px-3 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          Своя анимация
        </button>
      </div>

      {/* Animations List */}
      {animations.length > 0 && (
        <div className="border-t pt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Анимации ({animations.length})
          </h4>
          
          {animations.map((animation) => {
            const isExpanded = expandedAnimations.includes(animation.id)
            const TriggerIcon = TRIGGER_OPTIONS.find(t => t.value === animation.trigger)?.icon || Play
            
            return (
              <div key={animation.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Animation Header */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                  <button
                    onClick={() => toggleAnimation(animation.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <TriggerIcon size={14} className="text-primary-600" />
                    <span className="text-sm font-medium text-gray-700">{animation.name}</span>
                  </button>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => duplicateAnimation(animation)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Дублировать"
                    >
                      <Copy size={12} className="text-gray-500" />
                    </button>
                    <button
                      onClick={() => deleteAnimation(animation.id)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={12} className="text-red-500" />
                    </button>
                  </div>
                </div>
                
                {/* Animation Settings */}
                {isExpanded && (
                  <div className="p-3 space-y-3 bg-white border-t border-gray-200">
                    {/* Name */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Название</label>
                      <input
                        type="text"
                        value={animation.name}
                        onChange={(e) => updateAnimation(animation.id, { name: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    
                    {/* Trigger */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Триггер</label>
                      <div className="grid grid-cols-5 gap-1">
                        {TRIGGER_OPTIONS.map((option) => {
                          const Icon = option.icon
                          return (
                            <button
                              key={option.value}
                              onClick={() => updateAnimation(animation.id, { 
                                trigger: option.value,
                                scrollTrigger: option.value === 'scroll-into-view' ? {
                                  threshold: 0.2,
                                  once: true,
                                  offset: 0,
                                } : undefined,
                              })}
                              className={cn(
                                "flex flex-col items-center gap-1 p-2 rounded border transition-colors",
                                animation.trigger === option.value
                                  ? "bg-primary-50 border-primary-300 text-primary-700"
                                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                              )}
                              title={option.label}
                            >
                              <Icon size={14} />
                              <span className="text-[10px]">{option.label.split(' ')[1]}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    
                    {/* Scroll Trigger Options */}
                    {animation.trigger === 'scroll-into-view' && animation.scrollTrigger && (
                      <div className="p-2 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600">Видимость:</label>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.1}
                            value={animation.scrollTrigger.threshold}
                            onChange={(e) => updateAnimation(animation.id, {
                              scrollTrigger: { ...animation.scrollTrigger!, threshold: parseFloat(e.target.value) }
                            })}
                            className="flex-1"
                          />
                          <span className="text-xs text-gray-500 w-8">
                            {Math.round(animation.scrollTrigger.threshold * 100)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={animation.scrollTrigger.once}
                              onChange={(e) => updateAnimation(animation.id, {
                                scrollTrigger: { ...animation.scrollTrigger!, once: e.target.checked }
                              })}
                              className="rounded border-gray-300"
                            />
                            Только один раз
                          </label>
                        </div>
                      </div>
                    )}
                    
                    {/* Preset */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Тип анимации</label>
                      <select
                        value={animation.preset || 'custom'}
                        onChange={(e) => updateAnimation(animation.id, { 
                          preset: e.target.value as AnimationPreset,
                          name: ANIMATION_PRESETS[e.target.value as AnimationPreset].name,
                        })}
                        className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        {Object.entries(ANIMATION_PRESETS).map(([key, value]) => (
                          <option key={key} value={key}>{value.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Timing */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Длительность (мс)</label>
                        <input
                          type="number"
                          value={animation.duration}
                          onChange={(e) => updateAnimation(animation.id, { duration: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          min={0}
                          max={10000}
                          step={100}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Задержка (мс)</label>
                        <input
                          type="number"
                          value={animation.delay}
                          onChange={(e) => updateAnimation(animation.id, { delay: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                          min={0}
                          max={10000}
                          step={100}
                        />
                      </div>
                    </div>
                    
                    {/* Easing */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Плавность</label>
                      <select
                        value={animation.easing}
                        onChange={(e) => updateAnimation(animation.id, { easing: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        {EASING_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Iteration & Direction */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Повторы</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={animation.iterationCount === 'infinite' ? 0 : animation.iterationCount}
                            onChange={(e) => updateAnimation(animation.id, { 
                              iterationCount: parseInt(e.target.value) || 1 
                            })}
                            className="flex-1 px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                            min={0}
                            disabled={animation.iterationCount === 'infinite'}
                          />
                          <button
                            onClick={() => updateAnimation(animation.id, {
                              iterationCount: animation.iterationCount === 'infinite' ? 1 : 'infinite'
                            })}
                            className={cn(
                              "px-2 py-1 text-xs border rounded transition-colors",
                              animation.iterationCount === 'infinite'
                                ? "bg-primary-100 border-primary-300 text-primary-700"
                                : "bg-white border-gray-300 text-gray-600"
                            )}
                          >
                            ∞
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Направление</label>
                        <select
                          value={animation.direction}
                          onChange={(e) => updateAnimation(animation.id, { 
                            direction: e.target.value as Animation['direction']
                          })}
                          className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="normal">Обычное</option>
                          <option value="reverse">Обратное</option>
                          <option value="alternate">Туда-обратно</option>
                          <option value="alternate-reverse">Обратно-туда</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Custom Keyframes */}
                    {animation.preset === 'custom' && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">CSS @keyframes</label>
                        <textarea
                          value={animation.keyframes?.map(kf => 
                            `${kf.offset}% { ${Object.entries(kf.properties).map(([k,v]) => `${k}: ${v}`).join('; ')} }`
                          ).join('\n') || ''}
                          onChange={() => {
                            // Parse custom keyframes (simplified)
                            // In a real implementation, this would need proper CSS parsing
                          }}
                          placeholder="0% { opacity: 0; }&#10;100% { opacity: 1; }"
                          className="w-full px-2 py-1.5 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
                          rows={4}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      
      {/* Empty State */}
      {animations.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Нет анимаций</p>
          <p className="text-xs">Добавьте анимацию выше</p>
        </div>
      )}
    </div>
  )
}
