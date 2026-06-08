import React, { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Header } from '@/shared/components/Header'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Globe,
  Database,
  Rss,
  FileJson,
  Braces,
  Plug,
  Calculator,
  FormInput,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  createDataSource,
  updateDataSource,
  testNewDataSourceConnection,
  selectDataSourcesSaving,
  selectDataSourcesTesting,
  selectTestResult,
  clearTestResult
} from '@/features/data-sources/dataSourcesSlice'
import type {
  DataSourceType,
  DataSourceWizardStep,
  AuthType,
  CredentialsStorage,
  CreateDataSourceRequest
} from '@/shared/types/dataSource'
import { DATA_SOURCE_TYPES, AUTH_TYPES, getDataSourceMeta } from '@/shared/types/dataSource'

/**
 * DataSourceWizard - Wizard для создания/редактирования Data Source
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 1.2 Frontend: DataSourceWizard
 * 
 * Шаги:
 * 1. Выбор типа (карточки)
 * 2. Основная информация
 * 3. Настройка подключения
 * 4. Авторизация
 * 5. Тестирование
 */

// Иконки для типов источников
const typeIcons: Record<DataSourceType, React.ReactNode> = {
  'rest-api': <Globe size={32} className="text-blue-500" />,
  'feed': <Rss size={32} className="text-orange-500" />,
  'graphql': <Braces size={32} className="text-pink-500" />,
  'database': <Database size={32} className="text-purple-500" />,
  'external': <Plug size={32} className="text-green-500" />,
  'static': <FileJson size={32} className="text-gray-500" />,
  'computed': <Calculator size={32} className="text-cyan-500" />,
  'form-data': <FormInput size={32} className="text-yellow-500" />
}

// Шаги wizard-а
const STEPS: { key: DataSourceWizardStep; label: string }[] = [
  { key: 'type', label: 'Type' },
  { key: 'basic', label: 'Basic Info' },
  { key: 'connection', label: 'Connection' },
  { key: 'auth', label: 'Authentication' },
  { key: 'test', label: 'Test' }
]

interface FormData {
  // Basic
  name: string
  description: string
  type: DataSourceType | null
  
  // Connection - REST API / Feed
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers: { key: string; value: string }[]
  queryParams: { key: string; value: string }[]
  body: string
  bodyFormat: 'json' | 'form-data' | 'raw'
  timeout: number
  
  // Connection - Feed specific
  pollingEnabled: boolean
  pollingInterval: number
  cacheTTL: number
  
  // Connection - GraphQL
  query: string
  variables: string
  
  // Connection - Static
  staticData: string

  // Connection - Form Data (client-runtime)
  formDataType: 'url-params' | 'local-storage' | 'session-storage' | 'cookies'
  formDataKey: string
  formDataDefault: string

  // Connection - Database (read-only SQL)
  databaseType: 'postgresql' | 'mysql'
  dbConnectionMode: 'fields' | 'connectionString'
  dbHost: string
  dbPort: string
  dbDatabase: string
  dbUsername: string
  dbPassword: string
  dbConnectionString: string
  dbQuery: string
  dbQueryParams: string

  // Auth
  authType: AuthType
  authStorage: CredentialsStorage
  // Bearer
  bearerToken: string
  // API Key
  apiKey: string
  apiKeyName: string
  apiKeyPlacement: 'header' | 'query'
  // Basic
  basicUsername: string
  basicPassword: string
  // OAuth2
  oauth2ClientId: string
  oauth2ClientSecret: string
  oauth2AuthUrl: string
  oauth2TokenUrl: string
  oauth2Scope: string
  // Custom
  customHeaders: { key: string; value: string }[]
  // Macro HMAC
  macroDomain: string
  macroAppSecret: string
  
  // Status
  status: 'active' | 'draft'
  tags: string[]
}

