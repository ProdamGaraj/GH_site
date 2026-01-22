import React, { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { updateBinding, selectBindingsSaving } from '@/features/dataBindings/dataBindingsSlice'
import type {
  DataBinding,
  OutputBindingConfig,
  ValidationRule,
} from '@/shared/types/dataBinding'
import { FieldMappingEditor } from './FieldMappingEditor'

interface OutputBindingEditorProps {
  binding: DataBinding
  onTest: () => void
}

// Типы триггеров
const TRIGGER_OPTIONS = [
  { value: 'submit', label: 'Form Submit', desc: 'При отправке формы' },
  { value: 'click', label: 'Button Click', desc: 'При клике на кнопку' },
  { value: 'change', label: 'On Change', desc: 'При изменении значения' },
  { value: 'blur', label: 'On Blur', desc: 'При потере фокуса' },
  { value: 'interval', label: 'Interval', desc: 'Автоматически по интервалу' },
  { value: 'custom', label: 'Custom Event', desc: 'Кастомное событие' },
] as const

// HTTP методы
const HTTP_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const

// Типы валидации
const VALIDATION_TYPES = [
  { value: 'required', label: 'Обязательное', needsValue: false },
  { value: 'email', label: 'Email', needsValue: false },
  { value: 'minLength', label: 'Мин. длина', needsValue: true },
  { value: 'maxLength', label: 'Макс. длина', needsValue: true },
  { value: 'pattern', label: 'Regex паттерн', needsValue: true },
  { value: 'min', label: 'Мин. значение', needsValue: true },
  { value: 'max', label: 'Макс. значение', needsValue: true },
  { value: 'custom', label: 'Кастомная', needsValue: true },
] as const

// Действия после успеха
const SUCCESS_ACTIONS = [
  { value: 'none', label: 'Ничего' },
  { value: 'showMessage', label: 'Показать сообщение' },
  { value: 'redirect', label: 'Редирект на страницу' },
  { value: 'refreshData', label: 'Обновить данные' },
  { value: 'resetForm', label: 'Очистить форму' },
  { value: 'hideBlock', label: 'Скрыть блок' },
  { value: 'custom', label: 'Кастомный callback' },
] as const

// Действия при ошибке
const ERROR_ACTIONS = [
  { value: 'showError', label: 'Показать ошибку' },
  { value: 'showField', label: 'Подсветить поле' },
  { value: 'retry', label: 'Повторить попытку' },
  { value: 'custom', label: 'Кастомный callback' },
] as const

/**
 * Редактор конфигурации выходной привязки (запись данных)
 */
export const OutputBindingEditor: React.FC<OutputBindingEditorProps> = ({
  binding,
  onTest,
}) => {
  const dispatch = useAppDispatch()
  const saving = useAppSelector(selectBindingsSaving)

  // Локальный стейт для редактирования
  const [config, setConfig] = useState<OutputBindingConfig>(
    binding.config.outputConfig || {
      trigger: 'submit',
      method: 'POST',
      payloadMappings: [],
    }
  )
  const [activeSection, setActiveSection] = useState<string>('trigger')
  const [hasChanges, setHasChanges] = useState(false)

  // Обновление конфигурации
  const updateConfig = (updates: Partial<OutputBindingConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  // Сохранение
  const handleSave = async () => {
    try {
      await dispatch(updateBinding({
        id: binding.id,
        data: {
          config: {
            ...binding.config,
            outputConfig: config,
          }
        }
      })).unwrap()
      setHasChanges(false)
    } catch (err) {
      console.error('Failed to save binding:', err)
    }
  }

  // Добавление правила валидации
  const addValidationRule = () => {
    const newRule: ValidationRule = {
      field: '',
      type: 'required',
      message: 'Это поле обязательно',
    }
    updateConfig({
      validation: {
        enabled: true,
        rules: [...(config.validation?.rules || []), newRule],
      }
    })
  }

  // Обновление правила валидации
  const updateValidationRule = (index: number, updates: Partial<ValidationRule>) => {
    const rules = [...(config.validation?.rules || [])]
    rules[index] = { ...rules[index], ...updates }
    updateConfig({
      validation: {
        ...config.validation,
        enabled: config.validation?.enabled ?? true,
        rules,
      }
    })
  }

  // Удаление правила валидации
  const removeValidationRule = (index: number) => {
    const rules = (config.validation?.rules || []).filter((_, i) => i !== index)
    updateConfig({
      validation: {
        ...config.validation,
        enabled: config.validation?.enabled ?? true,
        rules,
      }
    })
  }

  const sections = [
    { id: 'trigger', label: 'Триггер', icon: '⚡' },
    { id: 'endpoint', label: 'Endpoint', icon: '🌐' },
    { id: 'payload', label: 'Payload', icon: '📦' },
    { id: 'validation', label: 'Валидация', icon: '✓' },
    { id: 'response', label: 'Ответ', icon: '↩️' },
  ]

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-800">Настройки Output Binding</h4>
        <div className="flex gap-2">
          <button
            onClick={onTest}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            🧪 Тест
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Сохранение...' : '💾 Сохранить'}
            </button>
          )}
        </div>
      </div>

      {/* Секции */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Табы */}
        <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex-1 min-w-[100px] px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeSection === section.id
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="mr-1">{section.icon}</span>
              {section.label}
            </button>
          ))}
        </div>

        {/* Контент секции */}
        <div className="p-4">
          {/* Триггер */}
          {activeSection === 'trigger' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Когда отправлять данные
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {TRIGGER_OPTIONS.map(trigger => (
                    <button
                      key={trigger.value}
                      onClick={() => updateConfig({ trigger: trigger.value as OutputBindingConfig['trigger'] })}
                      className={`p-3 border rounded-lg text-left transition-all ${
                        config.trigger === trigger.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{trigger.label}</div>
                      <div className="text-xs text-gray-500">{trigger.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Настройки интервала */}
              {config.trigger === 'interval' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Интервал (секунды)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={config.intervalSeconds || 30}
                    onChange={(e) => updateConfig({ intervalSeconds: parseInt(e.target.value) || 30 })}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Настройки debounce для change */}
              {config.trigger === 'change' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Debounce (мс)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={config.debounce || 300}
                    onChange={(e) => updateConfig({ debounce: parseInt(e.target.value) || 0 })}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Задержка перед отправкой после изменения
                  </p>
                </div>
              )}

              {/* Кастомное событие */}
              {config.trigger === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Имя события
                  </label>
                  <input
                    type="text"
                    value={config.customTrigger || ''}
                    onChange={(e) => updateConfig({ customTrigger: e.target.value })}
                    placeholder="my-custom-event"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Endpoint */}
          {activeSection === 'endpoint' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HTTP метод
                </label>
                <div className="flex gap-2">
                  {HTTP_METHODS.map(method => (
                    <button
                      key={method}
                      onClick={() => updateConfig({ method })}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        config.method === method
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endpoint URL (опционально)
                </label>
                <input
                  type="text"
                  value={config.endpoint || ''}
                  onChange={(e) => updateConfig({ endpoint: e.target.value })}
                  placeholder="Оставьте пустым для использования URL из Data Source"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Если не указано, будет использован URL из настроек Data Source
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content-Type
                </label>
                <select
                  value={config.contentType || 'application/json'}
                  onChange={(e) => updateConfig({ contentType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="application/json">application/json</option>
                  <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                  <option value="multipart/form-data">multipart/form-data</option>
                </select>
              </div>
            </div>
          )}

          {/* Payload маппинг */}
          {activeSection === 'payload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Настройте, какие данные из блока будут отправлены на сервер
              </p>
              <FieldMappingEditor
                mappings={config.payloadMappings || []}
                onChange={(payloadMappings) => updateConfig({ payloadMappings })}
                dataSourceId={binding.dataSourceId}
                mode="output"
              />
            </div>
          )}

          {/* Валидация */}
          {activeSection === 'validation' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="validation-enabled"
                  checked={config.validation?.enabled || false}
                  onChange={(e) => updateConfig({
                    validation: {
                      ...config.validation,
                      enabled: e.target.checked,
                      rules: config.validation?.rules || [],
                    }
                  })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="validation-enabled" className="text-sm font-medium text-gray-700">
                  Включить валидацию перед отправкой
                </label>
              </div>

              {config.validation?.enabled && (
                <>
                  {/* Список правил */}
                  <div className="space-y-3">
                    {(config.validation?.rules || []).map((rule, index) => (
                      <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="grid grid-cols-4 gap-3">
                          {/* Поле */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Поле
                            </label>
                            <input
                              type="text"
                              value={rule.field}
                              onChange={(e) => updateValidationRule(index, { field: e.target.value })}
                              placeholder="email"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          {/* Тип */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Тип
                            </label>
                            <select
                              value={rule.type}
                              onChange={(e) => updateValidationRule(index, { 
                                type: e.target.value as ValidationRule['type']
                              })}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            >
                              {VALIDATION_TYPES.map(vt => (
                                <option key={vt.value} value={vt.value}>{vt.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Значение (если нужно) */}
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Значение
                            </label>
                            <input
                              type="text"
                              value={rule.value?.toString() || ''}
                              onChange={(e) => updateValidationRule(index, { value: e.target.value })}
                              placeholder="—"
                              disabled={!VALIDATION_TYPES.find(vt => vt.value === rule.type)?.needsValue}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            />
                          </div>

                          {/* Удалить */}
                          <div className="flex items-end">
                            <button
                              onClick={() => removeValidationRule(index)}
                              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Сообщение об ошибке */}
                        <div className="mt-2">
                          <input
                            type="text"
                            value={rule.message}
                            onChange={(e) => updateValidationRule(index, { message: e.target.value })}
                            placeholder="Сообщение об ошибке"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Кнопка добавления */}
                  <button
                    onClick={addValidationRule}
                    className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    + Добавить правило
                  </button>
                </>
              )}
            </div>
          )}

          {/* Обработка ответа */}
          {activeSection === 'response' && (
            <div className="space-y-6">
              {/* Действие при успехе */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  При успешной отправке
                </label>
                <select
                  value={config.onSuccess?.action || 'showMessage'}
                  onChange={(e) => updateConfig({
                    onSuccess: {
                      ...config.onSuccess,
                      action: e.target.value as typeof SUCCESS_ACTIONS[number]['value'],
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {SUCCESS_ACTIONS.map(action => (
                    <option key={action.value} value={action.value}>{action.label}</option>
                  ))}
                </select>

                {/* Параметры действия */}
                {config.onSuccess?.action === 'showMessage' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={config.onSuccess?.message || ''}
                      onChange={(e) => updateConfig({
                        onSuccess: { ...config.onSuccess, action: 'showMessage', message: e.target.value }
                      })}
                      placeholder="Данные успешно отправлены!"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {config.onSuccess?.action === 'redirect' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={config.onSuccess?.redirectUrl || ''}
                      onChange={(e) => updateConfig({
                        onSuccess: { ...config.onSuccess, action: 'redirect', redirectUrl: e.target.value }
                      })}
                      placeholder="/thank-you"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {config.onSuccess?.action === 'custom' && (
                  <div className="mt-3">
                    <textarea
                      value={config.onSuccess?.callback || ''}
                      onChange={(e) => updateConfig({
                        onSuccess: { ...config.onSuccess, action: 'custom', callback: e.target.value }
                      })}
                      placeholder="// JavaScript код&#10;console.log('Success!', response)"
                      rows={4}
                      className="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Действие при ошибке */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  При ошибке
                </label>
                <select
                  value={config.onError?.action || 'showError'}
                  onChange={(e) => updateConfig({
                    onError: {
                      ...config.onError,
                      action: e.target.value as typeof ERROR_ACTIONS[number]['value'],
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {ERROR_ACTIONS.map(action => (
                    <option key={action.value} value={action.value}>{action.label}</option>
                  ))}
                </select>

                {/* Сообщение об ошибке */}
                <div className="mt-3">
                  <input
                    type="text"
                    value={config.onError?.message || ''}
                    onChange={(e) => updateConfig({
                      onError: { ...config.onError, action: config.onError?.action || 'showError', message: e.target.value }
                    })}
                    placeholder="Произошла ошибка при отправке"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Retry настройки */}
                {config.onError?.action === 'retry' && (
                  <div className="mt-3 flex items-center gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Макс. попыток</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={config.onError?.retryCount || 3}
                        onChange={(e) => updateConfig({
                          onError: { ...config.onError, action: 'retry', retryCount: parseInt(e.target.value) || 3 }
                        })}
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Интервал (мс)</label>
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={config.onError?.retryDelay || 1000}
                        onChange={(e) => updateConfig({
                          onError: { ...config.onError, action: 'retry', retryDelay: parseInt(e.target.value) || 1000 }
                        })}
                        className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Состояния кнопки */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Состояния кнопки отправки
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Текст при загрузке</label>
                    <input
                      type="text"
                      value={config.buttonStates?.loading || ''}
                      onChange={(e) => updateConfig({
                        buttonStates: { ...config.buttonStates, loading: e.target.value }
                      })}
                      placeholder="Отправка..."
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Текст при успехе</label>
                    <input
                      type="text"
                      value={config.buttonStates?.success || ''}
                      onChange={(e) => updateConfig({
                        buttonStates: { ...config.buttonStates, success: e.target.value }
                      })}
                      placeholder="Отправлено ✓"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Текст при ошибке</label>
                    <input
                      type="text"
                      value={config.buttonStates?.error || ''}
                      onChange={(e) => updateConfig({
                        buttonStates: { ...config.buttonStates, error: e.target.value }
                      })}
                      placeholder="Ошибка. Повторить?"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="disable-on-submit"
                      checked={config.buttonStates?.disableOnSubmit ?? true}
                      onChange={(e) => updateConfig({
                        buttonStates: { ...config.buttonStates, disableOnSubmit: e.target.checked }
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="disable-on-submit" className="ml-2 text-sm text-gray-600">
                      Блокировать при отправке
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
