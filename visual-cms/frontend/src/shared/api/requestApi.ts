/**
 * Запросы привязок в редакторе: превью, тест-отправка, запрос привязки
 * (для старых привязок — прочитанный сервером из старого вида).
 */
import { api } from './index'
import type { RequestEditorPayload, RequestPreviewResult, RequestSpec, RequestTestResult } from '@/shared/types/requestSpec'

export const requestApi = {
  preview: (payload: RequestEditorPayload) => api.post<RequestPreviewResult>('/data/requests/preview', payload),
  test: (payload: RequestEditorPayload) => api.post<RequestTestResult>('/data/requests/test', payload),
  effective: (bindingId: string) => api.get<{ request: RequestSpec | null }>(`/data/requests/effective/${bindingId}`),
}
