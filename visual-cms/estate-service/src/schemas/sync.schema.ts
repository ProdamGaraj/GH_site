import { z } from 'zod'

/**
 * Контракт синхронизации дома из MacroCRM.
 *
 * Схема здесь — единственная защита от рассинхрона с backend CMS, который эти
 * данные готовит: сервисы собираются раздельно, общих типов у них нет, и
 * переименованное поле выяснилось бы иначе только по кривым карточкам на сайте.
 *
 * Почти всё допускает пустоту сознательно: в живой выдаче CRM из ста восьми
 * полей заполнены десять, и требовать больше — значит отклонять нормальные
 * данные.
 */

const planImage = z.object({
  title: z.string().max(200).default(''),
  url: z.string().min(1).max(500),
  thumbUrl: z.string().max(500).default(''),
})

export const planTypeInputSchema = z.object({
  signature: z.string().min(1).max(200),
  planName: z.string().max(200).default(''),
  images: z.array(planImage).default([]),
  panoUrl: z.string().max(500).default(''),
  rooms: z.number().int().min(0).default(0),
  isStudio: z.boolean().default(false),
  areaMin: z.number().nonnegative().default(0),
  areaMax: z.number().nonnegative().default(0),
  priceMin: z.number().nonnegative().default(0),
  priceMax: z.number().nonnegative().default(0),
  apartmentsCount: z.number().int().min(0).default(0),
  floors: z.array(z.number().int()).default([]),
  entrances: z.array(z.number().int()).default([]),
  windowViews: z.array(z.string()).default([]),
  order: z.number().int().default(0),
})

export const apartmentInputSchema = z.object({
  externalId: z.number().int().positive(),
  rooms: z.number().int().min(0).default(0),
  areaM2: z.number().positive(),
  price: z.number().nonnegative().default(0),
  oldPrice: z.number().nonnegative().nullable().default(null),
  entrance: z.number().int().nullable().default(null),
  // Этаж может быть отрицательным: подземные уровни в CRM так и приходят.
  floorNumber: z.number().int().nullable().default(null),
  floor: z.string().max(20).default(''),
  number: z.string().max(40).default(''),
  isStudio: z.boolean().default(false),
  windowView: z.string().max(120).default(''),
  status: z.enum(['available', 'reserved', 'sold', 'hidden']).default('available'),
  dateModified: z.string().datetime().nullable().default(null),
  planSignature: z.string().max(200).nullable().default(null),
  planProbed: z.boolean().default(false),
})

export const syncHouseSchema = z.object({
  /** ID дома в MacroCRM. По нему находится наш «комплекс». */
  externalHouseId: z.number().int().positive(),
  /** Сведения о доме из estateHouses/list. Пустой объект допустим. */
  house: z
    .object({
      name: z.string().max(120).default(''),
      floorsCount: z.number().int().positive().nullable().default(null),
      address: z.string().max(500).default(''),
    })
    .default({}),
  planTypes: z.array(planTypeInputSchema).default([]),
  apartments: z.array(apartmentInputSchema).default([]),
})

export type SyncHouseBody = z.infer<typeof syncHouseSchema>
