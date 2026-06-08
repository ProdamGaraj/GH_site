/**
 * Collections API
 * Dynamic Project Pages — коллекции, которые генерируют N страниц из одного шаблона
 */

import { api } from './index'
import type { DataTransform } from '@/shared/types/transforms'
import type { EndpointConfig } from '@/shared/types/dataBinding'

export type { EndpointConfig }

export interface AdditionalSource {
  /** Ключ, под которым данные прикрепляются к элементу: {{item.<itemKey>.*}}. */
  itemKey: string
  /** DataSource, из которого выполняется запрос. */
  dataSourceId: string
  arrayPath?: string
  endpointConfig?: EndpointConfig
  extract?: Record<string, string>
  /** JOIN: прикрепить только элемент ответа, где source[sourceField] === item[itemField]. */
  join?: { itemField: string; sourceField: string }
}

export interface Collection {
  id: string
  siteId: string
  name: string
  dataSourceId: string
  arrayPath: string
  templatePageId: string
  basePath: string
  slugField: string
  titleField: string
  apiIdField: string
  linkMode: 'auto' | 'manual'
  isActive: boolean
  itemsOrder: string
  useCache: boolean
  cacheTtl: number
  pollInterval: number
  indexPageId: string | null
  statsDataSourceId: string | null
  transforms?: DataTransform[]
  endpointConfig?: EndpointConfig
  mainExtract?: Record<string, string>
  additionalSources?: AdditionalSource[]
  cachedApiData: unknown[] | null
  lastCachedAt: string | null
  overrides: CollectionOverride[]
  createdAt: string
  updatedAt: string
}

export interface CollectionOverride {
  id: string
  collectionId: string
  apiItemId: string
  apiItemSlug: string
  customPageId: string
  createdAt: string
  updatedAt: string
}

export interface CreateCollectionDto {
  siteId: string
  name: string
  dataSourceId: string
  arrayPath: string
  templatePageId: string
  basePath: string
  slugField: string
  titleField: string
  apiIdField?: string
  linkMode?: 'auto' | 'manual'
  isActive?: boolean
  itemsOrder?: string
  useCache?: boolean
  cacheTtl?: number
  pollInterval?: number
  statsDataSourceId?: string | null
  transforms?: DataTransform[]
  endpointConfig?: EndpointConfig
  mainExtract?: Record<string, string>
  additionalSources?: AdditionalSource[]
}

export interface UpdateCollectionDto {
  name?: string
  dataSourceId?: string
  arrayPath?: string
  templatePageId?: string
  basePath?: string
  slugField?: string
  titleField?: string
  apiIdField?: string
  linkMode?: 'auto' | 'manual'
  isActive?: boolean
  itemsOrder?: string
  useCache?: boolean
  cacheTtl?: number
  pollInterval?: number
  statsDataSourceId?: string | null
  transforms?: DataTransform[]
  endpointConfig?: EndpointConfig
  mainExtract?: Record<string, string>
  additionalSources?: AdditionalSource[]
}

export interface CreateOverrideDto {
  apiItemId: string
  apiItemSlug: string
  customPageId: string
}

export interface UpdateOverrideDto {
  apiItemSlug?: string
  customPageId?: string
}

export interface CollectionItemsResult {
  items: unknown[]
  total: number
  warnings?: string[]
  fromCache?: boolean
}

export interface CollectionRequestPreviewStep {
  kind: 'main' | 'source'
  label: string
  request: {
    method: string
    url: string
    body?: unknown
    queryParams?: Record<string, string>
  }
  response?: unknown
  extract?: Record<string, unknown>
  error?: string
}

export interface CollectionRequestPreview {
  itemCount: number
  sampleItem: unknown
  steps: CollectionRequestPreviewStep[]
  finalDataStore: Record<string, unknown>
  warnings: string[]
}

export const collectionApi = {
  getAll: (siteId?: string) => {
    const qs = siteId ? `?siteId=${siteId}` : ''
    return api.get<Collection[]>(`/collections${qs}`)
  },

  getById: (id: string) => api.get<Collection>(`/collections/${id}`),

  create: (data: CreateCollectionDto) => api.post<Collection>('/collections', data),

  update: (id: string, data: UpdateCollectionDto) => api.put<Collection>(`/collections/${id}`, data),

  delete: (id: string) => api.delete<void>(`/collections/${id}`),

  /** Получить элементы коллекции (из API источника данных, с кешем) */
  getItems: (id: string) => api.get<CollectionItemsResult>(`/collections/${id}/items`),

  /** Превью цепочки запросов (основной + доп.источники на образце-элементе) */
  previewRequest: (id: string) =>
    api.get<CollectionRequestPreview>(`/collections/${id}/preview-request`),

  /** Деплой конкретной коллекции */
  deploy: (id: string) => api.post<{ success: boolean; deployedPages: string[]; errors: string[] }>(
    `/deploy/collection/${id}`
  ),

  // --- Overrides ---
  createOverride: (collectionId: string, data: CreateOverrideDto) =>
    api.post<CollectionOverride>(`/collections/${collectionId}/overrides`, data),

  updateOverride: (collectionId: string, overrideId: string, data: UpdateOverrideDto) =>
    api.put<CollectionOverride>(`/collections/${collectionId}/overrides/${overrideId}`, data),

  deleteOverride: (collectionId: string, overrideId: string) =>
    api.delete<void>(`/collections/${collectionId}/overrides/${overrideId}`),
}

export default collectionApi
