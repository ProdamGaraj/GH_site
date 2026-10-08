// Типы модуля новостей (news-service admin API, см. news-service/README.md).
import type { GalleryItem } from '@/shared/forms/gallerySlides'

export type NewsStatus = 'draft' | 'published' | 'archived'
export type SectionType = 'text' | 'photoText' | 'sliderText' | 'block'
export type MediaSide = 'left' | 'right'
/** Языки перевода: новость публикуется на них по отметке и при полном переводе. */
export type ExtraLocale = 'uz' | 'en'
export const EXTRA_LOCALES: ExtraLocale[] = ['uz', 'en']

/** Вид якоря блока данных CMS. */
export type AnchorKind = 'text' | 'richtext' | 'image' | 'link'
export type LinkValue = { href: string; text: string }

/** Значение якоря секции-блока. */
export interface BlockValue {
  kind: AnchorKind
  /** text/richtext/image — строка; link — {href, text}. */
  value: string | LinkValue
}

/** Блок тела новости. id генерирует админка — по нему привязан перевод текста. */
export interface NewsSection {
  id: string
  type: SectionType
  /** HTML из визуального редактора; сервис чистит его при записи. */
  html: string
  /** «Фото + текст» — первое фото, «слайдер + текст» — все слайды. */
  media: GalleryItem[]
  side: MediaSide
  /** type block: блок данных из библиотеки CMS. */
  blockId?: string
  /** type block: значения якорей по ключу. */
  values?: Record<string, BlockValue>
}

/** Перевод новости на язык: текст секций — по id секции. */
export interface NewsTranslation {
  title: string
  lead: string
  sections: Record<string, string>
  /** Секции-блоки: id секции → ключ якоря → перевод текста (картинки и адреса — общие). */
  blocks?: Record<string, Record<string, string>>
}

/** Якорь блока данных (CMS GET /blocks/:id/data-anchors). */
export interface DataAnchor {
  nodeId: string
  key: string
  label: string
  kind: AnchorKind
  /** Прежнее содержимое узла — образец значения. */
  sample: string | LinkValue
}

/** Кандидат в якоря: «данные» (suggested) или «похоже на интерфейс» (noiseReason). */
export interface AnchorCandidate {
  nodeId: string
  kind: AnchorKind
  label: string
  sample: string | LinkValue
  suggested: boolean
  noiseReason?: string
}

export interface BlockDataUsage {
  pages: Array<{ id: string; name: string; slug: string }>
  blocks: Array<{ id: string; name: string }>
  projects: string[]
  news: Array<{ id: string; title: string }>
  unchecked: string[]
}

export type AnchorAction = 'use' | 'copy' | 'rewrite'

export interface BlockAnchorInfo {
  block: { id: string; name: string }
  anchors: DataAnchor[]
  candidates: AnchorCandidate[]
  usage: BlockDataUsage
  actions: AnchorAction[]
}

export interface MakeDataBlockResult {
  blockId: string
  name: string
  anchors: DataAnchor[]
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
