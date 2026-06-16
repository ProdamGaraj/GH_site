import { z } from 'zod'

export const updateMediaSchema = z.object({
  title: z.string().max(255).nullable().optional(),
  alt: z.string().max(512).nullable().optional(),
  tags: z.array(z.string().max(64)).max(32).optional(),
  // null = переместить в корень; uuid = в конкретную папку.
  folderId: z.string().uuid().nullable().optional(),
})

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'string' ? v === 'true' : v))

export const listMediaQuerySchema = z.object({
  siteId: z.string().uuid().optional(),
  includeGlobal: booleanish.optional(),
  kind: z.enum(['image', 'video', 'document']).optional(),
  search: z.string().max(255).optional(),
  tag: z.string().max(64).optional(),
  // 'root' = только файлы вне папок; uuid = конкретная папка.
  folderId: z.union([z.string().uuid(), z.literal('root')]).optional(),
  sort: z.enum(['newest', 'oldest', 'name', 'largest', 'smallest']).optional(),
  dateFrom: z.string().max(40).optional(),
  dateTo: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

// ---- Папки ----

export const listFoldersQuerySchema = z.object({
  siteId: z.string().uuid().optional(),
  includeGlobal: booleanish.optional(),
})

export const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().nullable().optional(),
  siteId: z.string().uuid().nullable().optional(),
})

export const updateFolderSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    // присутствие parentId означает перемещение (null = в корень).
    parentId: z.string().uuid().nullable().optional(),
  })
  .refine((d) => d.name !== undefined || d.parentId !== undefined, {
    message: 'Either name or parentId must be provided',
  })
