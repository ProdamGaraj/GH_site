import React from 'react'
import type { SortConfig } from '@/shared/types/dataBinding'

interface SortBuilderProps {
  sorting: SortConfig[]
  onChange: (sorting: SortConfig[]) => void
}

/**
 * Компонент для настройки сортировки данных
 */
export const SortBuilder: React.FC<SortBuilderProps> = ({ sorting, onChange }) => {
  // Генерация ID
  const generateId = () => `sort-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Добавление сортировки
  const addSort = () => {
    const newSort: SortConfig = {
      id: generateId(),
      field: '',
      direction: 'asc',
      isActive: true,
    }
    onChange([...sorting, newSort])
  }

  // Обновление
  const updateSort = (id: string, updates: Partial<SortConfig>) => {
    onChange(sorting.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  // Удаление
  const removeSort = (id: string) => {
    onChange(sorting.filter(s => s.id !== id))
  }

  // Перемещение (приоритет сортировки)
  const moveSort = (id: string, direction: 'up' | 'down') => {
    const idx = sorting.findIndex(s => s.id === id)
    if (idx === -1) return
    
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= sorting.length) return
    
    const newSorting = [...sorting]
    ;[newSorting[idx], newSorting[newIdx]] = [newSorting[newIdx], newSorting[idx]]
    onChange(newSorting)
  }

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Настройте порядок сортировки данных
        </p>
        <button
          onClick={addSort}
          className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors"
        >
          + Добавить сортировку
        </button>
      </div>

      {/* Список сортировок */}
      {sorting.length > 0 ? (
        <div className="space-y-2">
          {sorting.map((sort, index) => (
            <div
              key={sort.id}
              className={`p-3 border rounded-lg flex items-center gap-3 ${
                sort.isActive !== false ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-50'
              }`}
            >
              {/* Checkbox активности */}
              <input
                type="checkbox"
                checked={sort.isActive !== false}
                onChange={() => updateSort(sort.id, { isActive: !sort.isActive })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />

              {/* Приоритет */}
              <span className="text-gray-400 text-sm w-5">{index + 1}.</span>

              {/* Поле */}
              <input
                type="text"
                value={sort.field}
                onChange={(e) => updateSort(sort.id, { field: e.target.value })}
                placeholder="createdAt, name, price"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
              />

              {/* Направление */}
              <div className="flex gap-1">
                <button
                  onClick={() => updateSort(sort.id, { direction: 'asc' })}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    sort.direction === 'asc'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ↑ ASC
                </button>
                <button
                  onClick={() => updateSort(sort.id, { direction: 'desc' })}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    sort.direction === 'desc'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ↓ DESC
                </button>
              </div>

              {/* Кнопки перемещения и удаления */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveSort(sort.id, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  title="Вверх (выше приоритет)"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSort(sort.id, 'down')}
                  disabled={index === sorting.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  title="Вниз (ниже приоритет)"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeSort(sort.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <div className="text-2xl mb-2">↕️</div>
          <p className="text-sm">Нет настроенных сортировок</p>
          <p className="text-xs text-gray-400 mt-1">
            Данные будут отображаться в порядке источника
          </p>
          <button
            onClick={addSort}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            + Добавить сортировку
          </button>
        </div>
      )}

      {/* Подсказка */}
      {sorting.length > 0 && (
        <p className="text-xs text-gray-500">
          Порядок сортировок определяет приоритет: первая сортировка применяется первой
        </p>
      )}
    </div>
  )
}
