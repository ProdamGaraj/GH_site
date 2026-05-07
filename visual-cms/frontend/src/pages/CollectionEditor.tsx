import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Header } from '@/shared/components/Header'
import { ArrowLeft, Save, Trash2, Plus, Rocket, RefreshCw } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchCollectionById,
  createCollection,
  updateCollection,
  fetchCollectionItems,
  deployCollection,
  deleteOverride,
  createOverride,
  selectCurrentCollection,
  selectCollectionItems,
  selectCollectionsSaving,
  selectCollectionsDeploying,
  selectCollectionsLoading,
  selectCollectionsError,
  clearCollectionItems,
} from '@/features/collections/collectionsSlice'
import { fetchSites, selectSites } from '@/features/sites/sitesSlice'
import type { CreateCollectionDto, UpdateCollectionDto } from '@/shared/api/collectionApi'

// Inline data source fetch (пока нет отдельного thunk для всех DS по сайту)
import { api } from '@/shared/api/index'

interface DataSourceOption {
  id: string
  name: string
}

interface PageOption {
  id: string
  name: string
  slug: string
}

export const CollectionEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const collection = useAppSelector(selectCurrentCollection)
  const collectionItems = useAppSelector(selectCollectionItems)
  const sites = useAppSelector(selectSites)
  const saving = useAppSelector(selectCollectionsSaving)
  const deploying = useAppSelector(selectCollectionsDeploying)
  const loading = useAppSelector(selectCollectionsLoading)
  const error = useAppSelector(selectCollectionsError)

  // Form state
  const [form, setForm] = useState({
    siteId: '',
    name: '',
    dataSourceId: '',
    statsDataSourceId: '',
    arrayPath: '',
    templatePageId: '',
    basePath: '/',
    slugField: 'slug',
    titleField: 'title',
    apiIdField: 'id',
    linkMode: 'auto' as 'auto' | 'manual',
    isActive: true,
    itemsOrder: 'api',
    useCache: true,
    cacheTtl: 600,
    pollInterval: 300,
  })

  const [dataSources, setDataSources] = useState<DataSourceOption[]>([])
  const [pages, setPages] = useState<PageOption[]>([])
  const [overrideForm, setOverrideForm] = useState({ apiItemId: '', apiItemSlug: '', customPageId: '' })
  const [showOverrideForm, setShowOverrideForm] = useState(false)

  // Load sites
  useEffect(() => {
    dispatch(fetchSites())
  }, [dispatch])

  // Load existing collection
  useEffect(() => {
    if (!isNew && id) {
      dispatch(fetchCollectionById(id))
      dispatch(fetchCollectionItems(id))
    }
    return () => { dispatch(clearCollectionItems()) }
  }, [dispatch, id, isNew])

  // Populate form from collection
  useEffect(() => {
    if (!isNew && collection) {
      setForm({
        siteId: collection.siteId,
        name: collection.name,
        dataSourceId: collection.dataSourceId,
        statsDataSourceId: collection.statsDataSourceId || '',
        arrayPath: collection.arrayPath,
        templatePageId: collection.templatePageId,
        basePath: collection.basePath,
        slugField: collection.slugField,
        titleField: collection.titleField,
        apiIdField: collection.apiIdField || 'id',
        linkMode: collection.linkMode,
        isActive: collection.isActive,
        itemsOrder: collection.itemsOrder,
        useCache: collection.useCache,
        cacheTtl: collection.cacheTtl,
        pollInterval: collection.pollInterval,
      })
    }
  }, [collection, isNew])

  // Load data sources and pages when siteId changes
  const loadSiteData = useCallback(async (siteId: string) => {
    if (!siteId) return
    try {
      const [dsResponse, pg] = await Promise.all([
        api.get<{ items: DataSourceOption[] }>(`/data-sources?siteId=${siteId}`),
        api.get<PageOption[]>(`/pages?siteId=${siteId}`),
      ])
      setDataSources(Array.isArray(dsResponse) ? dsResponse : dsResponse.items || [])
      setPages(Array.isArray(pg) ? pg : [])
    } catch (err) {
      console.error('Failed to load site data:', err)
    }
  }, [])

  useEffect(() => {
    if (form.siteId) {
      loadSiteData(form.siteId)
    }
  }, [form.siteId, loadSiteData])

  const handleChange = (field: string, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      // Пустая строка statsDataSourceId → null (отвязать). Иначе Zod uuid() отклонит "".
      const payload = {
        ...form,
        statsDataSourceId: form.statsDataSourceId ? form.statsDataSourceId : null,
      }
      if (isNew) {
        const result = await dispatch(createCollection(payload as CreateCollectionDto)).unwrap()
        navigate(`/collections/${result.id}`, { replace: true })
      } else if (id) {
        const { siteId, ...updateData } = payload
        await dispatch(updateCollection({ id, data: updateData as UpdateCollectionDto })).unwrap()
      }
    } catch (err) {
      console.error('Save failed:', err)
    }
  }

  const handleDeploy = async () => {
    if (!id || isNew) return
    try {
      const result = await dispatch(deployCollection(id)).unwrap()
      alert(`Опубликовано ${result.deployedPages.length} страниц${result.errors.length ? `\nОшибки: ${result.errors.join(', ')}` : ''}`)
    } catch (err) {
      console.error('Deploy failed:', err)
    }
  }

  const handleRefreshItems = () => {
    if (id && !isNew) {
      dispatch(fetchCollectionItems(id))
    }
  }

  const handleAddOverride = async () => {
    if (!id || !overrideForm.apiItemId || !overrideForm.customPageId) return
    try {
      await dispatch(createOverride({
        collectionId: id,
        data: overrideForm,
      })).unwrap()
      setOverrideForm({ apiItemId: '', apiItemSlug: '', customPageId: '' })
      setShowOverrideForm(false)
      dispatch(fetchCollectionById(id))
    } catch (err) {
      console.error('Failed to create override:', err)
    }
  }

  const handleDeleteOverride = async (overrideId: string) => {
    if (!id) return
    if (!window.confirm('Удалить переопределение?')) return
    try {
      await dispatch(deleteOverride({ collectionId: id, overrideId })).unwrap()
      dispatch(fetchCollectionById(id))
    } catch (err) {
      console.error('Failed to delete override:', err)
    }
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto p-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/collections')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? 'Новая коллекция' : `Коллекция: ${collection?.name || '...'}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="secondary" onClick={handleDeploy} disabled={deploying}>
                <Rocket size={16} className="mr-2" />
                {deploying ? 'Публикуется...' : 'Опубликовать'}
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save size={16} className="mr-2" />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column – form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Основные настройки</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Название</label>
                  <input className={inputClass} value={form.name} onChange={e => handleChange('name', e.target.value)} placeholder="Проекты" />
                </div>
                <div>
                  <label className={labelClass}>Сайт</label>
                  <select className={inputClass} value={form.siteId} onChange={e => handleChange('siteId', e.target.value)} disabled={!isNew}>
                    <option value="">Выберите сайт</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Источник данных</label>
                  <select className={inputClass} value={form.dataSourceId} onChange={e => handleChange('dataSourceId', e.target.value)}>
                    <option value="">Выберите источник</option>
                    {dataSources.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Источник статистики (опционально)</label>
                  <select className={inputClass} value={form.statsDataSourceId} onChange={e => handleChange('statsDataSourceId', e.target.value)}>
                    <option value="">Не использовать</option>
                    {dataSources.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Macro v2 (Bearer-token DS) — для подтягивания квартир и расчёта диапазонов площадей/цен.</p>
                </div>
                <div>
                  <label className={labelClass}>Путь к массиву (arrayPath)</label>
                  <input className={inputClass} value={form.arrayPath} onChange={e => handleChange('arrayPath', e.target.value)} placeholder="data.projects" />
                </div>
                <div>
                  <label className={labelClass}>Страница-шаблон</label>
                  <select className={inputClass} value={form.templatePageId} onChange={e => handleChange('templatePageId', e.target.value)}>
                    <option value="">Выберите страницу</option>
                    {pages.map(p => <option key={p.id} value={p.id}>{p.name} (/{p.slug})</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Базовый путь</label>
                  <input className={inputClass} value={form.basePath} onChange={e => handleChange('basePath', e.target.value)} placeholder="/projects" />
                </div>
              </div>
            </div>

            {/* Fields & behaviour */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Поля и поведение</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Поле slug</label>
                  <input className={inputClass} value={form.slugField} onChange={e => handleChange('slugField', e.target.value)} placeholder="slug" />
                  <p className="text-xs text-gray-500 mt-1">Используется в URL (нормализуется автоматически)</p>
                </div>
                <div>
                  <label className={labelClass}>Поле заголовка</label>
                  <input className={inputClass} value={form.titleField} onChange={e => handleChange('titleField', e.target.value)} placeholder="title" />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Поле ID в API</label>
                  <input className={inputClass} value={form.apiIdField} onChange={e => handleChange('apiIdField', e.target.value)} placeholder="id" />
                  <p className="text-xs text-gray-500 mt-1">Используется для матчинга элемента при рендере страницы. Обычно <code>id</code>, иногда <code>_id</code>, <code>uuid</code>, <code>code</code>.</p>
                </div>
                <div>
                  <label className={labelClass}>Режим ссылок</label>
                  <select className={inputClass} value={form.linkMode} onChange={e => handleChange('linkMode', e.target.value)}>
                    <option value="auto">Авто (ссылки генерируются в repeater)</option>
                    <option value="manual">Ручной (ссылки через field mapping)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Сортировка</label>
                  <select className={inputClass} value={form.itemsOrder} onChange={e => handleChange('itemsOrder', e.target.value)}>
                    <option value="api">Порядок API</option>
                    <option value="alphabetical">По алфавиту</option>
                    <option value="custom">Пользовательская</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Cache & polling */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Кеш и обновление</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 col-span-2">
                  <input
                    type="checkbox"
                    id="useCache"
                    checked={form.useCache}
                    onChange={e => handleChange('useCache', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                  />
                  <label htmlFor="useCache" className="text-sm font-medium text-gray-700">
                    Использовать кеш (fallback при недоступности API)
                  </label>
                </div>
                <div>
                  <label className={labelClass}>TTL кеша (сек)</label>
                  <input type="number" className={inputClass} value={form.cacheTtl} onChange={e => handleChange('cacheTtl', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className={labelClass}>Интервал polling (сек, 0 = выкл)</label>
                  <input type="number" className={inputClass} value={form.pollInterval} onChange={e => handleChange('pollInterval', parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex items-center gap-3 col-span-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={form.isActive}
                    onChange={e => handleChange('isActive', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Активна (включена в деплой сайта)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right column – items preview + overrides */}
          <div className="space-y-6">
            {/* Items preview */}
            {!isNew && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Элементы</h2>
                  <button onClick={handleRefreshItems} className="p-1 text-gray-500 hover:text-gray-700">
                    <RefreshCw size={16} />
                  </button>
                </div>
                {loading ? (
                  <p className="text-gray-500 text-sm">Загрузка...</p>
                ) : collectionItems ? (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">
                      Всего: {collectionItems.total}
                      {collectionItems.fromCache && <span className="ml-2 text-amber-600">(из кеша)</span>}
                    </p>
                    {collectionItems.warnings?.map((w, i) => (
                      <p key={i} className="text-xs text-amber-600 mb-1">⚠ {w}</p>
                    ))}
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {collectionItems.items.slice(0, 50).map((item: any, i: number) => (
                        <div key={i} className="text-xs border-b border-gray-100 py-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            {item.mode === 'custom' && (
                              <span className="inline-block px-1 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 rounded">
                                custom
                              </span>
                            )}
                            <span className="truncate font-medium text-gray-800">
                              {item.title || item[form.titleField] || item.name || `#${i + 1}`}
                            </span>
                          </div>
                          <span className="text-gray-400 font-mono ml-2 flex-shrink-0">
                            {item.generatedUrl || `/${item.slug || item[form.slugField] || item.id}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Нет данных</p>
                )}
              </div>
            )}

            {/* Overrides */}
            {!isNew && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Переопределения</h2>
                  <button onClick={() => setShowOverrideForm(!showOverrideForm)} className="p-1 text-indigo-600 hover:text-indigo-800">
                    <Plus size={16} />
                  </button>
                </div>

                {showOverrideForm && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
                    <input
                      className={inputClass}
                      placeholder="ID элемента из API"
                      value={overrideForm.apiItemId}
                      onChange={e => setOverrideForm(prev => ({ ...prev, apiItemId: e.target.value }))}
                    />
                    <input
                      className={inputClass}
                      placeholder="Slug (снапшот)"
                      value={overrideForm.apiItemSlug}
                      onChange={e => setOverrideForm(prev => ({ ...prev, apiItemSlug: e.target.value }))}
                    />
                    <select
                      className={inputClass}
                      value={overrideForm.customPageId}
                      onChange={e => setOverrideForm(prev => ({ ...prev, customPageId: e.target.value }))}
                    >
                      <option value="">Кастомная страница</option>
                      {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <Button size="sm" onClick={handleAddOverride}>Добавить</Button>
                  </div>
                )}

                {collection?.overrides?.length ? (
                  <div className="space-y-2">
                    {collection.overrides.map(ov => (
                      <div key={ov.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2">
                        <div>
                          <span className="font-mono text-gray-600">{ov.apiItemSlug || ov.apiItemId}</span>
                          <span className="text-gray-400 mx-2">→</span>
                          <span className="text-indigo-600">
                            {pages.find(p => p.id === ov.customPageId)?.name || ov.customPageId}
                          </span>
                        </div>
                        <button onClick={() => handleDeleteOverride(ov.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Нет переопределений</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CollectionEditor
