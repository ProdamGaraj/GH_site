import React, { useState } from 'react'

// Типы состояний
export type StateType = 'loading' | 'empty' | 'error'

export interface StateTemplate {
  type: StateType
  enabled: boolean
  template?: string         // HTML шаблон
  useBlock?: boolean        // Использовать блок вместо шаблона
  blockId?: string          // ID блока для отображения
  message?: string          // Текст сообщения
  showIcon?: boolean        // Показывать иконку
  icon?: string             // Кастомная иконка
  showRetry?: boolean       // Показывать кнопку "Повторить"
  retryText?: string        // Текст кнопки
}

export interface RepeaterStatesConfig {
  loadingState?: StateTemplate
  emptyState?: StateTemplate
  errorState?: StateTemplate
}

interface RepeaterStatesEditorProps {
  config: RepeaterStatesConfig
  onChange: (config: RepeaterStatesConfig) => void
}

// Дефолтные настройки состояний
const defaultStates: Record<StateType, StateTemplate> = {
  loading: {
    type: 'loading',
    enabled: true,
    showIcon: true,
    icon: 'spinner',
    message: 'Загрузка данных...',
  },
  empty: {
    type: 'empty',
    enabled: true,
    showIcon: true,
    icon: '📭',
    message: 'Данные не найдены',
  },
  error: {
    type: 'error',
    enabled: true,
    showIcon: true,
    icon: '⚠️',
    message: 'Произошла ошибка при загрузке данных',
    showRetry: true,
    retryText: 'Повторить',
  },
}

// Предустановленные иконки
const ICONS: Record<StateType, string[]> = {
  loading: ['spinner', '⏳', '🔄', '⌛'],
  empty: ['📭', '🔍', '📋', '🗂️', '∅'],
  error: ['⚠️', '❌', '🚫', '💥', '🔴'],
}

/**
 * Редактор состояний Repeater (Loading, Empty, Error)
 */
export const RepeaterStatesEditor: React.FC<RepeaterStatesEditorProps> = ({
  config,
  onChange,
}) => {
  const [activeState, setActiveState] = useState<StateType>('loading')

  // Получить конфиг состояния
  const getStateConfig = (type: StateType): StateTemplate => {
    const key = `${type}State` as keyof RepeaterStatesConfig
    return config[key] || defaultStates[type]
  }

  // Обновить конфиг состояния
  const updateStateConfig = (type: StateType, updates: Partial<StateTemplate>) => {
    const key = `${type}State` as keyof RepeaterStatesConfig
    const current = getStateConfig(type)
    onChange({
      ...config,
      [key]: { ...current, ...updates },
    })
  }

  const currentState = getStateConfig(activeState)

  const tabs = [
    { type: 'loading' as StateType, label: 'Загрузка', icon: '⏳' },
    { type: 'empty' as StateType, label: 'Пусто', icon: '📭' },
    { type: 'error' as StateType, label: 'Ошибка', icon: '⚠️' },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Настройте отображение блока в различных состояниях
      </p>

      {/* Табы состояний */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.type}
            onClick={() => setActiveState(tab.type)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeState === tab.type
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Настройки состояния */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-4">
        {/* Включение */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id={`${activeState}-enabled`}
            checked={currentState.enabled}
            onChange={(e) => updateStateConfig(activeState, { enabled: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor={`${activeState}-enabled`} className="text-sm font-medium text-gray-700">
            Показывать состояние "{tabs.find(t => t.type === activeState)?.label}"
          </label>
        </div>

        {currentState.enabled && (
          <>
            {/* Режим: шаблон или блок */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Режим отображения
              </label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${activeState}-mode`}
                    checked={!currentState.useBlock}
                    onChange={() => updateStateConfig(activeState, { useBlock: false })}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Встроенный шаблон</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`${activeState}-mode`}
                    checked={currentState.useBlock}
                    onChange={() => updateStateConfig(activeState, { useBlock: true })}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Кастомный блок</span>
                </label>
              </div>
            </div>

            {/* Если встроенный шаблон */}
            {!currentState.useBlock && (
              <>
                {/* Иконка */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id={`${activeState}-icon`}
                      checked={currentState.showIcon}
                      onChange={(e) => updateStateConfig(activeState, { showIcon: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`${activeState}-icon`} className="text-sm font-medium text-gray-700">
                      Показывать иконку
                    </label>
                  </div>

                  {currentState.showIcon && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {ICONS[activeState].map(icon => (
                        <button
                          key={icon}
                          onClick={() => updateStateConfig(activeState, { icon })}
                          className={`w-10 h-10 flex items-center justify-center text-xl rounded-lg border transition-colors ${
                            currentState.icon === icon
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {icon === 'spinner' ? (
                            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                          ) : (
                            icon
                          )}
                        </button>
                      ))}
                      <input
                        type="text"
                        value={currentState.icon && !ICONS[activeState].includes(currentState.icon) ? currentState.icon : ''}
                        onChange={(e) => updateStateConfig(activeState, { icon: e.target.value })}
                        placeholder="Своя..."
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                {/* Сообщение */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Сообщение
                  </label>
                  <input
                    type="text"
                    value={currentState.message || ''}
                    onChange={(e) => updateStateConfig(activeState, { message: e.target.value })}
                    placeholder={defaultStates[activeState].message}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Кнопка повторить (только для error) */}
                {activeState === 'error' && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="show-retry"
                        checked={currentState.showRetry}
                        onChange={(e) => updateStateConfig(activeState, { showRetry: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="show-retry" className="text-sm font-medium text-gray-700">
                        Показывать кнопку "Повторить"
                      </label>
                    </div>

                    {currentState.showRetry && (
                      <input
                        type="text"
                        value={currentState.retryText || ''}
                        onChange={(e) => updateStateConfig(activeState, { retryText: e.target.value })}
                        placeholder="Повторить"
                        className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                )}

                {/* Кастомный HTML шаблон */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Кастомный HTML (опционально)
                  </label>
                  <textarea
                    value={currentState.template || ''}
                    onChange={(e) => updateStateConfig(activeState, { template: e.target.value })}
                    placeholder={`<div class="text-center py-8">
  ${activeState === 'loading' ? '<div class="spinner"></div>' : ''}
  <p>{message}</p>
</div>`}
                    rows={4}
                    className="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Используйте {'{message}'} и {'{icon}'} для подстановки значений
                  </p>
                </div>
              </>
            )}

            {/* Если кастомный блок */}
            {currentState.useBlock && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID блока
                </label>
                <input
                  type="text"
                  value={currentState.blockId || ''}
                  onChange={(e) => updateStateConfig(activeState, { blockId: e.target.value })}
                  placeholder="block-id-123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Укажите ID блока из библиотеки для отображения в этом состоянии
                </p>
              </div>
            )}
          </>
        )}

        {/* Превью */}
        <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-white">
          <p className="text-xs font-medium text-gray-500 mb-2">Превью:</p>
          <div className="flex flex-col items-center justify-center py-6 text-gray-500">
            {currentState.enabled ? (
              <>
                {currentState.showIcon && (
                  <div className="text-4xl mb-2">
                    {currentState.icon === 'spinner' ? (
                      <div className="w-8 h-8 border-3 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                    ) : (
                      currentState.icon || defaultStates[activeState].icon
                    )}
                  </div>
                )}
                <p className="text-sm">
                  {currentState.message || defaultStates[activeState].message}
                </p>
                {activeState === 'error' && currentState.showRetry && (
                  <button className="mt-3 px-4 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                    {currentState.retryText || 'Повторить'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm italic">Состояние отключено</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
