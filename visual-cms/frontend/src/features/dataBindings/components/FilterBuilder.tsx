import React, { useState } from 'react'
import type { FilterConfig, FilterOperator } from '@/shared/types/dataBinding'

interface FilterBuilderProps {
  filters: FilterConfig[]
  onChange: (filters: FilterConfig[]) => void
}

const FILTER_OPERATORS: { value: FilterOperator; label: string; description: string }[] = [
  { value: 'equals', label: '=', description: 'Равно' },
  { value: 'notEquals', label: '≠', description: 'Не равно' },
  { value: 'contains', label: '∋', description: 'Содержит' },
  { value: 'notContains', label: '∌', description: 'Не содержит' },
  { value: 'startsWith', label: 'A*', description: 'Начинается с' },
  { value: 'endsWith', label: '*A', description: 'Заканчивается на' },
  { value: 'greaterThan', label: '>', description: 'Больше' },
  { value: 'lessThan', label: '<', description: 'Меньше' },
  { value: 'greaterOrEqual', label: '≥', description: 'Больше или равно' },
  { value: 'lessOrEqual', label: '≤', description: 'Меньше или равно' },
  { value: 'between', label: '↔', description: 'Между (min,max)' },
  { value: 'in', label: '∈', description: 'В списке' },
  { value: 'notIn', label: '∉', description: 'Не в списке' },
  { value: 'exists', label: '∃', description: 'Существует' },
  { value: 'isEmpty', label: '∅', description: 'Пустое' },
  { value: 'regex', label: '.*', description: 'Регулярное выражение' },
]

/**
 * Компонент для построения фильтров данных
 */
export const FilterBuilder: React.FC<FilterBuilderProps> = ({ filters, onChange }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Генерация ID
  const generateId = () => `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Добавление фильтра
  const addFilter = () => {
    const newFilter: FilterConfig = {
      id: generateId(),
      field: '',
      operator: 'equals',
      value: '',
      isActive: true,
      valueSource: 'static',
    }
    onChange([...filters, newFilter])
    setExpandedId(newFilter.id)
  }

  // Обновление фильтра
  const updateFilter = (id: string, updates: Partial<FilterConfig>) => {
    onChange(filters.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  // Удаление фильтра
  const removeFilter = (id: string) => {
    onChange(filters.filter(f => f.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  // Переключение активности
  const toggleActive = (id: string) => {
    onChange(filters.map(f => f.id === id ? { ...f, isActive: !f.isActive } : f))
  }

  // Форматирование значения для отображения
  const formatValue = (filter: FilterConfig): string => {
    if (filter.valueSource === 'variable') {
      return `{{${filter.variableName}}}`
    }
    if (filter.valueSource === 'urlParam') {
      return `?${filter.paramName}`
    }
    if (filter.value === null || filter.value === undefined) {
      return ''
    }
    if (Array.isArray(filter.value)) {
      return filter.value.join(', ')
    }
    return String(filter.value)
  }

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Настройте фильтры для отбора данных из источника
        </p>
        <button
          onClick={addFilter}
          className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors"
        >
          + Добавить фильтр
        </button>
      </div>

      {/* Список фильтров */}
      {filters.length > 0 ? (
        <div className="space-y-2">
          {filters.map((filter, index) => (
            <div
              key={filter.id}
              className={`border rounded-lg transition-all ${
                !filter.isActive ? 'opacity-50' : ''
              } ${
                expandedId === filter.id
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {/* Компактный вид */}
              <div
                className="p-3 flex items-center gap-3 cursor-pointer"
                onClick={() => setExpandedId(expandedId === filter.id ? null : filter.id)}
              >
                {/* Checkbox активности */}
                <input
                  type="checkbox"
                  checked={filter.isActive !== false}
                  onChange={(e) => {
                    e.stopPropagation()
                    toggleActive(filter.id)
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />

                {/* Номер */}
                <span className="text-gray-400 text-sm">{index + 1}</span>

                {/* Описание фильтра */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="truncate text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                    {filter.field || 'поле'}
                  </span>
                  <span className="text-sm font-bold text-blue-600">
                    {FILTER_OPERATORS.find(op => op.value === filter.operator)?.label || filter.operator}
                  </span>
                  <span className="truncate text-sm font-mono bg-green-100 px-2 py-0.5 rounded">
                    {formatValue(filter) || 'значение'}
                  </span>
                  {filter.valueSource !== 'static' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      filter.valueSource === 'variable' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {filter.valueSource === 'variable' ? 'var' : 'url'}
                    </span>
                  )}
                </div>

                {/* Действия */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeFilter(filter.id) }}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Удалить"
                >
                  ✕
                </button>
              </div>

              {/* Расширенный вид */}
              {expandedId === filter.id && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-200 space-y-3">
                  {/* Поле */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Поле для фильтрации
                    </label>
                    <input
                      type="text"
                      value={filter.field}
                      onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                      placeholder="userId, status, user.role"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  {/* Оператор */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Оператор сравнения
                    </label>
                    <select
                      value={filter.operator}
                      onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {FILTER_OPERATORS.map(op => (
                        <option key={op.value} value={op.value}>
                          {op.label} — {op.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Источник значения */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Источник значения
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'static', label: 'Статическое' },
                        { value: 'variable', label: 'Переменная' },
                        { value: 'urlParam', label: 'URL параметр' },
                      ].map(src => (
                        <button
                          key={src.value}
                          onClick={() => updateFilter(filter.id, { 
                            valueSource: src.value as FilterConfig['valueSource']
                          })}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            filter.valueSource === src.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {src.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Значение */}
                  {filter.valueSource === 'static' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Значение
                        {(filter.operator === 'in' || filter.operator === 'notIn') && (
                          <span className="text-gray-400 ml-1">(через запятую)</span>
                        )}
                        {filter.operator === 'between' && (
                          <span className="text-gray-400 ml-1">(мин,макс)</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={Array.isArray(filter.value) ? filter.value.join(',') : String(filter.value || '')}
                        onChange={(e) => {
                          let newValue: unknown = e.target.value
                          if (filter.operator === 'in' || filter.operator === 'notIn' || filter.operator === 'between') {
                            newValue = e.target.value.split(',').map(v => v.trim())
                          }
                          updateFilter(filter.id, { value: newValue })
                        }}
                        placeholder={
                          filter.operator === 'in' || filter.operator === 'notIn'
                            ? 'value1, value2, value3'
                            : filter.operator === 'between'
                            ? '10, 100'
                            : 'значение'
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  )}

                  {filter.valueSource === 'variable' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Имя переменной
                      </label>
                      <input
                        type="text"
                        value={filter.variableName || ''}
                        onChange={(e) => updateFilter(filter.id, { variableName: e.target.value })}
                        placeholder="currentUserId"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Значение будет взято из контекста переменных
                      </p>
                    </div>
                  )}

                  {filter.valueSource === 'urlParam' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Имя URL параметра
                      </label>
                      <input
                        type="text"
                        value={filter.paramName || ''}
                        onChange={(e) => updateFilter(filter.id, { paramName: e.target.value })}
                        placeholder="id, category, page"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Значение будет взято из URL: ?{filter.paramName || 'param'}=value
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <div className="text-2xl mb-2">🔍</div>
          <p className="text-sm">Нет настроенных фильтров</p>
          <button
            onClick={addFilter}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            + Добавить первый фильтр
          </button>
        </div>
      )}
    </div>
  )
}
