// Типы модуля ЖК (estate-service admin API).

import type { GalleryItem } from './gallerySlides'

export type Locale = 'ru' | 'uz' | 'en'
export const LOCALES: Locale[] = ['ru', 'uz', 'en']
export const LOCALE_LABELS: Record<Locale, string> = { ru: 'RU', uz: 'UZ', en: 'EN' }

export interface StatItem {
  value: string
  label: string
}

/** Переводы по языку: { uz: {field: value}, en: {...} }. */
export type TranslationsByLocale = Partial<Record<Exclude<Locale, 'ru'>, Record<string, unknown>>>

export interface ComplexListItem {
  id: string
  slug: string
  name: string
  className: string
  status: string
  order: number
  /** ID дома в MacroCRM; null — проект не синхронизируется. */
  externalHouseId: number | null
}

export interface Apartment {
  id: string
  houseId: string
  order: number
  rooms: number
  areaM2: number | string
  price: number | string
  oldPrice: number | string | null
  entrance: number | null
  apartmentClass: string
  badges: string[]
  floor: string
  number: string
  deadline: string
  offerLabel: string
  status: string
  planImage: string
  translations: TranslationsByLocale
}

export interface House {
  id: string
  complexId: string
  order: number
  name: string
  floors: string
  deadline: string
  className: string
  entrances: number | null
  translations: TranslationsByLocale
  apartments: Apartment[]
}

export interface ComplexDetail {
  id: string
  slug: string
  order: number
  status: string
  /**
   * ID ДОМА в MacroCRM (houseId), не ЖК.
   *
   * По нему синхронизация тянет квартиры и планировки. Пусто — проект
   * синхронизация обходит стороной.
   */
  externalHouseId: number | null
  name: string
  className: string
  intro: string
  about: string
  aboutExtra: string
  locationText: string
  yardEyebrow: string
  yardTitle: string
  yardText: string
  yardFeatures: string[]
  stats: StatItem[]
  logo: string
  logoClass: string
  media: string
  aboutVideo: string
  mapUrl: string
  mapImage: string
  heroImages: string[]
  /** Галереи слайдов: ссылка или ссылка с кадрированием (см. gallerySlides.ts). */
  gallery: GalleryItem[]
  hallGallery: GalleryItem[]
  yardGallery: GalleryItem[]
  translations: TranslationsByLocale
  /** Склейка типов планировок на витрине; null — только точные совпадения. */
  planGrouping?: PlanGroupingConfig | null
  /**
   * Виды из окна, которые есть на витрине ЖК (из CRM, по-русски). Только для
   * чтения: по ним строится форма перевода `windowViewLabels` на вкладках uz/en.
   */
  windowViews?: string[]
  /** Карта проекта: точка дома (без неё карты нет), отдел продаж, места рядом. */
  housePoint?: GeoPoint | null
  salesOffice?: SalesOffice | null
  places?: MapPlace[]
  houses: House[]
}

// --- Карта проекта (estate-service: services/projectMap.ts) ---

export interface GeoPoint {
  lat: number
  lng: number
}

export interface SalesOffice extends GeoPoint {
  address?: string
}

/** Место рядом с ЖК; id — uuid, на нём держатся переводы названия (placeNames). */
export interface MapPlace extends GeoPoint {
  id: string
  type: string
  name: string
}

/** Тип места — общий для всех ЖК. Ключ неизменен: на него ссылаются места. */
export interface PlaceType {
  key: string
  nameRu: string
  nameUz: string
  nameEn: string
  icon: string
  color: string
  order: number
  hidden: boolean
}

/** Иконка из набора estate-service: готовый svg. */
export interface MapIconOption {
  key: string
  label: string
  svg: string
}

/** Настройка склейки планировок ЖК (estate-service: services/planGrouping.ts). */
export interface PlanGroupingConfig {
  /** Максимальный разброс площади внутри одной карточки, м². */
  areaTolerance?: number
  /** Принудительно объединённые планировки (по planName). */
  groups?: Array<{ plans: string[] }>
  /** Планировки, которые никогда ни с чем не склеиваются. */
  keepSeparate?: string[]
}

/** Одна планировка внутри карточки предпросмотра. */
export interface PlanPreview {
  planName: string
  houseId: string
  houseName: string
  areaMin: number
  areaMax: number
  floors: number[]
  entrances: number[]
  apartmentsCount: number
  thumb: string
  image: string
  imagesCount: number
  separated: boolean
}

/** Карточка витрины в предпросмотре. */
export interface PlanGroupPreview {
  manual: boolean
  rooms: number
  isStudio: boolean
  areaMin: number
  areaMax: number
  floors: number[]
  entrances: number[]
  apartmentsCount: number
  plans: PlanPreview[]
}

export interface PlanGroupingPreview {
  config: Required<PlanGroupingConfig>
  typesCount: number
  cardsCount: number
  groups: PlanGroupPreview[]
  warnings: { duplicateNames: string[]; unknownNames: string[] }
}
