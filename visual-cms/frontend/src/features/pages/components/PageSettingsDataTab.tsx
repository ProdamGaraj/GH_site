import React, { useState, useEffect, useCallback } from 'react'
import { 
  PageDataSourcesEditor, 
  VariablesEditor,
  type PageDataConfig,
  type VariablesConfig,
  type VariableDefinition 
} from '../../dataBindings'
import { pageDataSettingsApi } from '@/shared/api'
import { PageAdditionalSources } from './PageAdditionalSources'

/**
 * Объединённая конфигурация данных страницы
 */
export interface PageDataSettings {
  dataSources: PageDataConfig
  variables: VariablesConfig
  globalCachePolicy?: {
    enabled: boolean
    defaultTtl: number
    staleWhileRevalidate: boolean
  }
}

const DEFAULT_SETTINGS: PageDataSettings = {
  dataSources: { dataSources: [], variables: {}, cachePolicy: 'cache-first' },
  variables: { variables: [] },
  globalCachePolicy: {
    enabled: true,
    defaultTtl: 300,
    staleWhileRevalidate: true
  }
}

interface PageSettingsDataTabProps {
  pageId: string
  settings?: PageDataSettings
  onChange?: (settings: PageDataSettings) => void
  availableDataSources?: Array<{ id: string; name: string; type: string }>
  /** Автоматически загружать и сохранять данные через API */
  useApi?: boolean
}

type TabId = 'sources' | 'variables' | 'cache' | 'additional'

/**
 * Вкладка "Data" в настройках страницы
 * 
 * Согласно ТЗ: Stage 3.5 Page-Level Data Sources + Stage 3.6 Variables System
 * - Управление Data Sources для страницы ($products, $categories)
 * - Настройка переменных страницы ($page.selectedId, $page.filter)
 * - Глобальные настройки кэширования
 */
