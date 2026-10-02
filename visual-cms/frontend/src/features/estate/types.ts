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
  /** Проект на сайте (карточка на главной и страница). */
  showOnSite: boolean
  order: number
  /** Сколько домов проекта связано с MacroCRM; 0 — проект не синхронизируется. */
  crmHouses: number
}

export interface Apartment {
  id: string
  houseId: string
  order: number
  rooms: number
  areaM2: number | string
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

/**
 * Дом / корпус — единица MacroCRM. Проект объединяет дома; полей проекта дом
 * не меняет — даёт странице проекта квартиры, планировки и срок сдачи.
 */
export interface House {
  id: string
  complexId: string
  order: number
  /** ID дома в MacroCRM — связь с CRM; null — дом не синхронизируется. */
  externalId: number | null
  name: string
  floors: string
  /** Ручной срок сдачи; пусто — срок из CRM (`crmDeadline`). */
  deadline: string
  /** Срок сдачи из CRM строкой (ru), только для показа; пусто — в CRM нет. */
  crmDeadline?: string
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
  /** Проект на сайте: карточка на главной и страница проекта. */
  showOnSite: boolean
  /** Класс для фильтра карточек на главной: comfort | business | premium. */
  filterClass: string
  /** Картинка карточки на главной; пусто — About-медиа. */
  cardImage: string
  /** Теги карточки на главной (переводимые). */
  cardTags: string[]
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
  /** Ссылка на панораму 360°; пусто — кнопки «Панорама 360°» на сайте нет. */
  panoramaUrl?: string
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
  /** Скрытые с сайта планировки: группа скрыта, если в ней есть такая. */
  hidden?: string[]
  /** Ручные данные групп поверх CRM — по «якорной» (главной) планировке группы. */
  overrides?: Record<string, PlanGroupOverride>
}

/** Бейджи группы по языкам; пустой uz/en — на сайте ru. */
export interface PlanGroupBadges {
  ru?: string[]
  uz?: string[]
  en?: string[]
}

/**
 * Ручные данные группы: поле есть — главнее CRM, нет — значение CRM. Цены
 * нет: на сайте цены не показываются.
 */
export interface PlanGroupOverride {
  areaMin?: number
  areaMax?: number
  floors?: number[]
  entrances?: number[]
  badges?: PlanGroupBadges
}

/** Данные карточки, которые можно поправить вручную. */
export interface PlanGroupValues {
  areaMin: number
  areaMax: number
  floors: number[]
  entrances: number[]
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
export interface PlanGroupPreview extends PlanGroupValues {
  manual: boolean
  rooms: number
  isStudio: boolean
  apartmentsCount: number
  /** Значения из CRM — рядом с итоговыми видно, что поправлено. */
  crm: PlanGroupValues
  /** Главная планировка группы: под этим именем сохранится новая правка. */
  anchor: string
  hidden: boolean
  /** Применённая правка и её ключ; null — всё из CRM. */
  overrideKey: string | null
  override: PlanGroupOverride | null
  /** Правки других планировок группы, которые не применяются. */
  ignoredOverrides: string[]
  plans: PlanPreview[]
}

export interface PlanGroupingPreview {
  config: Required<PlanGroupingConfig>
  typesCount: number
  cardsCount: number
  groups: PlanGroupPreview[]
  warnings: { duplicateNames: string[]; unknownNames: string[] }
}
