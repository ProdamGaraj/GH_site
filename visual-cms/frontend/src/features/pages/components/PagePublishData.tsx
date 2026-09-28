import React, { useEffect, useState } from 'react'
import { Plus, Eye, Save } from 'lucide-react'
import {
  fetchDataSourceOptions,
  pagePublishDataApi,
  type DataSourceOption,
  type PagePublishDataDef,
  type PublishDataPreview,
} from '@/shared/api'
import { cleanPublishData, publishDataErrors } from '../publishData'

const formatJson = (val: unknown): string => {
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

/**
 * Данные страницы при публикации.
 *
 * Источник запрашивается при публикации страницы — на каждом языке сайта
 * (в адресе источника {{lang}}) — и подставляется в разметку блоков: так же,
 * как данные проекта на страницах коллекции. Результат сразу в HTML, браузеру
 * ничего запрашивать не нужно. Источник не ответил — страница не публикуется,
 * на сайте остаётся прежняя версия.
 */
export const PagePublishData: React.FC<{ pageId: string }> = ({ pageId }) => {
  const [defs, setDefs] = useState<PagePublishDataDef[]>([])
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const [preview, setPreview] = useState<PublishDataPreview[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [settings, options] = await Promise.all([pagePublishDataApi.get(pageId), fetchDataSourceOptions()])
        if (cancelled) return
        setDefs(settings.publishData || [])
        setDataSources(options)
      } catch (err) {
        console.error('Failed to load page publish data:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pageId])

  const errors = publishDataErrors(defs)
  const hasErrors = Object.keys(errors).length > 0

  const update = (idx: number, patch: Partial<PagePublishDataDef>) => {
    setDefs((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
    setPreview(null)
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    setSaveError(null)
    try {
      const saved = cleanPublishData(defs)
      await pagePublishDataApi.update(pageId, saved)
      setDefs(saved)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err: any) {
      console.error('Failed to save page publish data:', err)
      setSaveError(err?.message || 'Не удалось сохранить')
      setSaveStatus('error')
    }
  }

  const handlePreview = async () => {
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      setPreview(await pagePublishDataApi.preview(pageId))
    } catch (err: any) {
      setPreviewError(err?.message || 'Ошибка выполнения запроса')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const preClass =
    'text-[11px] bg-gray-900 text-gray-100 rounded p-2 overflow-auto max-h-56 font-mono whitespace-pre-wrap break-all'

  return (
    <div className="space-y-4" data-testid="publish-data">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-500">
          Источник запрашивается при публикации, на каждом языке (в адресе источника —{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{lang}}'}</code>), и подставляется в блоки страницы: узел
          повторяется по <code className="bg-gray-100 px-1 rounded">item.имя</code>, поля элемента —{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{$.поле}}'}</code>. Источник не ответил — страница не
          публикуется, на сайте остаётся прежняя.
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading || defs.length === 0}
            title="Запросить сохранённые источники на языке по умолчанию"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Eye size={14} />
            {previewLoading ? 'Выполняется...' : 'Проверить'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving' || hasErrors}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={14} />
            {saveStatus === 'saving' ? 'Сохранение...' : saveStatus === 'saved' ? 'Сохранено' : 'Сохранить'}
          </button>
        </div>
      </div>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      {defs.length === 0 && <p className="text-sm text-gray-400 italic">Данные при публикации не заданы.</p>}

      <div className="space-y-3">
        {defs.map((def, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-2" data-testid="publish-data-row">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass} htmlFor={`publish-name-${idx}`}>
                  Имя
                </label>
                <input
                  id={`publish-name-${idx}`}
                  className={inputClass}
                  value={def.name}
                  placeholder="complexes"
                  onChange={(e) => update(idx, { name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`publish-source-${idx}`}>
                  Источник
                </label>
                <select
                  id={`publish-source-${idx}`}
                  className={inputClass}
                  value={def.dataSourceId}
                  onChange={(e) => update(idx, { dataSourceId: e.target.value })}
                >
                  <option value="">Выберите источник</option>
                  {dataSources.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor={`publish-path-${idx}`}>
                  Путь к данным
                </label>
                <input
                  id={`publish-path-${idx}`}
                  className={inputClass}
                  value={def.arrayPath ?? ''}
                  placeholder="items"
                  onChange={(e) => update(idx, { arrayPath: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-red-600">{errors[idx] ?? ''}</span>
              <button
                type="button"
                onClick={() => {
                  setDefs((prev) => prev.filter((_, i) => i !== idx))
                  setPreview(null)
                }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDefs((prev) => [...prev, { name: '', dataSourceId: '', arrayPath: '' }])}
        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
      >
        <Plus size={14} /> Добавить данные
      </button>

      {previewError && (
        <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded p-2">{previewError}</div>
      )}
      {preview && (
        <div className="space-y-2" data-testid="publish-data-preview">
          {preview.length === 0 && <p className="text-sm text-gray-400 italic">Сохранённых данных нет.</p>}
          {preview.map((p) => (
            <div key={p.name} className={`border rounded-lg p-2 ${p.error ? 'border-red-200' : 'border-gray-200'}`}>
              <p className="text-sm font-medium text-gray-700">
                item.{p.name}
                {!p.error && (
                  <span className="ml-2 font-normal text-gray-500">
                    {p.count !== null ? `элементов: ${p.count}` : 'не массив'}
                  </span>
                )}
              </p>
              {p.error ? (
                <div className="mt-1 text-red-600 text-xs bg-red-50 border border-red-200 rounded p-2">{p.error}</div>
              ) : (
                <>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                    {p.count !== null ? 'Первый элемент' : 'Ответ'}
                  </p>
                  <pre className={preClass}>{formatJson(p.sample)}</pre>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