export const PageSettingsDataTab: React.FC<PageSettingsDataTabProps> = ({
  pageId,
  settings: externalSettings,
  onChange: externalOnChange,
  useApi = true,
  // availableDataSources не используется, так как PageDataSourcesEditor сам загружает sources
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('sources')
  const [internalSettings, setInternalSettings] = useState<PageDataSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // Локальный state для ползунка TTL для мгновенной визуальной обратной связи
  const [localTtl, setLocalTtl] = useState<number | null>(null)
  const ttlTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Используем либо внешние settings, либо внутренние (если useApi=true)
  const settings = externalSettings ?? internalSettings

  // Загрузка данных из API
  useEffect(() => {
    if (!useApi || !pageId || pageId === 'current') return

    const loadSettings = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await pageDataSettingsApi.getSettings(pageId)
        setInternalSettings({
          dataSources: {
            dataSources: data.dataSources || [],
            variables: {},
            cachePolicy: 'cache-first'
          },
          variables: { 
            variables: (data.variables || []) as VariableDefinition[]
          },
          globalCachePolicy: DEFAULT_SETTINGS.globalCachePolicy
        })
      } catch (err) {
        console.error('Failed to load page data settings:', err)
        // Если 404, значит просто нет данных - это нормально
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [pageId, useApi])

  // Автосохранение с debounce
  const saveSettings = useCallback(async (newSettings: PageDataSettings) => {
    if (!useApi || !pageId || pageId === 'current') return

    setSaveStatus('saving')
    try {
      await pageDataSettingsApi.updateSettings(pageId, {
        dataSources: newSettings.dataSources.dataSources,
        variables: newSettings.variables.variables as any
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Failed to save page data settings:', err)
      setSaveStatus('error')
      setError('Failed to save settings')
    }
  }, [pageId, useApi])

  const handleChange = useCallback((newSettings: PageDataSettings) => {
    if (externalOnChange) {
      externalOnChange(newSettings)
    } else {
      setInternalSettings(newSettings)
      saveSettings(newSettings)
    }
  }, [externalOnChange, saveSettings])

  const handleDataSourcesChange = (dataSources: PageDataConfig) => {
    handleChange({ ...settings, dataSources })
  }

  const handleVariablesChange = (variables: VariablesConfig) => {
    handleChange({ ...settings, variables })
  }

  const handleCachePolicyChange = (updates: Partial<PageDataSettings['globalCachePolicy']>) => {
    handleChange({
      ...settings,
      globalCachePolicy: {
        enabled: settings.globalCachePolicy?.enabled ?? true,
        defaultTtl: settings.globalCachePolicy?.defaultTtl ?? 300,
        staleWhileRevalidate: settings.globalCachePolicy?.staleWhileRevalidate ?? true,
        ...updates
      }
    })
  }

  // Обработчик изменения TTL с debounce для мгновенной визуальной обратной связи
  const handleTtlChange = (newTtl: number) => {
    // Мгновенно обновляем локальный state для UI
    setLocalTtl(newTtl)
    
    // Отменяем предыдущий таймер
    if (ttlTimeoutRef.current) {
      clearTimeout(ttlTimeoutRef.current)
    }
    
    // Откладываем обновление родительского state на 150ms
    ttlTimeoutRef.current = setTimeout(() => {
      handleCachePolicyChange({ defaultTtl: newTtl })
      setLocalTtl(null)
    }, 150)
  }
  
  // Очистка таймера при размонтировании
  React.useEffect(() => {
    return () => {
      if (ttlTimeoutRef.current) {
        clearTimeout(ttlTimeoutRef.current)
      }
    }
  }, [])

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; count?: number }> = [
    {
      id: 'sources',
      label: 'Data Sources',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      ),
      count: settings.dataSources?.dataSources?.length || 0
    },
    {
      id: 'variables',
      label: 'Variables',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      count: settings.variables?.variables?.filter((v: VariableDefinition) => v.scope === 'page').length || 0
    },
    {
      id: 'cache',
      label: 'Cache Settings',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'additional',
      label: 'Доп.источники',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )
    }
  ]

  return (
    <div className="space-y-4">
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading data settings...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Save Status Indicator */}
      {saveStatus !== 'idle' && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
          saveStatus === 'saving' ? 'bg-blue-50 text-blue-700' :
          saveStatus === 'saved' ? 'bg-green-50 text-green-700' :
          'bg-red-50 text-red-700'
        }`}>
          {saveStatus === 'saving' && (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              Saving...
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Save failed
            </>
          )}
        </div>
      )}

      {!isLoading && (
        <>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {/* Data Sources Tab */}
        {activeTab === 'sources' && (
          <PageDataSourcesEditor
            pageId={pageId}
            config={settings.dataSources || { dataSources: [], variables: {}, cachePolicy: 'cache-first' }}
            onChange={handleDataSourcesChange}
          />
        )}

        {/* Variables Tab */}
        {activeTab === 'variables' && (
          <div className="space-y-6">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-900 flex items-center gap-2">
                <span>📄</span>
                Page Variables
              </h4>
              <p className="mt-1 text-xs text-blue-700">
                Variables available only on this page. Use <code className="px-1 py-0.5 bg-blue-100 rounded">$page.varName</code> in blocks.
              </p>
            </div>

            <VariablesEditor
              config={settings.variables || { variables: [] }}
              onChange={handleVariablesChange}
              scope="page"
            />

            {/* Global/Session Variables Info */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Other Variable Scopes</h4>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span>🌐</span>
                  <span><strong>Global variables</strong> ($global.*) are configured in Site Settings</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⏱️</span>
                  <span><strong>Session variables</strong> ($session.*) persist until browser closes</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cache Settings Tab */}
        {activeTab === 'cache' && (
          <div className="space-y-6">
            {/* Global Cache Toggle */}
            <div className="p-4 rounded-lg border border-gray-200">
              <label className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Enable Caching</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Cache data source responses to improve performance
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.globalCachePolicy?.enabled ?? true}
                  onChange={(e) => handleCachePolicyChange({ enabled: e.target.checked })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-5 h-5 rounded border-2 border-gray-400 bg-white focus:ring-gray-500"
                  style={{ pointerEvents: 'auto', accentColor: '#1f2937' }}
                />
              </label>
            </div>

            {settings.globalCachePolicy?.enabled !== false && (
              <>
                {/* Default TTL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Cache Duration (TTL)
                  </label>
                  <div className="flex items-center gap-0.5">
                    <input
                      type="range"
                      min="0"
                      max="3600"
                      step="60"
                      value={localTtl ?? settings.globalCachePolicy?.defaultTtl ?? 300}
                      onChange={(e) => handleTtlChange(parseInt(e.target.value))}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      style={{
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        pointerEvents: 'auto',
                        background: '#cbd5e1',
                      }}
                    />
                    <span className="text-sm font-mono text-gray-600 min-w-[1.5rem] text-right">
                      {formatTtl(localTtl ?? settings.globalCachePolicy?.defaultTtl ?? 300)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    How long to cache responses before refetching
                  </p>
                </div>

                {/* Stale While Revalidate */}
                <div className="p-4 rounded-lg border border-gray-200">
                  <label className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">Stale While Revalidate</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Show cached data while fetching fresh data in background
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.globalCachePolicy?.staleWhileRevalidate ?? true}
                      onChange={(e) => handleCachePolicyChange({ staleWhileRevalidate: e.target.checked })}
                      onClick={(e) => e.stopPropagation()}
                      className="w-5 h-5 rounded border-2 border-gray-400 bg-white focus:ring-gray-500"
                      style={{ pointerEvents: 'auto', accentColor: '#1f2937' }}
                    />
                  </label>
                </div>

                {/* Cache Info */}
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <h4 className="text-sm font-medium text-amber-900 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Cache Behavior
                  </h4>
                  <ul className="mt-2 space-y-1 text-xs text-amber-800">
                    <li>• Individual data sources can override these defaults</li>
                    <li>• POST/PUT/DELETE requests are never cached</li>
                    <li>• Cache is cleared when page is refreshed</li>
                    <li>• Use <code className="px-1 py-0.5 bg-amber-100 rounded">$invalidateCache('alias')</code> to manually clear</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        {/* Additional sources Tab */}
        {activeTab === 'additional' && pageId && pageId !== 'current' && (
          <PageAdditionalSources pageId={pageId} />
        )}
        {activeTab === 'additional' && (!pageId || pageId === 'current') && (
          <p className="text-sm text-gray-400 italic">Сохраните страницу, чтобы настроить доп.источники.</p>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Page Data Summary</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">
              {settings.dataSources?.dataSources?.length || 0}
            </div>
            <div className="text-xs text-gray-500">Data Sources</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-purple-600">
              {settings.variables?.variables?.filter(v => v.scope === 'page').length || 0}
            </div>
            <div className="text-xs text-gray-500">Page Variables</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-gray-200">
            <div className={`text-2xl font-bold ${settings.globalCachePolicy?.enabled !== false ? 'text-green-600' : 'text-gray-400'}`}>
              {settings.globalCachePolicy?.enabled !== false ? '✓' : '✗'}
            </div>
            <div className="text-xs text-gray-500">Caching</div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  )
}

/**
 * Форматирование TTL для отображения
 */
function formatTtl(seconds: number): string {
  if (seconds === 0) return 'No cache'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

export default PageSettingsDataTab