const initialFormData: FormData = {
  name: '',
  description: '',
  type: null,
  url: '',
  method: 'GET',
  headers: [{ key: '', value: '' }],
  queryParams: [{ key: '', value: '' }],
  body: '',
  bodyFormat: 'json',
  timeout: 30000,
  pollingEnabled: false,
  pollingInterval: 60,
  cacheTTL: 0,
  query: '',
  variables: '{}',
  staticData: '{}',
  formDataType: 'url-params',
  formDataKey: '',
  formDataDefault: '',
  databaseType: 'postgresql',
  dbConnectionMode: 'fields',
  dbHost: '',
  dbPort: '',
  dbDatabase: '',
  dbUsername: '',
  dbPassword: '',
  dbConnectionString: '',
  dbQuery: '',
  dbQueryParams: '{}',
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
  macroDomain: '',
  macroAppSecret: '',
  status: 'draft',
  tags: []
}

export const DataSourceWizard: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const dispatch = useAppDispatch()
  
  const saving = useAppSelector(selectDataSourcesSaving)
  const testing = useAppSelector(selectDataSourcesTesting)
  const testResult = useAppSelector(selectTestResult)
  
  const isEditing = id && id !== 'new'
  
  const [currentStep, setCurrentStep] = useState<DataSourceWizardStep>('type')
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  // Навигация по шагам
  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep)
  
  const canGoNext = useCallback(() => {
    switch (currentStep) {
      case 'type':
        return formData.type !== null
      case 'basic':
        return formData.name.trim().length > 0
      case 'connection':
        if (formData.type === 'rest-api' || formData.type === 'feed' || formData.type === 'graphql') {
          return formData.url.trim().length > 0
        }
        if (formData.type === 'static') {
          try {
            JSON.parse(formData.staticData)
            return true
          } catch {
            return false
          }
        }
        if (formData.type === 'form-data') {
          // url-params без ключа допустимо (вернётся объект всех параметров);
          // для storage/cookies ключ обязателен.
          return formData.formDataType === 'url-params' || formData.formDataKey.trim().length > 0
        }
        if (formData.type === 'database') {
          if (formData.dbQuery.trim().length === 0) return false
          return formData.dbConnectionMode === 'connectionString'
            ? formData.dbConnectionString.trim().length > 0
            : formData.dbHost.trim().length > 0 && formData.dbDatabase.trim().length > 0
        }
        return true
      case 'auth':
        return true
      case 'test':
        return true
      default:
        return false
    }
  }, [currentStep, formData])

  const goNext = () => {
    if (currentStepIndex < STEPS.length - 1 && canGoNext()) {
      setCurrentStep(STEPS[currentStepIndex + 1].key)
    }
  }

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1].key)
    }
  }

  // Обновление формы
  const updateForm = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  // Добавление/удаление пар ключ-значение
  const addKeyValue = (field: 'headers' | 'queryParams' | 'customHeaders') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], { key: '', value: '' }]
    }))
  }

  const removeKeyValue = (field: 'headers' | 'queryParams' | 'customHeaders', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
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
      [field]: prev[field].map((item, i) => 
        i === index ? { key, value } : item
      )
    }))
  }

  // Построение конфига для API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildConfig = (): any => {
    const headersObj: Record<string, string> = {}
    formData.headers.filter(h => h.key).forEach(h => {
      headersObj[h.key] = h.value
    })

    const queryParamsObj: Record<string, string> = {}
    formData.queryParams.filter(p => p.key).forEach(p => {
      queryParamsObj[p.key] = p.value
    })

    switch (formData.type) {
      case 'rest-api':
        return {
          type: 'rest-api',
          url: formData.url,
          headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
          queryParams: Object.keys(queryParamsObj).length > 0 ? queryParamsObj : undefined,
          cacheTTL: formData.cacheTTL || 0,
          timeout: formData.timeout
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
          timeout: formData.timeout
        }
      
      case 'graphql':
        return {
          type: 'graphql',
          url: formData.url,
          headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
          query: formData.query,
          variables: formData.variables ? JSON.parse(formData.variables) : undefined,
          cacheTTL: formData.cacheTTL || 0,
          timeout: formData.timeout
        }
      
      case 'static':
        return {
          type: 'static',
          data: JSON.parse(formData.staticData),
          dataFormat: 'json'
        }

      case 'form-data': {
        // defaultValue: пробуем распарсить как JSON, иначе оставляем строкой
        let defaultValue: unknown = formData.formDataDefault || undefined
        if (typeof defaultValue === 'string' && defaultValue.trim()) {
          try { defaultValue = JSON.parse(defaultValue) } catch { /* строка как есть */ }
        }
        return {
          type: 'form-data',
          dataType: formData.formDataType,
          key: formData.formDataKey || undefined,
          defaultValue,
        }
      }

      case 'database': {
        let queryParams: Record<string, unknown> | undefined
        if (formData.dbQueryParams.trim()) {
          try {
            const parsed = JSON.parse(formData.dbQueryParams)
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) queryParams = parsed
          } catch { /* невалидный JSON — игнорируем */ }
        }
        const base = {
          type: 'database',
          databaseType: formData.databaseType,
          query: formData.dbQuery,
          ...(queryParams ? { queryParams } : {}),
        }
        if (formData.dbConnectionMode === 'connectionString') {
          return { ...base, connectionString: formData.dbConnectionString }
        }
        return {
          ...base,
          host: formData.dbHost,
          port: formData.dbPort ? parseInt(formData.dbPort, 10) : undefined,
          database: formData.dbDatabase,
          username: formData.dbUsername || undefined,
          password: formData.dbPassword || undefined,
        }
      }

      default:
        return { type: formData.type }
    }
  }

  // Построение authConfig для API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildAuthConfig = (): any => {
    switch (formData.authType) {
      case 'none':
        return { type: 'none' }
      
      case 'bearer':
        return {
          type: 'bearer',
          token: formData.bearerToken,
          storage: formData.authStorage
        }
      
      case 'api-key':
        return {
          type: 'api-key',
          key: formData.apiKey,
          keyName: formData.apiKeyName,
          placement: formData.apiKeyPlacement,
          storage: formData.authStorage
        }
      
      case 'basic':
        return {
          type: 'basic',
          username: formData.basicUsername,
          password: formData.basicPassword,
          storage: formData.authStorage
        }
      
      case 'oauth2':
        return {
          type: 'oauth2',
          clientId: formData.oauth2ClientId,
          clientSecret: formData.oauth2ClientSecret,
          authorizationUrl: formData.oauth2AuthUrl,
          tokenUrl: formData.oauth2TokenUrl,
          scope: formData.oauth2Scope,
          storage: formData.authStorage
        }
      
      case 'custom': {
        const customHeadersObj: Record<string, string> = {}
        formData.customHeaders.filter(h => h.key).forEach(h => {
          customHeadersObj[h.key] = h.value
        })
        return {
          type: 'custom',
          headers: customHeadersObj,
          storage: formData.authStorage
        }
      }
      
      case 'macro-hmac':
        return {
          type: 'macro-hmac',
          domain: formData.macroDomain,
          appSecret: formData.macroAppSecret,
          storage: formData.authStorage
        }
      
      default:
        return undefined
    }
  }

  // Тестирование подключения
  const handleTest = async () => {
    dispatch(clearTestResult())
    
    if (!formData.type) return
    
    await dispatch(testNewDataSourceConnection({
      type: formData.type,
      config: buildConfig(),
      authConfig: buildAuthConfig()
    }))
  }

  // Сохранение
  const handleSave = async () => {
    if (!formData.type || !formData.name) return

    const data: CreateDataSourceRequest = {
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
      config: buildConfig(),
      authConfig: buildAuthConfig(),
      status: formData.status,
      tags: formData.tags.length > 0 ? formData.tags : undefined
    }

    try {
      if (isEditing) {
        await dispatch(updateDataSource({ id, data })).unwrap()
      } else {
        await dispatch(createDataSource(data)).unwrap()
      }
      navigate('/data-sources')
    } catch (error) {
      console.error('Failed to save:', error)
    }
  }

  // Toggle пароля
  const togglePassword = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
  }

  // Рендер шагов
  const renderStepContent = () => {
    switch (currentStep) {
      case 'type':
        return renderTypeStep()
      case 'basic':
        return renderBasicStep()
      case 'connection':
        return renderConnectionStep()
      case 'auth':
        return renderAuthStep()
      case 'test':
        return renderTestStep()
      default:
        return null
    }
  }

  // Шаг 1: Выбор типа
  const renderTypeStep = () => (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Choose Data Source Type</h2>
      <p className="text-gray-600 mb-6">Select the type of data source you want to create</p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {DATA_SOURCE_TYPES.map(type => {
          const meta = getDataSourceMeta(type.value)
          const isTechdebt = meta.status === 'techdebt'
          const isBeta = meta.status === 'beta'
          return (
            <button
              key={type.value}
              disabled={isTechdebt}
              title={isTechdebt ? 'Тип в разработке — пока недоступен' : undefined}
              onClick={() => { if (!isTechdebt) updateForm({ type: type.value }) }}
              className={`relative p-4 rounded-lg border-2 text-left transition-all ${
                isTechdebt
                  ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                  : formData.type === type.value
                  ? 'border-blue-500 bg-blue-50 hover:shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
            >
              {isTechdebt && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-semibold bg-gray-200 text-gray-600 rounded">
                  в разработке
                </span>
              )}
              {isBeta && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded">
                  beta
                </span>
              )}
              <div className="mb-3">{typeIcons[type.value]}</div>
              <div className="font-medium text-gray-900">{type.label}</div>
              <div className="text-sm text-gray-500 mt-1">{type.description}</div>
            </button>
          )
        })}
      </div>
    </div>
  )

  // Шаг 2: Основная информация
  const renderBasicStep = () => (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Basic Information</h2>
      <p className="text-gray-600 mb-6">Give your data source a name and description</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.name}
            onChange={(e) => updateForm({ name: e.target.value })}
            placeholder="e.g., Products API, Blog Posts"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => updateForm({ description: e.target.value })}
            placeholder="Optional description..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white text-gray-700"
            rows={3}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => updateForm({ status: e.target.value as 'active' | 'draft' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
        </div>
      </div>
    </div>
  )

  // Шаг 3: Настройка подключения
  const renderConnectionStep = () => {
    switch (formData.type) {
      case 'rest-api':
      case 'feed':
        return renderRestApiConnection()
      case 'graphql':
        return renderGraphQLConnection()
      case 'static':
        return renderStaticDataConnection()
      case 'form-data':
        return renderFormDataConnection()
      case 'database':
        return renderDatabaseConnection()
      default:
        return (
          <div className="text-center text-gray-500 py-8">
            Connection settings for {formData.type} type coming soon...
          </div>
        )
    }
  }

  // REST API / Feed подключение
  const renderRestApiConnection = () => (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Настройка подключения</h2>
      <p className="text-gray-600 mb-6">
        Укажите базовый URL сервиса и общие параметры. Конкретные endpointы и методы настраиваются при подключении к блоку.
      </p>
      
      <div className="space-y-4">
        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Base URL (Origin) <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.url}
            onChange={(e) => updateForm({ url: e.target.value })}
            placeholder="https://api.example.com"
          />
          <p className="mt-1 text-xs text-gray-500">
            Базовый адрес сервиса без конкретного endpoint. Например: https://api.example.com
          </p>
        </div>

        {/* Default Headers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Общие заголовки (для всех запросов)
          </label>
          {formData.headers.map((header, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <Input
                value={header.key}
                onChange={(e) => updateKeyValue('headers', index, e.target.value, header.value)}
                placeholder="Header name"
                className="flex-1"
              />
              <Input
                value={header.value}
                onChange={(e) => updateKeyValue('headers', index, header.key, e.target.value)}
                placeholder="Value"
                className="flex-1"
              />
              {formData.headers.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeKeyValue('headers', index)}
                >
                  <X size={16} />
                </Button>
              )}
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => addKeyValue('headers')}>
            + Add Header
          </Button>
        </div>

        {/* Timeout */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timeout (ms)
          </label>
          <Input
            type="number"
            value={formData.timeout}
            onChange={(e) => updateForm({ timeout: parseInt(e.target.value) || 30000 })}
            min={1000}
            max={120000}
          />
        </div>

        {/* Feed-specific settings */}
        {formData.type === 'feed' && (
          <>
            <hr className="my-4" />
            <h3 className="font-medium text-gray-900">Feed Settings</h3>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pollingEnabled"
                checked={formData.pollingEnabled}
                onChange={(e) => updateForm({ pollingEnabled: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="pollingEnabled" className="text-sm text-gray-700">
                Enable auto-refresh (polling)
              </label>
            </div>
            
            {formData.pollingEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Polling Interval (seconds)
                </label>
                <Input
                  type="number"
                  value={formData.pollingInterval}
                  onChange={(e) => updateForm({ pollingInterval: parseInt(e.target.value) || 60 })}
                  min={10}
                  max={3600}
                />
              </div>
            )}
          </>
        )}

        {/* Cache TTL — для rest-api, feed, graphql */}
        {(formData.type === 'rest-api' || formData.type === 'feed' || formData.type === 'graphql') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cache TTL (seconds)
            </label>
            <Input
              type="number"
              value={formData.cacheTTL}
              onChange={(e) => updateForm({ cacheTTL: parseInt(e.target.value) || 0 })}
              min={0}
              max={86400}
            />
            <p className="mt-1 text-xs text-gray-500">Время жизни кеша ответов от API. 0 = кеш отключён.</p>
          </div>
        )}
      </div>
    </div>
  )

  // GraphQL подключение
  const renderGraphQLConnection = () => (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">GraphQL Settings</h2>
      <p className="text-gray-600 mb-6">Configure your GraphQL endpoint and query</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GraphQL Endpoint <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.url}
            onChange={(e) => updateForm({ url: e.target.value })}
            placeholder="https://api.example.com/graphql"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Query
          </label>
          <textarea
            value={formData.query}
            onChange={(e) => updateForm({ query: e.target.value })}
            placeholder={`query GetProducts {
  products {
    id
    name
    price
  }
}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            rows={8}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Variables (JSON)
          </label>
          <textarea
            value={formData.variables}
            onChange={(e) => updateForm({ variables: e.target.value })}
            placeholder='{}'
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            rows={3}
          />
        </div>
      </div>
    </div>
  )

  // Static Data подключение
  const renderStaticDataConnection = () => (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Static Data</h2>
      <p className="text-gray-600 mb-6">Enter your JSON data directly</p>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          JSON Data <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.staticData}
          onChange={(e) => updateForm({ staticData: e.target.value })}
          placeholder={`{
  "items": [
    { "id": 1, "name": "Item 1" },
    { "id": 2, "name": "Item 2" }
  ]
}`}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
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
  )

  // Form Data подключение (client-runtime: значение читается в браузере)
  const FORM_DATA_SOURCES: { value: FormData['formDataType']; label: string; hint: string; keyPlaceholder: string }[] = [
    { value: 'url-params', label: 'URL-параметры (query string)', hint: 'Из ?key=value текущей страницы. Без ключа — объект со всеми параметрами.', keyPlaceholder: 'category' },
    { value: 'local-storage', label: 'localStorage', hint: 'Из localStorage браузера по ключу (значение JSON.parse, если возможно).', keyPlaceholder: 'user_prefs' },
    { value: 'session-storage', label: 'sessionStorage', hint: 'Из sessionStorage браузера по ключу.', keyPlaceholder: 'cart_id' },
    { value: 'cookies', label: 'Cookies', hint: 'Из cookie браузера по имени.', keyPlaceholder: 'session_token' },
  ]

  const renderFormDataConnection = () => {
    const selected = FORM_DATA_SOURCES.find(s => s.value === formData.formDataType) || FORM_DATA_SOURCES[0]
    const keyRequired = formData.formDataType !== 'url-params'
    return (
      <div className="max-w-2xl">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Form Data</h2>
        <p className="text-gray-600 mb-6">
          Значение читается в браузере посетителя при загрузке страницы — бэкенд этот источник не запрашивает.
          Подходит для фильтров из URL, сохранённых настроек и т.п.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Источник значения</label>
            <select
              value={formData.formDataType}
              onChange={(e) => updateForm({ formDataType: e.target.value as FormData['formDataType'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700"
            >
              {FORM_DATA_SOURCES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">{selected.hint}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ключ {keyRequired && <span className="text-red-500">*</span>}
              {!keyRequired && <span className="text-gray-400"> (необязательно)</span>}
            </label>
            <Input
              value={formData.formDataKey}
              onChange={(e) => updateForm({ formDataKey: e.target.value })}
              placeholder={selected.keyPlaceholder}
            />
            {keyRequired && formData.formDataKey.trim().length === 0 && (
              <p className="mt-1 text-xs text-red-600">Для {selected.label} ключ обязателен</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Значение по умолчанию <span className="text-gray-400">(необязательно)</span>
            </label>
            <Input
              value={formData.formDataDefault}
              onChange={(e) => updateForm({ formDataDefault: e.target.value })}
              placeholder="напр. all или {}"
            />
            <p className="mt-1 text-xs text-gray-500">
              Используется, если ключ отсутствует. Валидный JSON парсится автоматически, иначе — строка.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Database подключение (read-only SQL: PostgreSQL / MySQL)
  const renderDatabaseConnection = () => (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Database (read-only)</h2>
      <p className="text-gray-600 mb-6">
        Подключение к PostgreSQL или MySQL. Разрешены только <span className="font-medium">SELECT</span>-запросы:
        они выполняются в read-only транзакции с таймаутом. Значения подставляются параметрами
        (<code className="bg-gray-100 px-1 rounded">:имя</code>), не конкатенацией.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">СУБД</label>
          <select
            value={formData.databaseType}
            onChange={(e) => updateForm({ databaseType: e.target.value as 'postgresql' | 'mysql' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700"
          >
            <option value="postgresql">PostgreSQL</option>
            <option value="mysql">MySQL</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Способ подключения</label>
          <div className="flex gap-2">
            {(['fields', 'connectionString'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => updateForm({ dbConnectionMode: mode })}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  formData.dbConnectionMode === mode
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {mode === 'fields' ? 'Поля (host/db/...)' : 'Connection string'}
              </button>
            ))}
          </div>
        </div>

        {formData.dbConnectionMode === 'connectionString' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Connection string <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type={showPasswords.dbConn ? 'text' : 'password'}
                value={formData.dbConnectionString}
                onChange={(e) => updateForm({ dbConnectionString: e.target.value })}
                placeholder={formData.databaseType === 'postgresql'
                  ? 'postgresql://user:pass@host:5432/dbname'
                  : 'mysql://user:pass@host:3306/dbname'}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => togglePassword('dbConn')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPasswords.dbConn ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">Шифруется AES-256 перед сохранением.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Host <span className="text-red-500">*</span></label>
              <Input value={formData.dbHost} onChange={(e) => updateForm({ dbHost: e.target.value })} placeholder="db.example.com" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <Input value={formData.dbPort} onChange={(e) => updateForm({ dbPort: e.target.value })} placeholder={formData.databaseType === 'postgresql' ? '5432' : '3306'} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Database <span className="text-red-500">*</span></label>
              <Input value={formData.dbDatabase} onChange={(e) => updateForm({ dbDatabase: e.target.value })} placeholder="app_production" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <Input value={formData.dbUsername} onChange={(e) => updateForm({ dbUsername: e.target.value })} placeholder="readonly_user" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Input
                  type={showPasswords.dbPass ? 'text' : 'password'}
                  value={formData.dbPassword}
                  onChange={(e) => updateForm({ dbPassword: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => togglePassword('dbPass')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.dbPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">Шифруется AES-256.</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SQL-запрос (только SELECT) <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.dbQuery}
            onChange={(e) => updateForm({ dbQuery: e.target.value })}
            placeholder={'SELECT id, title, slug FROM projects\nWHERE status = :status\nORDER BY created_at DESC'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            rows={6}
          />
          <p className="mt-1 text-xs text-gray-500">
            Параметры вида <code className="bg-gray-100 px-1 rounded">:имя</code> подставляются из значений ниже.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Значения параметров (JSON)
          </label>
          <textarea
            value={formData.dbQueryParams}
            onChange={(e) => updateForm({ dbQueryParams: e.target.value })}
            placeholder={'{\n  "status": "active"\n}'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            rows={3}
          />
          {(() => {
            if (!formData.dbQueryParams.trim()) return null
            try {
              JSON.parse(formData.dbQueryParams)
              return <p className="text-xs text-green-600 mt-1">✓ Valid JSON</p>
            } catch (e: any) {
              return <p className="text-xs text-red-600 mt-1">✗ Invalid JSON: {e.message}</p>
            }
          })()}
        </div>
      </div>
    </div>
  )

  // Шаг 4: Авторизация
  const renderAuthStep = () => (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication</h2>
      <p className="text-gray-600 mb-6">Configure authentication for your data source</p>
      
      <div className="space-y-4">
        {/* Auth Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Authentication Type
          </label>
          <select
            value={formData.authType}
            onChange={(e) => updateForm({ authType: e.target.value as AuthType })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700"
          >
            {AUTH_TYPES.map(auth => (
              <option key={auth.value} value={auth.value}>
                {auth.label}
              </option>
            ))}
          </select>
        </div>

        {/* Auth-specific fields */}
        {formData.authType === 'bearer' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bearer Token
            </label>
            <div className="relative">
              <Input
                type={showPasswords.bearer ? 'text' : 'password'}
                value={formData.bearerToken}
                onChange={(e) => updateForm({ bearerToken: e.target.value })}
                placeholder="Enter your token"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <div className="relative">
                <Input
                  type={showPasswords.apiKey ? 'text' : 'password'}
                  value={formData.apiKey}
                  onChange={(e) => updateForm({ apiKey: e.target.value })}
                  placeholder="Enter your API key"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key Name
              </label>
              <Input
                value={formData.apiKeyName}
                onChange={(e) => updateForm({ apiKeyName: e.target.value })}
                placeholder="X-API-Key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placement
              </label>
              <select
                value={formData.apiKeyPlacement}
                onChange={(e) => updateForm({ apiKeyPlacement: e.target.value as 'header' | 'query' })}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <Input
                value={formData.basicUsername}
                onChange={(e) => updateForm({ basicUsername: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPasswords.basic ? 'text' : 'password'}
                  value={formData.basicPassword}
                  onChange={(e) => updateForm({ basicPassword: e.target.value })}
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

        {formData.authType === 'macro-hmac' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domain
              </label>
              <Input
                value={formData.macroDomain}
                onChange={(e) => updateForm({ macroDomain: e.target.value })}
                placeholder="example.com"
              />
              <p className="text-xs text-gray-500 mt-1">Домен сайта для подписи запросов</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                App Secret
              </label>
              <div className="relative">
                <Input
                  type={showPasswords.macroSecret ? 'text' : 'password'}
                  value={formData.macroAppSecret}
                  onChange={(e) => updateForm({ macroAppSecret: e.target.value })}
                  placeholder="Секретный ключ приложения"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => togglePassword('macroSecret')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.macroSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Storage type (for auth types that need it) */}
        {formData.authType !== 'none' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Credentials Storage
            </label>
            <select
              value={formData.authStorage}
              onChange={(e) => updateForm({ authStorage: e.target.value as CredentialsStorage })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="inline">Encrypted in Database</option>
              <option value="env">Environment Variable</option>
              <option value="secrets">Secrets Manager (coming soon)</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              {formData.authStorage === 'inline' && 'Credentials will be encrypted with AES-256 before storing'}
              {formData.authStorage === 'env' && 'Reference an environment variable on the server'}
              {formData.authStorage === 'secrets' && 'Use AWS Secrets Manager or HashiCorp Vault'}
            </p>
          </div>
        )}
      </div>
    </div>
  )

  // Шаг 5: Тестирование
  const renderTestStep = () => (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Test Connection</h2>
      <p className="text-gray-600 mb-6">Verify that your data source is configured correctly</p>
      
      <div className="space-y-6">
        {/* Test Button */}
        <div className="flex items-center gap-4">
          <Button onClick={handleTest} disabled={testing}>
            {testing ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Globe size={16} className="mr-2" />
                Test Connection
              </>
            )}
          </Button>
          
          {testResult && (
            <div className={`flex items-center ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.success ? (
                <>
                  <CheckCircle size={20} className="mr-2" />
                  Connection successful!
                </>
              ) : (
                <>
                  <XCircle size={20} className="mr-2" />
                  Connection failed
                </>
              )}
            </div>
          )}
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {testResult.responseTime && (
              <p className="text-sm text-gray-600 mb-2">
                Response time: {testResult.responseTime}ms
              </p>
            )}
            
            {testResult.error && (
              <div className="mb-4">
                <p className="font-medium text-red-800">{testResult.error.code}</p>
                <p className="text-red-700">{testResult.error.message}</p>
              </div>
            )}
            
            {testResult.sampleData !== undefined && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Sample Data:</p>
                <pre className="bg-white p-3 rounded border text-xs overflow-auto max-h-64 text-gray-700 ">
                  {typeof testResult.sampleData === 'string' 
                    ? testResult.sampleData 
                    : JSON.stringify(testResult.sampleData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-3">Configuration Summary</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex">
              <dt className="w-32 text-gray-500">Name:</dt>
              <dd className="text-gray-900">{formData.name}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-gray-500">Type:</dt>
              <dd className="text-gray-900">{DATA_SOURCE_TYPES.find(t => t.value === formData.type)?.label}</dd>
            </div>
            {formData.url && (
              <div className="flex">
                <dt className="w-32 text-gray-500">URL:</dt>
                <dd className="text-gray-900 break-all">{formData.url}</dd>
              </div>
            )}
            <div className="flex">
              <dt className="w-32 text-gray-500">Auth:</dt>
              <dd className="text-gray-900">{AUTH_TYPES.find(a => a.value === formData.authType)?.label}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      
      <div className="flex-1 overflow-y-auto pl-2 pr-2">
        <div className="max-w-4xl mx-auto p-8">
          {/* Back button */}
          <button
            onClick={() => navigate('/data-sources')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Data Sources
          </button>

          {/* Stepper */}
          <div className="flex items-center justify-between mb-8">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.key}>
                <div 
                  className={`flex items-center ${
                    index <= currentStepIndex ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index < currentStepIndex
                        ? 'bg-blue-600 text-white'
                        : index === currentStepIndex
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {index < currentStepIndex ? <Check size={16} /> : index + 1}
                  </div>
                  <span className="ml-2 text-sm font-medium hidden sm:inline">{step.label}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="secondary"
              onClick={goBack}
              disabled={currentStepIndex === 0}
            >
              <ArrowLeft size={16} className="mr-2" />
              Previous
            </Button>
            
            <div className="flex gap-3">
              {currentStep === 'test' ? (
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} className="mr-2" />
                      {isEditing ? 'Save Changes' : 'Create Data Source'}
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={goNext} disabled={!canGoNext()}>
                  Next
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DataSourceWizard
