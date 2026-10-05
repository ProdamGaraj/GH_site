import { z } from 'zod'
import { SLUG_RE } from '../services/slug'

/**
 * Элемент галереи: ссылка строкой или {url, focus, fit} — как в
 * estate-service (services/mediaSlides.ts), один контракт слайдов.
 */
export const galleryItemSchema = z.union([
  z.string().max(500),
  z.object({
    url: z.string().min(1).max(500),
    focus: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
    fit: z.enum(['cover', 'contain']).optional(),
  }),
])

const keySchema = z.string().regex(/^[a-z0-9_-]{1,40}$/, 'латиница, цифры, - и _')
const html = z.string().max(50000)

/** Блок тела новости. id генерирует админка — по нему привязан перевод. */
export const sectionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['text', 'photoText', 'sliderText']),
  html: html.default(''),
  media: z.array(galleryItemSchema).max(30).default([]),
  side: z.enum(['left', 'right']).default('right'),
})

/** Переводы: { uz: { title, lead, sections: { "<id секции>": html } }, en: … } */
export const translationsSchema = z
  .record(
    z.enum(['uz', 'en']),
    z.object({
      title: z.string().max(300).optional(),
      lead: z.string().max(2000).optional(),
      sections: z.record(z.string().uuid(), html).optional(),
    })
  )
  .optional()

const newsFields = {
  slug: z.string().regex(SLUG_RE, 'адрес: латиница, цифры и дефисы').max(120),
  categoryKey: keySchema.nullable(),
  tagKeys: z.array(keySchema).max(20),
  title: z.string().trim().min(1, 'нужен заголовок').max(300),
  lead: z.string().max(2000),
  cover: galleryItemSchema.nullable(),
  hero: z.array(galleryItemSchema).max(30),
  sections: z.array(sectionSchema).max(100),
  publishOn: z.array(z.enum(['uz', 'en'])).max(2),
  /** Дату новости можно поправить (например, импорт старых постов). */
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  translations: translationsSchema,
}

export const createNewsSchema = z.object(newsFields).partial().required({ title: true })
export const updateNewsSchema = z.object(newsFields).partial()

export const dictionarySchema = z.object({
  key: keySchema,
  nameRu: z.string().trim().min(1).max(80),
  nameUz: z.string().trim().max(80).default(''),
  nameEn: z.string().trim().max(80).default(''),
  order: z.number().int().default(0),
  hidden: z.boolean().default(false),
})
export const updateDictionarySchema = dictionarySchema.omit({ key: true }).partial()

/** Отчёт CMS о деплое коллекции новостей на языке: какие адреса выкачены. */
export const deployedSchema = z.object({
  locale: z.enum(['ru', 'uz', 'en']),
  slugs: z.array(z.string().max(120)).max(10000),
})

export type CreateNewsInput = z.infer<typeof createNewsSchema>
export type UpdateNewsInput = z.infer<typeof updateNewsSchema>
export type TranslationsInput = z.infer<typeof translationsSchema>
