import { z } from 'zod'

const templateCategoryEnum = z.enum(['card', 'list-item', 'hero', 'feature', 'testimonial', 'pricing', 'gallery-item', 'custom'])
const templateStatusEnum = z.enum(['draft', 'active', 'archived'])

// POST /api/templates
export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).nullable().optional(),
  category: templateCategoryEnum.optional().default('custom'),
  htmlContent: z.string().min(1, 'HTML content is required'),
  cssContent: z.string().optional().default(''),
  settings: z.record(z.unknown()).optional(),
  previewData: z.array(z.record(z.unknown())).optional(),
  tags: z.array(z.string().max(100)).optional().default([]),
  sourceBlockId: z.string().uuid().nullable().optional(),
  autoDetectFields: z.boolean().optional().default(true),
})

// PUT /api/templates/:id
export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: templateCategoryEnum.optional(),
  htmlContent: z.string().min(1).optional(),
  cssContent: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
  previewData: z.array(z.record(z.unknown())).optional(),
  tags: z.array(z.string().max(100)).optional(),
  status: templateStatusEnum.optional(),
  autoDetectFields: z.boolean().optional(),
})

// POST /api/templates/detect-fields
export const detectFieldsSchema = z.object({
  html: z.string().min(1, 'HTML content is required'),
})
