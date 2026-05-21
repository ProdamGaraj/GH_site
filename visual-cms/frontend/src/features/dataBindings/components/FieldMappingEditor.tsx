import React, { useState } from 'react'
import type { FieldMapping } from '@/shared/types/dataBinding'

interface FieldMappingEditorProps {
  mappings: FieldMapping[]
  onChange: (mappings: FieldMapping[]) => void
  dataSourceId?: string
  mode?: 'input' | 'output'
}

/**
 * Редактор маппинга полей
 * Позволяет настроить связь между полями источника данных и свойствами блока
 */
export const FieldMappingEditor: React.FC<FieldMappingEditorProps> = ({
  mappings,
  onChange,
  dataSourceId: _dataSourceId,
  mode: _mode = 'input',
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Генерация уникального ID
  const generateId = () => `mapping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Добавление нового маппинга
  const addMapping = () => {
    const newMapping: FieldMapping = {
      id: generateId(),
      sourceField: '',
      targetProperty: '',
    }
    onChange([...mappings, newMapping])
    setExpandedId(newMapping.id)
  }

  // Обновление маппинга
  const updateMapping = (id: string, updates: Partial<FieldMapping>) => {
    onChange(mappings.map(m => m.id === id ? { ...m, ...updates } : m))
  }

  // Удаление маппинга
  const removeMapping = (id: string) => {
    onChange(mappings.filter(m => m.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  // Перемещение маппинга
  const moveMapping = (id: string, direction: 'up' | 'down') => {
    const idx = mappings.findIndex(m => m.id === id)
    if (idx === -1) return
    
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= mappings.length) return
    
    const newMappings = [...mappings]
    ;[newMappings[idx], newMappings[newIdx]] = [newMappings[newIdx], newMappings[idx]]
    onChange(newMappings)
  }

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Настройте соответствие между полями источника данных и свойствами блока
        </p>
        <button
          onClick={addMapping}
          className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors"
        >
          + Добавить поле
        </button>
      </div>

      {/* Список маппингов */}
      {mappings.length > 0 ? (
        <div className="space-y-2">
          {mappings.map((mapping, index) => (
            <div
              key={mapping.id}
              className={`border rounded-lg transition-all ${
                expandedId === mapping.id
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {/* Компактный вид */}
              <div
                className="p-3 flex items-center gap-3 cursor-pointer"
                onClick={() => setExpandedId(expandedId === mapping.id ? null : mapping.id)}
              >
                {/* Иконка и номер */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">{index + 1}</span>
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                    mapping.sourceField && mapping.targetProperty
                      ? 'bg-green-100 text-green-600'
                      : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    {mapping.sourceField && mapping.targetProperty ? '✓' : '!'}
                  </span>
                </div>

                {/* Поля */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="truncate text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                    {mapping.sourceField || 'источник'}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="truncate text-sm font-mono bg-blue-100 px-2 py-0.5 rounded">
                    {mapping.targetProperty || 'свойство'}
                  </span>
                </div>

                {/* Действия */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); moveMapping(mapping.id, 'up') }}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    title="Вверх"
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveMapping(mapping.id, 'down') }}
                    disabled={index === mappings.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    title="Вниз"
                  >
                    ↓
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeMapping(mapping.id) }}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Расширенный вид */}
              {expandedId === mapping.id && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-200 space-y-3">
                  {/* Поле источника */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Поле источника (Source Field)
                    </label>
                    <input
                      type="text"
                      value={mapping.sourceField}
                      onChange={(e) => updateMapping(mapping.id, { sourceField: e.target.value })}
                      placeholder="title, user.name, items[0].id"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Путь к полю в данных. Поддерживаются вложенные пути: user.profile.avatar
                    </p>
                  </div>

                  {/* Свойство блока */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Свойство блока (Target Property)
                    </label>
                    <input
                      type="text"
                      value={mapping.targetProperty}
                      onChange={(e) => updateMapping(mapping.id, { targetProperty: e.target.value })}
                      placeholder="content, attributes.src, styles.color"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                  </div>

                  {/* Трансформация */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Трансформация (выражение)
                    </label>
                    <textarea
                      value={mapping.transform || ''}
                      onChange={(e) => updateMapping(mapping.id, { transform: e.target.value })}
                      placeholder="upper(value)"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Выражение над <code className="bg-gray-100 px-1 rounded">value</code>. Доступны
                      helper'ы: <code>upper</code>, <code>lower</code>, <code>trim</code>,
                      <code>concat</code>, <code>len</code>, <code>slice</code>, <code>replace</code>,
                      <code>round/floor/ceil</code>, <code>default(a,b)</code>, <code>if(c,a,b)</code>.
                      Либо short-name: <code>uppercase</code>, <code>lowercase</code>,
                      <code>trim</code>, <code>number</code>, <code>round</code>, <code>length</code>,
                      <code>json</code>, <code>template:...</code>, <code>replace:from|to</code>,
                      <code>truncate:N</code>, <code>slice:S|E</code>.
                    </p>
                  </div>

                  {/* Fallback */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Fallback значение
                      </label>
                      <input
                        type="text"
                        value={typeof mapping.fallbackValue === 'string' ? mapping.fallbackValue : ''}
                        onChange={(e) => updateMapping(mapping.id, { fallbackValue: e.target.value })}
                        placeholder="Значение по умолчанию"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Fallback поле
                      </label>
                      <input
                        type="text"
                        value={mapping.fallbackField || ''}
                        onChange={(e) => updateMapping(mapping.id, { fallbackField: e.target.value })}
                        placeholder="alternativeField"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <div className="text-2xl mb-2">🔗</div>
          <p className="text-sm">Нет настроенных маппингов</p>
          <button
            onClick={addMapping}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            + Добавить первый маппинг
          </button>
        </div>
      )}

      {/* Подсказка */}
      {mappings.length > 0 && (
        <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
          <strong>Примеры путей:</strong>
          <ul className="mt-1 space-y-1 ml-4 list-disc">
            <li><code className="bg-gray-200 px-1 rounded">title</code> — простое поле</li>
            <li><code className="bg-gray-200 px-1 rounded">user.profile.name</code> — вложенное поле</li>
            <li><code className="bg-gray-200 px-1 rounded">items[0].name</code> — элемент массива</li>
            <li><code className="bg-gray-200 px-1 rounded">items[*].name</code> — все элементы массива</li>
          </ul>
        </div>
      )}
    </div>
  )
}
