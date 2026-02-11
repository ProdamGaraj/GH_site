import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'
import { linkedBlocksService } from '../services/LinkedBlocksService'

const pageRepository = AppDataSource.getRepository(Page)

export class PageController {
  constructor() {
    // Привязываем методы к контексту this
    this.getAll = this.getAll.bind(this)
    this.getById = this.getById.bind(this)
    this.create = this.create.bind(this)
    this.update = this.update.bind(this)
    this.delete = this.delete.bind(this)
    this.publish = this.publish.bind(this)
    this.getDataSettings = this.getDataSettings.bind(this)
    this.updateDataSettings = this.updateDataSettings.bind(this)
    this.updateDataSources = this.updateDataSources.bind(this)
    this.updateVariables = this.updateVariables.bind(this)
  }

  async getAll(req: Request, res: Response) {
    try {
      const pages = await pageRepository.find({
        relations: ['group'],
        order: { updatedAt: 'DESC' },
      })
      res.json(pages)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      console.log('[PageController] getById called for page:', id)
      
      const page = await pageRepository.findOne({
        where: { id },
        relations: ['group'],
      })

      if (!page) {
        console.log('[PageController] getById - page not found:', id)
        return res.status(404).json({ error: 'Page not found' })
      }

      // Обновляем связанные блоки перед отправкой
      // Всегда берёт актуальную структуру из библиотеки
      if (page.structure) {
        console.log('[PageController] getById - updating linked blocks for page:', id)
        page.structure = await linkedBlocksService.updateLinkedBlocks(page.structure)
        console.log('[PageController] getById - linked blocks updated')
      }

      res.json(page)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const page = pageRepository.create(req.body)
      await pageRepository.save(page)
      res.status(201).json(page)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      console.log('[PageController] update called for page:', id)
      
      const page = await pageRepository.findOne({ where: { id } })

      if (!page) {
        return res.status(404).json({ error: 'Page not found' })
      }

      // Если обновляется структура, синхронизируем linked блоки в библиотеку
      if (req.body.structure) {
        console.log('[PageController] syncing linked blocks to library...')
        await linkedBlocksService.syncLinkedBlocksToLibrary(req.body.structure)
        console.log('[PageController] linked blocks synced')
      }

      Object.assign(page, req.body)
      page.version += 1
      console.log('[PageController] saving page version:', page.version)
      await pageRepository.save(page)
      console.log('[PageController] page saved successfully')

      res.json(page)
    } catch (error: any) {
      console.error('[PageController] update error:', error)
      res.status(500).json({ error: error.message })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await pageRepository.delete(id)

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Page not found' })
      }

      res.status(204).send()
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async publish(req: Request, res: Response) {
    try {
      const { id } = req.params
      const page = await pageRepository.findOne({ where: { id } })

      if (!page) {
        return res.status(404).json({ error: 'Page not found' })
      }

      // Deploy the page to generate static HTML
      const { deployService } = await import('../services/DeployService')
      const deployResult = await deployService.deployPage(id)
      
      if (!deployResult.success) {
        return res.status(500).json({ 
          error: 'Deploy failed', 
          message: deployResult.message,
          errors: deployResult.errors 
        })
      }

      // Reload page to get updated status
      const updatedPage = await pageRepository.findOne({ where: { id } })
      res.json(updatedPage)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * Update page data sources configuration
   * Stage 3.5: Page-Level Data Sources
   */
  async updateDataSources(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { dataSources } = req.body

      const page = await pageRepository.findOne({ where: { id } })

      if (!page) {
        return res.status(404).json({ error: 'Page not found' })
      }

      page.dataSources = dataSources
      await pageRepository.save(page)

      res.json({ success: true, dataSources: page.dataSources })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * Update page variables configuration
   * Stage 3.6: Variables System
   */
  async updateVariables(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { variables } = req.body

      const page = await pageRepository.findOne({ where: { id } })

      if (!page) {
        return res.status(404).json({ error: 'Page not found' })
      }

      page.variables = variables
      await pageRepository.save(page)

      res.json({ success: true, variables: page.variables })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * Get page data settings (data sources + variables)
   */
  async getDataSettings(req: Request, res: Response) {
    try {
      const { id } = req.params

      const page = await pageRepository.findOne({
        where: { id },
        select: ['id', 'dataSources', 'variables']
      })

      if (!page) {
        return res.status(404).json({ error: 'Page not found' })
      }

      res.json({
        dataSources: page.dataSources || {
          dataSources: [],
          variables: {},
          cachePolicy: 'cache-first'
        },
        variables: page.variables || { variables: [] }
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * Update all page data settings at once
   */
  async updateDataSettings(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { dataSources, variables } = req.body

      const page = await pageRepository.findOne({ where: { id } })

      if (!page) {
        return res.status(404).json({ error: 'Page not found' })
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
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}
