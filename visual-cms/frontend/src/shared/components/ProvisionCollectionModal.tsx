import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layers, X, CheckCircle2 } from 'lucide-react'
import { siteApi, pageApi } from '@/shared/api'
import type { Site, Page } from '@/shared/types'

export interface ProvisionResult {
  dataSourceId: string
  collectionId: string
  created: { dataSource: boolean; collection: boolean }
}

export interface ProvisionBody {
  siteId: string
  templatePageId: string
  basePath?: string
}

interface Props {
  onClose: () => void
  /** Заголовок окна: «Страницы проектов», «Страницы новостей». */
  title: string
  /** Что создаётся — абзац под заголовком. */
  description: React.ReactNode
  /** Подсказка у выбора шаблона. */
  templateLabel: string
  /** Шаблон, который выбрать сразу, если он есть на сайте (slug страницы). */
  defaultTemplateSlug?: string
  defaultBasePath: string
  /** Что осталось сделать после создания. */
  doneHint: React.ReactNode
  provision: (body: ProvisionBody) => Promise<ProvisionResult>
}

/**
 * Связка сервиса-источника (estate-service, news-service) с коллекцией:
 * выбираем сайт + страницу-шаблон + basePath, бэкенд идемпотентно создаёт
 * DataSource(rest-api, {{lang}}) и Collection. После создания — ссылка на
 * редактор коллекции (деплой — вручную).
 */
export const ProvisionCollectionModal: React.FC<Props> = ({
  onClose,
  title,
  description,
  templateLabel,
  defaultTemplateSlug,
  defaultBasePath,
  doneHint,
  provision,
}) => {
  const [sites, setSites] = useState<Site[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [siteId, setSiteId] = useState('')
  const [templatePageId, setTemplatePageId] = useState('')
  const [basePath, setBasePath] = useState(defaultBasePath)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProvisionResult | null>(null)

  useEffect(() => {
    siteApi
      .getAll()
      .then((list) => {
        setSites(list)
        if (list.length === 1) setSiteId(list[0].id)
      })
      .catch((e) => setError(e?.message || 'Не удалось загрузить сайты'))
  }, [])

  useEffect(() => {
    if (!siteId) {
      setPages([])
      setTemplatePageId('')
      return
    }
    pageApi
      .getAll(siteId)
      .then((list) => {
        setPages(list)
        const preferred = defaultTemplateSlug && list.find((p) => p.slug === defaultTemplateSlug)
        if (preferred) setTemplatePageId(preferred.id)
      })
      .catch((e) => setError(e?.message || 'Не удалось загрузить страницы'))
  }, [siteId, defaultTemplateSlug])

  const submit = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await provision({ siteId, templatePageId, basePath })
      setResult(res)
    } catch (e: any) {
      setError(e?.message || 'Ошибка провижна')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = siteId && templatePageId && /^\/[a-z0-9\-/]*$/.test(basePath)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Layers size={20} /> {title}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {result ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-green-700">
              <CheckCircle2 size={18} />
              {result.created.collection ? 'Коллекция создана' : 'Коллекция обновлена'}
            </p>
            <p className="text-sm text-gray-600">{doneHint}</p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Закрыть
              </button>
              <Link
                to={`/collections/${result.collectionId}`}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700"
              >
                Открыть коллекцию
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{description}</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Сайт</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                <option value="">— выбрать —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {templateLabel}
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                value={templatePageId}
                onChange={(e) => setTemplatePageId(e.target.value)}
                disabled={!siteId}
              >
                <option value="">— выбрать —</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (/{p.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base path (префикс URL страниц)
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={basePath}
                onChange={(e) => setBasePath(e.target.value)}
                placeholder={defaultBasePath}
              />
              <p className="text-xs text-gray-400 mt-1">Только /, строчные буквы, цифры, дефис.</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Отмена
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit || loading}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? 'Создание…' : 'Создать связку'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
