import { Request, Response } from 'express'
import { asyncHandler } from '../middleware'
import { blockVersionService } from '../services/BlockVersionService'

/** История версий блоков: /api/blocks/:blockId/versions и /api/block-versions/deleted. */
export class BlockVersionController {
  /** GET /api/blocks/:blockId/versions — версии без структуры, новые первыми */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    res.json(await blockVersionService.list(req.params.blockId))
  })

  /** GET /api/blocks/:blockId/versions/:versionId — версия целиком */
  getById = asyncHandler(async (req: Request, res: Response) => {
    res.json(await blockVersionService.get(req.params.blockId, req.params.versionId))
  })

  /** POST /api/blocks/:blockId/versions — снимок текущего состояния с меткой */
  create = asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await blockVersionService.snapshot(req.params.blockId, req.body?.label))
  })

  /** POST /api/blocks/:blockId/versions/:versionId/restore — вернуть блоку эту версию */
  restore = asyncHandler(async (req: Request, res: Response) => {
    const block = await blockVersionService.restore(req.params.blockId, req.params.versionId)
    res.json({ success: true, block, restoredFrom: req.params.versionId })
  })

  /** PUT /api/blocks/:blockId/versions/:versionId — метка версии */
  updateLabel = asyncHandler(async (req: Request, res: Response) => {
    res.json(await blockVersionService.updateLabel(req.params.blockId, req.params.versionId, String(req.body?.label ?? '')))
  })

  /** DELETE /api/blocks/:blockId/versions/:versionId */
  delete = asyncHandler(async (req: Request, res: Response) => {
    await blockVersionService.remove(req.params.blockId, req.params.versionId)
    res.status(204).send()
  })

  /** GET /api/block-versions/deleted — удалённые блоки (их последние версии) */
  getDeleted = asyncHandler(async (_req: Request, res: Response) => {
    res.json(await blockVersionService.listDeleted())
  })

  /** POST /api/block-versions/deleted/:versionId/restore — вернуть удалённый блок */
  restoreDeleted = asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await blockVersionService.restoreDeleted(req.params.versionId))
  })
}

export const blockVersionController = new BlockVersionController()
