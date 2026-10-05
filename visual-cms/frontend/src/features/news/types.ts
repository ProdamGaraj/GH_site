// Типы модуля новостей (news-service admin API, см. news-service/README.md).
import type { GalleryItem } from '@/shared/forms/gallerySlides'

export type NewsStatus = 'draft' | 'published' | 'archived'
export type SectionType = 'text' | 'photoText' | 'sliderText'
export type MediaSide = 'left' | 'right'
/** Языки перевода: новость публикуется на них по отметке и при полном переводе. */
export type ExtraLocale = 'uz' | 'en'
export const EXTRA_LOCALES: ExtraLocale[] = ['uz', 'en']

/** Блок тела новости. id генерирует админка — по нему привязан перевод текста. */
export interface NewsSection {
  id: string
  type: SectionType
  /** HTML из визуального редактора; сервис чистит его при записи. */
  html: string
  /** «Фото + текст» — первое фото, «слайдер + текст» — все слайды. */
  media: GalleryItem[]
  side: MediaSide
}

/** Перевод новости на язык: текст секций — по id секции. */
export interface NewsTranslation {
  title: string
  lead: string
  sections: Record<string, string>
}

export interface LocaleState {
  /** Язык отмечен к публикации. */
  enabled: boolean
  /** Чего не хватает в переводе: `title`, `lead`, `section:<номер>`. */
  missing: string[]
}

/** Поля новости, которые правит редактор. */
export interface NewsDraft {
  slug: string
  categoryKey: string | null
  tagKeys: string[]
  title: string
  lead: string
  cover: GalleryItem | null
  hero: GalleryItem[]
  sections: NewsSection[]
  publishOn: ExtraLocale[]
  publishedAt: string | null
  translations: Record<ExtraLocale, NewsTranslation>
}

export interface NewsDetail extends NewsDraft {
  id: string
  status: NewsStatus
  slugLocked: boolean
  createdAt: string
  updatedAt: string
  locales: Record<ExtraLocale, LocaleState>
}

export interface NewsListItem {
  id: string
  slug: string
  status: NewsStatus
  title: string
  publishedAt: string | null
  categoryKey: string | null
  tagKeys: string[]
  hero: GalleryItem[]
  updatedAt: string
  locales: Record<ExtraLocale, LocaleState>
}

/** Рубрика (бейдж карточки) или тег. Ключ неизменен. */
export interface DictionaryEntry {
  key: string
  nameRu: string
  nameUz: string
  nameEn: string
  order: number
  hidden: boolean
}

export type DictionaryKind = 'categories' | 'tags'
