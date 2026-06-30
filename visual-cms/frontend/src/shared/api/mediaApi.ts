/**
 * Media Library API client.
 *
 * Backend endpoints (Phase 1+2):
 *   GET    /api/media
 *   GET    /api/media/:id
 *   POST   /api/media         (multipart: file, optional poster, siteId, title, alt, tags)
 *   PATCH  /api/media/:id
 *   DELETE /api/media/:id
 */

import { api } from './index'
import { getApiBaseUrl } from './baseUrl'
import { apiFetch } from './http'

export type MediaKind = 'image' | 'video' | 'document'

/** Расширения документов, принимаемых медиатекой (PDF + офисные форматы). */
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx'

/**
 * Значение атрибута `accept` для <input type="file"> по виду медиа.
 * Единый источник правды, чтобы не плодить копии строк по компонентам.
 *
 * Для 'any' (общая медиатека) ограничений нет — можно загрузить что угодно,
 * бэкенд сам распределит файл по категории (image/video/document).
 */
export function mediaAcceptAttr(kind: MediaKind | 'any'): string {
  switch (kind) {
    case 'image':
      return 'image/*'
    case 'video':
      return 'video/*'
    case 'document':
      return DOCUMENT_ACCEPT
    default:
      return '*/*'
  }
}

export type MediaSort = 'newest' | 'oldest' | 'name' | 'largest' | 'smallest'

/** Адаптивный вариант изображения (один размер для srcset). */
export interface MediaVariant {
  width: number
  height: number
  url: string
  sizeBytes: number
}

