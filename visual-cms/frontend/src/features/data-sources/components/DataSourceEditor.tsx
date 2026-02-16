/**
 * DataSourceEditor — Полноэкранный редактор существующего Data Source.
 *
 * В отличие от DataSourceWizard (пошаговое создание), показывает
 * ВСЕ секции на одной странице с возможностью редактирования любой части.
 * Загружает данные по ID из URL.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Header } from '@/shared/components/Header'
import {
  ArrowLeft,
  Check,
  Globe,
  Database,
  Rss,
  Braces,
  FileJson,
  Plug,
  Calculator,
  FormInput,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Save,
  X,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchDataSourceById,
  updateDataSource,
  testNewDataSourceConnection,
  selectDataSourcesSaving,
  selectDataSourcesTesting,
  selectTestResult,
  clearTestResult,
  selectDataSourceById as selectDSById,
} from '@/features/data-sources/dataSourcesSlice'
import type {
  DataSourceType,
  AuthType,
  CredentialsStorage,
} from '@/shared/types/dataSource'
import { DATA_SOURCE_TYPES, AUTH_TYPES } from '@/shared/types/dataSource'

// ─── Type icons ────────────────────────────────────────────────

const typeIcons: Record<DataSourceType, React.ReactNode> = {
  'rest-api': <Globe size={20} className="text-blue-500" />,
  'feed': <Rss size={20} className="text-orange-500" />,
  'graphql': <Braces size={20} className="text-pink-500" />,
  'database': <Database size={20} className="text-purple-500" />,
  'external': <Plug size={20} className="text-green-500" />,
  'static': <FileJson size={20} className="text-gray-500" />,
  'computed': <Calculator size={20} className="text-cyan-500" />,
  'form-data': <FormInput size={20} className="text-yellow-500" />,
}

// ─── Form state ────────────────────────────────────────────────

interface FormData {
  name: string
  description: string
  type: DataSourceType | null
  url: string
  headers: { key: string; value: string }[]
  queryParams: { key: string; value: string }[]
  timeout: number
  // Feed
  pollingEnabled: boolean
  pollingInterval: number
  cacheTTL: number
  // GraphQL
  query: string
  variables: string
  // Static
  staticData: string
  // Auth
  authType: AuthType
  authStorage: CredentialsStorage
  bearerToken: string
  apiKey: string
  apiKeyName: string
  apiKeyPlacement: 'header' | 'query'
  basicUsername: string
  basicPassword: string
  oauth2ClientId: string
  oauth2ClientSecret: string
  oauth2AuthUrl: string
  oauth2TokenUrl: string
  oauth2Scope: string
  customHeaders: { key: string; value: string }[]
  status: 'active' | 'draft'
}

const initialFormData: FormData = {
  name: '',
  description: '',
  type: null,
  url: '',
  headers: [{ key: '', value: '' }],
  queryParams: [],
  timeout: 30000,
  pollingEnabled: false,
  pollingInterval: 60,
  cacheTTL: 300,
  query: '',
  variables: '{}',
  staticData: '{}',
  authType: 'none',
  authStorage: 'inline',
  bearerToken: '',
  apiKey: '',
  apiKeyName: 'X-API-Key',
  apiKeyPlacement: 'header',
  basicUsername: '',
  basicPassword: '',
  oauth2ClientId: '',
  oauth2ClientSecret: '',
  oauth2AuthUrl: '',
  oauth2TokenUrl: '',
  oauth2Scope: '',
  customHeaders: [{ key: '', value: '' }],
  status: 'draft',
}

// ─── Collapsible section ───────────────────────────────────────

const Section: React.FC<{
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}> = ({ title, icon, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && <div className="px-6 pb-6 pt-2">{children}</div>}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════

export const DataSourceEditor: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()

  const saving = useAppSelector(selectDataSourcesSaving)
  const testing = useAppSelector(selectDataSourcesTesting)
  const testResult = useAppSelector(selectTestResult)
  const existingDS = useAppSelector(id ? selectDSById(id) : () => undefined)

  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [dataLoaded, setDataLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // ─── Load existing data ─────────────────────────────────────

  useEffect(() => {
    if (id) {
      dispatch(fetchDataSourceById(id))
        .unwrap()
        .catch((err: any) => setLoadError(typeof err === 'string' ? err : 'Ошибка загрузки'))
    }
  }, [dispatch, id])

  // When DS loads from store, populate form
  useEffect(() => {
    if (!existingDS || dataLoaded) return

    const config = existingDS.config as any
    const auth = existingDS.authConfig as any

    // Parse headers from object to array
    const headersArr = config?.headers
      ? Object.entries(config.headers).map(([key, value]) => ({ key, value: value as string }))
      : [{ key: '', value: '' }]
    
    const queryParamsArr = config?.queryParams
      ? Object.entries(config.queryParams).map(([key, value]) => ({ key, value: value as string }))
      : []

    const customHeadersArr = auth?.headers
      ? Object.entries(auth.headers).map(([key, value]) => ({ key, value: value as string }))
      : [{ key: '', value: '' }]

    setFormData({
      name: existingDS.name || '',
      description: existingDS.description || '',
      type: existingDS.type,
      url: config?.url || '',
      headers: headersArr.length > 0 ? headersArr : [{ key: '', value: '' }],
      queryParams: queryParamsArr,
      timeout: config?.timeout || 30000,
      // Feed
      pollingEnabled: config?.pollingEnabled || false,
      pollingInterval: config?.pollingInterval || 60,
      cacheTTL: config?.cacheTTL || 300,
      // GraphQL
      query: config?.query || '',
      variables: config?.variables ? JSON.stringify(config.variables, null, 2) : '{}',
      // Static
      staticData: config?.data ? JSON.stringify(config.data, null, 2) : '{}',
      // Auth
      authType: auth?.type || 'none',
      authStorage: auth?.storage || 'inline',
      bearerToken: auth?.token || '',
      apiKey: auth?.key || '',
      apiKeyName: auth?.keyName || 'X-API-Key',
      apiKeyPlacement: auth?.placement || 'header',
      basicUsername: auth?.username || '',
      basicPassword: auth?.password || '',
      oauth2ClientId: auth?.clientId || '',
      oauth2ClientSecret: auth?.clientSecret || '',
      oauth2AuthUrl: auth?.authorizationUrl || '',
      oauth2TokenUrl: auth?.tokenUrl || '',
      oauth2Scope: auth?.scope || '',
      customHeaders: customHeadersArr.length > 0 ? customHeadersArr : [{ key: '', value: '' }],
      status: existingDS.status === 'active' ? 'active' : 'draft',
    })
    setDataLoaded(true)
  }, [existingDS, dataLoaded])

  // ─── Form helpers ───────────────────────────────────────────

  const updateForm = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const addKeyValue = (field: 'headers' | 'queryParams' | 'customHeaders') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], { key: '', value: '' }],
    }))
  }

  const removeKeyValue = (field: 'headers' | 'queryParams' | 'customHeaders', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }))
  }

  const updateKeyValue = (
    field: 'headers' | 'queryParams' | 'customHeaders',
    index: number,
    key: string,
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? { key, value } : item)),
    }))
  }

  const togglePassword = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
  }

  // ─── Build configs ──────────────────────────────────────────

  const buildConfig = useCallback((): any => {
    const headersObj: Record<string, string> = {}
    formData.headers.filter(h => h.key).forEach(h => { headersObj[h.key] = h.value })
    const queryParamsObj: Record<string, string> = {}
    formData.queryParams.filter(p => p.key).forEach(p => { queryParamsObj[p.key] = p.value })

    switch (formData.type) {
      case 'rest-api':
        return {
          type: 'rest-api',
          url: formData.url,
          headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
          queryParams: Object.keys(queryParamsObj).length > 0 ? queryParamsObj : undefined,
          timeout: formData.timeout,
        }
      case 'feed':
        return {
          type: 'feed',
          url: formData.url,
          headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
          queryParams: Object.keys(queryParamsObj).length > 0 ? queryParamsObj : undefined,
          pollingEnabled: formData.pollingEnabled,
          pollingInterval: formData.pollingInterval,
          cacheTTL: formData.cacheTTL,
          timeout: formData.timeout,
        }
      case 'graphql':
        return {
          type: 'graphql',
          url: formData.url,
          headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
          query: formData.query,
          variables: formData.variables ? JSON.parse(formData.variables) : undefined,
          timeout: formData.timeout,
        }
      case 'static':
        return {
          type: 'static',
          data: JSON.parse(formData.staticData),
          dataFormat: 'json',
        }
      default:
        return { type: formData.type }
    }
  }, [formData])

  const buildAuthConfig = useCallback((): any => {
    switch (formData.authType) {
      case 'none':
        return { type: 'none' }
      case 'bearer':
        return { type: 'bearer', token: formData.bearerToken, storage: formData.authStorage }
      case 'api-key':
        return {
          type: 'api-key',
          key: formData.apiKey,
          keyName: formData.apiKeyName,
          placement: formData.apiKeyPlacement,
          storage: formData.authStorage,
        }
      case 'basic':
        return {
          type: 'basic',
          username: formData.basicUsername,
          password: formData.basicPassword,
          storage: formData.authStorage,
        }
      case 'oauth2':
        return {
          type: 'oauth2',
          clientId: formData.oauth2ClientId,
          clientSecret: formData.oauth2ClientSecret,
          authorizationUrl: formData.oauth2AuthUrl,
          tokenUrl: formData.oauth2TokenUrl,
          scope: formData.oauth2Scope,
          storage: formData.authStorage,
        }
      case 'custom': {
        const obj: Record<string, string> = {}
        formData.customHeaders.filter(h => h.key).forEach(h => { obj[h.key] = h.value })
        return { type: 'custom', headers: obj, storage: formData.authStorage }
      }
      default:
        return { type: 'none' }
    }
  }, [formData])

  // ─── Actions ────────────────────────────────────────────────

  const handleTest = async () => {
    dispatch(clearTestResult())
    if (!formData.type) return
    await dispatch(testNewDataSourceConnection({
      type: formData.type,
      config: buildConfig(),
      authConfig: buildAuthConfig(),
    }))
  }

  const handleSave = async () => {
    if (!formData.type || !formData.name || !id) return
    try {
      await dispatch(updateDataSource({
        id,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          config: buildConfig(),
          authConfig: buildAuthConfig(),
          status: formData.status,
        },
      })).unwrap()
      navigate('/data-sources')
    } catch (error) {
      console.error('Failed to save:', error)
    }
  }

  // ─── Loading / Error ────────────────────────────────────────

  if (!dataLoaded && !loadError) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Загрузка источника данных...</span>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center">
          <XCircle size={48} className="text-red-400 mb-4" />
          <p className="text-gray-700 text-lg mb-2">Не удалось загрузить источник данных</p>
          <p className="text-gray-500 text-sm mb-6">{loadError}</p>
          <Button onClick={() => navigate('/data-sources')}>
            <ArrowLeft size={16} className="mr-2" /> Назад к списку
          </Button>
        </div>
      </div>
    )
  }

  const typeLabel = DATA_SOURCE_TYPES.find(t => t.value === formData.type)?.label || formData.type

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/data-sources')}
                className="flex items-center text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-2">
                {formData.type && typeIcons[formData.type]}
                <div>
                  <h1 className="text-lg font-bold text-gray-900">{formData.name || 'Без названия'}</h1>
                  <p className="text-xs text-gray-500">{typeLabel} · Редактирование</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => navigate('/data-sources')}>
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={saving || !formData.name}>
                {saving ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Сохранение...</>
                ) : (
                  <><Save size={16} className="mr-2" /> Сохранить</>
                )}
              </Button>
            </div>
          </div>

          {/* ══ Section 1: Basic Info ══ */}
          <Section title="Основная информация" icon={<Database size={18} className="text-gray-500" />}>
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={e => updateForm({ name: e.target.value })}
                  placeholder="Например: Products API"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                <textarea
                  value={formData.description}
                  onChange={e => updateForm({ description: e.target.value })}
                  placeholder="Описание источника данных..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white text-gray-700"
                  rows={2}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm bg-white text-gray-700">
                    {formData.type && typeIcons[formData.type]}
                    {typeLabel}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Тип нельзя изменить после создания</p>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                  <select
                    value={formData.status}
                    onChange={e => updateForm({ status: e.target.value as 'active' | 'draft' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700"
                  >
                    <option value="draft">Черновик</option>
                    <option value="active">Активный</option>
                  </select>
                </div>
              </div>
            </div>
          </Section>

          {/* ══ Section 2: Connection ══ */}
          <Section title="Подключение" icon={<Globe size={18} className="text-blue-500" />}>
            {(formData.type === 'rest-api' || formData.type === 'feed') && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base URL (Origin) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.url}
                    onChange={e => updateForm({ url: e.target.value })}
                    placeholder="https://api.example.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Базовый адрес сервиса. Конкретные endpoint настраиваются при привязке к блоку.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Общие заголовки</label>
                  {formData.headers.map((header, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        value={header.key}
                        onChange={e => updateKeyValue('headers', index, e.target.value, header.value)}
                        placeholder="Header name"
                        className="flex-1"
                      />
                      <Input
                        value={header.value}
                        onChange={e => updateKeyValue('headers', index, header.key, e.target.value)}
                        placeholder="Value"
                        className="flex-1"
                      />
                      {formData.headers.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeKeyValue('headers', index)}>
                          <X size={16} />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => addKeyValue('headers')}>
                    + Добавить заголовок
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (мс)</label>
                  <Input
                    type="number"
                    value={formData.timeout}
                    onChange={e => updateForm({ timeout: parseInt(e.target.value) || 30000 })}
                    min={1000}
                    max={120000}
                  />
                </div>

                {/* Feed-specific */}
                {formData.type === 'feed' && (
                  <>
                    <hr />
                    <h4 className="font-medium text-gray-900 text-sm">Настройки Feed</h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="pollingEnabled"
                        checked={formData.pollingEnabled}
                        onChange={e => updateForm({ pollingEnabled: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="pollingEnabled" className="text-sm text-gray-700">
                        Авто-обновление (polling)
                      </label>
                    </div>
                    {formData.pollingEnabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Интервал (секунды)
                        </label>
                        <Input
                          type="number"
                          value={formData.pollingInterval}
                          onChange={e => updateForm({ pollingInterval: parseInt(e.target.value) || 60 })}
                          min={10}
                          max={3600}
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cache TTL (секунды)</label>
                      <Input
                        type="number"
                        value={formData.cacheTTL}
                        onChange={e => updateForm({ cacheTTL: parseInt(e.target.value) || 300 })}
                        min={0}
                        max={86400}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {formData.type === 'graphql' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GraphQL Endpoint <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.url}
                    onChange={e => updateForm({ url: e.target.value })}
                    placeholder="https://api.example.com/graphql"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Query</label>
                  <textarea
                    value={formData.query}
                    onChange={e => updateForm({ query: e.target.value })}
                    placeholder="query { ... }"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm resize-y"
                    rows={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Variables (JSON)</label>
                  <textarea
                    value={formData.variables}
                    onChange={e => updateForm({ variables: e.target.value })}
                    placeholder="{}"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm resize-y"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {formData.type === 'static' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">JSON Data</label>
                  <textarea
                    value={formData.staticData}
                    onChange={e => updateForm({ staticData: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm resize-y"
                    rows={12}
                  />
                  {(() => {
                    try {
                      JSON.parse(formData.staticData)
                      return <p className="text-sm text-green-600 mt-1">✓ Valid JSON</p>
                    } catch (e: any) {
                      return <p className="text-sm text-red-600 mt-1">✗ Invalid JSON: {e.message}</p>
                    }
                  })()}
                </div>
              </div>
            )}

            {!['rest-api', 'feed', 'graphql', 'static'].includes(formData.type || '') && (
              <p className="text-gray-500 text-sm py-4">
                Настройка подключения для типа «{typeLabel}» пока в разработке.
              </p>
            )}
          </Section>

          {/* ══ Section 3: Auth ══ */}
          <Section title="Авторизация" icon={<Check size={18} className="text-green-500" />} defaultOpen={formData.authType !== 'none'}>
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Тип авторизации</label>
                <select
                  value={formData.authType}
                  onChange={e => updateForm({ authType: e.target.value as AuthType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700"
                >
                  {AUTH_TYPES.map(auth => (
                    <option key={auth.value} value={auth.value}>{auth.label}</option>
                  ))}
                </select>
              </div>

              {formData.authType === 'bearer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bearer Token</label>
                  <div className="relative">
                    <Input
                      type={showPasswords.bearer ? 'text' : 'password'}
                      value={formData.bearerToken}
                      onChange={e => updateForm({ bearerToken: e.target.value })}
                      placeholder="Введите токен"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => togglePassword('bearer')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.bearer ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {formData.authType === 'api-key' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <div className="relative">
                      <Input
                        type={showPasswords.apiKey ? 'text' : 'password'}
                        value={formData.apiKey}
                        onChange={e => updateForm({ apiKey: e.target.value })}
                        placeholder="API ключ"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => togglePassword('apiKey')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.apiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Имя ключа</label>
                    <Input
                      value={formData.apiKeyName}
                      onChange={e => updateForm({ apiKeyName: e.target.value })}
                      placeholder="X-API-Key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Размещение</label>
                    <select
                      value={formData.apiKeyPlacement}
                      onChange={e => updateForm({ apiKeyPlacement: e.target.value as 'header' | 'query' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="header">Header</option>
                      <option value="query">Query Parameter</option>
                    </select>
                  </div>
                </>
              )}

              {formData.authType === 'basic' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <Input
                      value={formData.basicUsername}
                      onChange={e => updateForm({ basicUsername: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <div className="relative">
                      <Input
                        type={showPasswords.basic ? 'text' : 'password'}
                        value={formData.basicPassword}
                        onChange={e => updateForm({ basicPassword: e.target.value })}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => togglePassword('basic')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.basic ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {formData.authType === 'oauth2' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                    <Input value={formData.oauth2ClientId} onChange={e => updateForm({ oauth2ClientId: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                    <div className="relative">
                      <Input
                        type={showPasswords.oauth2 ? 'text' : 'password'}
                        value={formData.oauth2ClientSecret}
                        onChange={e => updateForm({ oauth2ClientSecret: e.target.value })}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => togglePassword('oauth2')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords.oauth2 ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Authorization URL</label>
                    <Input value={formData.oauth2AuthUrl} onChange={e => updateForm({ oauth2AuthUrl: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Token URL</label>
                    <Input value={formData.oauth2TokenUrl} onChange={e => updateForm({ oauth2TokenUrl: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                    <Input value={formData.oauth2Scope} onChange={e => updateForm({ oauth2Scope: e.target.value })} />
                  </div>
                </>
              )}

              {formData.authType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Headers</label>
                  {formData.customHeaders.map((header, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        value={header.key}
                        onChange={e => updateKeyValue('customHeaders', index, e.target.value, header.value)}
                        placeholder="Header"
                        className="flex-1"
                      />
                      <Input
                        value={header.value}
                        onChange={e => updateKeyValue('customHeaders', index, header.key, e.target.value)}
                        placeholder="Value"
                        className="flex-1"
                      />
                      {formData.customHeaders.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeKeyValue('customHeaders', index)}>
                          <X size={16} />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => addKeyValue('customHeaders')}>
                    + Добавить заголовок
                  </Button>
                </div>
              )}

              {/* Storage */}
              {formData.authType !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Хранение credentials</label>
                  <select
                    value={formData.authStorage}
                    onChange={e => updateForm({ authStorage: e.target.value as CredentialsStorage })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="inline">Шифрование в БД (AES-256)</option>
                    <option value="env">Переменная окружения</option>
                    <option value="secrets">Secrets Manager (скоро)</option>
                  </select>
                </div>
              )}
            </div>
          </Section>

          {/* ══ Section 4: Test ══ */}
          <Section title="Тестирование подключения" icon={<CheckCircle size={18} className="text-cyan-500" />} defaultOpen={false}>
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center gap-4">
                <Button onClick={handleTest} disabled={testing}>
                  {testing ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Тестирование...</>
                  ) : (
                    <><Globe size={16} className="mr-2" /> Тест подключения</>
                  )}
                </Button>
                {testResult && (
                  <div className={`flex items-center ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? (
                      <><CheckCircle size={20} className="mr-2" /> Подключение успешно!</>
                    ) : (
                      <><XCircle size={20} className="mr-2" /> Ошибка подключения</>
                    )}
                  </div>
                )}
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  {testResult.responseTime && (
                    <p className="text-sm text-gray-600 mb-2">Время ответа: {testResult.responseTime}мс</p>
                  )}
                  {testResult.error && (
                    <div className="mb-4">
                      <p className="font-medium text-red-800">{testResult.error.code}</p>
                      <p className="text-red-700">{testResult.error.message}</p>
                    </div>
                  )}
                  {testResult.sampleData !== undefined && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Пример данных:</p>
                      <pre className="bg-white p-3 rounded border text-xs overflow-auto max-h-64 text-gray-700">
                        {typeof testResult.sampleData === 'string'
                          ? testResult.sampleData
                          : JSON.stringify(testResult.sampleData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Bottom save bar */}
          <div className="sticky bottom-4 flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => navigate('/data-sources')}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name}>
              {saving ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> Сохранение...</>
              ) : (
                <><Save size={16} className="mr-2" /> Сохранить изменения</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DataSourceEditor
