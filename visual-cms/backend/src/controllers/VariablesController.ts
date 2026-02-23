/**
 * Variables Controller
 * 
 * API for managing page variables.
 */

import { Request, Response } from 'express'
import { asyncHandler, NotFoundError, ConflictError } from '../middleware'
import { AppDataSource } from '../config/database'
import { PageVariable, VariableScope, VariableType, VariableConfig } from '../models/PageVariable'
import { Page } from '../models/Page'

const variableRepository = AppDataSource.getRepository(PageVariable)
const pageRepository = AppDataSource.getRepository(Page)

// ==================== TYPES ====================

interface CreateVariableDTO {
  pageId?: string | null
  name: string
  scope?: VariableScope
  type?: VariableType
  defaultValue?: unknown
  description?: string
  config?: Partial<VariableConfig>
  order?: number
}

interface UpdateVariableDTO {
  name?: string
  type?: VariableType
  defaultValue?: unknown
  description?: string
  config?: Partial<VariableConfig>
  isActive?: boolean
  order?: number
}

// ==================== CONTROLLER ====================

export class VariablesController {
  /**
   * GET /api/variables
   */
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, scope, type, isActive, search } = req.query

    const queryBuilder = variableRepository
      .createQueryBuilder('variable')
      .orderBy('variable.order', 'ASC')
      .addOrderBy('variable.name', 'ASC')

    if (pageId) {
      queryBuilder.andWhere('variable.pageId = :pageId', { pageId })
    }
    if (scope) {
      queryBuilder.andWhere('variable.scope = :scope', { scope })
    }
    if (type) {
      queryBuilder.andWhere('variable.type = :type', { type })
    }
    if (isActive !== undefined) {
      queryBuilder.andWhere('variable.isActive = :isActive', { 
        isActive: isActive === 'true' 
      })
    }
    if (search) {
      queryBuilder.andWhere('variable.name ILIKE :search', { 
        search: `%${search}%` 
      })
    }

    const variables = await queryBuilder.getMany()

    res.json({
      success: true,
      data: variables,
      count: variables.length,
    })
  })

  /**
   * GET /api/variables/:id
   */
  static getOne = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const variable = await variableRepository.findOne({
      where: { id },
      relations: ['page'],
    })

    if (!variable) {
      throw new NotFoundError('Variable', id)
    }

    res.json({
      success: true,
      data: variable,
    })
  })

  /**
   * GET /api/variables/page/:pageId
   */
  static getByPage = asyncHandler(async (req: Request, res: Response) => {
    const { pageId } = req.params
    const { includeGlobal = 'true' } = req.query

    const page = await pageRepository.findOne({ where: { id: pageId } })
    if (!page) {
      throw new NotFoundError('Page', pageId)
    }

    const queryBuilder = variableRepository
      .createQueryBuilder('variable')
      .orderBy('variable.scope', 'ASC')
      .addOrderBy('variable.order', 'ASC')
      .addOrderBy('variable.name', 'ASC')

    if (includeGlobal === 'true') {
      queryBuilder.where(
        '(variable.pageId = :pageId OR variable.scope = :globalScope)',
        { pageId, globalScope: 'global' }
      )
    } else {
      queryBuilder.where('variable.pageId = :pageId', { pageId })
    }

    const variables = await queryBuilder.getMany()

    const grouped = {
      global: variables.filter(v => v.scope === 'global'),
      session: variables.filter(v => v.scope === 'session'),
      page: variables.filter(v => v.scope === 'page'),
    }

    res.json({
      success: true,
      data: variables,
      grouped,
      count: variables.length,
    })
  })

  /**
   * POST /api/variables
   */
  static create = asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateVariableDTO = req.body

    if (dto.pageId) {
      const page = await pageRepository.findOne({ where: { id: dto.pageId } })
      if (!page) {
        throw new NotFoundError('Page', dto.pageId)
      }
    }

    const existing = await variableRepository.findOne({
      where: {
        pageId: dto.pageId || undefined,
        name: dto.name,
      },
    })

    if (existing) {
      throw new ConflictError(`Variable "${dto.name}" already exists`)
    }

    const variable = variableRepository.create({
      pageId: dto.pageId || null,
      name: dto.name,
      scope: dto.scope || 'page',
      type: dto.type || 'string',
      defaultValue: dto.defaultValue,
      description: dto.description || null,
      config: dto.config || null,
      order: dto.order ?? 0,
      isActive: true,
    })

    await variableRepository.save(variable)

    res.status(201).json({
      success: true,
      data: variable,
    })
  })

  /**
   * PUT /api/variables/:id
   */
  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const dto: UpdateVariableDTO = req.body

    const variable = await variableRepository.findOne({ where: { id } })

    if (!variable) {
      throw new NotFoundError('Variable', id)
    }

    if (dto.name && dto.name !== variable.name) {
      const existing = await variableRepository.findOne({
        where: {
          pageId: variable.pageId || undefined,
          name: dto.name,
        },
      })

      if (existing) {
        throw new ConflictError(`Variable "${dto.name}" already exists`)
      }
    }

    if (dto.name !== undefined) variable.name = dto.name
    if (dto.type !== undefined) variable.type = dto.type
    if (dto.defaultValue !== undefined) variable.defaultValue = dto.defaultValue
    if (dto.description !== undefined) variable.description = dto.description
    if (dto.config !== undefined) {
      variable.config = { ...variable.config, ...dto.config }
    }
    if (dto.isActive !== undefined) variable.isActive = dto.isActive
    if (dto.order !== undefined) variable.order = dto.order

    await variableRepository.save(variable)

    res.json({
      success: true,
      data: variable,
    })
  })

  /**
   * DELETE /api/variables/:id
   */
  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const variable = await variableRepository.findOne({ where: { id } })

    if (!variable) {
      throw new NotFoundError('Variable', id)
    }

    await variableRepository.remove(variable)

    res.json({
      success: true,
      message: 'Variable deleted',
    })
  })

  /**
   * POST /api/variables/bulk
   */
  static bulkCreate = asyncHandler(async (req: Request, res: Response) => {
    const { variables }: { variables: CreateVariableDTO[] } = req.body

    const created: PageVariable[] = []
    const errors: { index: number; error: string }[] = []

    for (let i = 0; i < variables.length; i++) {
      const dto = variables[i]
      try {
        const variable = variableRepository.create({
          pageId: dto.pageId || null,
          name: dto.name,
          scope: dto.scope || 'page',
          type: dto.type || 'string',
          defaultValue: dto.defaultValue,
          description: dto.description || null,
          config: dto.config || null,
          order: dto.order ?? i,
          isActive: true,
        })
        await variableRepository.save(variable)
        created.push(variable)
      } catch (err) {
        errors.push({
          index: i,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    res.status(errors.length > 0 ? 207 : 201).json({
      success: errors.length === 0,
      data: created,
      errors: errors.length > 0 ? errors : undefined,
      count: created.length,
    })
  })

  /**
   * PUT /api/variables/reorder
   */
  static reorder = asyncHandler(async (req: Request, res: Response) => {
    const { items }: { items: { id: string; order: number }[] } = req.body

    for (const item of items) {
      await variableRepository.update(item.id, { order: item.order })
    }

    res.json({
      success: true,
      message: 'Variables reordered',
    })
  })

  /**
   * POST /api/variables/:id/validate
   */
  static validateValue = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const { value } = req.body

    const variable = await variableRepository.findOne({ where: { id } })

    if (!variable) {
      throw new NotFoundError('Variable', id)
    }

    const result = variable.validateValue(value)
    const coerced = variable.coerceValue(value)

    res.json({
      success: true,
      data: {
        valid: result.valid,
        error: result.error,
        coercedValue: coerced,
        originalValue: value,
      },
    })
  })
}

export default VariablesController
