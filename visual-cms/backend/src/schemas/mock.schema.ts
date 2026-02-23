import { z } from 'zod'

// POST /api/mock/applications
export const submitApplicationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  projectId: z.union([z.string(), z.number()]).nullable().optional(),
  projectName: z.string().max(255).nullable().optional(),
  message: z.string().max(5000).nullable().optional(),
  source: z.string().max(100).optional().default('website'),
}).refine(
  (data) => data.phone || data.email,
  { message: 'At least phone or email is required', path: ['phone'] }
)
