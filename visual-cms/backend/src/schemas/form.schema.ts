import { z } from 'zod'

const formFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.string().min(1),
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  validation: z.record(z.unknown()).optional(),
}).passthrough()

const formSettingsSchema = z.object({
  successMessage: z.string().optional(),
  honeypotField: z.string().optional(),
  rateLimitPerMinute: z.number().int().min(1).optional(),
  storeSubmissions: z.boolean().optional(),
}).passthrough()

const formStatusEnum = z.enum(['draft', 'active', 'archived'])

// POST /api/forms
export const createFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).nullable().optional(),
  pageId: z.string().uuid().nullable().optional(),
  status: formStatusEnum.optional().default('draft'),
  fields: z.array(formFieldSchema).optional().default([]),
  settings: formSettingsSchema.optional().default({}),
})

// PUT /api/forms/:id
export const updateFormSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  pageId: z.string().uuid().nullable().optional(),
  status: formStatusEnum.optional(),
  fields: z.array(formFieldSchema).optional(),
  settings: formSettingsSchema.optional(),
})

const destinationTypeEnum = z.enum(['email', 'telegram', 'webhook', 'bitrix24', 'amocrm', 'google_sheets', 'custom'])

// POST /api/forms/:formId/destinations
export const createDestinationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  type: destinationTypeEnum,
  config: z.record(z.unknown()),
  fieldMapping: z.array(z.record(z.unknown())).optional().default([]),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().min(0).optional().default(0),
})

// PUT /api/forms/:formId/destinations/:destId
export const updateDestinationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: destinationTypeEnum.optional(),
  config: z.record(z.unknown()).optional(),
  fieldMapping: z.array(z.record(z.unknown())).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
})

// POST /api/forms/:formId/submit (public)
export const submitFormSchema = z.object({
  formId: z.string().uuid().optional(),
  data: z.record(z.unknown()).optional(),
}).passthrough()
