/**
 * Variables Controller
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 6: Reactive Variables
 * 
 * API для управления переменными страниц.
 */

import { Request, Response } from 'express'
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
   * Получить переменные с фильтрацией
   */
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { pageId, scope, type, isActive, search } = req.query

      const queryBuilder = variableRepository
        .createQueryBuilder('variable')
        .orderBy('variable.order', 'ASC')
        .addOrderBy('variable.name', 'ASC')

      // Filter by page
      if (pageId) {
        queryBuilder.andWhere('variable.pageId = :pageId', { pageId })
      }

      // Filter by scope
      if (scope) {
        queryBuilder.andWhere('variable.scope = :scope', { scope })
      }

      // Filter by type
      if (type) {
        queryBuilder.andWhere('variable.type = :type', { type })
      }

      // Filter by active status
      if (isActive !== undefined) {
        queryBuilder.andWhere('variable.isActive = :isActive', { 
          isActive: isActive === 'true' 
        })
      }

      // Search by name
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
    } catch (error) {
      console.error('Error getting variables:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get variables',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * GET /api/variables/:id
   * Получить одну переменную
   */
  static async getOne(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      const variable = await variableRepository.findOne({
        where: { id },
        relations: ['page'],
      })

      if (!variable) {
        res.status(404).json({
          success: false,
          error: 'Variable not found',
        })
        return
      }

      res.json({
        success: true,
        data: variable,
      })
    } catch (error) {
      console.error('Error getting variable:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get variable',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * GET /api/variables/page/:pageId
   * Получить все переменные страницы (включая global)
   */
  static async getByPage(req: Request, res: Response): Promise<void> {
    try {
      const { pageId } = req.params
      const { includeGlobal = 'true' } = req.query

      // Verify page exists
      const page = await pageRepository.findOne({ where: { id: pageId } })
      if (!page) {
        res.status(404).json({
          success: false,
          error: 'Page not found',
        })
        return
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

      // Group by scope
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
    } catch (error) {
      console.error('Error getting page variables:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get page variables',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * POST /api/variables
   * Создать переменную
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const dto: CreateVariableDTO = req.body

      // Validate required fields
      if (!dto.name) {
        res.status(400).json({
          success: false,
          error: 'Name is required',
        })
        return
      }

      // Validate page exists if pageId provided
      if (dto.pageId) {
        const page = await pageRepository.findOne({ where: { id: dto.pageId } })
        if (!page) {
          res.status(404).json({
            success: false,
            error: 'Page not found',
          })
          return
        }
      }

      // Check for duplicate name
      const existing = await variableRepository.findOne({
        where: {
          pageId: dto.pageId || undefined,
          name: dto.name,
        },
      })

      if (existing) {
        res.status(409).json({
          success: false,
          error: `Variable "${dto.name}" already exists`,
        })
        return
      }

      // Create variable
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
    } catch (error) {
      console.error('Error creating variable:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to create variable',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * PUT /api/variables/:id
   * Обновить переменную
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const dto: UpdateVariableDTO = req.body

      const variable = await variableRepository.findOne({ where: { id } })

      if (!variable) {
        res.status(404).json({
          success: false,
          error: 'Variable not found',
        })
        return
      }

      // Check for duplicate name if renaming
      if (dto.name && dto.name !== variable.name) {
        const existing = await variableRepository.findOne({
          where: {
            pageId: variable.pageId || undefined,
            name: dto.name,
          },
        })

        if (existing) {
          res.status(409).json({
            success: false,
            error: `Variable "${dto.name}" already exists`,
          })
          return
        }
      }

      // Update fields
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
    } catch (error) {
      console.error('Error updating variable:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to update variable',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * DELETE /api/variables/:id
   * Удалить переменную
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      const variable = await variableRepository.findOne({ where: { id } })

      if (!variable) {
        res.status(404).json({
          success: false,
          error: 'Variable not found',
        })
        return
      }

      await variableRepository.remove(variable)

      res.json({
        success: true,
        message: 'Variable deleted',
      })
    } catch (error) {
      console.error('Error deleting variable:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to delete variable',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * POST /api/variables/bulk
   * Создать несколько переменных
   */
  static async bulkCreate(req: Request, res: Response): Promise<void> {
    try {
      const { variables }: { variables: CreateVariableDTO[] } = req.body

      if (!Array.isArray(variables) || variables.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Variables array is required',
        })
        return
      }

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
    } catch (error) {
      console.error('Error bulk creating variables:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to bulk create variables',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * PUT /api/variables/reorder
   * Изменить порядок переменных
   */
  static async reorder(req: Request, res: Response): Promise<void> {
    try {
      const { items }: { items: { id: string; order: number }[] } = req.body

      if (!Array.isArray(items)) {
        res.status(400).json({
          success: false,
          error: 'Items array is required',
        })
        return
      }

      for (const item of items) {
        await variableRepository.update(item.id, { order: item.order })
      }

      res.json({
        success: true,
        message: 'Variables reordered',
      })
    } catch (error) {
      console.error('Error reordering variables:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to reorder variables',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * POST /api/variables/:id/validate
   * Валидировать значение переменной
   */
  static async validateValue(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { value } = req.body

      const variable = await variableRepository.findOne({ where: { id } })

      if (!variable) {
        res.status(404).json({
          success: false,
          error: 'Variable not found',
        })
        return
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
    } catch (error) {
      console.error('Error validating variable value:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to validate value',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export default VariablesController
