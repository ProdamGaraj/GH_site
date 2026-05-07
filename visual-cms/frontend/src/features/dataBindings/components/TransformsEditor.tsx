/**
 * TransformsEditor
 * 
 * Компонент для настройки серверных трансформаций данных:
 * - Статические фильтры (exclude/include)
 * - Добавление элементов (prepend/append)
 * - Сортировка
 * - Лимит
 * - Уникальность
 * - Динамические фильтры (связь с блоками)
 */

import React, { useState } from 'react'
import type { 
  DataTransform,
  ExcludeTransform,
  IncludeTransform,
  PrependTransform,
  AppendTransform,
  SortTransform,
  LimitTransform,
  UniqueTransform,
  TransformFilterOperator,
  DynamicFilter
} from '@/shared/types/transforms'
import { useAppSelector } from '@/app/hooks'
import { selectRootNode } from '@/features/editor/editorSlice'
import type { BlockNode } from '@/shared/types'

// ============ Типы ============

interface InputElementInfo {
  id: string
  path: string
  name: string
  type: string // tagName or elementType
  depth: number
}

interface TransformsEditorProps {
  transforms: DataTransform[]
  onChange: (transforms: DataTransform[]) => void
  dynamicFilters?: DynamicFilter[]
  onDynamicFiltersChange?: (filters: DynamicFilter[]) => void
}

// ============ Константы ============

const TRANSFORM_TYPES: { value: DataTransform['type']; label: string; icon: string; description: string }[] = [
  { value: 'include', label: 'Include', icon: '✓', description: 'Оставить только записи по условию' },
  { value: 'exclude', label: 'Exclude', icon: '✕', description: 'Исключить записи по условию' },
  { value: 'sort', label: 'Sort', icon: '↕', description: 'Сортировка' },
  { value: 'limit', label: 'Limit', icon: '#', description: 'Ограничить количество' },
  { value: 'unique', label: 'Unique', icon: '◎', description: 'Убрать дубликаты' },
  { value: 'prepend', label: 'Prepend', icon: '⬆', description: 'Добавить в начало' },
  { value: 'append', label: 'Append', icon: '⬇', description: 'Добавить в конец' },
]

const FILTER_OPERATORS: { value: TransformFilterOperator; label: string }[] = [
  { value: 'eq', label: '= равно' },
  { value: 'neq', label: '≠ не равно' },
  { value: 'contains', label: '∋ содержит' },
  { value: 'notContains', label: '∌ не содержит' },
  { value: 'startsWith', label: 'начинается с' },
  { value: 'endsWith', label: 'заканчивается на' },
  { value: 'gt', label: '> больше' },
  { value: 'gte', label: '≥ больше или равно' },
  { value: 'lt', label: '< меньше' },
  { value: 'lte', label: '≤ меньше или равно' },
  { value: 'in', label: '∈ в списке' },
  { value: 'notIn', label: '∉ не в списке' },
  { value: 'exists', label: '∃ существует' },
  { value: 'isEmpty', label: '∅ пустое' },
]

// ============ Утилиты ============

