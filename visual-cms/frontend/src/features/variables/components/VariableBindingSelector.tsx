/**
 * VariableBindingSelector
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 6.2: Variable Binding в блоках
 * 
 * Компонент для выбора переменной и привязки к свойству блока.
 */

import React, { useState, useMemo } from 'react'
import { Variable, ChevronDown, Link, Unlink, Globe, FileText, Clock } from 'lucide-react'
import { useAppSelector } from '@/app/hooks'
import { selectPageVariables, selectGlobalVariables, type PageVariable, type VariableScope } from '../index'

// ==================== TYPES ====================

interface VariableBindingSelectorProps {
  pageId: string
  value?: string // Имя переменной
  onChange: (variableName: string | null) => void
  filterType?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any'
  placeholder?: string
  compact?: boolean
}

interface VariableOption {
  variable: PageVariable
  scope: VariableScope
}

// ==================== CONSTANTS ====================

const SCOPE_ICONS: Record<VariableScope, React.ReactNode> = {
  page: <FileText className="w-3 h-3" />,
  session: <Clock className="w-3 h-3" />,
  global: <Globe className="w-3 h-3" />,
}

const SCOPE_COLORS: Record<VariableScope, string> = {
  page: 'text-blue-500',
  session: 'text-orange-500',
  global: 'text-purple-500',
}

// ==================== COMPONENT ====================

export const VariableBindingSelector: React.FC<VariableBindingSelectorProps> = ({
  pageId,
  value,
  onChange,
  filterType,
  placeholder = 'Select variable...',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  
  // selectPageVariables is a factory selector: selectPageVariables(pageId) returns a selector
  const pageVariablesSelector = useMemo(() => selectPageVariables(pageId), [pageId])
  const pageVariables = useAppSelector(pageVariablesSelector)
  const globalVariables = useAppSelector(selectGlobalVariables)

  // Combine and optionally filter variables
  const allVariables: VariableOption[] = useMemo(() => {
    const result: VariableOption[] = []
    
    pageVariables.forEach((v: PageVariable) => {
      if (!filterType || v.type === filterType || v.type === 'any') {
        result.push({ variable: v, scope: v.scope })
      }
    })
    
    globalVariables.forEach((v: PageVariable) => {
      if (!filterType || v.type === filterType || v.type === 'any') {
        result.push({ variable: v, scope: 'global' })
      }
    })
    
    return result
  }, [pageVariables, globalVariables, filterType])

  // Find selected variable
  const selectedVariable = value 
    ? allVariables.find((opt) => opt.variable.name === value)
    : null

  const handleSelect = (opt: VariableOption | null) => {
    onChange(opt?.variable.name ?? null)
    setIsOpen(false)
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded border ${
            value 
              ? 'bg-purple-50 border-purple-200 text-purple-700' 
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Variable className="w-3 h-3" />
          {selectedVariable ? (
            <>
              <span className={SCOPE_COLORS[selectedVariable.scope]}>
                {SCOPE_ICONS[selectedVariable.scope]}
              </span>
              <code className="font-medium">{value}</code>
            </>
          ) : (
            <span>Bind</span>
          )}
        </button>

        {isOpen && (
          <VariableDropdown
            options={allVariables}
            selectedName={value}
            onSelect={handleSelect}
            onClose={() => setIsOpen(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
          value
            ? 'bg-purple-50 border-purple-200 hover:bg-purple-100'
            : 'bg-white border-gray-300 hover:bg-gray-50'
        }`}
      >
        <Variable className={`w-4 h-4 ${value ? 'text-purple-500' : 'text-gray-400'}`} />
        
        <div className="flex-1 text-left">
          {selectedVariable ? (
            <div className="flex items-center gap-2">
              <span className={SCOPE_COLORS[selectedVariable.scope]}>
                {SCOPE_ICONS[selectedVariable.scope]}
              </span>
              <code className="font-medium text-purple-700">{value}</code>
              <span className="text-gray-400 text-xs">({selectedVariable.variable.type})</span>
            </div>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>

        {value ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
            className="p-1 hover:bg-purple-200 rounded"
          >
            <Unlink className="w-4 h-4 text-purple-400" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <VariableDropdown
          options={allVariables}
          selectedName={value}
          onSelect={handleSelect}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

// ==================== SUB-COMPONENTS ====================

interface VariableDropdownProps {
  options: VariableOption[]
  selectedName?: string
  onSelect: (opt: VariableOption | null) => void
  onClose: () => void
}

const VariableDropdown: React.FC<VariableDropdownProps> = ({
  options,
  selectedName,
  onSelect,
  onClose,
}) => {
  // Group by scope
  const grouped = useMemo(() => {
    const result: Record<VariableScope, VariableOption[]> = {
      page: [],
      session: [],
      global: [],
    }
    options.forEach((opt) => {
      result[opt.scope].push(opt)
    })
    return result
  }, [options])

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />

      {/* Dropdown */}
      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-auto">
        {options.length === 0 ? (
          <div className="px-3 py-4 text-center text-gray-400 text-sm">
            No variables available
          </div>
        ) : (
          <>
            {/* Clear option */}
            {selectedName && (
              <button
                onClick={() => onSelect(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 border-b"
              >
                <Unlink className="w-4 h-4" />
                Clear binding
              </button>
            )}

            {/* Page variables */}
            {grouped.page.length > 0 && (
              <div>
                <div className="px-3 py-1 text-xs font-medium text-gray-400 bg-gray-50 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Page Variables
                </div>
                {grouped.page.map((opt) => (
                  <VariableOptionItem
                    key={opt.variable.id}
                    option={opt}
                    isSelected={opt.variable.name === selectedName}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}

            {/* Session variables */}
            {grouped.session.length > 0 && (
              <div>
                <div className="px-3 py-1 text-xs font-medium text-gray-400 bg-gray-50 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Session Variables
                </div>
                {grouped.session.map((opt) => (
                  <VariableOptionItem
                    key={opt.variable.id}
                    option={opt}
                    isSelected={opt.variable.name === selectedName}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}

            {/* Global variables */}
            {grouped.global.length > 0 && (
              <div>
                <div className="px-3 py-1 text-xs font-medium text-gray-400 bg-gray-50 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Global Variables
                </div>
                {grouped.global.map((opt) => (
                  <VariableOptionItem
                    key={opt.variable.id}
                    option={opt}
                    isSelected={opt.variable.name === selectedName}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

interface VariableOptionItemProps {
  option: VariableOption
  isSelected: boolean
  onSelect: (opt: VariableOption) => void
}

const VariableOptionItem: React.FC<VariableOptionItemProps> = ({
  option,
  isSelected,
  onSelect,
}) => {
  return (
    <button
      onClick={() => onSelect(option)}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
        isSelected ? 'bg-purple-50' : ''
      }`}
    >
      <Link className={`w-4 h-4 ${isSelected ? 'text-purple-500' : 'text-gray-300'}`} />
      <code className="font-medium text-gray-800">{option.variable.name}</code>
      <span className="text-gray-400 text-xs ml-auto">{option.variable.type}</span>
    </button>
  )
}

export default VariableBindingSelector
