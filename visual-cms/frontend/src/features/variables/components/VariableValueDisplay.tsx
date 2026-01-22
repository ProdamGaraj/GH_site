/**
 * VariableValueDisplay
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 6.2: Отображение значений переменных
 * 
 * Компонент для отображения и редактирования текущего значения переменной.
 */

import React, { useState, useEffect } from 'react'
import { Eye, EyeOff, Edit2, Check, X, RotateCcw } from 'lucide-react'
import { useVariableByName, type VariableType } from '../index'

// ==================== TYPES ====================

interface VariableValueDisplayProps {
  pageId: string
  variableName: string
  editable?: boolean
  showType?: boolean
  compact?: boolean
}

// ==================== COMPONENT ====================

export const VariableValueDisplay: React.FC<VariableValueDisplayProps> = ({
  pageId,
  variableName,
  editable = true,
  showType = true,
  compact = false,
}) => {
  // useVariableByName(name, pageId) returns an object
  const variableResult = useVariableByName(variableName, pageId)
  const { value, setValue, definition } = variableResult
  // Note: usePageVariablesManager is available for future extension if needed
  
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    // Update edit value when actual value changes
    if (!isEditing) {
      setEditValue(formatValueForEdit(value, definition?.type))
    }
  }, [value, isEditing, definition?.type])

  if (!definition) {
    return (
      <span className="text-red-400 text-xs italic">
        Variable "{variableName}" not found
      </span>
    )
  }

  const handleStartEdit = () => {
    setEditValue(formatValueForEdit(value, definition.type))
    setIsEditing(true)
  }

  const handleSave = () => {
    const parsed = parseEditValue(editValue, definition.type)
    setValue(parsed)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(formatValueForEdit(value, definition.type))
    setIsEditing(false)
  }

  const handleReset = () => {
    setValue(definition.defaultValue)
  }

  const displayValue = formatValueForDisplay(value, definition.type, showRaw)

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-700 max-w-32 truncate">
          {displayValue}
        </code>
        {showType && (
          <span className="text-gray-400">({definition.type})</span>
        )}
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <ValueEditor
          value={editValue}
          onChange={setEditValue}
          type={definition.type}
        />
        <button
          onClick={handleSave}
          className="p-1 text-green-500 hover:bg-green-50 rounded"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <code className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-700 font-mono truncate max-w-48">
          {displayValue}
        </code>
        
        {showType && (
          <span className="text-xs text-gray-400">({definition.type})</span>
        )}

        {(definition.type === 'array' || definition.type === 'object') && (
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="p-1 text-gray-400 hover:text-gray-600"
            title={showRaw ? 'Show formatted' : 'Show raw'}
          >
            {showRaw ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        )}
      </div>

      {editable && (
        <div className="flex items-center gap-1">
          <button
            onClick={handleStartEdit}
            className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
            title="Edit value"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded"
            title="Reset to default"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ==================== SUB-COMPONENTS ====================

interface ValueEditorProps {
  value: string
  onChange: (value: string) => void
  type: VariableType
}

const ValueEditor: React.FC<ValueEditorProps> = ({ value, onChange, type }) => {
  if (type === 'boolean') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  if (type === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
      />
    )
  }

  if (type === 'array' || type === 'object') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-64 h-24 px-2 py-1 text-sm font-mono border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        placeholder={type === 'array' ? '[]' : '{}'}
      />
    )
  }

  // string, any
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 min-w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
    />
  )
}

// ==================== HELPERS ====================

function formatValueForDisplay(value: unknown, type: VariableType, showRaw: boolean): string {
  if (value === null || value === undefined) {
    return 'null'
  }

  if (type === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (type === 'array' || type === 'object') {
    if (showRaw) {
      return JSON.stringify(value, null, 2)
    }
    if (Array.isArray(value)) {
      return `Array(${value.length})`
    }
    if (typeof value === 'object') {
      return `Object(${Object.keys(value as object).length} keys)`
    }
  }

  return String(value)
}

function formatValueForEdit(value: unknown, type?: VariableType): string {
  if (value === null || value === undefined) {
    if (type === 'array') return '[]'
    if (type === 'object') return '{}'
    if (type === 'number') return '0'
    if (type === 'boolean') return 'false'
    return ''
  }

  if (type === 'array' || type === 'object') {
    return JSON.stringify(value, null, 2)
  }

  return String(value)
}

function parseEditValue(value: string, type: VariableType): unknown {
  if (type === 'boolean') {
    return value === 'true'
  }

  if (type === 'number') {
    const num = Number(value)
    return isNaN(num) ? 0 : num
  }

  if (type === 'array' || type === 'object') {
    try {
      return JSON.parse(value)
    } catch {
      return type === 'array' ? [] : {}
    }
  }

  return value
}

export default VariableValueDisplay
