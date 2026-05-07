import { z } from 'zod'

const dataSourceTypeEnum = z.enum(['rest-api', 'rest', 'graphql', 'static', 'websocket', 'mock', 'feed', 'database', 'external', 'computed', 'form-data', 'page-variable'])
const dataSourceStatusEnum = z.enum(['draft', 'active', 'error', 'disabled'])

// Для type='page-variable' config обязан содержать непустую строку variableName
function validatePageVariableConfig(data: { type?: string; config?: Record<string, unknown> }, ctx: z.RefinementCtx): void {
  if (data.type === 'page-variable') {
    const vn = data.config?.variableName
    if (typeof vn !== 'string' || vn.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['config', 'variableName'],
        message: 'variableName is required for page-variable data source',
      })
    }
  }
}

// POST /api/data-sources
export const createDataSourceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).nullable().optional(),
  type: dataSourceTypeEnum,
  config: z.record(z.unknown()),
  authConfig: z.record(z.unknown()).optional(),
  groupId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().max(100)).optional(),
  status: dataSourceStatusEnum.optional().default('draft'),
}).superRefine(validatePageVariableConfig)

// PUT /api/data-sources/:id
export const updateDataSourceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  type: dataSourceTypeEnum.optional(),
  config: z.record(z.unknown()).optional(),
  authConfig: z.record(z.unknown()).optional(),
  groupId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().max(100)).optional(),
  status: dataSourceStatusEnum.optional(),
}).superRefine(validatePageVariableConfig)

// POST /api/data-sources/new/test
export const testNewConnectionSchema = z.object({
  type: dataSourceTypeEnum,
  config: z.record(z.unknown()),
  authConfig: z.record(z.unknown()).optional(),
})
