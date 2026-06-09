import { z } from 'zod'

export const updateMediaSchema = z.object({
  title: z.string().max(255).nullable().optional(),
  alt: z.string().max(512).nullable().optional(),
  tags: z.array(z.string().max(64)).max(32).optional(),
})

export const listMediaQuerySchema = z.object({
  siteId: z.string().uuid().optional(),
  includeGlobal: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
  kind: z.enum(['image', 'video', 'document']).optional(),
  search: z.string().max(255).optional(),
  tag: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
