import { z } from 'zod'

// POST /api/blocks
export const createBlockSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  type: z.string().min(1).max(100),
  groupId: z.string().uuid().nullable().optional(),
  isReusable: z.boolean().optional().default(false),
  structure: z.record(z.unknown()),
  thumbnail: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().max(100)).optional().default([]),
  isTemplate: z.boolean().optional().default(false),
  templateCategory: z.string().max(100).nullable().optional(),
})

// PUT /api/blocks/:id
export const updateBlockSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.string().min(1).max(100).optional(),
  groupId: z.string().uuid().nullable().optional(),
  isReusable: z.boolean().optional(),
  structure: z.record(z.unknown()).optional(),
  thumbnail: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().max(100)).optional(),
  isTemplate: z.boolean().optional(),
  templateCategory: z.string().max(100).nullable().optional(),
  // Ручное управление Template Fields из UI
  detectedFields: z.array(z.record(z.unknown())).optional(),
  templateSettings: z.record(z.unknown()).nullable().optional(),
})

// POST /api/blocks/:id/enable-template
export const enableTemplateSchema = z.object({
  templateCategory: z.string().max(100).optional().default('custom'),
  autoDetectFields: z.boolean().optional().default(true),
})

// POST /api/blocks/create-from-element
export const createFromElementSchema = z.object({
  name: z.string().max(255).optional(),
  structure: z.record(z.unknown()),
  enableTemplate: z.boolean().optional().default(false),
  templateCategory: z.string().max(100).optional().default('custom'),
})
