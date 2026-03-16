/**
 * API роуты для деплоя
 */

import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware'
import { deployService } from '../services/DeployService'

const router = Router()

/**
 * POST /api/deploy/site/:siteId - Деплой всех страниц сайта
 */
router.post('/site/:siteId', asyncHandler(async (req: Request, res: Response) => {
    const { siteId } = req.params
    const result = await deployService.deploySite(siteId)
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
}))

/**
 * POST /api/deploy/:pageId - Деплой одной страницы
 */
router.post('/:pageId', asyncHandler(async (req: Request, res: Response) => {
    const { pageId } = req.params
    const result = await deployService.deployPage(pageId)
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
}))

/**
 * POST /api/deploy - Деплой всех опубликованных страниц
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const result = await deployService.deployAll()
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
}))

/**
 * GET /api/deploy - Получить список опубликованных файлов
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const files = deployService.getDeployedFiles()
    res.json({
      files,
      publicUrl: `${process.env.PUBLIC_SITE_URL || 'https://localhost'}/`
    })
}))

/**
 * DELETE /api/deploy/:slug - Удалить опубликованную страницу
 */
router.delete('/:slug', asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params
    const siteSlug = req.query.site as string | undefined
    const success = await deployService.undeployPage(slug, siteSlug)
    
    if (success) {
      res.json({ message: `Страница ${slug} удалена из публикации` })
    } else {
      res.status(404).json({ error: 'Файл не найден' })
    }
}))

export default router
