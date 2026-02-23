import { z } from 'zod'

const bindingTypeEnum = z.enum(['input', 'output', 'two-way'])

// POST /api/data-bindings
export const createDataBindingSchema = z.object({
  blockId: z.string().uuid('blockId must be a valid UUID'),
  pageId: z.string().uuid().nullable().optional(),
  dataSourceId: z.string().uuid('dataSourceId must be a valid UUID'),
  bindingType: bindingTypeEnum,
  config: z.record(z.unknown()),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().min(0).optional().default(0),
})

// PUT /api/data-bindings/:id
export const updateDataBindingSchema = z.object({
  blockId: z.string().uuid().optional(),
  pageId: z.string().uuid().nullable().optional(),
  dataSourceId: z.string().uuid().optional(),
  bindingType: bindingTypeEnum.optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
})

// POST /api/data/fetch
export const fetchDataSchema = z.object({
  dataSourceId: z.string().uuid('dataSourceId is required'),
  config: z.record(z.unknown()).optional(),
  filters: z.array(z.record(z.unknown())).optional(),
  sorting: z.array(z.record(z.unknown())).optional(),
  pagination: z.object({
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(1000).optional(),
  }).optional(),
  variables: z.record(z.unknown()).optional(),
  urlParams: z.record(z.string()).optional(),
  arrayPath: z.string().optional(),
})
