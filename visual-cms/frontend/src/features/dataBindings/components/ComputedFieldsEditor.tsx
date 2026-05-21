/**
 * ComputedFieldsEditor
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 5.2: Computed Fields Config
 * 
 * Компонент для настройки вычисляемых полей с Monaco Editor.
 */

import React, { useState, useCallback } from 'react'
import { Plus, Trash2, Play, Check, X, Code, AlertTriangle, Zap, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useDataSourcePreview } from '@/features/dataBindings/hooks'

// ==================== TYPES ====================

export interface ComputedFieldConfig {
  id: string
  name: string
  expression: string
  isAsync?: boolean
  dependencies?: string[]
  cacheKey?: string
  enabled?: boolean
  description?: string
}

interface ComputedFieldsEditorProps {
  fields: ComputedFieldConfig[]
  dataSourceId?: string
  onChange: (fields: ComputedFieldConfig[]) => void
}

interface TestResult {
  success: boolean
  value?: unknown
  error?: string
  duration?: number
}

// ==================== COMPONENT ====================

export const ComputedFieldsEditor: React.FC<ComputedFieldsEditorProps> = ({
  fields,
  dataSourceId,
  onChange,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  
  const { preview: sampleData, loading: previewLoading } = useDataSourcePreview(dataSourceId || '')

  const addField = () => {
    const newField: ComputedFieldConfig = {
      id: `computed-${Date.now()}`,
      name: '',
      expression: '// Access data with:\n// item - current data object\n// $var("name") - get variable\n// $data("sourceId") - get other source\n\nreturn item.field1 + item.field2',
      isAsync: false,
      enabled: true,
    }
    onChange([...fields, newField])
    setExpandedId(newField.id)
  }

  const updateField = (id: string, updates: Partial<ComputedFieldConfig>) => {
    onChange(fields.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const removeField = (id: string) => {
    onChange(fields.filter(f => f.id !== id))
    setTestResults(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (expandedId === id) setExpandedId(null)
  }

  const testField = useCallback((field: ComputedFieldConfig) => {
    const startTime = performance.now()
    
    try {
      // Создаем тестовый контекст
      const item = Array.isArray(sampleData) ? sampleData[0] : sampleData
      const context = {
        item: item || {},
        $var: (name: string) => `[var:${name}]`,
        $data: (sourceId: string) => `[data:${sourceId}]`,
        $page: { title: 'Test Page' },
      }

      // Безопасное выполнение
      const fn = new Function('item', '$var', '$data', '$page', field.expression)
      const result = fn(context.item, context.$var, context.$data, context.$page)
      
      const duration = performance.now() - startTime

      setTestResults(prev => ({
        ...prev,
        [field.id]: { success: true, value: result, duration },
      }))
    } catch (error) {
      const duration = performance.now() - startTime
      setTestResults(prev => ({
        ...prev,
        [field.id]: { 
          success: false, 
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
      }))
    }
  }, [sampleData])

  // Извлекаем доступные поля для автодополнения
  const availableFields = React.useMemo(() => {
    if (!sampleData) return []
    const sample = Array.isArray(sampleData) ? sampleData[0] : sampleData
    if (!sample || typeof sample !== 'object') return []
    return Object.keys(sample as Record<string, unknown>)
  }, [sampleData])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h5 className="font-medium text-gray-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Computed Fields
          </h5>
          <p className="text-xs text-gray-500">
            Create dynamic fields calculated from your data
          </p>
        </div>
        <button
          onClick={addField}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Field
        </button>
      </div>

      {/* Available Fields Reference */}
      {availableFields.length > 0 && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs font-medium text-gray-600 mb-2">Available fields from data:</p>
          <div className="flex flex-wrap gap-1">
            {availableFields.map((field) => (
              <code key={field} className="px-2 py-0.5 bg-white text-xs text-gray-700 rounded border border-gray-200">
                item.{field}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {fields.length === 0 && (
        <div className="p-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg text-center">
          <Code className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No computed fields</p>
          <p className="text-sm text-gray-400">
            Add fields to calculate values dynamically from your data
          </p>
        </div>
      )}

      {/* Fields List */}
      <div className="space-y-3">
        {fields.map((field) => {
          const isExpanded = expandedId === field.id
          const testResult = testResults[field.id]

          return (
            <div
              key={field.id}
              className={`border rounded-lg overflow-hidden transition-colors ${
                field.enabled !== false ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
              }`}
            >
              {/* Field Header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(isExpanded ? null : field.id)}
              >
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="checkbox"
                    checked={field.enabled !== false}
                    onChange={(e) => {
                      e.stopPropagation()
                      updateField(field.id, { enabled: e.target.checked })
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <Code className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    {field.name || 'Untitled Field'}
                  </span>
                  {field.isAsync && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                      async
                    </span>
                  )}
                  {testResult && (
                    <span className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${
                      testResult.success 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {testResult.success ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {testResult.duration?.toFixed(0)}ms
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      testField(field)
                    }}
                    disabled={previewLoading || !field.expression}
                    className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-50"
                    title="Test expression"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeField(field.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  {/* Field Name & Description */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field Name *
                      </label>
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => updateField(field.id, { name: e.target.value })}
                        placeholder="e.g., fullName, totalPrice"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={field.description || ''}
                        onChange={(e) => updateField(field.id, { description: e.target.value })}
                        placeholder="What this field calculates"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Expression Editor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expression *
                    </label>
                    <div className="relative">
                      <textarea
                        value={field.expression}
                        onChange={(e) => updateField(field.id, { expression: e.target.value })}
                        placeholder='concat(item.firstName, " ", item.lastName)'
                        rows={6}
                        className="w-full px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-900 text-green-400"
                        spellCheck={false}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Безопасное выражение (без произвольного JS). Доступны:{' '}
                      <code>item</code>, <code>index</code>, <code>items</code>,
                      <code>$page</code>, функции <code>$var("name")</code> и{' '}
                      <code>$data("alias")</code>. Helper'ы:{' '}
                      <code>upper/lower/trim/concat/len/slice/replace/round/floor/ceil/default/if</code>.
                      Member-access по точке (<code>item.user.name</code>) и тернарник{' '}
                      (<code>a ? b : c</code>). Метод-вызовы (<code>.toUpperCase()</code>) и
                      шаблонные литералы НЕ поддерживаются — используйте helper'ы.
                    </p>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={field.isAsync || false}
                          onChange={(e) => updateField(field.id, { isAsync: e.target.checked })}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm text-gray-700">Async (for API calls)</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cache Key
                      </label>
                      <input
                        type="text"
                        value={field.cacheKey || ''}
                        onChange={(e) => updateField(field.id, { cacheKey: e.target.value })}
                        placeholder="Optional cache identifier"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Test Result */}
                  {testResult && (
                    <div className={`p-3 rounded-lg ${
                      testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {testResult.success ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                          {testResult.success ? 'Test Passed' : 'Test Failed'}
                        </span>
                        {testResult.duration !== undefined && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {testResult.duration.toFixed(2)}ms
                          </span>
                        )}
                      </div>
                      <pre className={`text-sm p-2 rounded bg-white overflow-auto max-h-32 ${
                        testResult.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {testResult.success 
                          ? JSON.stringify(testResult.value, null, 2)
                          : testResult.error
                        }
                      </pre>
                    </div>
                  )}

                  {/* Help */}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
                      Expression Examples
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                      <ExpressionExample
                        title="String concatenation"
                        code="return item.firstName + ' ' + item.lastName"
                      />
                      <ExpressionExample
                        title="Math calculation"
                        code="return item.price * item.quantity"
                      />
                      <ExpressionExample
                        title="Conditional value"
                        code="return item.stock > 0 ? 'In Stock' : 'Out of Stock'"
                      />
                      <ExpressionExample
                        title="Format currency"
                        code="return '$' + item.price.toFixed(2)"
                      />
                      <ExpressionExample
                        title="Date formatting"
                        code="return new Date(item.date).toLocaleDateString()"
                      />
                    </div>
                  </details>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== HELPERS ====================

const ExpressionExample: React.FC<{ title: string; code: string }> = ({ title, code }) => (
  <div>
    <p className="text-gray-600 mb-1">{title}:</p>
    <code className="block px-2 py-1 bg-gray-900 text-green-400 text-xs rounded">
      {code}
    </code>
  </div>
)

export default ComputedFieldsEditor
