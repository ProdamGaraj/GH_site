import { z } from 'zod'
import { isMapIcon } from '../services/mapIcons'

/** Переводы: { uz: {field: value}, en: {field: value} }. Значения свободны
 *  (string | string[] | объект) — контроллер сериализует по типу поля. */
const translationsSchema = z.record(z.record(z.unknown())).optional()

const statsItemSchema = z.object({ value: z.string(), label: z.string() })

/** Подпись на карте проекта. top/left — CSS-проценты ('46%'). */
const locationLabelSchema = z.object({
  label: z.string().max(120),
  accent: z.boolean().optional(),
  top: z.string().max(20),
  left: z.string().max(20),
})

/**
 * Склейка типов планировок на витрине.
 *
 * Правится у каждого ЖК: общего признака «одна планировка» в метаданных
 * CRM нет, а допустимый разброс площади у проектов свой. Подбирается в
 * админке (раздел «Планировки на сайте») или scripts/preview-plan-groups.ts.
 */
const planGroupingSchema = z
  .object({
    areaTolerance: z.number().min(0).max(50).optional(),
    groups: z.array(z.object({ plans: z.array(z.string().min(1)).min(2) })).optional(),
    keepSeparate: z.array(z.string().min(1)).optional(),
  })
  .nullable()

/**
 * Элемент галереи слайдов: ссылка строкой или ссылка с кадрированием —
 * точкой фокуса (проценты кадра) и вписыванием. См. services/mediaSlides.ts.
 */
export const galleryItemSchema = z.union([
  z.string().max(500),
  z.object({
    url: z.string().min(1).max(500),
    focus: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
    fit: z.enum(['cover', 'contain']).optional(),
  }),
])

// --- Карта проекта (services/projectMap.ts) ---
const latitude = z.number().min(-90).max(90)
const longitude = z.number().min(-180).max(180)

export const geoPointSchema = z.object({ lat: latitude, lng: longitude })

export const salesOfficeSchema = geoPointSchema.extend({ address: z.string().max(300).optional() })

export const mapPlaceSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  lat: latitude,
  lng: longitude,
})

/** Места рядом с ЖК: id уникальны — на них держатся переводы названий. */
export const mapPlacesSchema = z
  .array(mapPlaceSchema)
  .max(100)
  .refine((places) => new Set(places.map((p) => p.id)).size === places.length, 'id мест повторяются')

const placeTypeFields = {
  nameRu: z.string().trim().min(1).max(80),
  nameUz: z.string().trim().max(80).optional(),
  nameEn: z.string().trim().max(80).optional(),
  icon: z.string().refine(isMapIcon, 'Иконки нет в наборе'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Цвет в виде #rrggbb'),
  order: z.number().int().optional(),
  hidden: z.boolean().optional(),
}

/** Ключ типа неизменен: на него ссылаются места у ЖК. */
export const createPlaceTypeSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/, 'Ключ: латиница, цифры и дефис, от 2 символов'),
  ...placeTypeFields,
})
export const updatePlaceTypeSchema = z.object(placeTypeFields).partial()

// --- Complex ---
const complexBase = {
  slug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/, 'slug: только a-z, 0-9, дефис'),
  order: z.number().int().optional(),
  externalHouseId: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'sold_out']).optional(),
  name: z.string().min(1).max(200),
  className: z.string().max(60).optional(),
  intro: z.string().optional(),
  about: z.string().optional(),
  aboutTitle: z.string().max(200).optional(),
  aboutExtra: z.string().optional(),
  hallTitle: z.string().max(200).optional(),
  hallText: z.string().optional(),
  address: z.string().max(300).optional(),
  locationTitle: z.string().max(200).optional(),
  locationText: z.string().optional(),
  locationLabels: z.array(locationLabelSchema).optional(),
  yardEyebrow: z.string().max(120).optional(),
  yardTitle: z.string().max(200).optional(),
  yardText: z.string().optional(),
  yardFeatures: z.array(z.string()).optional(),
  stats: z.array(statsItemSchema).optional(),
  logo: z.string().max(500).optional(),
  logoClass: z.string().max(60).optional(),
  media: z.string().max(500).optional(),
  aboutVideo: z.string().max(500).optional(),
  mapUrl: z.string().max(500).optional(),
  mapImage: z.string().max(500).optional(),
  panoramaUrl: z.string().max(500).optional(),
  heroImages: z.array(z.string()).optional(),
  gallery: z.array(galleryItemSchema).optional(),
  hallGallery: z.array(galleryItemSchema).optional(),
  yardGallery: z.array(galleryItemSchema).optional(),
  planGrouping: planGroupingSchema.optional(),
  housePoint: geoPointSchema.nullable().optional(),
  salesOffice: salesOfficeSchema.nullable().optional(),
  places: mapPlacesSchema.optional(),
  translations: translationsSchema,
}
export const createComplexSchema = z.object(complexBase)
export const updateComplexSchema = z.object(complexBase).partial()

/** Предпросмотр склейки: черновик настройки, ещё не сохранённый в ЖК. */
export const previewPlanGroupsSchema = z.object({ planGrouping: planGroupingSchema })

// --- House ---
const houseBase = {
  order: z.number().int().optional(),
  name: z.string().max(120).optional(),
  floors: z.string().max(60).optional(),
  deadline: z.string().max(60).optional(),
  className: z.string().max(60).optional(),
  entrances: z.number().int().nullable().optional(),
  translations: translationsSchema,
}
export const createHouseSchema = z.object(houseBase)
export const updateHouseSchema = z.object(houseBase).partial()

// --- Apartment ---
const apartmentBase = {
  order: z.number().int().optional(),
  rooms: z.number().int().min(0).optional(),
  areaM2: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  oldPrice: z.number().min(0).nullable().optional(),
  entrance: z.number().int().nullable().optional(),
  apartmentClass: z.string().max(60).optional(),
  badges: z.array(z.string()).optional(),
  floor: z.string().max(20).optional(),
  number: z.string().max(40).optional(),
  deadline: z.string().max(60).optional(),
  offerLabel: z.string().max(80).optional(),
  status: z.enum(['available', 'sold']).optional(),
  planImage: z.string().max(500).optional(),
  translations: translationsSchema,
}
export const createApartmentSchema = z.object(apartmentBase)
export const updateApartmentSchema = z.object(apartmentBase).partial()
