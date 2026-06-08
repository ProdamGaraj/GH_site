import { z } from 'zod'

const linkModeEnum = z.enum(['auto', 'manual', 'disabled'])
const itemsOrderEnum = z.enum(['api', 'alphabetical', 'custom'])

const endpointConfigBodySchema = z.object({
  path: z.string().max(2048).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string()).optional(),
  queryParams: z.record(z.string()).optional(),
  body: z.string().optional(),
  bodyFormat: z.enum(['json', 'form-data', 'form-urlencoded', 'raw']).optional(),
})

const additionalSourceSchema = z.object({
  itemKey: z.string().min(1, 'itemKey is required').max(255),
  dataSourceId: z.string().uuid('Invalid additional source DataSource ID'),
  arrayPath: z.string().max(255).optional(),
  endpointConfig: endpointConfigBodySchema.optional(),
  extract: z.record(z.string().max(512)).optional(),
  join: z.object({
    itemField: z.string().min(1).max(255),
    sourceField: z.string().min(1).max(255),
  }).optional(),
})

const endpointConfigSchema = endpointConfigBodySchema.optional()

// Серверная трансформация элементов коллекции (как у дата-биндингов).
// Совпадает с DataTransform фронтенда / DataTransformConfig бэкенда.
const transformFilterOperatorEnum = z.enum([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'containsAny', 'notContains',
  'startsWith', 'endsWith', 'in', 'notIn', 'between', 'exists', 'isEmpty',
])
const transformFilterSchema = z.object({
  field: z.string(),
  operator: transformFilterOperatorEnum,
  value: z.unknown().optional(),
}).passthrough()
const collectionTransformSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['include', 'exclude', 'prepend', 'append', 'sort', 'limit', 'unique']),
  enabled: z.boolean().optional(),
  filter: transformFilterSchema.optional(),
  staticItems: z.array(z.unknown()).optional(),
  field: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  keepFirst: z.boolean().optional(),
}).passthrough()

// POST /api/collections
export const createCollectionSchema = z.object({
  siteId: z.string().uuid('Invalid site ID'),
  name: z.string().min(1, 'Name is required').max(255),

  dataSourceId: z.string().uuid('Invalid data source ID'),
  arrayPath: z.string().max(255).optional().default('data'),

  // Опциональный второй DS для агрегированной статистики (Macro v2 estateSell/list).
  // null допускается чтобы UI мог явно очистить значение.
  statsDataSourceId: z.string().uuid('Invalid stats data source ID').nullable().optional(),

  templatePageId: z.string().uuid('Invalid template page ID'),

  basePath: z.string()
    .min(1, 'Base path is required')
    .max(255)
    .regex(/^\/[a-z0-9\-\/]*$/, 'Base path must start with / and contain only lowercase, numbers, hyphens'),
  slugField: z.string().min(1, 'Slug field is required').max(255),
  titleField: z.string().max(255).optional().default('title'),
  apiIdField: z.string().min(1).max(255).optional().default('id'),

  linkMode: linkModeEnum.optional().default('auto'),
  linkTextField: z.string().max(255).optional(),

  isActive: z.boolean().optional().default(true),
  itemsOrder: itemsOrderEnum.optional().default('api'),

  useCache: z.boolean().optional().default(true),
  cacheTtl: z.number().int().min(0).max(86400).optional().default(600),
  pollInterval: z.number().int().min(0).max(86400).optional().default(300),

  indexPageId: z.string().uuid().nullable().optional(),

  transforms: z.array(collectionTransformSchema).optional(),
  endpointConfig: endpointConfigSchema,
  mainExtract: z.record(z.string().max(512)).optional(),
  additionalSources: z.array(additionalSourceSchema).optional(),
})

// PUT /api/collections/:id
export const updateCollectionSchema = z.object({
  name: z.string().min(1).max(255).optional(),

  dataSourceId: z.string().uuid().optional(),
  arrayPath: z.string().max(255).optional(),

  // Опциональный второй DS для статистики; null = отвязать.
  statsDataSourceId: z.string().uuid('Invalid stats data source ID').nullable().optional(),

  templatePageId: z.string().uuid().optional(),

  basePath: z.string()
    .min(1)
    .max(255)
    .regex(/^\/[a-z0-9\-\/]*$/, 'Base path must start with / and contain only lowercase, numbers, hyphens')
    .optional(),
  slugField: z.string().min(1).max(255).optional(),
  titleField: z.string().max(255).optional(),
  apiIdField: z.string().min(1).max(255).optional(),

  linkMode: linkModeEnum.optional(),
  linkTextField: z.string().max(255).optional(),

  isActive: z.boolean().optional(),
  itemsOrder: itemsOrderEnum.optional(),

  useCache: z.boolean().optional(),
  cacheTtl: z.number().int().min(0).max(86400).optional(),
  pollInterval: z.number().int().min(0).max(86400).optional(),

  indexPageId: z.string().uuid().nullable().optional(),

  transforms: z.array(collectionTransformSchema).optional(),
  endpointConfig: endpointConfigSchema,
  mainExtract: z.record(z.string().max(512)).optional(),
  additionalSources: z.array(additionalSourceSchema).optional(),
})

// POST /api/collections/:id/overrides
export const createOverrideSchema = z.object({
  apiItemId: z.string().min(1, 'API item ID is required').max(255),
  apiItemSlug: z.string().max(255).optional(),
  customPageId: z.string().uuid('Invalid custom page ID'),
})

// PUT /api/collections/:id/overrides/:overrideId
export const updateOverrideSchema = z.object({
  apiItemSlug: z.string().max(255).optional(),
  customPageId: z.string().uuid().optional(),
})
