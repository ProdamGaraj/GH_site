import { z } from 'zod'

// === Language Schemas ===

export const createLanguageSchema = z.object({
  code: z.string().min(2).max(10).regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Invalid language code format (e.g. en, ru, kz, en-US)'),
  name: z.string().min(1).max(100),
  nativeName: z.string().min(1).max(100),
  flag: z.string().max(10).optional(),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  direction: z.enum(['ltr', 'rtl']).optional().default('ltr'),
})

export const updateLanguageSchema = z.object({
  code: z.string().min(2).max(10).regex(/^[a-z]{2,3}(-[A-Z]{2})?$/).optional(),
  name: z.string().min(1).max(100).optional(),
  nativeName: z.string().min(1).max(100).optional(),
  flag: z.string().max(10).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  direction: z.enum(['ltr', 'rtl']).optional(),
})

export const reorderLanguagesSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
})

// === Translation Schemas ===

const translationEntrySchema = z.object({
  nodeId: z.string().min(1).max(255),
  field: z.string().min(1).max(50),
  value: z.string(),
  status: z.enum(['draft', 'review', 'approved', 'published']).optional(),
})

export const bulkTranslationSchema = z.object({
  translations: z.array(translationEntrySchema).min(1).max(5000),
})

export const upsertTranslationSchema = z.object({
  value: z.string(),
  status: z.enum(['draft', 'review', 'approved', 'published']).optional(),
})

export const copyTranslationsSchema = z.object({
  fromLocale: z.string().min(2).max(10),
  toLocale: z.string().min(2).max(10),
})
