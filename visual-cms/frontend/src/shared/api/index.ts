// Ensure API URL always ends with /api
const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'
  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`
}

const API_BASE_URL = getApiBaseUrl()

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
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
      throw new Error(error.message || `HTTP error ${response.status}`)
    }

    return response.json()
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
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
  getById: (id: string) => api.get<Block>(`/blocks/${id}`),
  create: (data: CreateBlockDto) => api.post<Block>('/blocks', data),
  update: (id: string, data: UpdateBlockDto) => api.put<Block>(`/blocks/${id}`, data),
  delete: (id: string) => api.delete<void>(`/blocks/${id}`),
}

// Page API
export const pageApi = {
  getAll: () => api.get<Page[]>('/pages'),
  getById: (id: string) => api.get<Page>(`/pages/${id}`),
  create: (data: CreatePageDto) => api.post<Page>('/pages', data),
  update: (id: string, data: UpdatePageDto) => api.put<Page>(`/pages/${id}`, data),
  delete: (id: string) => api.delete<void>(`/pages/${id}`),
}

// Types
import type { Block, Page, BlockNode } from '@/shared/types'

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
}

export interface CreatePageDto {
  name: string
  slug: string
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
}
