import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'
import { linkedBlocksService } from '../services/LinkedBlocksService'
import { asyncHandler, NotFoundError, AppError } from '../middleware'
import { cacheService } from '../services/CacheService'

const pageRepository = AppDataSource.getRepository(Page)

export class PageController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const pages = await pageRepository.find({
      relations: ['group'],
      order: { updatedAt: 'DESC' },
    })
    res.json(pages)
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const page = await pageRepository.findOne({
      where: { id },
      relations: ['group'],
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

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const page = await pageRepository.findOne({ where: { id } })

    if (!page) {
      throw new NotFoundError('Page', id)
    }

    if (req.body.structure) {
      await linkedBlocksService.syncLinkedBlocksToLibrary(req.body.structure)
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
