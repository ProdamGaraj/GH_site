/**
 * API роуты для деплоя
 */

import { Router, Request, Response } from 'express'
import { asyncHandler, NotFoundError } from '../middleware'
import { deployService } from '../services/DeployService'
import { AppDataSource } from '../config/database'
import { DeployLog } from '../models/DeployLog'
import { PageVersion } from '../models/PageVersion'
import { Page } from '../models/Page'
import { Collection } from '../models/Collection'

const router = Router()
const deployLogRepository = AppDataSource.getRepository(DeployLog)
const versionRepository = AppDataSource.getRepository(PageVersion)
const pageRepository = AppDataSource.getRepository(Page)
const collectionRepository = AppDataSource.getRepository(Collection)

/**
 * GET /api/deploy/logs - Получить историю деплоев
 */
router.get('/logs', asyncHandler(async (req: Request, res: Response) => {
    const { siteId, pageId, limit } = req.query
    const where: any = {}
    if (siteId) where.siteId = siteId
    if (pageId) where.pageId = pageId

    const logs = await deployLogRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: Number(limit) || 50,
    })
    res.json(logs)
}))

/**
 * POST /api/deploy/site/:siteId - Деплой всех страниц сайта
 */
router.post('/site/:siteId', asyncHandler(async (req: Request, res: Response) => {
    const { siteId } = req.params
    const start = Date.now()
    const result = await deployService.deploySite(siteId)
    const durationMs = Date.now() - start

    await deployLogRepository.save(deployLogRepository.create({
      siteId,
      action: 'deploy-site',
      status: result.success ? 'success' : result.deployedPages.length > 0 ? 'partial' : 'failed',
      message: result.message,
      deployedFiles: result.deployedPages,
      errors: result.errors,
      durationMs,
      publicUrl: result.publicUrl,
    }))
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
}))

/**
 * POST /api/deploy/collection/:collectionId - Деплой коллекции
 */
router.post('/collection/:collectionId', asyncHandler(async (req: Request, res: Response) => {
    const { collectionId } = req.params
    const start = Date.now()

    const collection = await collectionRepository.findOne({ where: { id: collectionId } })

    const result = await deployService.deployCollection(collectionId)
    const durationMs = Date.now() - start

    await deployLogRepository.save(deployLogRepository.create({
      siteId: collection?.siteId || undefined,
      action: 'deploy-site',
      status: result.success ? 'success' : result.deployedPages.length > 0 ? 'partial' : 'failed',
      message: result.message,
      deployedFiles: result.deployedPages,
      errors: result.errors,
      durationMs,
    }))

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
    const start = Date.now()

    const page = await pageRepository.findOne({ where: { id: pageId } })

    const result = await deployService.deployPage(pageId)
    const durationMs = Date.now() - start

    await deployLogRepository.save(deployLogRepository.create({
      siteId: page?.siteId || undefined,
      pageId,
      pageName: page?.name,
      pageSlug: page?.slug,
      action: 'deploy',
      status: result.success ? 'success' : 'failed',
      message: result.message,
      deployedFiles: result.deployedPages,
      errors: result.errors,
      durationMs,
      publicUrl: result.publicUrl,
      pageVersion: page?.version,
    }))
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
}))

/**
 * POST /api/deploy/:pageId/rollback/:versionId - Rollback: restore version and redeploy
 */
router.post('/:pageId/rollback/:versionId', asyncHandler(async (req: Request, res: Response) => {
    const { pageId, versionId } = req.params
    const start = Date.now()

    const page = await pageRepository.findOne({ where: { id: pageId } })
    if (!page) throw new NotFoundError('Page', pageId)

    const version = await versionRepository.findOne({ where: { id: versionId, pageId } })
    if (!version) throw new NotFoundError('PageVersion', versionId)

    // Save current state before rollback
    if (page.structure) {
      await versionRepository.save(versionRepository.create({
        pageId: page.id,
        version: page.version,
        structure: page.structure,
        metadata: page.metadata,
        name: page.name,
        slug: page.slug,
        status: page.status,
        source: 'manual',
        label: `До отката на v${version.version}`,
      }))
    }

    // Restore page to the version
    page.structure = version.structure
    page.metadata = version.metadata || page.metadata
    page.version += 1
    await pageRepository.save(page)

    // Re-deploy
    const result = await deployService.deployPage(pageId)
    const durationMs = Date.now() - start

    await deployLogRepository.save(deployLogRepository.create({
      siteId: page.siteId || undefined,
      pageId,
      pageName: page.name,
      pageSlug: page.slug,
      action: 'rollback',
      status: result.success ? 'success' : 'failed',
      message: `Откат до v${version.version}: ${result.message}`,
      deployedFiles: result.deployedPages,
      errors: result.errors,
      durationMs,
      publicUrl: result.publicUrl,
      pageVersion: page.version,
      versionId,
    }))

    res.json({
      ...result,
      rolledBackTo: version.version,
      newVersion: page.version,
    })
}))

/**
 * POST /api/deploy - Деплой всех опубликованных страниц
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const start = Date.now()
    const result = await deployService.deployAll()
    const durationMs = Date.now() - start

    await deployLogRepository.save(deployLogRepository.create({
      action: 'deploy-all',
      status: result.success ? 'success' : result.deployedPages.length > 0 ? 'partial' : 'failed',
      message: result.message,
      deployedFiles: result.deployedPages,
      errors: result.errors,
      durationMs,
      publicUrl: result.publicUrl,
    }))

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
      await deployLogRepository.save(deployLogRepository.create({
        pageSlug: slug,
        action: 'undeploy',
        status: 'success',
        message: `Страница ${slug} удалена`,
      }))
      res.json({ message: `Страница ${slug} удалена из публикации` })
    } else {
      res.status(404).json({ error: 'Файл не найден' })
    }
}))

export default router