export interface MediaAsset {
  id: string
  siteId: string | null
  kind: MediaKind
  fileName: string
  mimeType: string
  url: string
  posterUrl: string | null
  thumbnailUrl: string | null
  /** Оптимизированная (сжатая) версия, если создавалась. */
  optimizedUrl: string | null
  optimizedSizeBytes: number | null
  /** Адаптивные варианты под разные ширины экранов. */
  variants: MediaVariant[]
  folderId: string | null
  sizeBytes: number
  width: number | null
  height: number | null
  durationSec: number | null
  title: string | null
  alt: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface MediaListResponse {
  items: MediaAsset[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface MediaListFilter {
  siteId?: string
  includeGlobal?: boolean
  kind?: MediaKind
  search?: string
  tag?: string
  /** uuid папки или 'root' (только файлы вне папок). */
  folderId?: string | 'root'
  sort?: MediaSort
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface UploadMediaInput {
  file: File
  poster?: File | null
  siteId?: string | null
  title?: string | null
  alt?: string | null
  tags?: string[]
  folderId?: string | null
  /** Создать оптимизированную (сжатую) версию рядом с оригиналом. */
  optimize?: boolean
  /** Ширины экранов для адаптивных вариантов. */
  variantWidths?: number[]
}

export interface UpdateMediaInput {
  title?: string | null
  alt?: string | null
  tags?: string[]
  /** null = переместить в корень; uuid = в конкретную папку. */
  folderId?: string | null
}

export interface MediaFolder {
  id: string
  siteId: string | null
  parentId: string | null
  name: string
  createdAt: string
  updatedAt: string
}

export interface CreateFolderInput {
  name: string
  parentId?: string | null
  siteId?: string | null
}

/** Кол-во файлов по папкам (прямые файлы, без подпапок). */
export interface MediaFolderCounts {
  byFolder: Record<string, number>
  /** файлы вне папок (корень) */
  root: number
  /** всего файлов в области видимости */
  total: number
}

export interface MediaFoldersResponse {
  items: MediaFolder[]
  counts: MediaFolderCounts
}

const API_BASE = getApiBaseUrl()

function buildQuery(filter: MediaListFilter): string {
  const params = new URLSearchParams()
  if (filter.siteId) params.set('siteId', filter.siteId)
  if (filter.includeGlobal !== undefined) params.set('includeGlobal', String(filter.includeGlobal))
  if (filter.kind) params.set('kind', filter.kind)
  if (filter.search) params.set('search', filter.search)
  if (filter.tag) params.set('tag', filter.tag)
  if (filter.folderId) params.set('folderId', filter.folderId)
  if (filter.sort) params.set('sort', filter.sort)
  if (filter.dateFrom) params.set('dateFrom', filter.dateFrom)
  if (filter.dateTo) params.set('dateTo', filter.dateTo)
  if (filter.page) params.set('page', String(filter.page))
  if (filter.limit) params.set('limit', String(filter.limit))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const mediaApi = {
  list: (filter: MediaListFilter = {}): Promise<MediaListResponse> =>
    api.get<MediaListResponse>(`/media${buildQuery(filter)}`),

  getById: (id: string): Promise<MediaAsset> => api.get<MediaAsset>(`/media/${id}`),

  upload: async (input: UploadMediaInput): Promise<MediaAsset> => {
    const fd = new FormData()
    fd.append('file', input.file)
    if (input.poster) fd.append('poster', input.poster)
    if (input.siteId) fd.append('siteId', input.siteId)
    if (input.folderId) fd.append('folderId', input.folderId)
    if (input.title) fd.append('title', input.title)
    if (input.alt) fd.append('alt', input.alt)
    if (input.tags && input.tags.length > 0) fd.append('tags', input.tags.join(','))
    if (input.optimize) fd.append('optimize', 'true')
    if (input.variantWidths && input.variantWidths.length > 0) {
      fd.append('variantWidths', input.variantWidths.join(','))
    }

    const resp = await apiFetch(`${API_BASE}/media`, { method: 'POST', body: fd })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }))
      throw new Error(err.message || `Upload failed (${resp.status})`)
    }
    return resp.json()
  },

  update: (id: string, patch: UpdateMediaInput): Promise<MediaAsset> => {
    // PATCH not implemented in shared ApiClient — use raw fetch with JSON.
    return apiFetch(`${API_BASE}/media/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(async (resp) => {
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }))
        throw new Error(err.message || `Update failed (${resp.status})`)
      }
      return resp.json()
    })
  },

  delete: (id: string): Promise<void> => api.delete<void>(`/media/${id}`),
}

async function parseJsonOrThrow(resp: Response, action: string) {
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }))
    throw new Error(err.message || `${action} failed (${resp.status})`)
  }
  return resp.json()
}

export const mediaFolderApi = {
  list: (siteId?: string): Promise<MediaFoldersResponse> => {
    const qs = siteId ? `?siteId=${encodeURIComponent(siteId)}` : ''
    return api.get<MediaFoldersResponse>(`/media/folders${qs}`)
  },

  create: (input: CreateFolderInput): Promise<MediaFolder> =>
    apiFetch(`${API_BASE}/media/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then((r) => parseJsonOrThrow(r, 'Create folder')),

  /** Переименование (name) и/или перемещение (parentId: null = в корень). */
  update: (
    id: string,
    patch: { name?: string; parentId?: string | null },
  ): Promise<MediaFolder> =>
    apiFetch(`${API_BASE}/media/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => parseJsonOrThrow(r, 'Update folder')),

  /**
   * Удаление папки.
   * Без strategy — только пустая папка (иначе 400).
   * 'delete-contents' — удалить папку со всем содержимым.
   * 'move-to-parent' — переместить содержимое в родителя, затем удалить.
   */
  delete: (id: string, strategy?: 'delete-contents' | 'move-to-parent'): Promise<void> => {
    const qs = strategy ? `?strategy=${strategy}` : ''
    return api.delete<void>(`/media/folders/${id}${qs}`)
  },
}

/**
 * Resolve a public media URL.
 * `url` from backend is already absolute path (`/media/<key>`); we leave it as-is
 * because nginx proxies it to MinIO. For dev (Vite on :3000) we point to backend host.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/media/')) {
    // In dev (Vite on :3000) media goes through backend nginx (public-site on :443/:80),
    // not through Vite. We resolve relative to current origin to keep flexibility:
    // - prod public-site: nginx serves /media/* directly.
    // - dev admin (localhost:3000): proxied through Vite if configured; otherwise
    //   user can override via VITE_PUBLIC_MEDIA_URL.
    const base = ((import.meta as any).env?.VITE_PUBLIC_MEDIA_URL as string | undefined) || ''
    if (base) return base.replace(/\/+$/, '') + url.replace(/^\/media/, '')
  }
  return url
}
