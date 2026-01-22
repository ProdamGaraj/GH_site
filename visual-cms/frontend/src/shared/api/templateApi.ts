/**
 * Templates API
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 3: Templates System
 */

import { api } from './index'
import type { 
  Template, 
  CreateTemplateRequest, 
  UpdateTemplateRequest, 
  TemplateFilters,
  DetectedField 
} from '@/shared/types/template'

export const templateApi = {
  /**
   * Получить список шаблонов
   */
  getAll: (filters?: TemplateFilters) => {
    const params = new URLSearchParams()
    if (filters?.category) params.append('category', filters.category)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.tags) params.append('tags', filters.tags.join(','))
    if (filters?.isBuiltIn !== undefined) params.append('isBuiltIn', String(filters.isBuiltIn))
    
    const queryString = params.toString()
    return api.get<Template[]>(`/templates${queryString ? `?${queryString}` : ''}`)
  },

  /**
   * Получить шаблон по ID
   */
  getById: (id: string) => api.get<Template>(`/templates/${id}`),

  /**
   * Создать шаблон
   */
  create: (data: CreateTemplateRequest) => api.post<Template>('/templates', data),

  /**
   * Обновить шаблон
   */
  update: (id: string, data: UpdateTemplateRequest) => api.put<Template>(`/templates/${id}`, data),

  /**
   * Удалить шаблон
   */
  delete: (id: string) => api.delete<void>(`/templates/${id}`),

  /**
   * Дублировать шаблон
   */
  duplicate: (id: string, newName?: string) => 
    api.post<Template>(`/templates/${id}/duplicate`, { name: newName }),

  /**
   * Переопределить поля шаблона
   */
  detectFields: (id: string) => 
    api.post<{ templateId: string; detectedFields: DetectedField[] }>(
      `/templates/${id}/detect-fields`
    ),

  /**
   * Определить поля из HTML (без сохранения)
   */
  detectFieldsFromHtml: (html: string) => 
    api.post<{ detectedFields: DetectedField[] }>('/templates/detect-fields', { html }),
}

export default templateApi
