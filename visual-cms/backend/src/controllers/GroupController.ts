import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Group } from '../models/Group'
import { asyncHandler, NotFoundError } from '../middleware'
import { cacheService } from '../services/CacheService'

const groupRepository = AppDataSource.getRepository(Group)

export class GroupController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const groups = await groupRepository.find({
      relations: ['parent'],
      order: { order: 'ASC' },
    })
    res.json(groups)
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const group = await groupRepository.findOne({
      where: { id },
      relations: ['parent'],
    })

    if (!group) {
      throw new NotFoundError('Group', id)
    }

    res.json(group)
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const group = groupRepository.create(req.body)
    await groupRepository.save(group)
    await cacheService.invalidateByTag('groups')
    res.status(201).json(group)
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const group = await groupRepository.findOne({ where: { id } })

    if (!group) {
      throw new NotFoundError('Group', id)
    }

    Object.assign(group, req.body)
    await groupRepository.save(group)
    await cacheService.invalidateByTag('groups')

    res.json(group)
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const result = await groupRepository.delete(id)

    if (result.affected === 0) {
      throw new NotFoundError('Group', id)
    }

    await cacheService.invalidateByTag('groups')
    res.status(204).send()
  })
}
