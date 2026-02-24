/**
 * API layer for Languages and Translations
 */
import { api } from './index'
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
}
