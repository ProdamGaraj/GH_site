import React, { useState } from 'react'

/**
 * Типы переменных
 */
export type VariableScope = 'page' | 'global' | 'session'
export type VariableType = 'string' | 'number' | 'boolean' | 'array' | 'object'

/**
 * Определение переменной
 */
export interface VariableDefinition {
  id: string
  name: string                // Имя без префикса: productId, currentUser
  scope: VariableScope
  type: VariableType
  defaultValue?: unknown
  description?: string
  persist?: boolean           // Сохранять в localStorage (для session/global)
  reactive?: boolean          // Автообновление блоков при изменении
  readOnly?: boolean          // Только для чтения
}

/**
 * Конфигурация системы переменных
 */
export interface VariablesConfig {
  variables: VariableDefinition[]
}

interface VariablesEditorProps {
  config: VariablesConfig
  onChange: (config: VariablesConfig) => void
  scope?: VariableScope       // Фильтр по scope (для page-level редактора)
}

/**
 * Редактор системы переменных
 * 
 * Согласно ТЗ: Stage 3.6 Variables System
 * - Page Variables (доступны на текущей странице)
 * - Global Variables (доступны везде)
 * - Session Variables (живут до закрытия браузера)
 * - Реактивность: блоки автообновляются при изменении переменных
 */
