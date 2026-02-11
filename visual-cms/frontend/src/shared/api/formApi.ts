import { api } from './index'
import type {
  Form,
  CreateFormRequest,
  UpdateFormRequest,
  FormDestination,
  CreateDestinationRequest,
  UpdateDestinationRequest,
  FormSubmissionLog,
  SubmissionStats,
  DestinationTestResult,
} from '../types/form'

// ─── Forms API ───────────────────────────────────────────────────

export const formApi = {
  // Forms CRUD
  getAll: (params?: { status?: string; pageId?: string; search?: string }) =>
    api.get<Form[]>('/forms', { params: params as any }),

  getById: (id: string) =>
    api.get<Form>(`/forms/${id}`),

  create: (data: CreateFormRequest) =>
    api.post<Form>('/forms', data),

  update: (id: string, data: UpdateFormRequest) =>
    api.put<Form>(`/forms/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/forms/${id}`),

  duplicate: (id: string) =>
    api.post<Form>(`/forms/${id}/duplicate`),

  // Destinations
  getDestinations: (formId: string) =>
    api.get<FormDestination[]>(`/forms/${formId}/destinations`),

  createDestination: (formId: string, data: CreateDestinationRequest) =>
    api.post<FormDestination>(`/forms/${formId}/destinations`, data),

  updateDestination: (formId: string, destId: string, data: UpdateDestinationRequest) =>
    api.put<FormDestination>(`/forms/${formId}/destinations/${destId}`, data),

  deleteDestination: (formId: string, destId: string) =>
    api.delete<void>(`/forms/${formId}/destinations/${destId}`),

  testDestination: (formId: string, destId: string) =>
    api.post<DestinationTestResult>(`/forms/${formId}/destinations/${destId}/test`),

  // Submissions
  getSubmissions: (formId: string, params?: { status?: string; limit?: number; offset?: number }) =>
    api.get<{ items: FormSubmissionLog[]; total: number }>(
      `/forms/${formId}/submissions`,
      { params: params as any }
    ),

  getSubmissionStats: (formId: string) =>
    api.get<SubmissionStats>(`/forms/${formId}/submissions/stats`),

  // Public submit (for use on published site)
  submit: (formId: string, data: Record<string, unknown>) =>
    api.post<{ success: boolean; message: string }>(`/forms/${formId}/submit`, { data }),
}
