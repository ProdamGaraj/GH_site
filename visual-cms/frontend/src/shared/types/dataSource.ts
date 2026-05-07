/**
 * Data Source Types
 * Типы для системы управления источниками данных
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 1: Data Sources Management
 */

// ============================================
// DATA SOURCE TYPES
// ============================================

/**
 * Типы источников данных
 * ТЗ п.1.1 Типы источников данных
 */
export type DataSourceType = 
  | 'rest-api'      // REST API (GET, POST, PUT, DELETE, PATCH)
  | 'feed'          // Dynamic JSON Feed (auto-refresh, CRM integration)
  | 'graphql'       // GraphQL queries and mutations
  | 'database'      // SQL queries through backend proxy
  | 'external'      // External services (WordPress, Strapi, Shopify)
  | 'static'        // Static JSON data, manual input
  | 'computed'      // Transformation of other sources
  | 'form-data'     // URL params, localStorage, cookies

/**
 * HTTP методы для API запросов
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

/**
 * Формат тела запроса
 */
export type RequestBodyFormat = 'json' | 'xml' | 'form-data' | 'form-urlencoded' | 'raw'

/**
 * Статус источника данных
 */
export type DataSourceStatus = 'active' | 'draft' | 'archived'

// ============================================
// AUTHENTICATION TYPES
// ============================================

/**
 * Типы авторизации
 * ТЗ п.2.1 Типы авторизации
 */
export type AuthType = 
  | 'none'          // Без авторизации
  | 'bearer'        // Bearer Token
  | 'api-key'       // API Key (header или query parameter)
  | 'basic'         // Basic Auth (username/password)
  | 'oauth2'        // OAuth 2.0 с refresh tokens
  | 'custom'        // Custom headers
  | 'macro-hmac'    // MacroCRM HMAC (md5 подпись запросов)

/**
 * Способ хранения credentials
 * ТЗ п.2.2 Хранение credentials
 */
export type CredentialsStorage = 
  | 'inline'        // Шифрование AES-256 в БД
  | 'env'           // Environment Variables
  | 'secrets'       // AWS Secrets Manager / HashiCorp Vault

/**
 * Место размещения API Key
 */
export type ApiKeyPlacement = 'header' | 'query'

/**
 * Конфигурация Bearer Token авторизации
 */
export interface BearerAuthConfig {
  type: 'bearer'
  token: string
  storage: CredentialsStorage
}

/**
 * Конфигурация API Key авторизации
 */
export interface ApiKeyAuthConfig {
  type: 'api-key'
  key: string
  keyName: string        // Имя заголовка или параметра (например, 'X-API-Key')
  placement: ApiKeyPlacement
  storage: CredentialsStorage
}

/**
 * Конфигурация Basic Auth авторизации
 */
export interface BasicAuthConfig {
  type: 'basic'
  username: string
  password: string
  storage: CredentialsStorage
}

/**
 * Конфигурация OAuth 2.0 авторизации
 */
export interface OAuth2AuthConfig {
  type: 'oauth2'
  clientId: string
  clientSecret: string
  authorizationUrl: string
  tokenUrl: string
  scope: string
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: string
  storage: CredentialsStorage
}

/**
 * Конфигурация Custom Headers авторизации
 */
export interface CustomAuthConfig {
  type: 'custom'
  headers: Record<string, string>
  storage: CredentialsStorage
}

/**
 * Отсутствие авторизации
 */
export interface NoAuthConfig {
  type: 'none'
}

/**
 * Конфигурация MacroCRM HMAC авторизации
 * token = md5(domain + unixtime + appSecret)
 */
export interface MacroHmacAuthConfig {
  type: 'macro-hmac'
  domain: string
  appSecret: string
  storage: CredentialsStorage
}

/**
 * Объединённый тип конфигурации авторизации
 */
export type AuthConfig = 
  | NoAuthConfig
  | BearerAuthConfig
  | ApiKeyAuthConfig
  | BasicAuthConfig
  | OAuth2AuthConfig
  | CustomAuthConfig
  | MacroHmacAuthConfig

// ============================================
// DATA SOURCE CONFIGURATIONS
// ============================================

