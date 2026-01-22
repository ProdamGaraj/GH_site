/**
 * ConditionalMappingEditor
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 5.3: Conditional Mapping Component
 * 
 * Компонент для настройки условной логики IF-THEN-ELSE.
 */

import React, { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, GitBranch, ArrowRight, Layers, Copy } from 'lucide-react'
import type { FilterOperator } from '@/shared/types/dataBinding'
import { useDataSourcePreview } from '@/features/dataBindings/hooks'

// ==================== TYPES ====================

export interface ConditionClause {
  field: string
  operator: FilterOperator
  value: unknown
}

export interface ConditionalBranch {
  id: string
  conditions: ConditionClause[]
  conditionLogic: 'and' | 'or'
  result: unknown | { field: string }
  isFieldReference?: boolean
}

export interface ConditionalFieldConfig {
  id: string
  targetField: string
  branches: ConditionalBranch[]
  elseResult?: unknown | { field: string }
  elseIsFieldReference?: boolean
  enabled?: boolean
}

interface ConditionalMappingEditorProps {
  mappings: ConditionalFieldConfig[]
  dataSourceId?: string
  onChange: (mappings: ConditionalFieldConfig[]) => void
}

// ==================== OPERATORS ====================

const OPERATORS: { value: FilterOperator; label: string; category: string }[] = [
  // Comparison
  { value: 'equals', label: 'equals (=)', category: 'comparison' },
  { value: 'notEquals', label: 'not equals (≠)', category: 'comparison' },
  { value: 'greaterThan', label: 'greater than (>)', category: 'comparison' },
  { value: 'greaterOrEqual', label: 'greater or equal (≥)', category: 'comparison' },
  { value: 'lessThan', label: 'less than (<)', category: 'comparison' },
  { value: 'lessOrEqual', label: 'less or equal (≤)', category: 'comparison' },
  // Text
  { value: 'contains', label: 'contains', category: 'text' },
  { value: 'notContains', label: 'not contains', category: 'text' },
  { value: 'startsWith', label: 'starts with', category: 'text' },
  { value: 'endsWith', label: 'ends with', category: 'text' },
  { value: 'regex', label: 'matches (regex)', category: 'text' },
  // Existence
  { value: 'isEmpty', label: 'is empty', category: 'existence' },
  { value: 'exists', label: 'exists', category: 'existence' },
  // Array
  { value: 'in', label: 'in list', category: 'array' },
  { value: 'notIn', label: 'not in list', category: 'array' },
]

// ==================== COMPONENT ====================

