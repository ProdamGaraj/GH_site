/**
 * Types for the i18n/translation system
 */

export interface Language {
  id: string
  code: string
  name: string
  nativeName: string
  flag?: string
  isDefault: boolean
  isActive: boolean
  order: number
  direction: 'ltr' | 'rtl'
  createdAt: string
  updatedAt: string
}

export interface CreateLanguageRequest {
  code: string
  name: string
  nativeName: string
  flag?: string
  isDefault?: boolean
  isActive?: boolean
  direction?: 'ltr' | 'rtl'
}

export interface UpdateLanguageRequest {
  code?: string
  name?: string
  nativeName?: string
  flag?: string
  isDefault?: boolean
  isActive?: boolean
  order?: number
  direction?: 'ltr' | 'rtl'
}

export interface TranslationEntry {
  nodeId: string
  field: string
  value: string
  status?: 'draft' | 'review' | 'approved' | 'published'
}

export interface Translation {
  id: string
  pageId: string
  locale: string
  nodeId: string
  field: string
  value: string
  status: 'draft' | 'review' | 'approved' | 'published'
  createdAt: string
  updatedAt: string
}

export interface TranslationMap {
  [nodeId: string]: {
    [field: string]: string
  }
}

export interface TranslationProgress {
  locale: string
  total: number
  translated: number
  percentage: number
  byStatus: {
    draft: number
    review: number
    approved: number
    published: number
  }
}

export interface BulkTranslationRequest {
  translations: TranslationEntry[]
}
