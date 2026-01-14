/**
 * API роуты для деплоя
 */

import { Router, Request, Response } from 'express'
import { deployService } from '../services/DeployService'

const router = Router()

/**
 * POST /api/deploy/:pageId - Деплой одной страницы
 */
router.post('/:pageId', async (req: Request, res: Response) => {
  try {
    const { pageId } = req.params
    const result = await deployService.deployPage(pageId)
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера',
      errors: [error.message],
      deployedPages: []
    })
  }
})

/**
 * POST /api/deploy - Деплой всех опубликованных страниц
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const result = await deployService.deployAll()
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера',
      errors: [error.message],
      deployedPages: []
    })
  }
})

/**
 * GET /api/deploy - Получить список опубликованных файлов
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const files = deployService.getDeployedFiles()
    res.json({
      files,
      publicUrl: 'http://localhost:3001/'
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/deploy/:slug - Удалить опубликованную страницу
 */
router.delete('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    const success = await deployService.undeployPage(slug)
    
    if (success) {
      res.json({ message: `Страница ${slug} удалена из публикации` })
    } else {
      res.status(404).json({ error: 'Файл не найден' })
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
