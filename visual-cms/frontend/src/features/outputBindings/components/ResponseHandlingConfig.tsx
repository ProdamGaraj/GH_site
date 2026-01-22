/**
 * ResponseHandlingConfig Component
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Конфигурация обработки ответов и состояний кнопки
 */

import React, { useState } from 'react'
import {
  SuccessAction,
  ErrorAction,
  ButtonStates,
  RetryConfig,
  SuccessActionType,
  ErrorActionType,
} from '@/shared/types/outputBinding'

interface ResponseHandlingConfigProps {
  successActions: SuccessAction[]
  errorActions: ErrorAction[]
  buttonStates: ButtonStates
  retryConfig: RetryConfig
  onSuccessActionsChange: (actions: SuccessAction[]) => void
  onErrorActionsChange: (actions: ErrorAction[]) => void
  onButtonStatesChange: (states: ButtonStates) => void
  onRetryConfigChange: (config: RetryConfig) => void
}

type ActiveTab = 'success' | 'error' | 'button' | 'retry'

export function ResponseHandlingConfig({
  successActions,
  errorActions,
  buttonStates,
  retryConfig,
  onSuccessActionsChange,
  onErrorActionsChange,
  onButtonStatesChange,
  onRetryConfigChange,
}: ResponseHandlingConfigProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('success')

  const tabs: Array<{ id: ActiveTab; label: string; icon: string }> = [
    { id: 'success', label: 'Успех', icon: '✅' },
    { id: 'error', label: 'Ошибка', icon: '❌' },
    { id: 'button', label: 'Кнопка', icon: '🔘' },
    { id: 'retry', label: 'Retry', icon: '🔄' },
  ]

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pt-2">
        {activeTab === 'success' && (
          <SuccessActionsConfig
            actions={successActions}
            onChange={onSuccessActionsChange}
          />
        )}

        {activeTab === 'error' && (
          <ErrorActionsConfig
            actions={errorActions}
            onChange={onErrorActionsChange}
          />
        )}

        {activeTab === 'button' && (
          <ButtonStatesConfig
            states={buttonStates}
            onChange={onButtonStatesChange}
          />
        )}

        {activeTab === 'retry' && (
          <RetryConfigPanel
            config={retryConfig}
            onChange={onRetryConfigChange}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Success Actions Config
 */
interface SuccessActionsConfigProps {
  actions: SuccessAction[]
  onChange: (actions: SuccessAction[]) => void
}

function SuccessActionsConfig({ actions, onChange }: SuccessActionsConfigProps) {
  const actionTypes: Array<{ value: SuccessActionType; label: string; icon: string }> = [
    { value: 'show_message', label: 'Показать сообщение', icon: '💬' },
    { value: 'redirect', label: 'Редирект', icon: '↗️' },
    { value: 'reset_form', label: 'Сбросить форму', icon: '🔄' },
    { value: 'show_element', label: 'Показать элемент', icon: '👁️' },
    { value: 'hide_element', label: 'Скрыть элемент', icon: '🙈' },
    { value: 'custom', label: 'Custom функция', icon: '⚡' },
  ]

  const addAction = (type: SuccessActionType) => {
    const newAction: SuccessAction = { type }
    onChange([...actions, newAction])
  }

  const updateAction = (index: number, updates: Partial<SuccessAction>) => {
    const updated = actions.map((a, i) => i === index ? { ...a, ...updates } : a)
    onChange(updated)
  }

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Действия при успешной отправке данных
      </p>

      {/* Action list */}
      {actions.length > 0 && (
        <div className="space-y-3">
          {actions.map((action, index) => (
            <div key={index} className="p-3 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-green-800">
                  {actionTypes.find(t => t.value === action.type)?.icon}{' '}
                  {actionTypes.find(t => t.value === action.type)?.label}
                </span>
                <button
                  onClick={() => removeAction(index)}
                  className="text-red-500 hover:bg-red-50 p-1 rounded"
                >
                  ✕
                </button>
              </div>

              {/* Action-specific fields */}
              {action.type === 'show_message' && (
                <input
                  type="text"
                  value={action.message || ''}
                  onChange={(e) => updateAction(index, { message: e.target.value })}
                  placeholder="Сообщение для пользователя..."
                  className="w-full px-3 py-2 text-sm border border-green-300 rounded"
                />
              )}

              {action.type === 'redirect' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={action.redirectUrl || ''}
                    onChange={(e) => updateAction(index, { redirectUrl: e.target.value })}
                    placeholder="/thank-you или https://..."
                    className="w-full px-3 py-2 text-sm border border-green-300 rounded"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-green-700">Задержка (мс):</label>
                    <input
                      type="number"
                      value={action.redirectDelay || 0}
                      onChange={(e) => updateAction(index, { redirectDelay: Number(e.target.value) })}
                      className="w-20 px-2 py-1 text-sm border border-green-300 rounded"
                    />
                  </div>
                </div>
              )}

              {(action.type === 'show_element' || action.type === 'hide_element') && (
                <input
                  type="text"
                  value={action.elementSelector || ''}
                  onChange={(e) => updateAction(index, { elementSelector: e.target.value })}
                  placeholder="CSS селектор, например: #success-message"
                  className="w-full px-3 py-2 text-sm border border-green-300 rounded font-mono"
                />
              )}

              {action.type === 'custom' && (
                <textarea
                  value={action.customAction || ''}
                  onChange={(e) => updateAction(index, { customAction: e.target.value })}
                  placeholder="console.log('Success!', result)"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-green-300 rounded font-mono"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add action buttons */}
      <div className="flex flex-wrap gap-2">
        {actionTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => addAction(type.value)}
            className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            {type.icon} {type.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Error Actions Config
 */
interface ErrorActionsConfigProps {
  actions: ErrorAction[]
  onChange: (actions: ErrorAction[]) => void
}

function ErrorActionsConfig({ actions, onChange }: ErrorActionsConfigProps) {
  const actionTypes: Array<{ value: ErrorActionType; label: string; icon: string }> = [
    { value: 'show_message', label: 'Показать сообщение', icon: '💬' },
    { value: 'show_inline_errors', label: 'Показать inline ошибки', icon: '⚠️' },
    { value: 'scroll_to_error', label: 'Скролл к ошибке', icon: '📍' },
    { value: 'focus_error_field', label: 'Фокус на поле', icon: '🎯' },
    { value: 'shake_form', label: 'Потрясти форму', icon: '💥' },
    { value: 'custom', label: 'Custom функция', icon: '⚡' },
  ]

  const addAction = (type: ErrorActionType) => {
    const newAction: ErrorAction = { type }
    onChange([...actions, newAction])
  }

  const updateAction = (index: number, updates: Partial<ErrorAction>) => {
    const updated = actions.map((a, i) => i === index ? { ...a, ...updates } : a)
    onChange(updated)
  }

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Действия при ошибке отправки
      </p>

      {/* Action list */}
      {actions.length > 0 && (
        <div className="space-y-3">
          {actions.map((action, index) => (
            <div key={index} className="p-3 border border-red-200 bg-red-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-red-800">
                  {actionTypes.find(t => t.value === action.type)?.icon}{' '}
                  {actionTypes.find(t => t.value === action.type)?.label}
                </span>
                <button
                  onClick={() => removeAction(index)}
                  className="text-red-500 hover:bg-red-100 p-1 rounded"
                >
                  ✕
                </button>
              </div>

              {/* Action-specific fields */}
              {action.type === 'show_message' && (
                <input
                  type="text"
                  value={action.message || ''}
                  onChange={(e) => updateAction(index, { message: e.target.value })}
                  placeholder="Сообщение об ошибке..."
                  className="w-full px-3 py-2 text-sm border border-red-300 rounded"
                />
              )}

              {action.type === 'custom' && (
                <textarea
                  value={action.customAction || ''}
                  onChange={(e) => updateAction(index, { customAction: e.target.value })}
                  placeholder="console.error('Error:', error)"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-red-300 rounded font-mono"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add action buttons */}
      <div className="flex flex-wrap gap-2">
        {actionTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => addAction(type.value)}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            {type.icon} {type.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Button States Config
 */
interface ButtonStatesConfigProps {
  states: ButtonStates
  onChange: (states: ButtonStates) => void
}

function ButtonStatesConfig({ states, onChange }: ButtonStatesConfigProps) {
  const updateState = (
    state: keyof ButtonStates,
    updates: Partial<ButtonStates[keyof ButtonStates]>
  ) => {
    onChange({
      ...states,
      [state]: {
        ...(states[state] || {}),
        ...updates,
      },
    })
  }

  const stateConfigs: Array<{
    key: keyof ButtonStates
    label: string
    color: string
    bgColor: string
  }> = [
    { key: 'normal', label: 'Обычное', color: 'text-gray-700', bgColor: 'bg-gray-50' },
    { key: 'loading', label: 'Загрузка', color: 'text-blue-700', bgColor: 'bg-blue-50' },
    { key: 'success', label: 'Успех', color: 'text-green-700', bgColor: 'bg-green-50' },
    { key: 'error', label: 'Ошибка', color: 'text-red-700', bgColor: 'bg-red-50' },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Настройте внешний вид кнопки для разных состояний
      </p>

      <div className="grid grid-cols-2 gap-4">
        {stateConfigs.map(({ key, label, color, bgColor }) => (
          <div key={key} className={`p-3 rounded-lg border ${bgColor}`}>
            <h5 className={`font-medium ${color} mb-3`}>{label}</h5>
            
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Текст</label>
                <input
                  type="text"
                  value={states[key]?.text || ''}
                  onChange={(e) => updateState(key, { text: e.target.value })}
                  placeholder={
                    key === 'normal' ? 'Отправить' :
                    key === 'loading' ? 'Отправка...' :
                    key === 'success' ? 'Отправлено!' :
                    'Ошибка'
                  }
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">CSS класс</label>
                <input
                  type="text"
                  value={states[key]?.className || ''}
                  onChange={(e) => updateState(key, { className: e.target.value })}
                  placeholder="btn-primary"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded font-mono"
                />
              </div>

              {key === 'loading' && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={states.loading?.showSpinner !== false}
                    onChange={(e) => updateState('loading', { showSpinner: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Показать спиннер
                </label>
              )}

              {key === 'loading' && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={states.loading?.disabled !== false}
                    onChange={(e) => updateState('loading', { disabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Заблокировать кнопку
                </label>
              )}

              {key === 'success' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Длительность (мс)
                  </label>
                  <input
                    type="number"
                    value={states.success?.duration || 2000}
                    onChange={(e) => updateState('success', { duration: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  />
                </div>
              )}

              {key === 'error' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Длительность (мс)
                  </label>
                  <input
                    type="number"
                    value={states.error?.duration || 3000}
                    onChange={(e) => updateState('error', { duration: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className="p-4 bg-gray-100 rounded-lg">
        <h5 className="text-sm font-medium text-gray-700 mb-3">Превью</h5>
        <div className="flex gap-3">
          {stateConfigs.map(({ key }) => (
            <button
              key={key}
              className={`
                px-4 py-2 rounded text-sm font-medium transition-all
                ${key === 'normal' ? 'bg-blue-500 text-white' :
                  key === 'loading' ? 'bg-blue-400 text-white opacity-75 cursor-wait' :
                  key === 'success' ? 'bg-green-500 text-white' :
                  'bg-red-500 text-white'}
              `}
              disabled={key === 'loading'}
            >
              {key === 'loading' && states.loading?.showSpinner !== false && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              )}
              {states[key]?.text || (
                key === 'normal' ? 'Отправить' :
                key === 'loading' ? 'Отправка...' :
                key === 'success' ? 'Отправлено!' :
                'Ошибка'
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Retry Config Panel
 */
interface RetryConfigPanelProps {
  config: RetryConfig
  onChange: (config: RetryConfig) => void
}

function RetryConfigPanel({ config, onChange }: RetryConfigPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h5 className="font-medium text-gray-900">Авто-повтор при ошибке</h5>
          <p className="text-sm text-gray-500">
            Автоматически повторять запрос при сетевых ошибках
          </p>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
            className="rounded border-gray-300"
          />
          <span className="text-sm">Включено</span>
        </label>
      </div>

      {config.enabled && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-yellow-700 mb-1">
                Макс. попыток
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={config.maxAttempts}
                onChange={(e) => onChange({ ...config, maxAttempts: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-yellow-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-yellow-700 mb-1">
                Задержка (мс)
              </label>
              <input
                type="number"
                min={100}
                step={100}
                value={config.delayMs}
                onChange={(e) => onChange({ ...config, delayMs: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-yellow-300 rounded text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-yellow-700">
            <input
              type="checkbox"
              checked={config.exponentialBackoff}
              onChange={(e) => onChange({ ...config, exponentialBackoff: e.target.checked })}
              className="rounded border-yellow-400"
            />
            Экспоненциальный backoff (задержка ×2 после каждой попытки)
          </label>

          {/* Retry codes */}
          <div>
            <label className="block text-sm text-yellow-700 mb-1">
              Коды ответов для retry (через запятую)
            </label>
            <input
              type="text"
              value={config.retryOn?.join(', ') || '500, 502, 503, 504'}
              onChange={(e) => onChange({
                ...config,
                retryOn: e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
              })}
              placeholder="500, 502, 503, 504"
              className="w-full px-3 py-2 border border-yellow-300 rounded text-sm font-mono"
            />
          </div>

          {/* Preview */}
          <div className="p-3 bg-white rounded border border-yellow-200">
            <div className="text-xs font-medium text-yellow-700 uppercase tracking-wide mb-2">
              Схема повторов
            </div>
            <div className="flex items-center gap-2 text-sm">
              {Array.from({ length: config.maxAttempts }).map((_, i) => {
                const delay = config.exponentialBackoff
                  ? config.delayMs * Math.pow(2, i)
                  : config.delayMs
                return (
                  <React.Fragment key={i}>
                    <span className="px-2 py-1 bg-yellow-100 rounded">
                      Попытка {i + 1}
                    </span>
                    {i < config.maxAttempts - 1 && (
                      <span className="text-yellow-600">
                        → {delay}мс →
                      </span>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResponseHandlingConfig
