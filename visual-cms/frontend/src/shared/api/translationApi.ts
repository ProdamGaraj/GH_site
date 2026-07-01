/**
 * API layer for Languages and Translations
 */
import { api } from './index'
import { apiFetch } from './http'
import { getApiBaseUrl } from './baseUrl'
import type {
  Language,
  CreateLanguageRequest,
  UpdateLanguageRequest,
  Translation,
  TranslationEntry,
  TranslationMap,
  TranslationProgress,
  BulkTranslationRequest,
} from '@/shared/types/translation'

// === Language API ===
export const languageApi = {
  getAll: () => api.get<Language[]>('/languages'),

  getActive: () => api.get<Language[]>('/languages/active'),

  getById: (id: string) => api.get<Language>(`/languages/${id}`),

  create: (data: CreateLanguageRequest) => api.post<Language>('/languages', data),

  update: (id: string, data: UpdateLanguageRequest) => api.put<Language>(`/languages/${id}`, data),

  delete: (id: string) => api.delete<void>(`/languages/${id}`),

  reorder: (orderedIds: string[]) => api.put<Language[]>('/languages/reorder', { orderedIds }),

  seedDefaults: () => api.post<Language[]>('/languages/seed'),
}

// === Translation API ===
export const translationApi = {
  /** Get all locales with translations for a page */
  getPageLocales: (pageId: string) =>
    api.get<string[]>(`/translations/${pageId}/locales`),

  /** Get all translations for a page in a locale */
  getPageTranslations: (pageId: string, locale: string) =>
    api.get<Translation[]>(`/translations/${pageId}/${locale}`),

  /** Get translations as a flat map */
  getTranslationMap: (pageId: string, locale: string) =>
    api.get<TranslationMap>(`/translations/${pageId}/${locale}/map`),

  /** Extract all translatable fields from source content */
  getTranslatableContent: (pageId: string) =>
    api.get<TranslationEntry[]>(`/translations/${pageId}/source`),

  /** Get translation progress stats */
  getProgress: (pageId: string) =>
    api.get<TranslationProgress[]>(`/translations/${pageId}/progress`),

  /** Bulk upsert translations */
  bulkUpsert: (pageId: string, locale: string, data: BulkTranslationRequest) =>
    api.put<Translation[]>(`/translations/${pageId}/${locale}`, data),

  /** Upsert a single translation */
  upsertOne: (pageId: string, locale: string, nodeId: string, field: string, value: string, status?: string) =>
    api.put<Translation>(`/translations/${pageId}/${locale}/${nodeId}/${field}`, { value, status }),

  /** Delete a single translation */
  deleteOne: (pageId: string, locale: string, nodeId: string, field: string) =>
    api.delete<void>(`/translations/${pageId}/${locale}/${nodeId}/${field}`),

  /** Delete all translations for a locale */
  deleteLocale: (pageId: string, locale: string) =>
    api.delete<{ deleted: number }>(`/translations/${pageId}/${locale}`),

  /** Copy translations between locales */
  copyTranslations: (pageId: string, fromLocale: string, toLocale: string) =>
    api.post<Translation[]>(`/translations/${pageId}/copy`, { fromLocale, toLocale }),

  /** Экспорт всех переводов сайта в XLSX — скачивает файл в браузере. */
  exportSite: async (siteId: string): Promise<void> => {
    const res = await apiFetch(`${getApiBaseUrl()}/translations/site/${siteId}/export`, { method: 'GET' })
    if (!res.ok) throw new Error(`Не удалось выгрузить переводы (${res.status})`)
    const blob = await res.blob()
    const cd = res.headers.get('Content-Disposition') || ''
    const m = cd.match(/filename="?([^"]+)"?/)
    const filename = m ? m[1] : `translations-${siteId}.xlsx`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  /** Импорт переводов сайта из XLSX. Возвращает отчёт. */
  importSite: async (siteId: string, file: File): Promise<TranslationImportReport> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await apiFetch(`${getApiBaseUrl()}/translations/site/${siteId}/import`, {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Импорт не удался' }))
      throw new Error(err.message || `Импорт не удался (${res.status})`)
    }
    return res.json() as Promise<TranslationImportReport>
  },
}

/** Отчёт импорта переводов (соответствует backend TranslationIOService.ImportReport). */
export interface TranslationImportReport {
  imported: number
  updated: number
  skipped: number
  orphans: Array<{ page?: string; nodeId: string; field: string; reason: string }>
  locales: string[]
}