export const VariablesEditor: React.FC<VariablesEditorProps> = ({
  config,
  onChange,
  scope
}) => {
  const [editingVariable, setEditingVariable] = useState<string | null>(null)
  const [filterScope, setFilterScope] = useState<VariableScope | 'all'>(scope || 'all')

  const filteredVariables = config.variables.filter(
    v => filterScope === 'all' || v.scope === filterScope
  )

  const addVariable = () => {
    const newVar: VariableDefinition = {
      id: `var_${Date.now()}`,
      name: 'newVariable',
      scope: scope || 'page',
      type: 'string',
      defaultValue: '',
      reactive: true,
      persist: false
    }

    onChange({
      ...config,
      variables: [...config.variables, newVar]
    })
    setEditingVariable(newVar.id)
  }

  const updateVariable = (id: string, updates: Partial<VariableDefinition>) => {
    onChange({
      ...config,
      variables: config.variables.map(v =>
        v.id === id ? { ...v, ...updates } : v
      )
    })
  }

  const removeVariable = (id: string) => {
    onChange({
      ...config,
      variables: config.variables.filter(v => v.id !== id)
    })
  }

  const duplicateVariable = (variable: VariableDefinition) => {
    const newVar: VariableDefinition = {
      ...variable,
      id: `var_${Date.now()}`,
      name: `${variable.name}_copy`
    }

    onChange({
      ...config,
      variables: [...config.variables, newVar]
    })
    setEditingVariable(newVar.id)
  }

  const getVariableFullName = (v: VariableDefinition): string => {
    const prefixes = { page: '$page.', global: '$global.', session: '$session.' }
    return prefixes[v.scope] + v.name
  }

  const getScopeColor = (s: VariableScope): string => {
    const colors = {
      page: 'bg-blue-100 text-blue-700',
      global: 'bg-purple-100 text-purple-700',
      session: 'bg-green-100 text-green-700'
    }
    return colors[s]
  }

  const getScopeIcon = (s: VariableScope): string => {
    const icons = { page: '📄', global: '🌐', session: '⏱️' }
    return icons[s]
  }

  const getTypeIcon = (t: VariableType): string => {
    const icons = {
      string: 'Aa',
      number: '#',
      boolean: '✓',
      array: '[]',
      object: '{}'
    }
    return icons[t]
  }

  const getDefaultValueInput = (variable: VariableDefinition) => {
    switch (variable.type) {
      case 'string':
        return (
          <input
            type="text"
            value={variable.defaultValue as string || ''}
            onChange={(e) => updateVariable(variable.id, { defaultValue: e.target.value })}
            placeholder="Default string value"
            className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        )
      case 'number':
        return (
          <input
            type="number"
            value={variable.defaultValue as number || 0}
            onChange={(e) => updateVariable(variable.id, { defaultValue: parseFloat(e.target.value) || 0 })}
            className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        )
      case 'boolean':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={variable.defaultValue as boolean || false}
              onChange={(e) => updateVariable(variable.id, { defaultValue: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">
              {variable.defaultValue ? 'true' : 'false'}
            </span>
          </label>
        )
      case 'array':
      case 'object':
        return (
          <textarea
            value={JSON.stringify(variable.defaultValue || (variable.type === 'array' ? [] : {}), null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                updateVariable(variable.id, { defaultValue: parsed })
              } catch {
                // Invalid JSON, ignore
              }
            }}
            rows={3}
            placeholder={variable.type === 'array' ? '["item1", "item2"]' : '{"key": "value"}'}
            className="w-full text-sm font-mono border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        )
      default:
        return null
    }
  }

  const validateName = (name: string, currentId: string): string | null => {
    if (!name) return 'Name is required'
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      return 'Name must start with letter, contain only letters, numbers, underscores'
    }
    const duplicate = config.variables.find(
      v => v.name === name && v.id !== currentId && v.scope === config.variables.find(x => x.id === currentId)?.scope
    )
    if (duplicate) return 'Variable name already exists in this scope'
    return null
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Variables</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Define variables for dynamic data and state management
          </p>
        </div>
        <button
          onClick={addVariable}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Variable
        </button>
      </div>

      {/* Scope Filter */}
      {!scope && (
        <div className="flex gap-2">
          {(['all', 'page', 'global', 'session'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterScope(s)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filterScope === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'All' : (
                <>
                  {getScopeIcon(s)} {s.charAt(0).toUpperCase() + s.slice(1)}
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Variables List */}
      {filteredVariables.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p className="mt-2 text-sm text-gray-500">No variables defined</p>
          <p className="text-xs text-gray-400">Click "Add Variable" to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredVariables.map(variable => (
            <div
              key={variable.id}
              className={`p-3 rounded-lg border transition-colors ${
                editingVariable === variable.id
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Variable Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Type badge */}
                  <span className="w-7 h-7 flex items-center justify-center text-xs font-mono font-medium text-gray-500 bg-gray-100 rounded">
                    {getTypeIcon(variable.type)}
                  </span>

                  {/* Full name */}
                  <code className={`px-2 py-0.5 text-sm font-mono rounded ${getScopeColor(variable.scope)}`}>
                    {getVariableFullName(variable)}
                  </code>

                  {/* Badges */}
                  {variable.reactive && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 rounded">
                      REACTIVE
                    </span>
                  )}
                  {variable.readOnly && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-700 bg-gray-100 rounded">
                      READ-ONLY
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => duplicateVariable(variable)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Duplicate"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingVariable(editingVariable === variable.id ? null : variable.id)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {editingVariable === variable.id ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={() => removeVariable(variable.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Description */}
              {variable.description && !editingVariable && (
                <p className="mt-1 text-xs text-gray-500 ml-9">{variable.description}</p>
              )}

              {/* Expanded Editor */}
              {editingVariable === variable.id && (
                <div className="mt-4 space-y-4 pt-3 border-t border-gray-200">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Variable Name
                    </label>
                    <input
                      type="text"
                      value={variable.name}
                      onChange={(e) => updateVariable(variable.id, { name: e.target.value })}
                      placeholder="variableName"
                      className={`w-full text-sm font-mono border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 ${
                        validateName(variable.name, variable.id) ? 'border-red-300' : ''
                      }`}
                    />
                    {validateName(variable.name, variable.id) && (
                      <p className="mt-1 text-xs text-red-600">
                        {validateName(variable.name, variable.id)}
                      </p>
                    )}
                  </div>

                  {/* Scope */}
                  {!scope && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Scope
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['page', 'global', 'session'] as VariableScope[]).map(s => (
                          <button
                            key={s}
                            onClick={() => updateVariable(variable.id, { scope: s })}
                            className={`p-2 text-center rounded-lg border transition-colors ${
                              variable.scope === s
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="text-lg">{getScopeIcon(s)}</span>
                            <span className="block text-xs mt-0.5 capitalize">{s}</span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {variable.scope === 'page' && 'Available only on this page'}
                        {variable.scope === 'global' && 'Available across all pages'}
                        {variable.scope === 'session' && 'Persists until browser is closed'}
                      </p>
                    </div>
                  )}

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {(['string', 'number', 'boolean', 'array', 'object'] as VariableType[]).map(t => (
                        <button
                          key={t}
                          onClick={() => updateVariable(variable.id, { type: t, defaultValue: undefined })}
                          className={`p-2 text-center rounded-lg border transition-colors ${
                            variable.type === t
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="font-mono text-sm">{getTypeIcon(t)}</span>
                          <span className="block text-[10px] mt-0.5 capitalize">{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Default Value */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Value
                    </label>
                    {getDefaultValueInput(variable)}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={variable.description || ''}
                      onChange={(e) => updateVariable(variable.id, { description: e.target.value })}
                      placeholder="What is this variable for?"
                      className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Reactive</span>
                        <p className="text-xs text-gray-500">Auto-update blocks when this variable changes</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={variable.reactive}
                        onChange={(e) => updateVariable(variable.id, { reactive: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>

                    {(variable.scope === 'global' || variable.scope === 'session') && (
                      <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="text-sm font-medium text-gray-700">Persist to Storage</span>
                          <p className="text-xs text-gray-500">Save to localStorage for persistence</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={variable.persist}
                          onChange={(e) => updateVariable(variable.id, { persist: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </label>
                    )}

                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Read-Only</span>
                        <p className="text-xs text-gray-500">Prevent modification after initialization</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={variable.readOnly}
                        onChange={(e) => updateVariable(variable.id, { readOnly: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Usage Examples */}
      {filteredVariables.length > 0 && (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Usage in blocks:</h4>
          <div className="space-y-2 text-xs">
            <div>
              <span className="font-medium text-gray-600">Read:</span>
              <code className="ml-2 px-1.5 py-0.5 bg-gray-200 rounded">
                {'{'}$page.variableName{'}'}
              </code>
            </div>
            <div>
              <span className="font-medium text-gray-600">Write (on click):</span>
              <code className="ml-2 px-1.5 py-0.5 bg-gray-200 rounded">
                $page.counter = $page.counter + 1
              </code>
            </div>
            <div>
              <span className="font-medium text-gray-600">Conditional:</span>
              <code className="ml-2 px-1.5 py-0.5 bg-gray-200 rounded">
                {'{'}$page.isLoggedIn ? 'Welcome' : 'Login'{'}'}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VariablesEditor
