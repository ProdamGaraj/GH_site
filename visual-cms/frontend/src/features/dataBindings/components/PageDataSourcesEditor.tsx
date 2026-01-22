import React, { useState, useEffect } from 'react'

/**
 * Page Data Source - привязка источника данных к странице с алиасом
 */
export interface PageDataSource {
  id: string
  dataSourceId: string
  alias: string              // $products, $categories и т.д.
  loadStrategy: 'pageLoad' | 'onDemand' | 'interval'
  loadInterval?: number      // секунды (для interval)
  cacheEnabled: boolean
  cacheTTL?: number          // секунды
  priority: number           // порядок загрузки
  dependsOn?: string[]       // алиасы зависимостей
}

/**
 * Конфигурация данных страницы
 */
export interface PageDataConfig {
  dataSources: PageDataSource[]
  variables: Record<string, unknown>
  cachePolicy: 'cache-first' | 'network-first' | 'network-only'
}

interface PageDataSourcesEditorProps {
  pageId: string
  config: PageDataConfig
  onChange: (config: PageDataConfig) => void
}

interface DataSourceOption {
  id: string
  name: string
  type: string
}

/**
 * Редактор Page-Level Data Sources
 * 
 * Согласно ТЗ: Stage 3.5
 * - Прикрепление Data Sources к странице с алиасами
 * - Настройка загрузки: On page load, On demand, On interval
 * - Все блоки на странице имеют доступ к page-level данным
 */
