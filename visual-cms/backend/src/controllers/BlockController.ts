import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'

const blockRepository = AppDataSource.getRepository(Block)

export class BlockController {
  async getAll(req: Request, res: Response) {
    try {
      const blocks = await blockRepository.find({
        relations: ['group'],
        order: { updatedAt: 'DESC' },
      })
      res.json(blocks)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getReusable(req: Request, res: Response) {
    try {
      const blocks = await blockRepository.find({
        where: { isReusable: true },
        relations: ['group'],
        order: { updatedAt: 'DESC' },
      })
      res.json(blocks)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const block = await blockRepository.findOne({
        where: { id },
        relations: ['group'],
      })

      if (!block) {
        return res.status(404).json({ error: 'Block not found' })
      }

      res.json(block)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const block = blockRepository.create(req.body)
      await blockRepository.save(block)
      res.status(201).json(block)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const block = await blockRepository.findOne({ where: { id } })

      if (!block) {
        return res.status(404).json({ error: 'Block not found' })
      }

      Object.assign(block, req.body)
      await blockRepository.save(block)

      res.json(block)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await blockRepository.delete(id)

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Block not found' })
      }

      res.status(204).send()
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}
