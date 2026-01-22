/**
 * OutputBindingsConfig Component
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Главный компонент конфигурации OUTPUT биндингов
 */

import { useState } from 'react'
import type { OutputBinding, OutputMethod } from '@/shared/types/outputBinding'
import { DEFAULT_BUTTON_STATES, DEFAULT_RETRY_CONFIG } from '@/shared/types/outputBinding'
import { PayloadMappingConfig } from './PayloadMappingConfig'
import { TriggersConfigPanel } from './TriggersConfigPanel'
import { ValidationConfigPanel } from './ValidationConfigPanel'
import { ResponseHandlingConfig } from './ResponseHandlingConfig'

interface OutputBindingsConfigProps {
  binding: OutputBinding
  onChange: (binding: OutputBinding) => void
  availableFields: string[]
  dataSources?: Array<{ id: string; name: string; endpoint: string }>
}

type ConfigTab = 'basic' | 'mapping' | 'triggers' | 'validation' | 'response'

export function OutputBindingsConfig({
  binding,
  onChange,
  availableFields,
  dataSources = [],
}: OutputBindingsConfigProps) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('basic')

  const updateBinding = (updates: Partial<OutputBinding>) => {
    onChange({ ...binding, ...updates })
  }

  const tabs: Array<{ id: ConfigTab; label: string; icon: string }> = [
    { id: 'basic', label: 'Основное', icon: '⚙️' },
    { id: 'mapping', label: 'Маппинг полей', icon: '🔗' },
    { id: 'triggers', label: 'Триггеры', icon: '⚡' },
    { id: 'validation', label: 'Валидация', icon: '✓' },
    { id: 'response', label: 'Действия', icon: '📤' },
  ]

  return (
    <div className="output-bindings-config bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <span className="text-blue-500">📤</span>
            OUTPUT Binding
          </h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={binding.enabled}
              onChange={(e) => updateBinding({ enabled: e.target.checked })}
              className="rounded border-gray-300"
            />
            Включено
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'basic' && (
          <BasicConfig
            binding={binding}
            onChange={updateBinding}
            dataSources={dataSources}
          />
        )}

        {activeTab === 'mapping' && (
          <PayloadMappingConfig
            fieldMappings={binding.fieldMappings}
            onChange={(fieldMappings) => updateBinding({ fieldMappings })}
            availableFields={availableFields}
            additionalData={binding.additionalData}
            onAdditionalDataChange={(additionalData) => updateBinding({ additionalData })}
          />
        )}

        {activeTab === 'triggers' && (
          <TriggersConfigPanel
            trigger={binding.trigger}
            onTriggerChange={(trigger) => updateBinding({ trigger })}
            conditionalTriggers={binding.conditionalTriggers}
            onConditionalTriggersChange={(conditionalTriggers) => 
              updateBinding({ conditionalTriggers })
            }
          />
        )}

        {activeTab === 'validation' && (
          <ValidationConfigPanel
            validations={binding.validations}
            onChange={(validations) => updateBinding({ validations })}
            availableFields={availableFields}
          />
        )}

        {activeTab === 'response' && (
          <ResponseHandlingConfig
            successActions={binding.successActions}
            errorActions={binding.errorActions}
            buttonStates={binding.buttonStates || DEFAULT_BUTTON_STATES}
            retryConfig={binding.retryConfig || DEFAULT_RETRY_CONFIG}
            onSuccessActionsChange={(successActions) => updateBinding({ successActions })}
            onErrorActionsChange={(errorActions) => updateBinding({ errorActions })}
            onButtonStatesChange={(buttonStates) => updateBinding({ buttonStates })}
            onRetryConfigChange={(retryConfig) => updateBinding({ retryConfig })}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Basic Configuration Panel
 */
interface BasicConfigProps {
  binding: OutputBinding
  onChange: (updates: Partial<OutputBinding>) => void
  dataSources: Array<{ id: string; name: string; endpoint: string }>
}

function BasicConfig({ binding, onChange, dataSources }: BasicConfigProps) {
  const methods: Array<{ value: OutputMethod; label: string; description: string }> = [
    { value: 'POST', label: 'POST', description: 'Создание новых данных' },
    { value: 'PUT', label: 'PUT', description: 'Полное обновление' },
    { value: 'PATCH', label: 'PATCH', description: 'Частичное обновление' },
    { value: 'DELETE', label: 'DELETE', description: 'Удаление данных' },
  ]

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Название binding
        </label>
        <input
          type="text"
          value={binding.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Например: Отправка формы"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      {/* Data Source */}
      {dataSources.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Источник данных
          </label>
          <select
            value={binding.dataSourceId || ''}
            onChange={(e) => {
              const ds = dataSources.find(d => d.id === e.target.value)
              onChange({
                dataSourceId: e.target.value,
                endpoint: ds?.endpoint || binding.endpoint,
              })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Выберите источник...</option>
            {dataSources.map((ds) => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Endpoint */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Endpoint URL
        </label>
        <input
          type="text"
          value={binding.endpoint}
          onChange={(e) => onChange({ endpoint: e.target.value })}
          placeholder="/api/submit"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
        />
        <p className="mt-1 text-xs text-gray-500">
          Можно использовать переменные: {'{pageId}'}, {'{blockId}'}, {'{id}'}
        </p>
      </div>

      {/* Method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          HTTP Метод
        </label>
        <div className="grid grid-cols-4 gap-2">
          {methods.map((m) => (
            <button
              key={m.value}
              onClick={() => onChange({ method: m.value })}
              className={`
                px-3 py-2 text-sm font-medium rounded-md border transition-colors
                ${binding.method === m.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400 text-gray-700'
                }
              `}
            >
              {m.value}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {methods.find(m => m.value === binding.method)?.description}
        </p>
      </div>

      {/* Content Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content-Type
        </label>
        <select
          value={binding.contentType || 'application/json'}
          onChange={(e) => onChange({ contentType: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="application/json">application/json</option>
          <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
          <option value="multipart/form-data">multipart/form-data</option>
        </select>
      </div>

      {/* Preview */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Превью запроса
        </div>
        <div className="font-mono text-sm">
          <span className={`
            px-2 py-1 rounded text-white mr-2
            ${binding.method === 'POST' ? 'bg-green-500' :
              binding.method === 'PUT' ? 'bg-blue-500' :
              binding.method === 'PATCH' ? 'bg-yellow-500' :
              'bg-red-500'}
          `}>
            {binding.method}
          </span>
          <span className="text-gray-700">{binding.endpoint || '/api/...'}</span>
        </div>
      </div>
    </div>
  )
}

export default OutputBindingsConfig