/**
 * Базовые настройки подключения к сервису.
 * Это ORIGIN — общие параметры для ЛЮБОГО запроса к этому сервису.
 * Конкретные endpoint/метод настраиваются на уровне привязки (DataBinding).
 */
export interface BaseRequestConfig {
  url: string                              // Base URL / Origin: https://api.example.com
  headers?: Record<string, string>         // Общие заголовки для всех запросов
  queryParams?: Record<string, string>     // Общие query-параметры
  timeout?: number                         // ms
}

/**
 * Конфигурация REST API источника — ТОЛЬКО подключение.
 * method/body/bodyFormat — deprecated, конкретный endpoint настраивается в привязке.
 */
export interface RestApiConfig extends BaseRequestConfig {
  type: 'rest-api'
  method?: HttpMethod         // @deprecated — переносится в EndpointConfig привязки
  body?: string               // @deprecated
  bodyFormat?: RequestBodyFormat  // @deprecated
}

/**
 * Конфигурация Feed источника (только GET)
 * ТЗ: Polling стратегии, webhook notifications, кэширование с TTL
 */
export interface FeedConfig extends BaseRequestConfig {
  type: 'feed'
  pollingEnabled: boolean
  pollingInterval?: number  // секунды
  webhookSecret?: string    // для webhook notifications
  cacheTTL?: number         // секунды, время жизни кэша
}

/**
 * Конфигурация GraphQL источника
 */
export interface GraphQLConfig extends BaseRequestConfig {
  type: 'graphql'
  query: string
  variables?: Record<string, unknown>
  operationName?: string
}

/**
 * Тип базы данных
 */
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite'

/**
 * Конфигурация Database источника
 */
export interface DatabaseConfig {
  type: 'database'
  databaseType: DatabaseType
  connectionString?: string   // Если используется connection string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  query: string               // SQL запрос
  queryParams?: Record<string, unknown>  // Параметризованные запросы
}

/**
 * Тип внешнего сервиса
 */
export type ExternalServiceType = 'wordpress' | 'strapi' | 'shopify' | 'custom'

/**
 * Конфигурация External Service источника
 */
export interface ExternalServiceConfig extends BaseRequestConfig {
  type: 'external'
  serviceType: ExternalServiceType
  apiVersion?: string
  // Специфичные настройки для разных сервисов
  wordpress?: {
    endpoint: string        // /wp-json/wp/v2/posts, etc.
    perPage?: number
  }
  strapi?: {
    contentType: string
    populate?: string[]
  }
  shopify?: {
    resource: string        // products, collections, etc.
    limit?: number
  }
}

/**
 * Конфигурация Static Data источника
 */
export interface StaticDataConfig {
  type: 'static'
  data: unknown             // JSON данные
  dataFormat: 'json' | 'csv'
}

/**
 * Конфигурация Computed Data источника
 */
export interface ComputedDataConfig {
  type: 'computed'
  sourceIds: string[]       // ID источников для комбинирования
  transformFunction: string // JavaScript функция
}

/**
 * Тип данных формы
 */
export type FormDataType = 'url-params' | 'local-storage' | 'session-storage' | 'cookies' | 'user-input'

/**
 * Конфигурация Form Data источника
 */
export interface FormDataConfig {
  type: 'form-data'
  dataType: FormDataType
  key?: string              // Имя параметра/ключа
  defaultValue?: unknown    // Значение по умолчанию
}

/**
 * Объединённый тип конфигурации источника
 */
export type DataSourceConfig = 
  | RestApiConfig
  | FeedConfig
  | GraphQLConfig
  | DatabaseConfig
  | ExternalServiceConfig
  | StaticDataConfig
  | ComputedDataConfig
  | FormDataConfig

// ============================================
// DATA SOURCE ENTITY
// ============================================

/**
 * Результат тестирования подключения
 */
export interface TestConnectionResult {
  success: boolean
  message: string
  responseTime?: number     // ms
  sampleData?: unknown      // Preview данных
  error?: {
    code: string
    message: string
    details?: string
  }
}

/**
 * Основная сущность Data Source
 * ТЗ п.1.2 Управление Data Sources
 */
