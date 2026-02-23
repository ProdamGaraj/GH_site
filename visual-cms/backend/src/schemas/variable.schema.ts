import { z } from 'zod'

const variableScopeEnum = z.enum(['page', 'global', 'session'])
const variableTypeEnum = z.enum(['string', 'number', 'boolean', 'array', 'object', 'date', 'color', 'url', 'email', 'json'])

const variableConfigSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(0).optional(),
  pattern: z.string().optional(),
  enum: z.array(z.unknown()).optional(),
  required: z.boolean().optional(),
  persist: z.boolean().optional(),
  persistKey: z.string().optional(),
}).partial()

// POST /api/variables
export const createVariableSchema = z.object({
  pageId: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'Name is required').max(255),
  scope: variableScopeEnum.optional().default('page'),
  type: variableTypeEnum.optional().default('string'),
  defaultValue: z.unknown().optional(),
  description: z.string().max(1000).nullable().optional(),
  config: variableConfigSchema.nullable().optional(),
  order: z.number().int().min(0).optional().default(0),
})

// PUT /api/variables/:id
export const updateVariableSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: variableTypeEnum.optional(),
  defaultValue: z.unknown().optional(),
  description: z.string().max(1000).nullable().optional(),
  config: variableConfigSchema.nullable().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
})

// POST /api/variables/bulk
export const bulkCreateVariablesSchema = z.object({
  variables: z.array(createVariableSchema).min(1, 'Variables array must not be empty'),
})

// PUT /api/variables/reorder
export const reorderVariablesSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    order: z.number().int().min(0),
  })).min(1, 'Items array is required'),
})

// POST /api/variables/:id/validate
export const validateValueSchema = z.object({
  value: z.unknown(),
})
