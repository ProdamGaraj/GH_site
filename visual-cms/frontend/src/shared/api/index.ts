// Ensure API URL always ends with /api
const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'
  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`
}

const API_BASE_URL = getApiBaseUrl()

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    let url = `${this.baseUrl}${endpoint}`
    
    if (params) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value))
        }
      }
      const queryString = searchParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }
    
    return url
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params)
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    const response = await fetch(url, config)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }))
      let message = error.message || `HTTP error ${response.status}`
      // Include field-level validation errors in the message
      if (error.details?.errors) {
        const fields = Object.entries(error.details.errors)
          .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
          .join('; ')
        if (fields) message += ` (${fields})`
      }
      throw new Error(message)
    }

    return response.json()
  }

  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, options?.params)
  }

  post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    })
  }

  put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

export const api = new ApiClient(API_BASE_URL)

// Block API
export const blockApi = {
  getAll: () => api.get<Block[]>('/blocks'),
  getReusable: () => api.get<Block[]>('/blocks/reusable'),
  getById: (id: string) => api.get<Block>(`/blocks/${id}`),
  getUsages: (id: string) => api.get<Array<{ type: 'page' | 'block'; id: string; name: string; nodePath?: string }>>(`/blocks/${id}/usages`),
  getAllWithUsages: () => api.get<Array<Block & { usages: Array<{ type: 'page' | 'block'; id: string; name: string }> }>>('/blocks/with-usages'),
  create: (data: CreateBlockDto) => api.post<Block>('/blocks', data),
  update: (id: string, data: UpdateBlockDto) => api.put<Block>(`/blocks/${id}`, data),
  delete: (id: string) => api.delete<void>(`/blocks/${id}`),
}

// Page API
export const pageApi = {
  getAll: (siteId?: string) => api.get<Page[]>('/pages', { params: siteId ? { siteId } : undefined }),
  getById: (id: string) => api.get<Page>(`/pages/${id}`),
  create: (data: CreatePageDto) => api.post<Page>('/pages', data),
  update: (id: string, data: UpdatePageDto) => api.put<Page>(`/pages/${id}`, data),
  delete: (id: string) => api.delete<void>(`/pages/${id}`),
  // Page-level data settings (variables + dataSources). Используется SlidesTab,
  // чтобы не таскать огромный page.structure при сохранении hero-слайдов.
  getDataSettings: (id: string) =>
    api.get<{ dataSources: unknown; variables: PageVariablesEnvelope }>(`/pages/${id}/data-settings`),
  updateVariables: (id: string, variables: PageVariablesEnvelope) =>
    api.put<{ success: true; variables: PageVariablesEnvelope }>(`/pages/${id}/variables`, { variables }),
}

/**
 * Конверт page.variables в БД: { variables: PageVariable[] }.
 * Бэкенд хранит ровно так (см. PageController.updateVariables).
 * PageVariable объявлен ниже в этом же файле (используется PageDataSettings).
 */
export interface PageVariablesEnvelope {
  variables: PageVariable[]
}

// Site API
export const siteApi = {
  getAll: () => api.get<Site[]>('/sites'),
  getById: (id: string) => api.get<Site>(`/sites/${id}`),
  create: (data: CreateSiteDto) => api.post<Site>('/sites', data),
  update: (id: string, data: UpdateSiteDto) => api.put<Site>(`/sites/${id}`, data),
  delete: (id: string) => api.delete<void>(`/sites/${id}`),
  getPages: (id: string) => api.get<Page[]>(`/sites/${id}/pages`),
  assignPage: (siteId: string, pageId: string) => api.post<Page>(`/sites/${siteId}/pages/${pageId}`),
  unassignPage: (siteId: string, pageId: string) => api.delete<Page>(`/sites/${siteId}/pages/${pageId}`),
  updateSettings: (id: string, settings: Partial<SiteSettings>) => api.put<Site>(`/sites/${id}/settings`, settings),
  duplicate: (id: string) => api.post<Site>(`/sites/${id}/duplicate`),
  deploy: (id: string) => api.post<any>(`/deploy/site/${id}`),
}

// Types
import type { Block, Page, BlockNode, Site, SiteSettings, PageVersion } from '@/shared/types'
import type { 
  DataSource, 
  DataSourcesListResponse, 
  DataSourcesFilter,
  CreateDataSourceRequest,
  UpdateDataSourceRequest,
  TestConnectionResult 
} from '@/shared/types/dataSource'

export interface DeployLogEntry {
  id: string
  siteId?: string
  pageId?: string
  pageName?: string
  pageSlug?: string
  action: 'deploy' | 'rollback' | 'undeploy' | 'deploy-all' | 'deploy-site'
  status: 'success' | 'failed' | 'partial'
  message?: string
  deployedFiles?: string[]
  errors?: string[]
  durationMs?: number
  publicUrl?: string
  pageVersion?: number
  versionId?: string
  createdAt: string
}

export interface CreateBlockDto {
  name: string
  type: string
  structure: BlockNode
  isReusable?: boolean
  groupId?: string
  tags?: string[]
}

export interface UpdateBlockDto {
  name?: string
  type?: string
  structure?: BlockNode
  isReusable?: boolean
  groupId?: string
  tags?: string[]
  detectedFields?: any[]
}

export interface CreatePageDto {
  name: string
  slug: string
  siteId?: string
  structure: BlockNode
  groupId?: string
  metadata?: {
    title: string
    description?: string
    keywords?: string[]
    ogImage?: string
  }
}

export interface UpdatePageDto {
  name?: string
  slug?: string
  structure?: BlockNode
  groupId?: string
  metadata?: {
    title?: string
    description?: string
    keywords?: string[]
    ogImage?: string
  }
  status?: 'draft' | 'published' | 'archived'
  siteId?: string | null
}

export interface CreateSiteDto {
  name: string
  slug: string
  description?: string
  routingMode?: 'subdomain' | 'path-prefix' | 'custom-domain'
  hostname?: string
  settings?: Partial<SiteSettings>
}

export interface UpdateSiteDto {
  name?: string
  slug?: string
  description?: string
  routingMode?: 'subdomain' | 'path-prefix' | 'custom-domain'
  hostname?: string
  settings?: Partial<SiteSettings>
  status?: 'draft' | 'active' | 'archived'
  isDefault?: boolean
  homepageId?: string | null
}

// Version API
export const versionApi = {
  getAll: (pageId: string) => api.get<PageVersion[]>(`/pages/${pageId}/versions`),
  getById: (pageId: string, versionId: string) => api.get<PageVersion>(`/pages/${pageId}/versions/${versionId}`),
  create: (pageId: string, label?: string) => api.post<PageVersion>(`/pages/${pageId}/versions`, { label }),
  restore: (pageId: string, versionId: string) => api.post<{ success: boolean; page: Page; restoredFrom: string }>(`/pages/${pageId}/versions/${versionId}/restore`),
  updateLabel: (pageId: string, versionId: string, label: string) => api.put<PageVersion>(`/pages/${pageId}/versions/${versionId}`, { label }),
  delete: (pageId: string, versionId: string) => api.delete<void>(`/pages/${pageId}/versions/${versionId}`),
}

// Deploy API
export interface DeployResult {
  success: boolean
  message: string
  deployedPages: string[]
  errors: string[]
  publicUrl?: string
}

export const deployApi = {
  deployPage: (pageId: string) => api.post<DeployResult>(`/deploy/${pageId}`),
  deployAll: () => api.post<DeployResult>('/deploy'),
  getDeployedFiles: () => api.get<{ files: string[], publicUrl: string }>('/deploy'),
  undeploy: (slug: string) => api.delete<{ message: string }>(`/deploy/${slug}`),
  getLogs: (params?: { siteId?: string; pageId?: string; limit?: number }) =>
    api.get<DeployLogEntry[]>('/deploy/logs', { params: params as any }),
  rollback: (pageId: string, versionId: string) =>
    api.post<DeployResult & { rolledBackTo: number; newVersion: number }>(`/deploy/${pageId}/rollback/${versionId}`),
}

// Data Sources API
export const dataSourceApi = {
  /**
   * Получить список источников данных с фильтрацией и пагинацией
   */
  getAll: (filters?: DataSourcesFilter) => {
    const params = new URLSearchParams()
    if (filters) {
      if (filters.search) params.append('search', filters.search)
      if (filters.type) params.append('type', filters.type)
      if (filters.status) params.append('status', filters.status)
      if (filters.groupId) params.append('groupId', filters.groupId)
      if (filters.tags) filters.tags.forEach(tag => params.append('tags', tag))
      if (filters.page) params.append('page', String(filters.page))
      if (filters.limit) params.append('limit', String(filters.limit))
      if (filters.sortBy) params.append('sortBy', filters.sortBy)
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)
    }
    const queryString = params.toString()
    return api.get<DataSourcesListResponse>(`/data-sources${queryString ? `?${queryString}` : ''}`)
  },

  /**
   * Получить один источник данных по ID
   */
  getById: (id: string) => api.get<DataSource>(`/data-sources/${id}`),

  /**
   * Создать новый источник данных
   */
  create: (data: CreateDataSourceRequest) => api.post<DataSource>('/data-sources', data),

  /**
   * Обновить источник данных
   */
  update: (id: string, data: UpdateDataSourceRequest) => api.put<DataSource>(`/data-sources/${id}`, data),

  /**
   * Удалить источник данных
   */
  delete: (id: string) => api.delete<void>(`/data-sources/${id}`),

  /**
   * Тестировать подключение к существующему источнику
   */
  testConnection: (id: string) => api.post<TestConnectionResult>(`/data-sources/${id}/test`),

  /**
   * Получить дешифрованный authConfig
   */
  revealCredentials: (id: string) => api.get<{ authConfig: Record<string, unknown> | null }>(`/data-sources/${id}/credentials`),

  /**
   * Тестировать новую конфигурацию (без сохранения)
   */
  testNewConnection: (data: { type: string; config: unknown; authConfig?: unknown }) => 
    api.post<TestConnectionResult>('/data-sources/new/test', data),

  /**
   * Дублировать источник данных
   */
  duplicate: (id: string, newName?: string) => 
    api.post<DataSource>(`/data-sources/${id}/duplicate`, { name: newName }),

  /**
   * Сбросить кеш данных для источника
   */
  invalidateCache: (id: string) =>
    api.post<{ success: boolean; invalidated: number; message: string }>(`/data-sources/${id}/invalidate-cache`),
}

// Re-export types for convenience
export type { 
  DataSource, 
  DataSourcesListResponse, 
  DataSourcesFilter,
  CreateDataSourceRequest,
  UpdateDataSourceRequest,
  TestConnectionResult 
} from '@/shared/types/dataSource'

// Data Binding Types
import type {
  DataBinding,
  CreateDataBindingRequest,
  UpdateDataBindingRequest,
  FetchWithBindingRequest,
  FetchDataResult,
  DirectFetchRequest
} from '@/shared/types/dataBinding'

// Data Bindings API
export const dataBindingApi = {
  /**
   * Получить все привязки
   */
  getAll: () => api.get<DataBinding[]>('/data-bindings'),

  /**
   * Получить привязку по ID
   */
  getById: (id: string) => api.get<DataBinding>(`/data-bindings/${id}`),

  /**
   * Получить привязки для блока
   */
  getByBlockId: (blockId: string, pageId?: string) => {
    return api.get<DataBinding[]>(`/data-bindings?blockId=${blockId}${pageId ? `&pageId=${pageId}` : ''}`)
  },

  /**
   * Создать привязку
   */
  create: (data: CreateDataBindingRequest) => api.post<DataBinding>('/data-bindings', data),

  /**
   * Обновить привязку
   */
  update: (id: string, data: UpdateDataBindingRequest) => 
    api.put<DataBinding>(`/data-bindings/${id}`, data),

  /**
   * Удалить привязку
   */
  delete: (id: string) => api.delete<void>(`/data-bindings/${id}`),

  /**
   * Получить данные напрямую из источника (с фильтрами)
   */
  fetchDirect: (data: DirectFetchRequest) => 
    api.post<FetchDataResult>('/data/fetch', data),

  /**
   * Получить данные через привязку
   */
  fetchWithBinding: (data: FetchWithBindingRequest) =>
    api.post<FetchDataResult>('/data/fetch-with-binding', data),

  /**
   * Получить данные с трансформациями, фильтрами, поиском и пагинацией
   */
  fetchWithTransforms: (data: FetchWithTransformsRequest) =>
    api.post<FetchWithTransformsResponse>('/data/fetch-with-transforms', data),
}

// Import transform types
import type {
  FetchWithTransformsRequest,
  FetchWithTransformsResponse,
} from '@/shared/types/transforms'

// Re-export data binding types
export type {
  DataBinding,
  CreateDataBindingRequest,
  UpdateDataBindingRequest,
  FetchWithBindingRequest,
  FetchDataResult,
  DirectFetchRequest
} from '@/shared/types/dataBinding'

// Re-export transform types
export type {
  FetchWithTransformsRequest,
  FetchWithTransformsResponse,
  FilterCondition,
  DataTransform
} from '@/shared/types/transforms'

// Page Data Settings Types
export interface PageDataSource {
  id: string
  dataSourceId: string
  alias: string
  loadStrategy: 'pageLoad' | 'onDemand' | 'interval'
  loadInterval?: number
  cacheEnabled: boolean
  cacheTTL?: number
  priority: number
  dependsOn?: string[]
}

export interface PageVariable {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  defaultValue: unknown
  description?: string
  persist?: boolean
}

export interface PageDataSettings {
  dataSources: PageDataSource[]
  variables: PageVariable[]
}

// Page Data Settings API
export const pageDataSettingsApi = {
  getSettings: (pageId: string) =>
    api.get<PageDataSettings>(`/pages/${pageId}/data-settings`),

  updateSettings: (pageId: string, settings: Partial<PageDataSettings>) =>
    api.put<PageDataSettings>(`/pages/${pageId}/data-settings`, settings),

  updateDataSources: (pageId: string, dataSources: PageDataSource[]) =>
    api.put<{ dataSources: PageDataSource[] }>(`/pages/${pageId}/data-sources`, { dataSources }),

  updateVariables: (pageId: string, variables: PageVariable[]) =>
    api.put<{ variables: PageVariable[] }>(`/pages/${pageId}/variables`, { variables }),
}