export interface DataSource {
  id: string
  name: string
  description?: string
  type: DataSourceType
  
  // Конфигурация подключения
  config: DataSourceConfig
  
  // Авторизация
  authConfig: AuthConfig
  
  // Организация
  groupId?: string          // Папка/группа
  tags?: string[]
  
  // Статус
  status: DataSourceStatus
  
  // Метаданные последнего запроса
  lastFetchAt?: string
  lastFetchStatus?: 'success' | 'error'
  lastFetchError?: string
  
  // Версионирование
  version: number
  
  // Audit
  createdAt: string
  updatedAt: string
  createdBy?: string
}

/**
 * Группа/папка для организации Data Sources
 */
export interface DataSourceGroup {
  id: string
  name: string
  parentId?: string
  order: number
  createdAt: string
  updatedAt: string
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

/**
 * Запрос на создание Data Source
 */
export interface CreateDataSourceRequest {
  name: string
  description?: string
  type: DataSourceType
  config: DataSourceConfig
  authConfig: AuthConfig
  groupId?: string
  tags?: string[]
  status?: DataSourceStatus
}

/**
 * Запрос на обновление Data Source
 */
export interface UpdateDataSourceRequest {
  name?: string
  description?: string
  config?: Partial<DataSourceConfig>
  authConfig?: AuthConfig
  groupId?: string
  tags?: string[]
  status?: DataSourceStatus
}

/**
 * Запрос на тестирование Data Source
 */
export interface TestDataSourceRequest {
  id?: string               // ID существующего источника
  // ИЛИ конфигурация для тестирования нового
  type?: DataSourceType
  config?: DataSourceConfig
  authConfig?: AuthConfig
}

/**
 * Ответ списка Data Sources
 */
export interface DataSourcesListResponse {
  items: DataSource[]
  total: number
  page: number
  limit: number
}

/**
 * Фильтры для списка Data Sources
 */
export interface DataSourcesFilter {
  search?: string
  type?: DataSourceType
  status?: DataSourceStatus
  groupId?: string
  tags?: string[]
  page?: number
  limit?: number
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastFetchAt'
  sortOrder?: 'asc' | 'desc'
}

// ============================================
// UI STATE TYPES
// ============================================

/**
 * Шаг wizard-а создания Data Source
 */
export type DataSourceWizardStep = 
  | 'type'          // Выбор типа
  | 'basic'         // Основная информация
  | 'connection'    // Настройка подключения
  | 'auth'          // Авторизация
  | 'test'          // Тестирование

/**
 * Состояние формы Data Source
 */
export interface DataSourceFormState {
  step: DataSourceWizardStep
  isValid: boolean
  isDirty: boolean
  errors: Record<string, string>
}

/**
 * Redux состояние для Data Sources
 */
export interface DataSourcesState {
  // Данные
  items: DataSource[]
  groups: DataSourceGroup[]
  selectedId: string | null
  
  // Загрузка
  loading: boolean
  saving: boolean
  testing: boolean
  
  // Ошибки
  error: string | null
  
  // Пагинация
  total: number
  page: number
  limit: number
  
  // Фильтры
  filters: DataSourcesFilter
  
