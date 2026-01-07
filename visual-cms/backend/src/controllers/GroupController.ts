import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Group } from '../models/Group'

const groupRepository = AppDataSource.getRepository(Group)

export class GroupController {
  async getAll(req: Request, res: Response) {
    try {
      const groups = await groupRepository.find({
        relations: ['parent'],
        order: { order: 'ASC' },
      })
      res.json(groups)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const group = await groupRepository.findOne({
        where: { id },
        relations: ['parent'],
      })

      if (!group) {
        return res.status(404).json({ error: 'Group not found' })
      }

      res.json(group)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async create(req: Request, res: Response) {
    try {
      const group = groupRepository.create(req.body)
      await groupRepository.save(group)
      res.status(201).json(group)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const group = await groupRepository.findOne({ where: { id } })

      if (!group) {
        return res.status(404).json({ error: 'Group not found' })
      }

      Object.assign(group, req.body)
      await groupRepository.save(group)

      res.json(group)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const result = await groupRepository.delete(id)

      if (result.affected === 0) {
        return res.status(404).json({ error: 'Group not found' })
      }

      res.status(204).send()
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}
