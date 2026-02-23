import { z } from 'zod'

const httpMethodEnum = z.enum(['POST', 'PUT', 'PATCH', 'DELETE'])
const triggerEnum = z.enum(['form_submit', 'button_click', 'input_change', 'input_blur', 'interval', 'custom_event', 'api_call'])

// POST /api/data/submit
export const submitDataSchema = z.object({
  dataSourceId: z.string().uuid().optional(),
  outputBindingId: z.string().uuid().optional(),
  endpoint: z.string().url().optional(),
  method: httpMethodEnum.optional().default('POST'),
  data: z.record(z.unknown()),
  fieldMapping: z.record(z.string()).optional(),
  additionalData: z.object({
    timestamp: z.boolean().optional(),
    pageUrl: z.boolean().optional(),
    sessionId: z.boolean().optional(),
    customFields: z.record(z.unknown()).optional(),
  }).optional(),
  validations: z.array(z.record(z.unknown())).optional(),
  pageId: z.string().uuid().nullable().optional(),
  blockId: z.string().uuid().nullable().optional(),
  trigger: triggerEnum.optional().default('api_call'),
  isRetry: z.boolean().optional().default(false),
  attemptNumber: z.number().int().min(1).optional().default(1),
  originalSubmissionId: z.string().uuid().optional(),
})
