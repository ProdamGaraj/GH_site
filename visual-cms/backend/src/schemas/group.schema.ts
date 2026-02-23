import { z } from 'zod'

// POST /api/groups
export const createGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  type: z.enum(['pages', 'blocks']),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().min(0).optional().default(0),
})

// PUT /api/groups/:id
export const updateGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['pages', 'blocks']).optional(),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().min(0).optional(),
})
