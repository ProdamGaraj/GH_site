import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'
import { PageVersion } from '../models/PageVersion'
import { Block } from '../models/Block'
import { linkedBlocksService } from '../services/LinkedBlocksService'
import { asyncHandler, NotFoundError, AppError } from '../middleware'
import { cacheService } from '../services/CacheService'

const pageRepository = AppDataSource.getRepository(Page)
const versionRepository = AppDataSource.getRepository(PageVersion)
const blockRepository = AppDataSource.getRepository(Block)

export class PageController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { siteId } = req.query
    const where: any = {}
    if (siteId) where.siteId = siteId

    const pages = await pageRepository.find({
      where,
      relations: ['group', 'site'],
      order: { updatedAt: 'DESC' },
    })
    res.json(pages)
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const page = await pageRepository.findOne({
      where: { id },
      relations: ['group', 'site'],
    })

    if (!page) {
      throw new NotFoundError('Page', id)
    }

    if (page.structure) {
      page.structure = await linkedBlocksService.updateLinkedBlocks(page.structure)
    }

    res.json(page)
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const page = pageRepository.create(req.body)
    await pageRepository.save(page)
    await cacheService.invalidateByTag('pages')
    res.status(201).json(page)
  })

  /**
   * Preflight перед сохранением страницы: какие linked-блоки на странице разошлись
   * с библиотекой. Фронт по этому списку показывает модалку выбора действия.
   * Сравнение идёт против структуры из тела запроса (несохранённое состояние редактора),
   * а не против сохранённой page.structure.
   */
  savePreflight = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const page = await pageRepository.findOne({ where: { id }, select: ['id'] })
    if (!page) {
      throw new NotFoundError('Page', id)
    }
    const changedInstances = await linkedBlocksService.detectChangedLinkedInstances(req.body.structure)
    res.json({ changedInstances })
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const page = await pageRepository.findOne({ where: { id } })

    if (!page) {
      throw new NotFoundError('Page', id)
    }

    // Решения по изменённым linked-блокам не являются полем страницы — извлекаем до Object.assign.
    const decisions = (req.body.decisions || {}) as Record<string, 'push' | 'static' | 'revert'>
    delete req.body.decisions

    // Применяем решения к структуре: схлопываем linked-блоки в placeholder (инвариант B2),
    // 'static' отделяет блок, 'push' дополнительно пишет содержимое в библиотеку.
    if (req.body.structure) {
      const { structure, libraryWrites } = linkedBlocksService.applyLinkedDecisions(req.body.structure, decisions)
      req.body.structure = structure

      for (const write of libraryWrites) {
        const block = await blockRepository.findOne({ where: { id: write.blockId } })
        if (!block) continue
        block.structure = write.structure
        await blockRepository.save(block)
        // Распространяем на остальные страницы (схлопывание legacy-копий) и чистим кеши.
        await linkedBlocksService.syncBlockToAllPages(write.blockId, write.structure)
      }
      if (libraryWrites.length > 0) {
        await cacheService.invalidateByTag('blocks')
      }
    }

    // Auto-save version snapshot before overwriting
    if (page.structure) {
      const snapshot = versionRepository.create({
        pageId: page.id,
        version: page.version,
        structure: page.structure,
        metadata: page.metadata,
        name: page.name,
        slug: page.slug,
        status: page.status,
        source: 'auto',
        label: `v${page.version}`,
      })
      await versionRepository.save(snapshot)
    }

    Object.assign(page, req.body)
    page.version += 1
    await pageRepository.save(page)
    await cacheService.invalidateByTag('pages')

    res.json(page)
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const result = await pageRepository.delete(id)

    if (result.affected === 0) {
      throw new NotFoundError('Page', id)
    }

    await cacheService.invalidateByTag('pages')
    res.status(204).send()
  })

  publish = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const page = await pageRepository.findOne({ where: { id } })

    if (!page) {
      throw new NotFoundError('Page', id)
    }

    // Save deploy snapshot
    if (page.structure) {
      const snapshot = versionRepository.create({
        pageId: page.id,
        version: page.version,
        structure: page.structure,
        metadata: page.metadata,
        name: page.name,
        slug: page.slug,
        status: page.status,
        source: 'deploy',
        label: `Деплой v${page.version}`,
      })
      await versionRepository.save(snapshot)
    }

    const { deployService } = await import('../services/DeployService')
    const deployResult = await deployService.deployPage(id)

    if (!deployResult.success) {
      throw new AppError(
        deployResult.message || 'Deploy failed',
        500,
        'DEPLOY_FAILED',
        { errors: deployResult.errors }
      )
    }

    const updatedPage = await pageRepository.findOne({ where: { id } })
    res.json(updatedPage)
  })

  updateDataSources = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const { dataSources } = req.body

    const page = await pageRepository.findOne({ where: { id } })

    if (!page) {
      throw new NotFoundError('Page', id)
    }

    page.dataSources = dataSources
    await pageRepository.save(page)

    res.json({ success: true, dataSources: page.dataSources })
  })

  updateVariables = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const { variables } = req.body

    const page = await pageRepository.findOne({ where: { id } })

    if (!page) {
      throw new NotFoundError('Page', id)
    }

    page.variables = variables
    await pageRepository.save(page)

    res.json({ success: true, variables: page.variables })
  })

  getDataSettings = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const page = await pageRepository.findOne({
      where: { id },
      select: ['id', 'dataSources', 'variables']
    })

    if (!page) {
      throw new NotFoundError('Page', id)
    }

    res.json({
      dataSources: page.dataSources || {
        dataSources: [],
        variables: {},
        cachePolicy: 'cache-first'
      },
      variables: page.variables || { variables: [] }
    })
  })

  updateDataSettings = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const { dataSources, variables } = req.body

    const page = await pageRepository.findOne({ where: { id } })

    if (!page) {
      throw new NotFoundError('Page', id)
    }

    if (dataSources !== undefined) {
      page.dataSources = dataSources
    }
    if (variables !== undefined) {
      page.variables = variables
    }

    await pageRepository.save(page)

    res.json({
      success: true,
      dataSources: page.dataSources,
      variables: page.variables
    })
  })
}
