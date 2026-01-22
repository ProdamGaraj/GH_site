/**
 * TriggersConfigPanel Component
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Конфигурация триггеров отправки данных
 */

import type { OutputTrigger, ConditionalTrigger } from '@/shared/types/outputBinding'
import { TRIGGER_LABELS } from '@/shared/types/outputBinding'

interface TriggersConfigPanelProps {
  trigger: OutputTrigger
  onTriggerChange: (trigger: OutputTrigger) => void
  conditionalTriggers?: ConditionalTrigger[]
  onConditionalTriggersChange?: (triggers: ConditionalTrigger[]) => void
}

export function TriggersConfigPanel({
  trigger,
  onTriggerChange,
  conditionalTriggers = [],
  onConditionalTriggersChange,
}: TriggersConfigPanelProps) {
  const triggers: Array<{ value: OutputTrigger; icon: string; description: string }> = [
    {
      value: 'form_submit',
      icon: '📋',
      description: 'При отправке формы (submit event)',
    },
    {
      value: 'button_click',
      icon: '🔘',
      description: 'При клике на кнопку',
    },
    {
      value: 'input_change',
      icon: '✏️',
      description: 'При изменении значения поля',
    },
    {
      value: 'input_blur',
      icon: '👆',
      description: 'При потере фокуса полем',
    },
    {
      value: 'interval',
      icon: '⏱️',
      description: 'По интервалу (авто-сохранение)',
    },
    {
      value: 'custom_event',
      icon: '⚡',
      description: 'По кастомному событию',
    },
  ]

  const addConditionalTrigger = () => {
    if (onConditionalTriggersChange) {
      const newTrigger: ConditionalTrigger = {
        trigger: 'button_click',
        condition: '',
        enabled: true,
      }
      onConditionalTriggersChange([...conditionalTriggers, newTrigger])
    }
  }

  const updateConditionalTrigger = (index: number, updates: Partial<ConditionalTrigger>) => {
    if (onConditionalTriggersChange) {
      const updated = conditionalTriggers.map((t, i) =>
        i === index ? { ...t, ...updates } : t
      )
      onConditionalTriggersChange(updated)
    }
  }

  const removeConditionalTrigger = (index: number) => {
    if (onConditionalTriggersChange) {
      onConditionalTriggersChange(conditionalTriggers.filter((_, i) => i !== index))
    }
  }

  return (
    <div className="space-y-6">
      {/* Main Trigger */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Основной триггер</h4>
        <div className="grid grid-cols-2 gap-2">
          {triggers.map((t) => (
            <button
              key={t.value}
              onClick={() => onTriggerChange(t.value)}
              className={`
                p-3 text-left rounded-lg border-2 transition-all
                ${trigger === t.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{t.icon}</span>
                <span className={`font-medium text-sm ${
                  trigger === t.value ? 'text-blue-700' : 'text-gray-700'
                }`}>
                  {TRIGGER_LABELS[t.value]}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-7">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Interval settings */}
      {trigger === 'interval' && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h5 className="font-medium text-yellow-800 mb-2">⏱️ Настройки интервала</h5>
          <div className="flex items-center gap-3">
            <label className="text-sm text-yellow-700">Интервал (мс):</label>
            <input
              type="number"
              min={1000}
              step={1000}
              defaultValue={5000}
              className="w-24 px-2 py-1 border border-yellow-300 rounded text-sm"
            />
            <span className="text-xs text-yellow-600">мин. 1000мс</span>
          </div>
          <p className="text-xs text-yellow-600 mt-2">
            💡 Авто-сохранение работает только если данные изменились
          </p>
        </div>
      )}

      {/* Custom event settings */}
      {trigger === 'custom_event' && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h5 className="font-medium text-purple-800 mb-2">⚡ Кастомное событие</h5>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-purple-700 mb-1">Название события:</label>
              <input
                type="text"
                placeholder="myCustomEvent"
                className="w-full px-3 py-2 border border-purple-300 rounded text-sm font-mono"
              />
            </div>
            <p className="text-xs text-purple-600">
              💡 Вызывайте через: <code className="bg-purple-100 px-1 rounded">
                window.dispatchEvent(new CustomEvent('myCustomEvent'))
              </code>
            </p>
          </div>
        </div>
      )}

      {/* Conditional Triggers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Условные триггеры</h4>
          <button
            onClick={addConditionalTrigger}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            + Добавить условие
          </button>
        </div>

        {conditionalTriggers.length === 0 ? (
          <p className="text-sm text-gray-500">
            Условные триггеры позволяют запускать отправку при выполнении определённого условия
          </p>
        ) : (
          <div className="space-y-3">
            {conditionalTriggers.map((ct, index) => (
              <div
                key={index}
                className={`
                  p-3 border rounded-lg
                  ${ct.enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Enable toggle */}
                  <label className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      checked={ct.enabled}
                      onChange={(e) => updateConditionalTrigger(index, { enabled: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                  </label>

                  {/* Trigger select */}
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Триггер</label>
                    <select
                      value={ct.trigger}
                      onChange={(e) => updateConditionalTrigger(index, { 
                        trigger: e.target.value as OutputTrigger 
                      })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      disabled={!ct.enabled}
                    >
                      {triggers.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.icon} {TRIGGER_LABELS[t.value]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeConditionalTrigger(index)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  >
                    ✕
                  </button>
                </div>

                {/* Condition */}
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 mb-1">
                    Условие (JavaScript expression)
                  </label>
                  <input
                    type="text"
                    value={ct.condition}
                    onChange={(e) => updateConditionalTrigger(index, { condition: e.target.value })}
                    placeholder="formData.email && formData.name"
                    className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded"
                    disabled={!ct.enabled}
                  />
                </div>

                {/* Description */}
                {ct.description !== undefined && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={ct.description}
                      onChange={(e) => updateConditionalTrigger(index, { description: e.target.value })}
                      placeholder="Описание условия..."
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded"
                      disabled={!ct.enabled}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debounce settings */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h5 className="font-medium text-gray-700 mb-2">🛡️ Защита от дублирования</h5>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Debounce (мс)</label>
            <input
              type="number"
              min={0}
              step={100}
              defaultValue={300}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
            <p className="text-xs text-gray-400 mt-1">Задержка перед отправкой</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Throttle (мс)</label>
            <input
              type="number"
              min={0}
              step={100}
              defaultValue={0}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
            <p className="text-xs text-gray-400 mt-1">Мин. интервал между отправками</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TriggersConfigPanel
