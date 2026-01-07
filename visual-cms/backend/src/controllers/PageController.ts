import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'

const pageRepository = AppDataSource.getRepository(Page)

export class PageController {
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
      const page = await pageRepository.findOne({
        where: { id },
        relations: ['group'],
      })

      if (!page) {
        return res.status(404).json({ error: 'Page not found' })
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
      const page = await pageRepository.findOne({ where: { id } })

      if (!page) {
        return res.status(404).json({ error: 'Page not found' })
      }

      Object.assign(page, req.body)
      page.version += 1
      await pageRepository.save(page)

      res.json(page)
    } catch (error: any) {
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

      page.status = 'published'
      await pageRepository.save(page)

      res.json(page)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}
