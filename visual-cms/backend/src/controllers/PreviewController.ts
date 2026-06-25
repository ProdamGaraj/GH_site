/**
 * Контроллер превью: рендерит страницу/блок тем же каноническим генератором,
 * что и деплой (`DeployService.renderPagePreview/renderBlockPreview`), и отдаёт
 * готовый HTML. Так превью совпадает с продом 1:1 (шрифт, карусель, формы,
 * data-bindings, навигация), вместо отдельного упрощённого рендера на фронте.
 */

import { Request, Response } from 'express'
import { asyncHandler } from '../middleware'
import { deployService } from '../services/DeployService'

export class PreviewController {
  /**
   * POST /api/preview/page
   * Body: { pageId?: string; structure: BlockNode; lang?: string }
   */
  renderPage = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, structure, lang } = req.body
    const html = await deployService.renderPagePreview({ pageId, structure, lang })
    res.json({ success: true, html })
  })

  /**
   * POST /api/preview/block
   * Body: { structure: BlockNode; lang?: string }
   */
  renderBlock = asyncHandler(async (req: Request, res: Response) => {
    const { structure, lang } = req.body
    const html = await deployService.renderBlockPreview({ structure, lang })
    res.json({ success: true, html })
  })
}

export const previewController = new PreviewController()