export const ConditionalMappingEditor: React.FC<ConditionalMappingEditorProps> = ({
  mappings,
  dataSourceId,
  onChange,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { preview: sampleData } = useDataSourcePreview(dataSourceId || '')

  // Извлекаем поля
  const availableFields = React.useMemo(() => {
    if (!sampleData) return []
    const sample = Array.isArray(sampleData) ? sampleData[0] : sampleData
    if (!sample || typeof sample !== 'object') return []
    return Object.keys(sample as Record<string, unknown>)
  }, [sampleData])

  const addMapping = () => {
    const newMapping: ConditionalFieldConfig = {
      id: `conditional-${Date.now()}`,
      targetField: '',
      branches: [{
        id: `branch-${Date.now()}`,
        conditions: [{ field: '', operator: 'equals' as FilterOperator, value: '' }],
        conditionLogic: 'and',
        result: '',
        isFieldReference: false,
      }],
      enabled: true,
    }
    onChange([...mappings, newMapping])
    setExpandedId(newMapping.id)
  }

  const updateMapping = (id: string, updates: Partial<ConditionalFieldConfig>) => {
    onChange(mappings.map(m => m.id === id ? { ...m, ...updates } : m))
  }

  const removeMapping = (id: string) => {
    onChange(mappings.filter(m => m.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const duplicateMapping = (mapping: ConditionalFieldConfig) => {
    const duplicate: ConditionalFieldConfig = {
      ...JSON.parse(JSON.stringify(mapping)),
      id: `conditional-${Date.now()}`,
      targetField: `${mapping.targetField}_copy`,
    }
    onChange([...mappings, duplicate])
    setExpandedId(duplicate.id)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h5 className="font-medium text-gray-800 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-500" />
            Conditional Mappings
          </h5>
          <p className="text-xs text-gray-500">
            Define IF-THEN-ELSE logic for dynamic field values
          </p>
        </div>
        <button
          onClick={addMapping}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          Add Conditional
        </button>
      </div>

      {/* Empty State */}
      {mappings.length === 0 && (
        <div className="p-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg text-center">
          <GitBranch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No conditional mappings</p>
          <p className="text-sm text-gray-400">
            Add mappings to set field values based on conditions
          </p>
        </div>
      )}

      {/* Mappings List */}
      <div className="space-y-3">
        {mappings.map((mapping) => {
          const isExpanded = expandedId === mapping.id

          return (
            <div
              key={mapping.id}
              className={`border rounded-lg overflow-hidden transition-colors ${
                mapping.enabled !== false ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
              }`}
            >
              {/* Mapping Header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(isExpanded ? null : mapping.id)}
              >
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="checkbox"
                    checked={mapping.enabled !== false}
                    onChange={(e) => {
                      e.stopPropagation()
                      updateMapping(mapping.id, { enabled: e.target.checked })
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-gray-700">
                    {mapping.targetField || 'Untitled'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {mapping.branches.length} branch{mapping.branches.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      duplicateMapping(mapping)
                    }}
                    className="p-1 text-gray-400 hover:text-blue-500"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeMapping(mapping.id)
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
                  {/* Target Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Field
                    </label>
                    <input
                      type="text"
                      value={mapping.targetField}
                      onChange={(e) => updateMapping(mapping.id, { targetField: e.target.value })}
                      placeholder="e.g., status, label, cssClass"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Branches */}
                  <BranchesEditor
                    branches={mapping.branches}
                    availableFields={availableFields}
                    onChange={(branches) => updateMapping(mapping.id, { branches })}
                  />

                  {/* Else Branch */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-600">ELSE</span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                    <ResultInput
                      value={mapping.elseResult}
                      isFieldReference={mapping.elseIsFieldReference}
                      availableFields={availableFields}
                      onChange={(elseResult, elseIsFieldReference) => 
                        updateMapping(mapping.id, { elseResult, elseIsFieldReference })
                      }
                    />
                  </div>

                  {/* Preview */}
                  <ConditionalPreview mapping={mapping} sampleData={sampleData} />
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

interface BranchesEditorProps {
  branches: ConditionalBranch[]
  availableFields: string[]
  onChange: (branches: ConditionalBranch[]) => void
}

const BranchesEditor: React.FC<BranchesEditorProps> = ({
  branches,
  availableFields,
  onChange,
}) => {
  const addBranch = () => {
    const newBranch: ConditionalBranch = {
      id: `branch-${Date.now()}`,
      conditions: [{ field: '', operator: 'equals' as FilterOperator, value: '' }],
      conditionLogic: 'and',
      result: '',
      isFieldReference: false,
    }
    onChange([...branches, newBranch])
  }

  const updateBranch = (id: string, updates: Partial<ConditionalBranch>) => {
    onChange(branches.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  const removeBranch = (id: string) => {
    if (branches.length > 1) {
      onChange(branches.filter(b => b.id !== id))
    }
  }

  const addCondition = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId)
    if (!branch) return

    updateBranch(branchId, {
      conditions: [...branch.conditions, { field: '', operator: 'equals' as FilterOperator, value: '' }],
    })
  }

  const updateCondition = (branchId: string, conditionIndex: number, updates: Partial<ConditionClause>) => {
    const branch = branches.find(b => b.id === branchId)
    if (!branch) return

    const conditions = [...branch.conditions]
    conditions[conditionIndex] = { ...conditions[conditionIndex], ...updates }
    updateBranch(branchId, { conditions })
  }

  const removeCondition = (branchId: string, conditionIndex: number) => {
    const branch = branches.find(b => b.id === branchId)
    if (!branch || branch.conditions.length <= 1) return

    updateBranch(branchId, {
      conditions: branch.conditions.filter((_, i) => i !== conditionIndex),
    })
  }

  return (
    <div className="space-y-3">
      {branches.map((branch, branchIndex) => (
        <div key={branch.id} className="border border-purple-200 rounded-lg p-3 bg-purple-50">
          {/* Branch Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-purple-700">
              {branchIndex === 0 ? 'IF' : 'ELSE IF'}
            </span>
            {branches.length > 1 && (
              <button
                onClick={() => removeBranch(branch.id)}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Conditions */}
          <div className="space-y-2 mb-3">
            {branch.conditions.map((condition, conditionIndex) => (
              <div key={conditionIndex} className="flex items-center gap-2">
                {conditionIndex > 0 && (
                  <select
                    value={branch.conditionLogic}
                    onChange={(e) => updateBranch(branch.id, { conditionLogic: e.target.value as 'and' | 'or' })}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="and">AND</option>
                    <option value="or">OR</option>
                  </select>
                )}
                
                {/* Field */}
                <select
                  value={condition.field}
                  onChange={(e) => updateCondition(branch.id, conditionIndex, { field: e.target.value })}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">Select field...</option>
                  {availableFields.map((field) => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </select>

                {/* Operator */}
                <select
                  value={condition.operator}
                  onChange={(e) => updateCondition(branch.id, conditionIndex, { operator: e.target.value as FilterOperator })}
                  className="w-36 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>

                {/* Value */}
                {!['is_empty', 'is_not_empty', 'is_null', 'is_not_null'].includes(condition.operator) && (
                  <input
                    type="text"
                    value={String(condition.value || '')}
                    onChange={(e) => updateCondition(branch.id, conditionIndex, { value: e.target.value })}
                    placeholder="Value"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                )}

                {/* Remove Condition */}
                {branch.conditions.length > 1 && (
                  <button
                    onClick={() => removeCondition(branch.id, conditionIndex)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={() => addCondition(branch.id)}
              className="text-xs text-purple-600 hover:text-purple-700"
            >
              + Add condition
            </button>
          </div>

          {/* Result */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-purple-600">THEN</span>
            <ArrowRight className="w-4 h-4 text-purple-400" />
            <div className="flex-1">
              <ResultInput
                value={branch.result}
                isFieldReference={branch.isFieldReference}
                availableFields={availableFields}
                onChange={(result, isFieldReference) => 
                  updateBranch(branch.id, { result, isFieldReference })
                }
              />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addBranch}
        className="w-full py-2 border border-dashed border-purple-300 rounded-lg text-sm text-purple-600 hover:bg-purple-50 flex items-center justify-center gap-1"
      >
        <Layers className="w-4 h-4" />
        Add ELSE IF branch
      </button>
    </div>
  )
}

interface ResultInputProps {
  value: unknown
  isFieldReference?: boolean
  availableFields: string[]
  onChange: (value: unknown, isFieldReference: boolean) => void
}

const ResultInput: React.FC<ResultInputProps> = ({
  value,
  isFieldReference,
  availableFields,
  onChange,
}) => {
  return (
    <div className="flex items-center gap-2">
      <select
        value={isFieldReference ? 'field' : 'value'}
        onChange={(e) => onChange(value, e.target.value === 'field')}
        className="w-24 px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
      >
        <option value="value">Value</option>
        <option value="field">Field</option>
      </select>

      {isFieldReference ? (
        <select
          value={typeof value === 'object' && value !== null ? (value as { field: string }).field : ''}
          onChange={(e) => onChange({ field: e.target.value }, true)}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
        >
          <option value="">Select field...</option>
          {availableFields.map((field) => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value, false)}
          placeholder="Result value"
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
        />
      )}
    </div>
  )
}

interface ConditionalPreviewProps {
  mapping: ConditionalFieldConfig
  sampleData: unknown
}

const ConditionalPreview: React.FC<ConditionalPreviewProps> = ({ mapping, sampleData }) => {
  if (!sampleData) return null

  const sample = Array.isArray(sampleData) ? sampleData[0] : sampleData
  if (!sample || typeof sample !== 'object') return null

  // Evaluate the conditional
  const evaluateCondition = (condition: ConditionClause, item: Record<string, unknown>): boolean => {
    const fieldValue = item[condition.field]
    const compareValue = condition.value

    switch (condition.operator) {
      case 'equals': return fieldValue === compareValue
      case 'notEquals': return fieldValue !== compareValue
      case 'greaterThan': return Number(fieldValue) > Number(compareValue)
      case 'greaterOrEqual': return Number(fieldValue) >= Number(compareValue)
      case 'lessThan': return Number(fieldValue) < Number(compareValue)
      case 'lessOrEqual': return Number(fieldValue) <= Number(compareValue)
      case 'contains': return String(fieldValue).includes(String(compareValue))
      case 'startsWith': return String(fieldValue).startsWith(String(compareValue))
      case 'endsWith': return String(fieldValue).endsWith(String(compareValue))
      case 'isEmpty': return !fieldValue || String(fieldValue).length === 0
      case 'exists': return fieldValue !== null && fieldValue !== undefined
      default: return false
    }
  }

  const getResult = (result: unknown, isFieldRef?: boolean, item?: Record<string, unknown>): unknown => {
    if (isFieldRef && typeof result === 'object' && result !== null) {
      return item?.[(result as { field: string }).field]
    }
    return result
  }

  const item = sample as Record<string, unknown>
  let resultValue: unknown = mapping.elseIsFieldReference 
    ? getResult(mapping.elseResult, true, item) 
    : mapping.elseResult

  for (const branch of mapping.branches) {
    const matches = branch.conditionLogic === 'and'
      ? branch.conditions.every(c => evaluateCondition(c, item))
      : branch.conditions.some(c => evaluateCondition(c, item))

    if (matches) {
      resultValue = getResult(branch.result, branch.isFieldReference, item)
      break
    }
  }

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <p className="text-xs font-medium text-blue-700 mb-1">Preview with sample data:</p>
      <div className="flex items-center gap-2">
        <code className="text-sm text-blue-800">{mapping.targetField}</code>
        <ArrowRight className="w-4 h-4 text-blue-400" />
        <code className="px-2 py-0.5 bg-white rounded text-sm text-blue-900">
          {JSON.stringify(resultValue)}
        </code>
      </div>
    </div>
  )
}

export default ConditionalMappingEditor
