/**
 * VariableWatcher
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 6.2: Мониторинг переменных в реальном времени
 * 
 * Компонент для наблюдения за изменениями переменных во время редактирования.
 */

import React, { useState, useMemo } from 'react'
import { Minimize2, Maximize2, Filter, RefreshCw, Eye } from 'lucide-react'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { 
  selectAllValues, 
  selectPageVariables, 
  selectGlobalVariables,
  resetPageVariables,
  type PageVariable,
} from '../index'
import { VariableValueDisplay } from './VariableValueDisplay'

// ==================== TYPES ====================

interface VariableWatcherProps {
  pageId: string
  defaultExpanded?: boolean
}

type FilterMode = 'all' | 'changed' | 'page' | 'session' | 'global'

// ==================== COMPONENT ====================

export const VariableWatcher: React.FC<VariableWatcherProps> = ({
  pageId,
  defaultExpanded = false,
}) => {
  const dispatch = useAppDispatch()
  
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  
  const allValues = useAppSelector(selectAllValues)
  // selectPageVariables is a factory selector: selectPageVariables(pageId) returns a selector
  const pageVariablesSelector = useMemo(() => selectPageVariables(pageId), [pageId])
  const pageVariables = useAppSelector(pageVariablesSelector)
  const globalVariables = useAppSelector(selectGlobalVariables)

  // Combine all variables with their current values
  const variablesWithValues = useMemo(() => {
    const result: Array<{
      definition: PageVariable
      currentValue: unknown
      hasChanged: boolean
    }> = []

    // Page and session variables
    pageVariables.forEach((v: PageVariable) => {
      const valueEntry = allValues[v.id]
      const currentValue = valueEntry?.value ?? v.defaultValue
      const hasChanged = JSON.stringify(currentValue) !== JSON.stringify(v.defaultValue)
      result.push({ definition: v, currentValue, hasChanged })
    })

    // Global variables
    globalVariables.forEach((v: PageVariable) => {
      const valueEntry = allValues[v.id]
      const currentValue = valueEntry?.value ?? v.defaultValue
      const hasChanged = JSON.stringify(currentValue) !== JSON.stringify(v.defaultValue)
      result.push({ definition: v, currentValue, hasChanged })
    })

    return result
  }, [pageVariables, globalVariables, allValues])

  // Filter variables
  const filteredVariables = useMemo(() => {
    switch (filterMode) {
      case 'changed':
        return variablesWithValues.filter((v) => v.hasChanged)
      case 'page':
        return variablesWithValues.filter((v) => v.definition.scope === 'page')
      case 'session':
        return variablesWithValues.filter((v) => v.definition.scope === 'session')
      case 'global':
        return variablesWithValues.filter((v) => v.definition.scope === 'global')
      default:
        return variablesWithValues
    }
  }, [variablesWithValues, filterMode])

  // Stats
  const changedCount = variablesWithValues.filter((v) => v.hasChanged).length
  const totalCount = variablesWithValues.length

  const handleResetAll = () => {
    if (confirm('Reset all variables to their default values?')) {
      dispatch(resetPageVariables(pageId))
    }
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg shadow-lg hover:bg-purple-700 z-50"
      >
        <Eye className="w-4 h-4" />
        <span className="text-sm font-medium">Variables</span>
        {changedCount > 0 && (
          <span className="px-1.5 py-0.5 bg-white/20 rounded text-xs">
            {changedCount}
          </span>
        )}
        <Maximize2 className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-purple-500" />
          <span className="font-medium text-sm text-gray-700">Variable Watcher</span>
          <span className="text-xs text-gray-400">
            {changedCount}/{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleResetAll}
            className="p-1 text-gray-400 hover:text-orange-500"
            title="Reset all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-100">
        <Filter className="w-3 h-3 text-gray-400" />
        {(['all', 'changed', 'page', 'session', 'global'] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            className={`px-2 py-0.5 text-xs rounded ${
              filterMode === mode
                ? 'bg-purple-100 text-purple-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
            {mode === 'changed' && changedCount > 0 && (
              <span className="ml-1 text-purple-500">({changedCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* Variables List */}
      <div className="max-h-64 overflow-auto">
        {filteredVariables.length === 0 ? (
          <div className="px-3 py-4 text-center text-gray-400 text-sm">
            {filterMode === 'changed' ? 'No changed variables' : 'No variables'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredVariables.map(({ definition, hasChanged }) => (
              <div 
                key={definition.id}
                className={`px-3 py-2 ${hasChanged ? 'bg-yellow-50' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs font-medium text-gray-800">{definition.name}</code>
                  <span className="text-xs text-gray-400">{definition.scope}</span>
                  {hasChanged && (
                    <span className="px-1 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded">
                      changed
                    </span>
                  )}
                </div>
                <VariableValueDisplay
                  pageId={pageId}
                  variableName={definition.name}
                  compact
                  showType={false}
                  editable={false}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default VariableWatcher
