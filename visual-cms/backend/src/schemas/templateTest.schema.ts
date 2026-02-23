import { z } from 'zod'

const fieldMappingSchema = z.object({
  id: z.string(),
  targetProperty: z.string(),
  sourceField: z.string(),
})

// POST /api/template-test/render
export const renderTemplateSchema = z.object({
  templateBlockId: z.string().uuid('templateBlockId must be a valid UUID'),
  testData: z.array(z.record(z.unknown())).min(1, 'testData must be a non-empty array'),
  fieldMappings: z.array(fieldMappingSchema).optional(),
})