  // Тестирование
  testResult: TestConnectionResult | null
}

// ============================================
// HELPER TYPES
// ============================================

/**
 * Опции для dropdown выбора типа источника
 */
export interface DataSourceTypeOption {
  value: DataSourceType
  label: string
  description: string
  icon: string
}

/**
 * Опции для dropdown выбора типа авторизации
 */
export interface AuthTypeOption {
  value: AuthType
  label: string
  description: string
}

/**
 * Информация о поддерживаемых возможностях типа источника
 */
export interface DataSourceTypeCapabilities {
  type: DataSourceType
  supportsRead: boolean
  supportsWrite: boolean
  supportsPagination: boolean
  supportsFiltering: boolean
  supportsSorting: boolean
  supportsRealtime: boolean
  requiresAuth: boolean
}

/**
 * Константы типов источников с метаданными
 */
export const DATA_SOURCE_TYPES: DataSourceTypeOption[] = [
  {
    value: 'rest-api',
    label: 'REST API',
    description: 'Connect to any REST API with full HTTP method support',
    icon: 'Globe'
  },
  {
    value: 'feed',
    label: 'JSON Feed',
    description: 'Auto-refreshing JSON feed with polling and webhooks',
    icon: 'Rss'
  },
  {
    value: 'graphql',
    label: 'GraphQL',
    description: 'Query GraphQL APIs with variables support',
    icon: 'Braces'
  },
  {
    value: 'database',
    label: 'Database',
    description: 'Direct SQL queries to PostgreSQL, MySQL, SQLite',
    icon: 'Database'
  },
  {
    value: 'external',
    label: 'External Service',
    description: 'Pre-built integrations: WordPress, Strapi, Shopify',
    icon: 'Plug'
  },
  {
    value: 'static',
    label: 'Static Data',
    description: 'Manual JSON data or CSV import',
    icon: 'FileJson'
  },
  {
    value: 'computed',
    label: 'Computed',
    description: 'Transform and combine other data sources',
    icon: 'Calculator'
  },
  {
    value: 'form-data',
    label: 'Form Data',
    description: 'URL parameters, localStorage, cookies, user input',
    icon: 'FormInput'
  }
]

/**
 * Константы типов авторизации
 */
export const AUTH_TYPES: AuthTypeOption[] = [
  {
    value: 'none',
    label: 'No Authentication',
    description: 'Public API without authentication'
  },
  {
    value: 'bearer',
    label: 'Bearer Token',
    description: 'Token in Authorization header'
  },
  {
    value: 'api-key',
    label: 'API Key',
    description: 'Key in header or query parameter'
  },
  {
    value: 'basic',
    label: 'Basic Auth',
    description: 'Username and password'
  },
  {
    value: 'oauth2',
    label: 'OAuth 2.0',
    description: 'Full OAuth flow with refresh tokens'
  },
  {
    value: 'custom',
    label: 'Custom Headers',
    description: 'Custom authentication headers'
  },
  {
    value: 'macro-hmac',
    label: 'MacroCRM HMAC',
    description: 'MacroCRM HMAC (md5 подпись запросов)'
  }
]

/**
 * Возможности типов источников
 */
export const DATA_SOURCE_CAPABILITIES: Record<DataSourceType, DataSourceTypeCapabilities> = {
  'rest-api': {
    type: 'rest-api',
    supportsRead: true,
    supportsWrite: true,
    supportsPagination: true,
    supportsFiltering: true,
    supportsSorting: true,
    supportsRealtime: false,
    requiresAuth: false
  },
  'feed': {
    type: 'feed',
    supportsRead: true,
    supportsWrite: false,
    supportsPagination: true,
    supportsFiltering: true,
    supportsSorting: true,
    supportsRealtime: true,
    requiresAuth: false
  },
  'graphql': {
    type: 'graphql',
    supportsRead: true,
    supportsWrite: true,
    supportsPagination: true,
    supportsFiltering: true,
    supportsSorting: true,
    supportsRealtime: false,
    requiresAuth: false
  },
  'database': {
    type: 'database',
    supportsRead: true,
    supportsWrite: true,
    supportsPagination: true,
    supportsFiltering: true,
    supportsSorting: true,
    supportsRealtime: false,
    requiresAuth: true
  },
  'external': {
    type: 'external',
    supportsRead: true,
    supportsWrite: true,
    supportsPagination: true,
    supportsFiltering: true,
    supportsSorting: true,
    supportsRealtime: false,
    requiresAuth: false
  },
  'static': {
    type: 'static',
    supportsRead: true,
    supportsWrite: false,
    supportsPagination: false,
    supportsFiltering: false,
    supportsSorting: false,
    supportsRealtime: false,
    requiresAuth: false
  },
  'computed': {
    type: 'computed',
    supportsRead: true,
    supportsWrite: false,
    supportsPagination: false,
    supportsFiltering: false,
    supportsSorting: false,
    supportsRealtime: false,
    requiresAuth: false
  },
  'form-data': {
    type: 'form-data',
    supportsRead: true,
    supportsWrite: true,
    supportsPagination: false,
    supportsFiltering: false,
    supportsSorting: false,
    supportsRealtime: true,
    requiresAuth: false
  }
}
