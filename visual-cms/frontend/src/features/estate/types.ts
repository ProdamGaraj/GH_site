// Типы модуля ЖК (estate-service admin API).

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
  gallery: string[]
  hallGallery: string[]
  yardGallery: string[]
  translations: TranslationsByLocale
  houses: House[]
}
