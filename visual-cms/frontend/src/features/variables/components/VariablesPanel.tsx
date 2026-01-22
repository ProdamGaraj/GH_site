/**
 * VariablesPanel
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 6.2: Variables Panel
 * 
 * Панель управления переменными страницы.
 */

import React, { useState } from 'react'
import { Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp, Globe, FileText, Clock, Box } from 'lucide-react'
import { usePageVariablesManager, type PageVariable, type VariableScope, type VariableType } from '../index'

// ==================== TYPES ====================

interface VariablesPanelProps {
  pageId: string
  compact?: boolean
}

interface VariableFormData {
  name: string
  type: VariableType
  defaultValue: string
  description: string
  scope: VariableScope
}

// ==================== CONSTANTS ====================

const VARIABLE_TYPES: { value: VariableType; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' },
  { value: 'any', label: 'Any' },
]

const SCOPE_ICONS: Record<VariableScope, React.ReactNode> = {
  page: <FileText className="w-4 h-4" />,
  session: <Clock className="w-4 h-4" />,
  global: <Globe className="w-4 h-4" />,
}

const SCOPE_LABELS: Record<VariableScope, string> = {
  page: 'Page',
  session: 'Session',
  global: 'Global',
}

// ==================== COMPONENT ====================

export const VariablesPanel: React.FC<VariablesPanelProps> = ({ pageId, compact = false }) => {
  const { variables, globalVariables, loading, create, update, remove } = usePageVariablesManager(pageId)
  
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<VariableScope | null>('page')
  const [formData, setFormData] = useState<VariableFormData>({
    name: '',
    type: 'string',
    defaultValue: '',
    description: '',
    scope: 'page',
  })

  // Group variables by scope
  const groupedVariables = {
    page: variables.filter(v => v.scope === 'page'),
    session: variables.filter(v => v.scope === 'session'),
    global: globalVariables,
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'string',
      defaultValue: '',
      description: '',
      scope: 'page',
    })
    setShowAddForm(false)
    setEditingId(null)
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) return

    let parsedDefault: unknown = formData.defaultValue
    try {
      if (formData.type === 'number') {
        parsedDefault = Number(formData.defaultValue) || 0
      } else if (formData.type === 'boolean') {
        parsedDefault = formData.defaultValue === 'true'
      } else if (formData.type === 'array' || formData.type === 'object') {
        parsedDefault = JSON.parse(formData.defaultValue || (formData.type === 'array' ? '[]' : '{}'))
      }
    } catch {
      // Keep as string
    }

    const result = await create({
      name: formData.name.trim(),
      type: formData.type,
      defaultValue: parsedDefault,
      description: formData.description,
      scope: formData.scope,
      pageId: formData.scope === 'global' ? undefined : pageId,
    })

    if (result) {
      resetForm()
    }
  }

  const handleUpdate = async (id: string) => {
    let parsedDefault: unknown = formData.defaultValue
    try {
      if (formData.type === 'number') {
        parsedDefault = Number(formData.defaultValue) || 0
      } else if (formData.type === 'boolean') {
        parsedDefault = formData.defaultValue === 'true'
      } else if (formData.type === 'array' || formData.type === 'object') {
        parsedDefault = JSON.parse(formData.defaultValue || (formData.type === 'array' ? '[]' : '{}'))
      }
    } catch {
      // Keep as string
    }

    const success = await update(id, {
      name: formData.name.trim(),
      type: formData.type,
      defaultValue: parsedDefault,
      description: formData.description,
    })

    if (success) {
      resetForm()
    }
  }

  const handleEdit = (variable: PageVariable) => {
    setEditingId(variable.id)
    setFormData({
      name: variable.name,
      type: variable.type,
      defaultValue: typeof variable.defaultValue === 'object' 
        ? JSON.stringify(variable.defaultValue) 
        : String(variable.defaultValue ?? ''),
      description: variable.description || '',
      scope: variable.scope,
    })
    setShowAddForm(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this variable?')) {
      await remove(id)
    }
  }

  const renderVariableItem = (variable: PageVariable) => {
    const isEditing = editingId === variable.id

    if (isEditing) {
      return (
        <div key={variable.id} className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
          <VariableForm
            data={formData}
            onChange={setFormData}
            onSave={() => handleUpdate(variable.id)}
            onCancel={resetForm}
            isEditing
            showScope={false}
          />
        </div>
      )
    }

    return (
      <div
        key={variable.id}
        className="flex items-center gap-3 p-2 border border-gray-100 rounded-lg hover:bg-gray-50 group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-sm font-medium text-gray-800">{variable.name}</code>
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
              {variable.type}
            </span>
          </div>
          {variable.description && (
            <p className="text-xs text-gray-500 truncate">{variable.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handleEdit(variable)}
            className="p-1 text-gray-400 hover:text-blue-500"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(variable.id)}
            className="p-1 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  const renderSection = (scope: VariableScope, items: PageVariable[]) => {
    const isExpanded = expandedSection === scope

    return (
      <div key={scope} className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100"
          onClick={() => setExpandedSection(isExpanded ? null : scope)}
        >
          {SCOPE_ICONS[scope]}
          <span className="text-sm font-medium text-gray-700">{SCOPE_LABELS[scope]}</span>
          <span className="text-xs text-gray-400 ml-auto mr-2">{items.length}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {isExpanded && (
          <div className="p-2 space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">
                No {scope} variables
              </p>
            ) : (
              items.map(renderVariableItem)
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading && variables.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading variables...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="w-5 h-5 text-purple-500" />
          <h3 className="font-medium text-gray-800">Variables</h3>
        </div>
        {!showAddForm && !editingId && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-3 border border-purple-200 bg-purple-50 rounded-lg">
          <VariableForm
            data={formData}
            onChange={setFormData}
            onSave={handleCreate}
            onCancel={resetForm}
            showScope
          />
        </div>
      )}

      {/* Sections */}
      {compact ? (
        <div className="space-y-2">
          {[...groupedVariables.page, ...groupedVariables.session, ...groupedVariables.global].map(renderVariableItem)}
        </div>
      ) : (
        <div className="space-y-2">
          {renderSection('page', groupedVariables.page)}
          {renderSection('session', groupedVariables.session)}
          {renderSection('global', groupedVariables.global)}
        </div>
      )}
    </div>
  )
}

// ==================== SUB-COMPONENTS ====================

interface VariableFormProps {
  data: VariableFormData
  onChange: (data: VariableFormData) => void
  onSave: () => void
  onCancel: () => void
  isEditing?: boolean
  showScope?: boolean
}

const VariableForm: React.FC<VariableFormProps> = ({
  data,
  onChange,
  onSave,
  onCancel,
  isEditing: _isEditing = false, // Reserved for future use (different behavior in edit mode)
  showScope = true,
}) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="variableName"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={data.type}
            onChange={(e) => onChange({ ...data, type: e.target.value as VariableType })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
          >
            {VARIABLE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {showScope && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Scope</label>
          <div className="flex gap-2">
            {(['page', 'session', 'global'] as VariableScope[]).map((scope) => (
              <button
                key={scope}
                onClick={() => onChange({ ...data, scope })}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                  data.scope === scope
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                }`}
              >
                {SCOPE_ICONS[scope]}
                {SCOPE_LABELS[scope]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Default Value</label>
        <input
          type="text"
          value={data.defaultValue}
          onChange={(e) => onChange({ ...data, defaultValue: e.target.value })}
          placeholder={data.type === 'array' ? '[]' : data.type === 'object' ? '{}' : ''}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <input
          type="text"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Optional description"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={onSave}
          disabled={!data.name.trim()}
          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default VariablesPanel
