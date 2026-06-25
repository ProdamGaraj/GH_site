import { z } from 'zod'

/**
 * Схемы превью. `structure` — глубокое дерево BlockNode, поэтому валидируем его
 * как `z.any()` (с проверкой «это объект»): иначе `validate` вырезал бы
 * неизвестные вложенные поля и разрушил структуру. Верхнеуровневые лишние поля
 * при этом отсекаются как обычно.
 */

const structureSchema = z
  .any()
  .refine((v) => v != null && typeof v === 'object', 'structure must be an object')

// POST /api/preview/page
export const renderPagePreviewSchema = z.object({
  pageId: z.string().uuid().optional(),
  structure: structureSchema,
  lang: z.string().max(10).optional(),
})

// POST /api/preview/block
export const renderBlockPreviewSchema = z.object({
  structure: structureSchema,
  lang: z.string().max(10).optional(),
})
