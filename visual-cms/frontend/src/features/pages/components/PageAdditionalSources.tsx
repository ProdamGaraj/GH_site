import React, { useCallback, useEffect, useState } from 'react'
import { Plus, Eye, ChevronDown, ChevronRight, Save } from 'lucide-react'
import { api } from '@/shared/api'
import {
  pageAdditionalSourcesApi,
  type PageAdditionalSource,
  type PageInputBinding,
  type PageRequestPreview,
  type PageRequestPreviewStep,
} from '@/shared/api'
import { EndpointConfigEditor, DEFAULT_ENDPOINT_CONFIG } from '@/features/dataBindings/components/EndpointConfigEditor'

interface DataSourceOption {
  id: string
  name: string
  url?: string
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500',
  POST: 'bg-blue-500',
  PUT: 'bg-yellow-500',
  PATCH: 'bg-orange-500',
  DELETE: 'bg-red-500',
}

const formatValue = (val: unknown): string => {
  if (typeof val === 'string') return val
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

const PreviewStep: React.FC<{ step: PageRequestPreviewStep; defaultOpen?: boolean }> = ({ step, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const hasQuery = step.request.queryParams && Object.keys(step.request.queryParams).length > 0
  const hasBody = step.request.body !== undefined && step.request.body !== ''
  const hasExtract = step.extract && Object.keys(step.extract).length > 0
  const preClass = 'text-[11px] bg-gray-900 text-gray-100 rounded p-2 overflow-auto max-h-56 font-mono whitespace-pre-wrap break-all'

  return (
    <div className={`border rounded-lg ${step.error ? 'border-red-200' : 'border-gray-200'}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 rounded-lg"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown size={14} className="flex-shrink-0 text-gray-400" /> : <ChevronRight size={14} className="flex-shrink-0 text-gray-400" />}
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${METHOD_COLORS[step.request.method] || 'bg-gray-500'}`}>
            {step.request.method}
          </span>
          <span className="text-sm font-medium text-gray-700 truncate">{step.label}</span>
        </div>
        {step.error && <span className="text-red-500 text-xs flex-shrink-0 ml-2">ошибка</span>}
      </button>

      {open && (
        <div className="px-2 pb-2 space-y-2">
          <div className="text-[11px] font-mono break-all text-gray-500">{step.request.url}</div>
          {hasQuery && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Query-параметры</p>
              <pre className={preClass}>{formatValue(step.request.queryParams)}</pre>
            </div>
          )}
          {hasBody && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Тело запроса</p>
              <pre className={preClass}>{formatValue(step.request.body)}</pre>
            </div>
          )}
          {step.error ? (
            <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded p-2">{step.error}</div>
          ) : (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Ответ</p>
              <pre className={preClass}>{formatValue(step.response)}</pre>
            </div>
          )}
          {hasExtract && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-indigo-400 mb-0.5">Извлечено (extract)</p>
              <pre className={`${preClass} !bg-indigo-950`}>{formatValue(step.extract)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface PageAdditionalSourcesProps {
  pageId: string
}

/**
 * Управление дополнительными источниками данных страницы.
 * На деплое источники фетчатся и вшиваются в выбранную привязку как page-variable.
 */
export const PageAdditionalSources: React.FC<PageAdditionalSourcesProps> = ({ pageId }) => {
  const [sources, setSources] = useState<PageAdditionalSource[]>([])
  const [inputBindings, setInputBindings] = useState<PageInputBinding[]>([])
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const [preview, setPreview] = useState<PageRequestPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (!pageId || pageId === 'current') return
    let cancelled = false
    ;(async () => {
      try {
        const [settings, bindings, dsResp] = await Promise.all([
          pageAdditionalSourcesApi.get(pageId),
          pageAdditionalSourcesApi.inputBindings(pageId),
          api.get<{ items?: any[] } | any[]>(`/data-sources`),
        ])
        if (cancelled) return
        setSources(settings.additionalSources || [])
        setInputBindings(Array.isArray(bindings) ? bindings : [])
        const rawDs: any[] = Array.isArray(dsResp) ? dsResp : (dsResp as any).items || []
        setDataSources(rawDs.map(ds => ({ id: ds.id, name: ds.name, url: ds.config?.url || ds.config?.baseUrl || '' })))
      } catch (err) {
        console.error('Failed to load page additional sources:', err)
      }
    })()
    return () => { cancelled = true }
  }, [pageId])

  const bindingLabel = useCallback((b: PageInputBinding): string => {
    const dsName = b.dataSourceName || dataSources.find(d => d.id === b.dataSourceId)?.name || 'DataSource'
    const ep = [b.method, b.path].filter(Boolean).join(' ')
    return `${dsName}${ep ? ' · ' + ep : ''}${b.mode ? ' · ' + b.mode : ''}`
  }, [dataSources])

  const update = (idx: number, patch: Partial<PageAdditionalSource>) => {
    setSources(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      const cleaned = sources.map(s => ({
        ...s,
        extract: s.extract ? Object.fromEntries(Object.entries(s.extract).filter(([k, v]) => k && v)) : undefined,
      }))
      await pageAdditionalSourcesApi.update(pageId, cleaned)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Failed to save additional sources:', err)
      setSaveStatus('error')
    }
  }

  const handlePreview = async () => {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const result = await pageAdditionalSourcesApi.previewRequest(pageId)
      setPreview(result)
    } catch (err: any) {
      setPreviewError(err?.response?.data?.message || err?.message || 'Ошибка выполнения запроса')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          На деплое источники фетчатся (с цепочкой <code className="bg-gray-100 px-1 rounded">{'{{extract.name}}'}</code>)
          и вшиваются в выбранную привязку как page-variable — без браузерного fetch.
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Eye size={14} />
            {previewLoading ? 'Выполняется...' : 'Просмотр'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={14} />
            {saveStatus === 'saving' ? 'Сохранение...' : saveStatus === 'saved' ? 'Сохранено' : 'Сохранить'}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSources(prev => [...prev, { targetBindingId: '', dataSourceId: '', arrayPath: '', endpointConfig: DEFAULT_ENDPOINT_CONFIG }])}
        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
      >
        <Plus size={14} /> Добавить источник
      </button>

      {sources.length === 0 && (
        <p className="text-sm text-gray-400 italic">Дополнительные источники не добавлены.</p>
      )}

      <div className="space-y-4">
        {sources.map((src, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Источник #{idx + 1}</span>
              <button
                type="button"
                onClick={() => setSources(prev => prev.filter((_, i) => i !== idx))}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Удалить
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Целевая привязка</label>
                <select className={inputClass} value={src.targetBindingId} onChange={e => update(idx, { targetBindingId: e.target.value })}>
                  <option value="">Выберите привязку</option>
                  {inputBindings.map(b => (
                    <option key={b.id} value={b.id}>{bindingLabel(b)}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {inputBindings.length === 0
                    ? 'На странице нет input-привязок — создайте привязку блока к источнику.'
                    : 'Привязка (блок), в которую вшиваются данные'}
                </p>
              </div>
              <div>
                <label className={labelClass}>Источник запроса</label>
                <select className={inputClass} value={src.dataSourceId} onChange={e => update(idx, { dataSourceId: e.target.value })}>
                  <option value="">Выберите источник</option>
                  {dataSources.map(ds => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Любой DataSource — URL, авторизация, заголовки</p>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Путь к данным (arrayPath)</label>
                <input
                  className={inputClass}
                  value={src.arrayPath || ''}
                  onChange={e => update(idx, { arrayPath: e.target.value })}
                  placeholder="data.items  (оставьте пустым для корня ответа)"
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Настройка запроса</p>
              <EndpointConfigEditor
                value={src.endpointConfig || DEFAULT_ENDPOINT_CONFIG}
                onChange={ec => update(idx, { endpointConfig: ec })}
                showBody={true}
                baseUrl={dataSources.find(ds => ds.id === src.dataSourceId)?.url}
              />
            </div>

            {/* Extract fields */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">Извлечь значения</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Используй в следующих источниках как <code className="bg-gray-100 px-1 rounded">{'{{extract.name}}'}</code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const entries = Object.entries(src.extract || {})
                    entries.push(['', ''])
                    update(idx, { extract: Object.fromEntries(entries) })
                  }}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                >
                  <Plus size={12} /> Добавить
                </button>
              </div>

              {Object.entries(src.extract || {}).map(([name, dotPath], eIdx) => (
                <div key={eIdx} className="flex items-center gap-2 mb-1.5">
                  <input
                    className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
                    value={name}
                    placeholder="name"
                    onChange={e => {
                      const entries = Object.entries(src.extract || {})
                      entries[eIdx] = [e.target.value, dotPath]
                      update(idx, { extract: Object.fromEntries(entries) })
                    }}
                  />
                  <span className="text-gray-400 text-sm">→</span>
                  <input
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
                    value={dotPath}
                    placeholder="data.category.id"
                    onChange={e => {
                      const entries = Object.entries(src.extract || {})
                      entries[eIdx] = [name, e.target.value]
                      update(idx, { extract: Object.fromEntries(entries) })
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const entries = Object.entries(src.extract || {}).filter((_, i) => i !== eIdx)
                      update(idx, { extract: entries.length ? Object.fromEntries(entries) : undefined })
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

      {/* Preview */}
      {(previewError || preview) && (
        <div className="border-t border-gray-200 pt-4 space-y-2">
          <h4 className="text-sm font-semibold text-gray-900">Просмотр запроса</h4>
          {previewError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{previewError}</div>
          )}
          {preview && (
            <>
              {preview.warnings?.map((w, i) => (
                <div key={i} className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs">⚠ {w}</div>
              ))}
              {preview.steps.map((step, i) => (
                <PreviewStep key={i} step={step} defaultOpen={preview.steps.length === 1} />
              ))}
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-700 mb-1">Данные по привязкам</p>
                <pre className="text-[11px] bg-gray-900 text-gray-100 rounded p-2 overflow-auto max-h-72 font-mono whitespace-pre-wrap break-all">
                  {formatValue(preview.finalDataStore)}
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default PageAdditionalSources
