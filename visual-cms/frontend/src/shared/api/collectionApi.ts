/**
 * Collections API
 * Dynamic Project Pages — коллекции, которые генерируют N страниц из одного шаблона
 */

import { api } from './index'

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
  linkMode: 'auto' | 'manual'
  isActive: boolean
  itemsOrder: string
  useCache: boolean
  cacheTtl: number
  pollInterval: number
  indexPageId: string | null
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
  linkMode?: 'auto' | 'manual'
  isActive?: boolean
  itemsOrder?: string
  useCache?: boolean
  cacheTtl?: number
  pollInterval?: number
}

export interface UpdateCollectionDto {
  name?: string
  dataSourceId?: string
  arrayPath?: string
  templatePageId?: string
  basePath?: string
  slugField?: string
  titleField?: string
  linkMode?: 'auto' | 'manual'
  isActive?: boolean
  itemsOrder?: string
  useCache?: boolean
  cacheTtl?: number
  pollInterval?: number
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
