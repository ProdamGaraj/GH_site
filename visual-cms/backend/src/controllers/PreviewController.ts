/**
 * Контроллер превью: рендерит страницу/блок тем же каноническим генератором,
 * что и деплой (`DeployService.renderPagePreview/renderBlockPreview`), и отдаёт
 * готовый HTML. Так превью совпадает с продом 1:1 (шрифт, карусель, формы,
 * data-bindings, навигация), вместо отдельного упрощённого рендера на фронте.
 */

import { Request, Response } from 'express'
import { asyncHandler } from '../middleware'
import { deployService } from '../services/DeployService'
import { styleGenerator } from '../services/StyleGenerator'

/** Дефолтный контейнер канваса редактора. */
const DEFAULT_CANVAS_SCOPE = '.canvas-viewport'
/** Разрешаем только простой class/id/tag-селектор — scope префиксует правила. */
const SAFE_SCOPE = /^[.#]?[A-Za-z][\w-]*$/

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

  /**
   * GET /api/preview/base-css?scope=.canvas-viewport
   * Отдаёт канонический base-CSS (reset + форм-стили) деплоя, заскоупленный под
   * контейнер канваса. Канвас редактора инжектит его как есть — так формы/поля
   * в редакторе выглядят 1:1 с опубликованной страницей (единый источник —
   * StyleGenerator.getBaseCss). Статика: кэшируется.
   */
  baseCss = asyncHandler(async (req: Request, res: Response) => {
    const requested = typeof req.query.scope === 'string' ? req.query.scope : ''
    const scope = SAFE_SCOPE.test(requested) ? requested : DEFAULT_CANVAS_SCOPE
    const css = styleGenerator.getBaseCssScoped(scope)
    res.type('text/css')
    res.set('Cache-Control', 'public, max-age=3600')
    res.send(css)
  })
}

export const previewController = new PreviewController()