export const PageDataSourcesEditor: React.FC<PageDataSourcesEditorProps> = ({
  pageId: _pageId,
  config,
  onChange
}) => {
  const [availableDataSources, setAvailableDataSources] = useState<DataSourceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSource, setEditingSource] = useState<string | null>(null)

  // Загрузка доступных Data Sources
  useEffect(() => {
    const loadDataSources = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/data-sources')
        if (response.ok) {
          const data = await response.json()
          setAvailableDataSources(data.map((ds: any) => ({
            id: ds.id,
            name: ds.name,
            type: ds.type
          })))
        }
      } catch (error) {
        console.error('Failed to load data sources:', error)
      } finally {
        setLoading(false)
      }
    }
    loadDataSources()
  }, [])

  const addDataSource = () => {
    const newSource: PageDataSource = {
      id: `pds_${Date.now()}`,
      dataSourceId: '',
      alias: '$data' + (config.dataSources.length + 1),
      loadStrategy: 'pageLoad',
      cacheEnabled: true,
      cacheTTL: 300,
      priority: config.dataSources.length
    }

    onChange({
      ...config,
      dataSources: [...config.dataSources, newSource]
    })
    setEditingSource(newSource.id)
  }

  const updateDataSource = (id: string, updates: Partial<PageDataSource>) => {
    onChange({
      ...config,
      dataSources: config.dataSources.map(ds =>
        ds.id === id ? { ...ds, ...updates } : ds
      )
    })
  }

  const removeDataSource = (id: string) => {
    onChange({
      ...config,
      dataSources: config.dataSources.filter(ds => ds.id !== id)
    })
  }

  const moveDataSource = (id: string, direction: 'up' | 'down') => {
    const index = config.dataSources.findIndex(ds => ds.id === id)
    if (index === -1) return
    
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= config.dataSources.length) return

    const newSources = [...config.dataSources]
    const [item] = newSources.splice(index, 1)
    newSources.splice(newIndex, 0, item)
    
    // Обновляем приоритеты
    newSources.forEach((ds, idx) => {
      ds.priority = idx
    })

    onChange({
      ...config,
      dataSources: newSources
    })
  }

  const getDataSourceName = (dataSourceId: string): string => {
    const ds = availableDataSources.find(d => d.id === dataSourceId)
    return ds?.name || 'Not selected'
  }

  const validateAlias = (alias: string, currentId: string): string | null => {
    if (!alias) return 'Alias is required'
    if (!alias.startsWith('$')) return 'Alias must start with $'
    if (!/^\$[a-zA-Z][a-zA-Z0-9_]*$/.test(alias)) {
      return 'Invalid alias format. Use $variableName'
    }
    const duplicate = config.dataSources.find(
      ds => ds.alias === alias && ds.id !== currentId
    )
    if (duplicate) return 'Alias already in use'
    return null
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading data sources...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Page Data Sources</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Define data available to all blocks on this page
          </p>
        </div>
        <button
          onClick={addDataSource}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Data Source
        </button>
      </div>

      {/* Cache Policy */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Page Cache Policy</span>
          <select
            value={config.cachePolicy}
            onChange={(e) => onChange({ ...config, cachePolicy: e.target.value as any })}
            className="text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="cache-first">Cache First (faster)</option>
            <option value="network-first">Network First (fresh)</option>
            <option value="network-only">Network Only (no cache)</option>
          </select>
        </label>
      </div>

      {/* Data Sources List */}
      {config.dataSources.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm8-3v20M4 12h16" />
          </svg>
          <p className="mt-2 text-sm text-gray-500">No page-level data sources</p>
          <p className="text-xs text-gray-400">Click "Add Data Source" to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {config.dataSources.map((source, index) => (
            <div
              key={source.id}
              className={`p-4 rounded-lg border ${
                editingSource === source.id
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {/* Source Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveDataSource(source.id, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveDataSource(source.id, 'down')}
                      disabled={index === config.dataSources.length - 1}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Alias badge */}
                  <span className="px-2 py-1 text-sm font-mono font-medium text-blue-700 bg-blue-100 rounded">
                    {source.alias}
                  </span>

                  {/* Source name */}
                  <span className="text-sm text-gray-600">
                    ← {getDataSourceName(source.dataSourceId)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingSource(editingSource === source.id ? null : source.id)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {editingSource === source.id ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={() => removeDataSource(source.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded editor */}
              {editingSource === source.id && (
                <div className="space-y-4 pt-3 border-t border-gray-200">
                  {/* Data Source Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Source
                    </label>
                    <select
                      value={source.dataSourceId}
                      onChange={(e) => updateDataSource(source.id, { dataSourceId: e.target.value })}
                      className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select data source...</option>
                      {availableDataSources.map(ds => (
                        <option key={ds.id} value={ds.id}>
                          {ds.name} ({ds.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Alias */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Alias (variable name)
                    </label>
                    <input
                      type="text"
                      value={source.alias}
                      onChange={(e) => updateDataSource(source.id, { alias: e.target.value })}
                      placeholder="$variableName"
                      className={`w-full text-sm font-mono border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 ${
                        validateAlias(source.alias, source.id) ? 'border-red-300' : ''
                      }`}
                    />
                    {validateAlias(source.alias, source.id) && (
                      <p className="mt-1 text-xs text-red-600">
                        {validateAlias(source.alias, source.id)}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Use this alias in blocks: <code className="bg-gray-100 px-1 rounded">{source.alias}.fieldName</code>
                    </p>
                  </div>

                  {/* Load Strategy */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Load Strategy
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'pageLoad', label: 'On Page Load', icon: '⚡' },
                        { value: 'onDemand', label: 'On Demand', icon: '👆' },
                        { value: 'interval', label: 'Interval', icon: '🔄' }
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => updateDataSource(source.id, { 
                            loadStrategy: option.value as any,
                            loadInterval: option.value === 'interval' ? 30 : undefined
                          })}
                          className={`p-2 text-center rounded-lg border transition-colors ${
                            source.loadStrategy === option.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-lg">{option.icon}</span>
                          <span className="block text-xs mt-0.5">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interval settings */}
                  {source.loadStrategy === 'interval' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Refresh Interval (seconds)
                      </label>
                      <input
                        type="number"
                        value={source.loadInterval || 30}
                        onChange={(e) => updateDataSource(source.id, { loadInterval: parseInt(e.target.value) || 30 })}
                        min={5}
                        max={3600}
                        className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Cache settings */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Enable Caching</span>
                      <p className="text-xs text-gray-500">Store data locally for faster access</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={source.cacheEnabled}
                        onChange={(e) => updateDataSource(source.id, { cacheEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {source.cacheEnabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cache TTL (seconds)
                      </label>
                      <input
                        type="number"
                        value={source.cacheTTL || 300}
                        onChange={(e) => updateDataSource(source.id, { cacheTTL: parseInt(e.target.value) || 300 })}
                        min={0}
                        max={86400}
                        className="w-full text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        How long to keep cached data. 0 = cache forever.
                      </p>
                    </div>
                  )}

                  {/* Dependencies */}
                  {config.dataSources.length > 1 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Depends On
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Load this source only after the selected sources are loaded
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {config.dataSources
                          .filter(ds => ds.id !== source.id)
                          .map(ds => (
                            <label
                              key={ds.id}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                                (source.dependsOn || []).includes(ds.alias)
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={(source.dependsOn || []).includes(ds.alias)}
                                onChange={(e) => {
                                  const deps = source.dependsOn || []
                                  updateDataSource(source.id, {
                                    dependsOn: e.target.checked
                                      ? [...deps, ds.alias]
                                      : deps.filter(d => d !== ds.alias)
                                  })
                                }}
                                className="sr-only"
                              />
                              <span className="font-mono text-sm">{ds.alias}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Usage Example */}
      {config.dataSources.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Usage in blocks:</h4>
          <div className="space-y-1">
            {config.dataSources.map(ds => (
              <code key={ds.id} className="block text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                {ds.alias} → Access via: {ds.alias}.items, {ds.alias}.data.field
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PageDataSourcesEditor
