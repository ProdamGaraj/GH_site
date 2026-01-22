/**
 * AdditionalDataSourcesEditor
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 5.2: Multiple Data Sources UI
 * 
 * Компонент для добавления дополнительных источников данных и настройки JOIN условий.
 */

import React, { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Database, RefreshCw } from 'lucide-react'
import { useDataSources, useDataSourcePreview } from '@/features/dataBindings/hooks'

// ==================== TYPES ====================

export type JoinType = 'left' | 'inner' | 'full' | 'cross'
export type MergeStrategy = 'primary_wins' | 'additional_wins' | 'concat' | 'merge_objects'

export interface JoinCondition {
  primaryField: string
  additionalField: string
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'startsWith'
}

export interface AdditionalDataSource {
  id: string
  dataSourceId: string
  alias: string
  joinType: JoinType
  joinConditions: JoinCondition[]
  mergeStrategy: MergeStrategy
  prefix?: string  // Префикс для полей из этого источника
  enabled: boolean
}

interface AdditionalDataSourcesEditorProps {
  sources: AdditionalDataSource[]
  primaryDataSourceId?: string
  onChange: (sources: AdditionalDataSource[]) => void
}

// ==================== COMPONENT ====================

export const AdditionalDataSourcesEditor: React.FC<AdditionalDataSourcesEditorProps> = ({
  sources,
  primaryDataSourceId,
  onChange,
}) => {
  const { dataSources } = useDataSources()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Получаем превью основного источника для отображения полей
  const { preview: primaryPreview } = useDataSourcePreview(primaryDataSourceId || '')

  const addSource = () => {
    const newSource: AdditionalDataSource = {
      id: `additional-${Date.now()}`,
      dataSourceId: '',
      alias: `source${sources.length + 1}`,
      joinType: 'left',
      joinConditions: [],
      mergeStrategy: 'primary_wins',
      enabled: true,
    }
    onChange([...sources, newSource])
    setExpandedId(newSource.id)
  }

  const updateSource = (id: string, updates: Partial<AdditionalDataSource>) => {
    onChange(sources.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const removeSource = (id: string) => {
    onChange(sources.filter(s => s.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const addJoinCondition = (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId)
    if (!source) return

    const newCondition: JoinCondition = {
      primaryField: '',
      additionalField: '',
      operator: '=',
    }
    updateSource(sourceId, {
      joinConditions: [...source.joinConditions, newCondition],
    })
  }

  const updateJoinCondition = (sourceId: string, conditionIndex: number, updates: Partial<JoinCondition>) => {
    const source = sources.find(s => s.id === sourceId)
    if (!source) return

    const conditions = [...source.joinConditions]
    conditions[conditionIndex] = { ...conditions[conditionIndex], ...updates }
    updateSource(sourceId, { joinConditions: conditions })
  }

  const removeJoinCondition = (sourceId: string, conditionIndex: number) => {
    const source = sources.find(s => s.id === sourceId)
    if (!source) return

    updateSource(sourceId, {
      joinConditions: source.joinConditions.filter((_, i) => i !== conditionIndex),
    })
  }

  // Извлекаем поля из превью
  const extractFields = (data: unknown): string[] => {
    if (!data) return []
    const sample = Array.isArray(data) ? data[0] : data
    if (!sample || typeof sample !== 'object') return []
    return Object.keys(sample as Record<string, unknown>)
  }

  const primaryFields = extractFields(primaryPreview)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h5 className="font-medium text-gray-800">Additional Data Sources</h5>
          <p className="text-xs text-gray-500">
            Join data from multiple sources for enriched content
          </p>
        </div>
        <button
          onClick={addSource}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Source
        </button>
      </div>

      {/* Empty State */}
      {sources.length === 0 && (
        <div className="p-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg text-center">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No additional data sources</p>
          <p className="text-sm text-gray-400">
            Add sources to join data from APIs, files, or other endpoints
          </p>
        </div>
      )}

      {/* Sources List */}
      <div className="space-y-3">
        {sources.map((source, index) => {
          const isExpanded = expandedId === source.id
          const selectedDataSource = dataSources.find(ds => ds.id === source.dataSourceId)

          return (
            <div
              key={source.id}
              className={`border rounded-lg overflow-hidden transition-colors ${
                source.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
              }`}
            >
              {/* Source Header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(isExpanded ? null : source.id)}
              >
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="checkbox"
                    checked={source.enabled}
                    onChange={(e) => {
                      e.stopPropagation()
                      updateSource(source.id, { enabled: e.target.checked })
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {source.alias || `Source ${index + 1}`}
                  </span>
                  {selectedDataSource && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {selectedDataSource.name}
                    </span>
                  )}
                  <JoinTypeBadge type={source.joinType} />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeSource(source.id)
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
                  {/* Data Source & Alias */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data Source
                      </label>
                      <select
                        value={source.dataSourceId}
                        onChange={(e) => updateSource(source.id, { dataSourceId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select source...</option>
                        {dataSources.map((ds) => (
                          <option key={ds.id} value={ds.id}>
                            {ds.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Alias
                      </label>
                      <input
                        type="text"
                        value={source.alias}
                        onChange={(e) => updateSource(source.id, { alias: e.target.value })}
                        placeholder="e.g., users, products"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Join Type & Merge Strategy */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Join Type
                      </label>
                      <select
                        value={source.joinType}
                        onChange={(e) => updateSource(source.id, { joinType: e.target.value as JoinType })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="left">LEFT JOIN - Keep all primary records</option>
                        <option value="inner">INNER JOIN - Only matching records</option>
                        <option value="full">FULL JOIN - All records from both</option>
                        <option value="cross">CROSS JOIN - All combinations</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Merge Strategy
                      </label>
                      <select
                        value={source.mergeStrategy}
                        onChange={(e) => updateSource(source.id, { mergeStrategy: e.target.value as MergeStrategy })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="primary_wins">Primary Wins - Primary values override</option>
                        <option value="additional_wins">Additional Wins - Additional values override</option>
                        <option value="concat">Concat - Merge arrays</option>
                        <option value="merge_objects">Merge Objects - Deep merge</option>
                      </select>
                    </div>
                  </div>

                  {/* Field Prefix */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field Prefix (optional)
                    </label>
                    <input
                      type="text"
                      value={source.prefix || ''}
                      onChange={(e) => updateSource(source.id, { prefix: e.target.value })}
                      placeholder="e.g., user_ → user_name, user_email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Prefix will be added to all fields from this source to avoid conflicts
                    </p>
                  </div>

                  {/* Join Conditions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Join Conditions
                      </label>
                      <button
                        onClick={() => addJoinCondition(source.id)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                        Add Condition
                      </button>
                    </div>

                    {source.joinConditions.length === 0 && source.joinType !== 'cross' && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                        <strong>Warning:</strong> No join conditions defined. Add conditions to specify how records should be matched.
                      </div>
                    )}

                    <div className="space-y-2">
                      {source.joinConditions.map((condition, conditionIndex) => (
                        <JoinConditionRow
                          key={conditionIndex}
                          condition={condition}
                          primaryFields={primaryFields}
                          additionalDataSourceId={source.dataSourceId}
                          onChange={(updates) => updateJoinCondition(source.id, conditionIndex, updates)}
                          onRemove={() => removeJoinCondition(source.id, conditionIndex)}
                        />
                      ))}
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

// ==================== SUB-COMPONENTS ====================

const JoinTypeBadge: React.FC<{ type: JoinType }> = ({ type }) => {
  const colors: Record<JoinType, string> = {
    left: 'bg-blue-100 text-blue-700',
    inner: 'bg-green-100 text-green-700',
    full: 'bg-purple-100 text-purple-700',
    cross: 'bg-orange-100 text-orange-700',
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[type]}`}>
      {type.toUpperCase()}
    </span>
  )
}

interface JoinConditionRowProps {
  condition: JoinCondition
  primaryFields: string[]
  additionalDataSourceId: string
  onChange: (updates: Partial<JoinCondition>) => void
  onRemove: () => void
}

const JoinConditionRow: React.FC<JoinConditionRowProps> = ({
  condition,
  primaryFields,
  additionalDataSourceId,
  onChange,
  onRemove,
}) => {
  const { preview: additionalPreview, loading } = useDataSourcePreview(additionalDataSourceId)
  
  // Извлекаем поля из дополнительного источника
  const extractFields = (data: unknown): string[] => {
    if (!data) return []
    const sample = Array.isArray(data) ? data[0] : data
    if (!sample || typeof sample !== 'object') return []
    return Object.keys(sample as Record<string, unknown>)
  }
  
  const additionalFields = extractFields(additionalPreview)

  const operators = [
    { value: '=', label: 'equals (=)' },
    { value: '!=', label: 'not equals (!=)' },
    { value: '>', label: 'greater than (>)' },
    { value: '<', label: 'less than (<)' },
    { value: '>=', label: 'greater or equal (>=)' },
    { value: '<=', label: 'less or equal (<=)' },
    { value: 'contains', label: 'contains' },
    { value: 'startsWith', label: 'starts with' },
  ]

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
      {/* Primary Field */}
      <div className="flex-1">
        <select
          value={condition.primaryField}
          onChange={(e) => onChange({ primaryField: e.target.value })}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Primary field...</option>
          {primaryFields.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>
      </div>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={(e) => onChange({ operator: e.target.value as JoinCondition['operator'] })}
        className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Additional Field */}
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center gap-2 px-2 py-1.5 text-gray-400 text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <select
            value={condition.additionalField}
            onChange={(e) => onChange({ additionalField: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Additional field...</option>
            {additionalFields.map((field) => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-1.5 text-gray-400 hover:text-red-500"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

export default AdditionalDataSourcesEditor
