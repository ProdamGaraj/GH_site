import React from 'react'
import { Plus } from 'lucide-react'
import type { EndpointConfig } from '@/shared/types/dataBinding'
import { EndpointConfigEditor, DEFAULT_ENDPOINT_CONFIG } from './EndpointConfigEditor'

export interface BlockSubSource {
  itemKey: string
  dataSourceId: string
  arrayPath?: string
  endpoint?: EndpointConfig
  extract?: Record<string, string>
  join?: { itemField: string; sourceField: string }
}

interface DataSourceOption {
  id: string
  name: string
  url?: string
}

interface BlockSubRequestsEditorProps {
  dataSources: DataSourceOption[]
  mainExtract: Record<string, string>
  sources: BlockSubSource[]
  onMainExtractChange: (next: Record<string, string>) => void
  onSourcesChange: (next: BlockSubSource[]) => void
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

/**
 * Редактор цепочки под-запросов привязки блока.
 * Основной массив привязки обогащается под-запросами (как в коллекциях):
 * mainExtract → доп.источники с {{item.*}}/{{extract.*}}, arrayPath, extract, join, itemKey.
 * Выполняется в рантайме на бэкенде (fetch-with-transforms).
 */
export const BlockSubRequestsEditor: React.FC<BlockSubRequestsEditorProps> = ({
  dataSources,
  mainExtract,
  sources,
  onMainExtractChange,
  onSourcesChange,
}) => {
  const updateSource = (idx: number, patch: Partial<BlockSubSource>) => {
    onSourcesChange(sources.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  return (
    <div className="space-y-4 border-t border-gray-200 pt-4 mt-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Под-запросы (обогащение элементов)</h4>
        <p className="text-xs text-gray-500 mt-0.5">
          Каждый элемент основного массива дополняется данными под-запросов. Доступны{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{item.field}}'}</code> и{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{extract.name}}'}</code>. Выполняется на бэкенде.
        </p>
      </div>

      {/* mainExtract */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-gray-700">Извлечь из основного массива</p>
          <button
            type="button"
            onClick={() => onMainExtractChange({ ...mainExtract, '': '' })}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
          >
            <Plus size={12} /> Добавить
          </button>
        </div>
        {Object.entries(mainExtract).map(([name, dotPath], eIdx) => (
          <div key={eIdx} className="flex items-center gap-2 mb-1.5">
            <input
              className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
              value={name}
              placeholder="ids"
              onChange={e => {
                const entries = Object.entries(mainExtract)
                entries[eIdx] = [e.target.value, dotPath]
                onMainExtractChange(Object.fromEntries(entries))
              }}
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
              value={dotPath}
              placeholder="[].id"
              onChange={e => {
                const entries = Object.entries(mainExtract)
                entries[eIdx] = [name, e.target.value]
                onMainExtractChange(Object.fromEntries(entries))
              }}
            />
            <button
              type="button"
              onClick={() => onMainExtractChange(Object.fromEntries(Object.entries(mainExtract).filter((_, i) => i !== eIdx)))}
              className="text-red-400 hover:text-red-600 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        <p className="text-[11px] text-gray-400">Напр. <code className="bg-gray-100 px-1 rounded">[].id</code> — собрать id всех элементов. Используй как <code className="bg-gray-100 px-1 rounded">{'{{extract.ids}}'}</code>.</p>
      </div>

      {/* Add source */}
      <button
        type="button"
        onClick={() => onSourcesChange([...sources, { itemKey: '', dataSourceId: '', arrayPath: '', endpoint: DEFAULT_ENDPOINT_CONFIG }])}
        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
      >
        <Plus size={14} /> Добавить под-запрос
      </button>

      <div className="space-y-4">
        {sources.map((src, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Под-запрос #{idx + 1}</span>
              <button
                type="button"
                onClick={() => onSourcesChange(sources.filter((_, i) => i !== idx))}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Удалить
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Ключ в элементе (item.&lt;ключ&gt;)</label>
                <input className={inputClass} value={src.itemKey} placeholder="stats" onChange={e => updateSource(idx, { itemKey: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Источник запроса</label>
                <select className={inputClass} value={src.dataSourceId} onChange={e => updateSource(idx, { dataSourceId: e.target.value })}>
                  <option value="">Выберите источник</option>
                  {dataSources.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Путь к данным (arrayPath)</label>
                <input className={inputClass} value={src.arrayPath || ''} placeholder="data" onChange={e => updateSource(idx, { arrayPath: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Связать по полю (JOIN)</label>
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={src.join?.itemField || ''}
                    placeholder="поле элемента (id)"
                    onChange={e => {
                      const itemField = e.target.value
                      const sourceField = src.join?.sourceField || ''
                      updateSource(idx, { join: itemField || sourceField ? { itemField, sourceField } : undefined })
                    }}
                  />
                  <span className="text-gray-400 text-sm">=</span>
                  <input
                    className={inputClass}
                    value={src.join?.sourceField || ''}
                    placeholder="поле в ответе (id)"
                    onChange={e => {
                      const sourceField = e.target.value
                      const itemField = src.join?.itemField || ''
                      updateSource(idx, { join: itemField || sourceField ? { itemField, sourceField } : undefined })
                    }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Если ответ — массив, прикрепится элемент, где item.поле = ответ.поле. Пусто — весь массив.</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Настройка запроса</p>
              <EndpointConfigEditor
                value={src.endpoint || DEFAULT_ENDPOINT_CONFIG}
                onChange={ec => updateSource(idx, { endpoint: ec })}
                showBody={true}
                baseUrl={dataSources.find(ds => ds.id === src.dataSourceId)?.url}
              />
            </div>

            {/* extract */}
            <div className="border-t border-gray-100 pt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-700">Извлечь значения → {'{{extract.name}}'}</p>
                <button
                  type="button"
                  onClick={() => {
                    const entries = Object.entries(src.extract || {})
                    entries.push(['', ''])
                    updateSource(idx, { extract: Object.fromEntries(entries) })
                  }}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                >
                  <Plus size={12} /> Добавить
                </button>
              </div>
              {Object.entries(src.extract || {}).map(([name, dotPath], eIdx) => (
                <div key={eIdx} className="flex items-center gap-2 mb-1.5">
                  <input
                    className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
                    value={name}
                    placeholder="name"
                    onChange={e => {
                      const entries = Object.entries(src.extract || {})
                      entries[eIdx] = [e.target.value, dotPath]
                      updateSource(idx, { extract: Object.fromEntries(entries) })
                    }}
                  />
                  <span className="text-gray-400 text-sm">→</span>
                  <input
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
                    value={dotPath}
                    placeholder="data.id"
                    onChange={e => {
                      const entries = Object.entries(src.extract || {})
                      entries[eIdx] = [name, e.target.value]
                      updateSource(idx, { extract: Object.fromEntries(entries) })
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const entries = Object.entries(src.extract || {}).filter((_, i) => i !== eIdx)
                      updateSource(idx, { extract: entries.length ? Object.fromEntries(entries) : undefined })
                    }}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BlockSubRequestsEditor
