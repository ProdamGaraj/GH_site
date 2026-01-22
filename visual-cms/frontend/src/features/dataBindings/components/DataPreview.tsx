import React, { useState } from 'react'
import type { FetchDataResult } from '@/shared/types/dataBinding'

interface DataPreviewProps {
  data: FetchDataResult | undefined
  loading: boolean
  onRefresh: () => void
}

/**
 * Компонент превью полученных данных
 */
export const DataPreview: React.FC<DataPreviewProps> = ({ data, loading, onRefresh }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<'json' | 'table'>('json')

  if (!data && !loading) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
        <div className="text-3xl mb-2">📊</div>
        <p className="text-gray-500 mb-2">Нет данных для отображения</p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 Загрузить данные
        </button>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Заголовок */}
      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h5 className="font-medium text-gray-800">Превью данных</h5>
          {data?.metadata && (
            <div className="flex gap-2 text-xs">
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                {data.metadata.filtered} из {data.metadata.total}
              </span>
              {data.metadata.mode && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {data.metadata.mode}
                </span>
              )}
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
                {data.metadata.responseTime}ms
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Переключатель вида */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('json')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'json'
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              JSON
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Таблица
            </button>
          </div>

          {/* Кнопка обновления */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            {loading ? '⏳' : '🔄'} Обновить
          </button>

          {/* Развернуть/свернуть */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? '⊖' : '⊕'}
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className={`overflow-auto transition-all ${isExpanded ? 'max-h-[600px]' : 'max-h-[300px]'}`}>
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="text-gray-500 mt-2">Загрузка данных...</p>
          </div>
        ) : data?.success ? (
          viewMode === 'json' ? (
            <JsonView data={data.data} />
          ) : (
            <TableView data={data.data} />
          )
        ) : (
          <div className="p-4 bg-red-50 text-red-700">
            <div className="font-medium">Ошибка получения данных</div>
            <div className="text-sm mt-1">{data?.error || 'Неизвестная ошибка'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * JSON представление данных
 */
const JsonView: React.FC<{ data: unknown }> = ({ data }) => {
  const formatJson = (obj: unknown): string => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  return (
    <pre className="p-4 text-xs font-mono text-gray-800 bg-gray-50 whitespace-pre-wrap overflow-x-auto">
      {formatJson(data)}
    </pre>
  )
}

/**
 * Табличное представление данных
 */
const TableView: React.FC<{ data: unknown }> = ({ data }) => {
  // Преобразуем данные в массив
  const items = Array.isArray(data) ? data : [data]
  
  if (items.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Нет данных для отображения
      </div>
    )
  }

  // Получаем колонки из первого объекта
  const firstItem = items[0]
  if (typeof firstItem !== 'object' || firstItem === null) {
    return <JsonView data={data} />
  }

  const columns = Object.keys(firstItem as Record<string, unknown>)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              #
            </th>
            {columns.map(col => (
              <th
                key={col}
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.slice(0, 50).map((item, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
              {columns.map(col => (
                <td key={col} className="px-3 py-2 max-w-xs truncate">
                  {formatCellValue((item as Record<string, unknown>)[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > 50 && (
        <div className="p-2 text-center text-xs text-gray-500 bg-gray-50">
          Показано 50 из {items.length} записей
        </div>
      )}
    </div>
  )
}

/**
 * Форматирование значения ячейки
 */
const formatCellValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">null</span>
  }
  if (typeof value === 'boolean') {
    return value ? '✓' : '✗'
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return <span className="text-gray-500">[{value.length} items]</span>
    }
    return <span className="text-gray-500">{'{...}'}</span>
  }
  return String(value)
}
