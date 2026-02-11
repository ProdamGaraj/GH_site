/**
 * EndpointConfigEditor — Редактор конфигурации конкретного endpoint запроса.
 *
 * Используется в привязках данных (input/output) для настройки:
 * • Path (путь к endpoint)
 * • HTTP метод (GET, POST, PUT, DELETE, PATCH)
 * • Дополнительные заголовки
 * • Query-параметры
 * • Body (для POST/PUT/PATCH)
 *
 * DataSource хранит подключение (origin, auth), а этот компонент —
 * конкретный запрос к этому сервису.
 */

import React, { useState } from 'react'
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { EndpointConfig } from '@/shared/types/dataBinding'
import { cn } from '@/shared/utils'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700 border-green-300',
  POST: 'bg-blue-100 text-blue-700 border-blue-300',
  PUT: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  PATCH: 'bg-orange-100 text-orange-700 border-orange-300',
  DELETE: 'bg-red-100 text-red-700 border-red-300',
}

const BODY_FORMATS = [
  { value: 'json', label: 'JSON' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'form-urlencoded', label: 'URL Encoded' },
  { value: 'raw', label: 'Raw' },
] as const

interface EndpointConfigEditorProps {
  value: EndpointConfig
  onChange: (config: EndpointConfig) => void
  /** Показывать раздел Body (для output/POST-запросов) */
  showBody?: boolean
  /** Base URL источника для превью */
  baseUrl?: string
  /** Компактный режим */
  compact?: boolean
}

export const EndpointConfigEditor: React.FC<EndpointConfigEditorProps> = ({
  value,
  onChange,
  showBody = true,
  baseUrl,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const update = (updates: Partial<EndpointConfig>) => {
    onChange({ ...value, ...updates })
  }

  const headers = value.headers || {}
  const headerEntries = Object.entries(headers)
  const queryParams = value.queryParams || {}
  const queryEntries = Object.entries(queryParams)

  const addHeader = () => {
    update({ headers: { ...headers, '': '' } })
  }

  const removeHeader = (key: string) => {
    const { [key]: _, ...rest } = headers
    update({ headers: rest })
  }

  const updateHeader = (oldKey: string, newKey: string, newValue: string) => {
    const newHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(headers)) {
      if (k === oldKey) {
        if (newKey) newHeaders[newKey] = newValue
      } else {
        newHeaders[k] = v
      }
    }
    update({ headers: newHeaders })
  }

  const addQueryParam = () => {
    update({ queryParams: { ...queryParams, '': '' } })
  }

  const removeQueryParam = (key: string) => {
    const { [key]: _, ...rest } = queryParams
    update({ queryParams: rest })
  }

  const updateQueryParam = (oldKey: string, newKey: string, newValue: string) => {
    const newParams: Record<string, string> = {}
    for (const [k, v] of Object.entries(queryParams)) {
      if (k === oldKey) {
        if (newKey) newParams[newKey] = newValue
      } else {
        newParams[k] = v
      }
    }
    update({ queryParams: newParams })
  }

  // Нужно ли показывать body (POST, PUT, PATCH)
  const methodsWithBody = ['POST', 'PUT', 'PATCH']
  const canHaveBody = methodsWithBody.includes(value.method)

  return (
    <div className="space-y-3">
      {/* Method + Path — main row */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Метод и путь
        </label>
        <div className="flex gap-2">
          {/* Method selector */}
          <div className="flex gap-1">
            {HTTP_METHODS.map(m => (
              <button
                key={m}
                onClick={() => update({ method: m })}
                className={cn(
                  'px-2 py-1.5 text-xs font-mono font-bold rounded border transition-colors',
                  value.method === m
                    ? METHOD_COLORS[m]
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Path input */}
        <div className="mt-2">
          <input
            type="text"
            value={value.path}
            onChange={e => update({ path: e.target.value })}
            placeholder="/api/users или /v2/products"
            className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Preview */}
        {baseUrl && (
          <div className="mt-1.5 p-2 bg-gray-900 rounded text-xs font-mono">
            <span className={cn(
              'inline-block px-1.5 py-0.5 rounded text-white mr-2 text-[10px] font-bold',
              value.method === 'GET' ? 'bg-green-500' :
              value.method === 'POST' ? 'bg-blue-500' :
              value.method === 'PUT' ? 'bg-yellow-500' :
              value.method === 'PATCH' ? 'bg-orange-500' : 'bg-red-500'
            )}>
              {value.method}
            </span>
            <span className="text-green-400">{baseUrl}</span>
            <span className="text-blue-300">{value.path || '/'}</span>
          </div>
        )}
      </div>

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Дополнительные параметры запроса
        {(headerEntries.length > 0 || queryEntries.length > 0 || value.body) && (
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px]">
            настроено
          </span>
        )}
      </button>

      {showAdvanced && (
        <div className="space-y-3 pl-2 border-l-2 border-gray-200">
          {/* Extra Headers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">Заголовки запроса</label>
              <button
                onClick={addHeader}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
              >
                <Plus size={10} /> Добавить
              </button>
            </div>
            {headerEntries.length === 0 && (
              <p className="text-[10px] text-gray-400 italic">Нет дополнительных заголовков</p>
            )}
            {headerEntries.map(([key, val], i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input
                  type="text"
                  value={key}
                  onChange={e => updateHeader(key, e.target.value, val)}
                  placeholder="Header"
                  className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded"
                />
                <input
                  type="text"
                  value={val}
                  onChange={e => updateHeader(key, key, e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded"
                />
                <button onClick={() => removeHeader(key)} className="p-1 text-gray-400 hover:text-red-500">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Query Params */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">Query параметры</label>
              <button
                onClick={addQueryParam}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
              >
                <Plus size={10} /> Добавить
              </button>
            </div>
            {queryEntries.length === 0 && (
              <p className="text-[10px] text-gray-400 italic">Нет query-параметров</p>
            )}
            {queryEntries.map(([key, val], i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input
                  type="text"
                  value={key}
                  onChange={e => updateQueryParam(key, e.target.value, val)}
                  placeholder="Param"
                  className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded"
                />
                <input
                  type="text"
                  value={val}
                  onChange={e => updateQueryParam(key, key, e.target.value)}
                  placeholder="Value"
                  className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded"
                />
                <button onClick={() => removeQueryParam(key)} className="p-1 text-gray-400 hover:text-red-500">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Body (for POST/PUT/PATCH) */}
          {showBody && canHaveBody && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Тело запроса</label>
              <div className="flex gap-2 mb-1.5">
                {BODY_FORMATS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => update({ bodyFormat: f.value })}
                    className={cn(
                      'px-2 py-1 text-[10px] rounded border transition-colors',
                      value.bodyFormat === f.value
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <textarea
                value={value.body || ''}
                onChange={e => update({ body: e.target.value })}
                placeholder='{"key": "value"}'
                rows={3}
                className="w-full px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg resize-y"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">
                Переменные: {'{pageId}'}, {'{blockId}'}, {'{field.name}'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Default endpoint config */
export const DEFAULT_ENDPOINT_CONFIG: EndpointConfig = {
  path: '',
  method: 'GET',
}

/** Default endpoint config for output (POST) */
export const DEFAULT_OUTPUT_ENDPOINT_CONFIG: EndpointConfig = {
  path: '',
  method: 'POST',
  contentType: 'application/json',
}
