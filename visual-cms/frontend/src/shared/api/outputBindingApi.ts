/**
 * Output Bindings API
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 */

import { api } from './index'
import type { 
  SubmitDataRequest, 
  SubmitResult, 
  DataSubmission,
  SubmissionStats 
} from '@/shared/types/outputBinding'

export const outputBindingApi = {
  /**
   * Отправить данные
   */
  submit: (request: SubmitDataRequest) => 
    api.post<SubmitResult>('/data/submit', request),

  /**
   * Получить историю отправок
   */
  getSubmissions: (params?: {
    pageId?: string
    blockId?: string
    dataSourceId?: string
    status?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }) => {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })
    }
    const query = queryParams.toString()
    return api.get<{ items: DataSubmission[]; total: number }>(
      `/data/submissions${query ? `?${query}` : ''}`
    )
  },

  /**
   * Получить одну запись
   */
  getSubmissionById: (id: string) => 
    api.get<DataSubmission>(`/data/submissions/${id}`),

  /**
   * Получить статистику
   */
  getStats: (params?: {
    pageId?: string
    dataSourceId?: string
    startDate?: string
    endDate?: string
  }) => {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })
    }
    const query = queryParams.toString()
    return api.get<SubmissionStats>(
      `/data/submissions/stats${query ? `?${query}` : ''}`
    )
  },
}

export default outputBindingApi
