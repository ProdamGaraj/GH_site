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

/** Отметка «один текст для всех языков»: same — всегда оригинал, translate — переводить. */
export type SameMark = 'same' | 'translate'

/** Чей перевод у поля: страницы или библиотечного блока (общий для его страниц). */
export type TranslationOwner =
  | { kind: 'page' }
  | { kind: 'block'; blockId: string; blockName: string; pageCount: number }

/** Поле страницы в панели переводов (GET /translations/:pageId/:locale/overview). */
export interface TranslationOverviewEntry extends TranslationEntry {
  translation?: string
  translationStatus?: string
  owner: TranslationOwner
  mark?: SameMark
  /** Действует ли «один текст для всех языков» (с учётом умолчания поля). */
  same: boolean
  /** Поле по умолчанию общее (ссылки, медиа). */
  sameByDefault: boolean
  /** Не переведено: из-за таких полей языковая версия закрыта noindex. */
  missing: boolean
}

export interface TranslationOverview {
  locale: string
  total: number
  missing: number
  entries: TranslationOverviewEntry[]
}

export interface BulkTranslationRequest {
  translations: TranslationEntry[]
}
