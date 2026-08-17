import { z } from 'zod'

/** Переводы: { uz: {field: value}, en: {field: value} }. Значения свободны
 *  (string | string[] | объект) — контроллер сериализует по типу поля. */
const translationsSchema = z.record(z.record(z.unknown())).optional()

const statsItemSchema = z.object({ value: z.string(), label: z.string() })

// --- Complex ---
const complexBase = {
  slug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/, 'slug: только a-z, 0-9, дефис'),
  order: z.number().int().optional(),
  status: z.enum(['active', 'sold_out']).optional(),
  name: z.string().min(1).max(200),
  className: z.string().max(60).optional(),
  intro: z.string().optional(),
  about: z.string().optional(),
  aboutExtra: z.string().optional(),
  locationText: z.string().optional(),
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
  heroImages: z.array(z.string()).optional(),
  gallery: z.array(z.string()).optional(),
  hallGallery: z.array(z.string()).optional(),
  yardGallery: z.array(z.string()).optional(),
  translations: translationsSchema,
}
export const createComplexSchema = z.object(complexBase)
export const updateComplexSchema = z.object(complexBase).partial()

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
