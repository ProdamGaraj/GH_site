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
import { DATA_SOURCE_TYPES, AUTH_TYPES } from '@/shared/types/dataSource'

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
          method: formData.method,
          headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
          queryParams: Object.keys(queryParamsObj).length > 0 ? queryParamsObj : undefined,
          body: formData.body || undefined,
          bodyFormat: formData.bodyFormat,
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
          timeout: formData.timeout
        }
      
      case 'static':
        return {
          type: 'static',
          data: JSON.parse(formData.staticData),
          dataFormat: 'json'
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
        {DATA_SOURCE_TYPES.map(type => (
          <button
            key={type.value}
            onClick={() => updateForm({ type: type.value })}
            className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
              formData.type === type.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="mb-3">{typeIcons[type.value]}</div>
            <div className="font-medium text-gray-900">{type.label}</div>
            <div className="text-sm text-gray-500 mt-1">{type.description}</div>
          </button>
        ))}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Settings</h2>
      <p className="text-gray-600 mb-6">Configure how to connect to the API</p>
      
      <div className="space-y-4">
        {/* URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API URL <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.url}
            onChange={(e) => updateForm({ url: e.target.value })}
            placeholder="https://api.example.com/data"
          />
        </div>

        {/* Method (only for REST API) */}
        {formData.type === 'rest-api' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HTTP Method
            </label>
            <select
              value={formData.method}
              onChange={(e) => updateForm({ method: e.target.value as FormData['method'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
        )}

        {/* Headers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Headers
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cache TTL (seconds)
              </label>
              <Input
                type="number"
                value={formData.cacheTTL}
                onChange={(e) => updateForm({ cacheTTL: parseInt(e.target.value) || 300 })}
                min={0}
                max={86400}
              />
            </div>
          </>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <pre className="bg-white p-3 rounded border text-xs overflow-auto max-h-64">
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
      
      <div className="flex-1 overflow-y-auto">
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
