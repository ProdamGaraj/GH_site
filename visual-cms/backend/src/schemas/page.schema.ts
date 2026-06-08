import { z } from 'zod'

const metadataSchema = z.object({
  title: z.string().max(255).optional().default(''),
  description: z.string().max(1000).optional().default(''),
  keywords: z.array(z.string()).optional().default([]),
  ogImage: z.union([z.string().url(), z.literal('')]).optional(),
  scripts: z.array(z.record(z.unknown())).optional().default([]),
})

// POST /api/pages
export const createPageSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  siteId: z.string().uuid().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
  metadata: metadataSchema,
  rootBlockId: z.string().uuid().nullable().optional(),
  rootBlock: z.record(z.unknown()).nullable().optional(),
  structure: z.record(z.unknown()).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  isTemplate: z.boolean().optional().default(false),
})

// PUT /api/pages/:id
export const updatePageSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  siteId: z.string().uuid().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
  metadata: metadataSchema.partial().optional(),
  rootBlockId: z.string().uuid().nullable().optional(),
  rootBlock: z.record(z.unknown()).nullable().optional(),
  structure: z.record(z.unknown()).nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  isTemplate: z.boolean().optional(),
  // Решения пользователя по изменённым linked-блокам (instanceId -> действие).
  // Применяются в PageController.update перед сохранением структуры.
  decisions: z.record(z.enum(['push', 'static', 'revert'])).optional(),
})

// POST /api/pages/:id/save-preflight — детект расхождения linked-блоков перед сохранением
export const savePreflightSchema = z.object({
  structure: z.record(z.unknown()),
})

// PUT /api/pages/:id/data-sources
export const updatePageDataSourcesSchema = z.object({
  dataSources: z.record(z.unknown()),
})

// PUT /api/pages/:id/variables
export const updatePageVariablesSchema = z.object({
  variables: z.record(z.unknown()),
})

// Доп.источники данных страницы (вшиваются в привязку как page-variable на деплое)
const pageAdditionalSourceSchema = z.object({
  targetBindingId: z.string().uuid('Invalid target binding ID'),
  dataSourceId: z.string().uuid('Invalid data source ID'),
  arrayPath: z.string().max(255).optional(),
  endpointConfig: z.object({
    path: z.string().max(2048).optional(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
    headers: z.record(z.string()).optional(),
    queryParams: z.record(z.string()).optional(),
    body: z.string().optional(),
    bodyFormat: z.enum(['json', 'form-data', 'form-urlencoded', 'raw']).optional(),
  }).optional(),
  extract: z.record(z.string().max(512)).optional(),
})

// PUT /api/pages/:id/data-settings
export const updateDataSettingsSchema = z.object({
  dataSources: z.record(z.unknown()).optional(),
  variables: z.record(z.unknown()).optional(),
  additionalSources: z.array(pageAdditionalSourceSchema).optional(),
})