const generateId = () => `transform-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

/**
 * Собирает все элементы, которые могут быть источником значений (input, select, textarea и т.д.)
 * Рекурсивно обходит дерево блоков включая вложенные
 */
const collectInputElements = (node: BlockNode | null, path: string = '', depth: number = 0): InputElementInfo[] => {
  if (!node) return []
  
  const results: InputElementInfo[] = []
  
  // Типы элементов которые могут содержать value
  const inputTypes = ['input', 'select', 'textarea', 'button']
  const inputElementTypes = ['input', 'button']
  
  const isInputElement = 
    inputTypes.includes(node.tagName?.toLowerCase() || '') ||
    inputElementTypes.includes(node.elementType)
  
  const nodeName = node.metadata?.name || node.tagName || node.elementType
  const currentPath = path ? `${path} > ${nodeName}` : nodeName
  
  if (isInputElement) {
    results.push({
      id: node.id,
      path: currentPath,
      name: node.metadata?.name || `${node.tagName || node.elementType} (${node.id.slice(-6)})`,
      type: node.tagName || node.elementType,
      depth
    })
  }
  
  // Рекурсивно обходим детей
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      results.push(...collectInputElements(child, currentPath, depth + 1))
    }
  }
  
  return results
}

/**
 * Собирает ВСЕ блоки для возможности выбора любого элемента
 */
const collectAllElements = (node: BlockNode | null, path: string = '', depth: number = 0): InputElementInfo[] => {
  if (!node) return []
  
  const results: InputElementInfo[] = []
  
  const nodeName = node.metadata?.name || node.tagName || node.elementType
  const currentPath = path ? `${path} > ${nodeName}` : nodeName
  
  results.push({
    id: node.id,
    path: currentPath,
    name: node.metadata?.name || `${node.tagName || node.elementType} (${node.id.slice(-6)})`,
    type: node.tagName || node.elementType,
    depth
  })
  
  // Рекурсивно обходим детей
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      results.push(...collectAllElements(child, currentPath, depth + 1))
    }
  }
  
  return results
}

// ============ Компонент ============

export const TransformsEditor: React.FC<TransformsEditorProps> = ({
  transforms,
  onChange,
  dynamicFilters = [],
  onDynamicFiltersChange
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingType, setAddingType] = useState<DataTransform['type'] | null>(null)
  const [showAllElements, setShowAllElements] = useState(false)
  const rootNode = useAppSelector(selectRootNode)
  
  // Собираем элементы из текущей структуры
  const inputElements = React.useMemo(() => collectInputElements(rootNode), [rootNode])
  const allElements = React.useMemo(() => collectAllElements(rootNode), [rootNode])
  const availableElements = showAllElements ? allElements : inputElements

  // Debug: логируем изменения transforms
  React.useEffect(() => {
    console.log('🔄 TransformsEditor - transforms changed:', transforms)
    console.log('🔄 TransformsEditor - dynamicFilters changed:', dynamicFilters)
  }, [transforms, dynamicFilters])

  // ============ Handlers ============

  const addTransform = (type: DataTransform['type']) => {
    console.log('➕ Adding transform of type:', type)
    let newTransform: DataTransform

    switch (type) {
      case 'include':
        newTransform = {
          id: generateId(),
          type: 'include',
          enabled: true,
          filter: { field: '', operator: 'eq', value: '' }
        } as IncludeTransform
        break
      case 'exclude':
        newTransform = {
          id: generateId(),
          type: 'exclude',
          enabled: true,
          filter: { field: '', operator: 'eq', value: '' }
        } as ExcludeTransform
        break
      case 'sort':
        newTransform = {
          id: generateId(),
          type: 'sort',
          enabled: true,
          field: '',
          order: 'asc'
        } as SortTransform
        break
      case 'limit':
        newTransform = {
          id: generateId(),
          type: 'limit',
          enabled: true,
          limit: 10
        } as LimitTransform
        break
      case 'unique':
        newTransform = {
          id: generateId(),
          type: 'unique',
          enabled: true,
          field: '',
          keepFirst: true
        } as UniqueTransform
        break
      case 'prepend':
        newTransform = {
          id: generateId(),
          type: 'prepend',
          enabled: true,
          staticItems: []
        } as PrependTransform
        break
      case 'append':
        newTransform = {
          id: generateId(),
          type: 'append',
          enabled: true,
          staticItems: []
        } as AppendTransform
        break
      default:
        return
    }

    onChange([...transforms, newTransform])
    console.log('➕ Transform added, new list:', [...transforms, newTransform])
    setExpandedId(newTransform.id)
    setAddingType(null)
  }

  const updateTransform = (id: string, updates: Partial<DataTransform>) => {
    const updated = transforms.map(t => 
      t.id === id ? { ...t, ...updates } as DataTransform : t
    )
    console.log('✏️ Transform updated:', id, updates, 'Result:', updated)
    onChange(updated)
  }

  const removeTransform = (id: string) => {
    onChange(transforms.filter(t => t.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const toggleEnabled = (id: string) => {
    onChange(transforms.map(t => 
      t.id === id ? { ...t, enabled: !t.enabled } as DataTransform : t
    ))
  }

  const moveTransform = (id: string, direction: 'up' | 'down') => {
    const index = transforms.findIndex(t => t.id === id)
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === transforms.length - 1)
    ) return

    const newTransforms = [...transforms]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newTransforms[index], newTransforms[targetIndex]] = [newTransforms[targetIndex], newTransforms[index]]
    onChange(newTransforms)
  }

  // ============ Dynamic Filters ============

  const addDynamicFilter = () => {
    if (!onDynamicFiltersChange) return
    
    const newFilter: DynamicFilter = {
      id: generateId(),
      sourceBlockId: '',
      field: '',
      operator: 'eq',
      skipIfEmpty: true
    }
    onDynamicFiltersChange([...dynamicFilters, newFilter])
  }

  const updateDynamicFilter = (id: string, updates: Partial<DynamicFilter>) => {
    if (!onDynamicFiltersChange) return
    onDynamicFiltersChange(dynamicFilters.map(f => 
      f.id === id ? { ...f, ...updates } : f
    ))
  }

  const removeDynamicFilter = (id: string) => {
    if (!onDynamicFiltersChange) return
    onDynamicFiltersChange(dynamicFilters.filter(f => f.id !== id))
  }

  // ============ Render ============

  const getTransformLabel = (t: DataTransform): string => {
    switch (t.type) {
      case 'include':
      case 'exclude': {
        const v = Array.isArray(t.filter.value)
          ? t.filter.value.length <= 3
            ? `[${t.filter.value.join(', ')}]`
            : `[${t.filter.value.length} значений]`
          : String(t.filter.value ?? '')
        return `${t.filter.field} ${t.filter.operator} ${v}`
      }
      case 'sort':
        return `${t.field} ${t.order}`
      case 'limit':
        return `${t.limit}${t.offset ? ` offset ${t.offset}` : ''}`
      case 'unique':
        return t.field
      case 'prepend':
      case 'append':
        return `${t.staticItems.length} items`
      default:
        return ''
    }
  }

  const renderTransformEditor = (transform: DataTransform) => {
    switch (transform.type) {
      case 'include':
      case 'exclude': {
        const isMultiValue = transform.filter.operator === 'in' || transform.filter.operator === 'notIn'
        const isUnary = transform.filter.operator === 'exists' || transform.filter.operator === 'isEmpty'

        // Для in/notIn значение хранится как массив. Отображаем как CSV.
        const displayValue = Array.isArray(transform.filter.value)
          ? transform.filter.value.join(', ')
          : String(transform.filter.value ?? '')

        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={transform.filter.field}
                onChange={(e) => updateTransform(transform.id, {
                  filter: { ...transform.filter, field: e.target.value }
                })}
                placeholder="Поле"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
              />
              <select
                value={transform.filter.operator}
                onChange={(e) => {
                  const newOp = e.target.value as TransformFilterOperator
                  const wasMulti = transform.filter.operator === 'in' || transform.filter.operator === 'notIn'
                  const becomesMulti = newOp === 'in' || newOp === 'notIn'
                  // Конвертируем value при смене типа оператора, чтобы не потерять данные
                  let nextValue: unknown = transform.filter.value
                  if (becomesMulti && !wasMulti && typeof nextValue === 'string') {
                    nextValue = nextValue
                      .split(',')
                      .map(v => v.trim())
                      .filter(v => v.length > 0)
                  } else if (!becomesMulti && wasMulti && Array.isArray(nextValue)) {
                    nextValue = nextValue.join(', ')
                  }
                  updateTransform(transform.id, {
                    filter: { ...transform.filter, operator: newOp, value: nextValue }
                  })
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
              >
                {FILTER_OPERATORS.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              {!isUnary && (
                isMultiValue ? (
                  <textarea
                    value={displayValue}
                    onChange={(e) => updateTransform(transform.id, {
                      filter: {
                        ...transform.filter,
                        value: e.target.value
                          .split(/[,\n;]/)
                          .map(v => v.trim())
                          .filter(v => v.length > 0)
                      }
                    })}
                    placeholder="value1, value2, value3"
                    rows={1}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 font-mono resize-y min-h-[40px]"
                  />
                ) : (
                  <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => updateTransform(transform.id, {
                      filter: { ...transform.filter, value: e.target.value }
                    })}
                    placeholder="Значение"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                  />
                )
              )}
            </div>
            {isMultiValue && (
              <p className="text-xs text-gray-500">
                Введите несколько значений через запятую, точку с запятой или с новой строки. Сохраняется как массив.
                {Array.isArray(transform.filter.value) && (
                  <span className="ml-1 text-gray-700 font-medium">
                    Сейчас: {transform.filter.value.length} зн.
                  </span>
                )}
              </p>
            )}
          </div>
        )
      }

      case 'sort':
        return (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={transform.field}
              onChange={(e) => updateTransform(transform.id, { field: e.target.value })}
              placeholder="Поле для сортировки"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
            />
            <select
              value={transform.order}
              onChange={(e) => updateTransform(transform.id, { order: e.target.value as 'asc' | 'desc' })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
            >
              <option value="asc">По возрастанию (A-Z)</option>
              <option value="desc">По убыванию (Z-A)</option>
            </select>
          </div>
        )

      case 'limit':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Лимит</label>
              <input
                type="number"
                min="1"
                value={transform.limit}
                onChange={(e) => updateTransform(transform.id, { limit: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Offset (опционально)</label>
              <input
                type="number"
                min="0"
                value={transform.offset || 0}
                onChange={(e) => updateTransform(transform.id, { offset: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
              />
            </div>
          </div>
        )

      case 'unique':
        return (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={transform.field}
              onChange={(e) => updateTransform(transform.id, { field: e.target.value })}
              placeholder="Поле для уникальности"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={transform.keepFirst ?? true}
                onChange={(e) => updateTransform(transform.id, { keepFirst: e.target.checked })}
                className="w-4 h-4"
              />
              Оставлять первый дубликат
            </label>
          </div>
        )

      case 'prepend':
      case 'append':
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              JSON элементы для добавления {transform.type === 'prepend' ? 'в начало' : 'в конец'}:
            </p>
            <textarea
              value={JSON.stringify(transform.staticItems, null, 2)}
              onChange={(e) => {
                try {
                  const items = JSON.parse(e.target.value)
                  if (Array.isArray(items)) {
                    updateTransform(transform.id, { staticItems: items })
                  }
                } catch {
                  // Ignore invalid JSON during typing
                }
              }}
              placeholder='[{ "id": "static-1", "title": "..." }]'
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono bg-white text-gray-900"
            />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-800">Серверные трансформации</h4>
          <p className="text-sm text-gray-500">
            Трансформации применяются на бэкенде после загрузки данных из источника
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setAddingType(addingType ? null : 'include')}
            className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors"
          >
            + Добавить
          </button>
          
          {/* Dropdown menu */}
          {addingType !== null && (
            <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {TRANSFORM_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => addTransform(type.value)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                >
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-sm">
                    {type.icon}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{type.label}</div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transforms List */}
      {transforms.length > 0 ? (
        <div className="space-y-2">
          {transforms.map((transform, index) => {
            const typeInfo = TRANSFORM_TYPES.find(t => t.value === transform.type)
            const isExpanded = expandedId === transform.id

            return (
              <div
                key={transform.id}
                className={`border rounded-lg transition-all ${
                  !transform.enabled ? 'opacity-50' : ''
                } ${
                  isExpanded ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
              >
                {/* Header */}
                <div
                  className="p-3 flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : transform.id)}
                >
                  {/* Enable toggle */}
                  <input
                    type="checkbox"
                    checked={transform.enabled ?? true}
                    onChange={(e) => {
                      e.stopPropagation()
                      toggleEnabled(transform.id)
                    }}
                    className="w-4 h-4"
                  />

                  {/* Type icon */}
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-sm">
                    {typeInfo?.icon}
                  </span>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {typeInfo?.label}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {getTransformLabel(transform)}
                    </div>
                  </div>

                  {/* Order number */}
                  <span className="text-xs text-gray-400">#{index + 1}</span>

                  {/* Move buttons */}
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveTransform(transform.id, 'up') }}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveTransform(transform.id, 'down') }}
                      disabled={index === transforms.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTransform(transform.id) }}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    ✕
                  </button>

                  {/* Expand arrow */}
                  <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>

                {/* Editor (expanded) */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-gray-200">
                    <div className="pt-3">
                      {renderTransformEditor(transform)}
                    </div>
                    
                    {/* Description */}
                    <div className="mt-3">
                      <input
                        type="text"
                        value={transform.description || ''}
                        onChange={(e) => updateTransform(transform.id, { description: e.target.value })}
                        placeholder="Описание (опционально)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <div className="text-2xl mb-2">⚙️</div>
          <p>Нет трансформаций</p>
          <p className="text-sm">Добавьте трансформации для обработки данных на сервере</p>
        </div>
      )}

      {/* Dynamic Filters Section */}
      {onDynamicFiltersChange && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium text-gray-800">Динамические фильтры</h4>
              <p className="text-sm text-gray-500">
                Связь с элементами ввода на странице (значение берётся в реальном времени)
              </p>
            </div>
            <button
              onClick={addDynamicFilter}
              className="px-3 py-1.5 bg-purple-100 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-200 transition-colors"
            >
              + Добавить фильтр
            </button>
          </div>

          {/* Переключатель: показывать все элементы или только input */}
          {dynamicFilters.length > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllElements}
                  onChange={(e) => setShowAllElements(e.target.checked)}
                  className="w-3 h-3"
                />
                Показать все элементы (не только input/select)
              </label>
              <span className="text-xs text-gray-400">
                ({availableElements.length} элементов)
              </span>
            </div>
          )}

          {dynamicFilters.length > 0 ? (
            <div className="space-y-3">
              {dynamicFilters.map(filter => {
                const selectedElement = availableElements.find(e => e.id === filter.sourceBlockId)
                
                return (
                  <div key={filter.id} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    {/* Кнопка удаления в правом верхнем углу */}
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-purple-700">Динамический фильтр</span>
                      <button
                        onClick={() => removeDynamicFilter(filter.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
                        title="Удалить фильтр"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Поля в вертикальном layout */}
                    <div className="space-y-2">
                      {/* Элемент-источник значения */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Элемент-источник (откуда брать значение)</label>
                        <select
                          value={filter.sourceBlockId}
                          onChange={(e) => updateDynamicFilter(filter.id, { sourceBlockId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                        >
                          <option value="">Выберите элемент...</option>
                          {availableElements.map(el => (
                            <option key={el.id} value={el.id}>
                              {'  '.repeat(el.depth)}{el.name} [{el.type}]
                            </option>
                          ))}
                        </select>
                        {selectedElement && (
                          <div className="mt-1 text-xs text-purple-600">
                            Путь: {selectedElement.path}
                          </div>
                        )}
                      </div>
                      
                      {/* Field - поле данных для фильтрации */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Поле данных (что фильтровать)</label>
                        <input
                          type="text"
                          value={filter.field}
                          onChange={(e) => updateDynamicFilter(filter.id, { field: e.target.value })}
                          placeholder="id, name, category..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                        />
                      </div>

                      {/* Operator */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Оператор сравнения</label>
                        <select
                          value={filter.operator}
                          onChange={(e) => updateDynamicFilter(filter.id, { operator: e.target.value as TransformFilterOperator })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                        >
                          {FILTER_OPERATORS.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* populateFrom — путь к данным для заполнения select-а */}
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Заполнить options из данных (путь к полю API)
                        </label>
                        <input
                          type="text"
                          value={filter.populateFrom ?? ''}
                          onChange={(e) => updateDynamicFilter(filter.id, { populateFrom: e.target.value || undefined })}
                          placeholder="houses[0].address"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                        />
                        <p className="text-xs text-gray-400 mt-1">Уникальные значения попадут в options select-а (оставьте пустым если не нужно)</p>
                      </div>

                      {/* valueExtract — JS-выражение для вырезания части значения */}
                      {filter.populateFrom && (
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Вырезать часть значения (JS-выражение)
                          </label>
                          <input
                            type="text"
                            value={filter.valueExtract ?? ''}
                            onChange={(e) => updateDynamicFilter(filter.id, { valueExtract: e.target.value || undefined })}
                            placeholder="value.split(',')[2].trim()"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 font-mono"
                          />
                          <p className="text-xs text-gray-400 mt-1">Переменная <code>value</code> — сырое значение поля. Результат попадёт в option</p>
                        </div>
                      )}

                      {/* Checkbox */}
                      <label className="flex items-center gap-2 text-xs text-gray-600 mt-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filter.skipIfEmpty ?? true}
                          onChange={(e) => updateDynamicFilter(filter.id, { skipIfEmpty: e.target.checked })}
                          className="w-3 h-3"
                        />
                        Пропустить фильтр если значение пустое
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 border border-dashed border-purple-200 rounded-lg bg-purple-50/50">
              <p className="text-sm">Нет динамических фильтров</p>
              <p className="text-xs mt-1">Добавьте фильтр для связи данных с элементами ввода на странице</p>
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h5 className="text-sm font-medium text-blue-900 mb-2">💡 Порядок выполнения</h5>
        <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
          <li>Загрузка данных из источника</li>
          <li>Применение статических трансформаций (сверху вниз)</li>
          <li>Применение динамических фильтров от блоков</li>
          <li>Применение поиска (если есть)</li>
          <li>Применение пагинации</li>
          <li>Вычисление агрегатов</li>
        </ol>
      </div>
    </div>
  )
}

export default TransformsEditor
