import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { blockTemplateService } from '../services/BlockTemplateService'

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

      const oldStructure = block.structure
      const oldFields = block.detectedFields || []

      Object.assign(block, req.body)

      // Если блок является Template и structure изменилась - пересчитать поля
      if (block.isTemplate && JSON.stringify(oldStructure) !== JSON.stringify(block.structure)) {
        const newFields = blockTemplateService.detectFieldsFromStructure(block.structure)
        const diff = blockTemplateService.diffFields(oldFields, newFields)

        // Обновляем detected fields
        block.detectedFields = newFields

        // Синхронизируем bindings асинхронно
        blockTemplateService.syncBindingsOnFieldChange(id, diff).catch(err => {
          console.error('Error syncing bindings:', err)
        })

        // Логируем изменения для отладки
        if (diff.added.length > 0 || diff.removed.length > 0) {
          console.log(`[Template Block ${id}] Field changes:`, {
            added: diff.added.map(f => f.name),
            removed: diff.removed.map(f => f.name)
          })
        }
      }

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

  /**
   * POST /api/blocks/:id/enable-template
   * Включить Template режим для блока
   */
  async enableTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { templateCategory = 'custom', autoDetectFields = true } = req.body

      const block = await blockRepository.findOne({ where: { id } })

      if (!block) {
        return res.status(404).json({ error: 'Block not found' })
      }

      // Включаем Template режим
      block.isTemplate = true
      block.templateCategory = templateCategory

      // Автоопределение полей
      if (autoDetectFields) {
        block.detectedFields = blockTemplateService.detectFieldsFromStructure(block.structure)
      }

      await blockRepository.save(block)

      res.json({
        block,
        message: `Template mode enabled. Detected ${block.detectedFields?.length || 0} fields.`
      })
    } catch (error: any) {
      console.error('Error enabling template mode:', error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * POST /api/blocks/:id/disable-template
   * Выключить Template режим для блока
   */
  async disableTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params

      const block = await blockRepository.findOne({ where: { id } })

      if (!block) {
        return res.status(404).json({ error: 'Block not found' })
      }

      block.isTemplate = false
      block.detectedFields = undefined
      block.templateSettings = undefined

      await blockRepository.save(block)

      res.json({
        block,
        message: 'Template mode disabled.'
      })
    } catch (error: any) {
      console.error('Error disabling template mode:', error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * GET /api/blocks/:id/html
   * Получить HTML представление блока (для Template режима)
   */
  async getHTML(req: Request, res: Response) {
    try {
      const { id } = req.params

      const block = await blockRepository.findOne({ where: { id } })

      if (!block) {
        return res.status(404).json({ error: 'Block not found' })
      }

      if (!block.isTemplate) {
        return res.status(400).json({ 
          error: 'Block is not in template mode',
          message: 'Enable template mode first using POST /api/blocks/:id/enable-template'
        })
      }

      const html = blockTemplateService.generateHTMLFromStructure(block.structure)
      const css = blockTemplateService.generateCSSFromStructure(block.structure)

      res.json({
        html,
        css,
        detectedFields: block.detectedFields
      })
    } catch (error: any) {
      console.error('Error generating HTML:', error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * POST /api/blocks/:id/refresh-fields
   * Принудительно пересчитать detected fields
   */
  async refreshFields(req: Request, res: Response) {
    try {
      const { id } = req.params

      const block = await blockRepository.findOne({ where: { id } })

      if (!block) {
        return res.status(404).json({ error: 'Block not found' })
      }

      if (!block.isTemplate) {
        return res.status(400).json({ 
          error: 'Block is not in template mode'
        })
      }

      const oldFields = block.detectedFields || []
      const newFields = blockTemplateService.detectFieldsFromStructure(block.structure)
      const diff = blockTemplateService.diffFields(oldFields, newFields)

      block.detectedFields = newFields
      await blockRepository.save(block)

      // Синхронизируем bindings
      await blockTemplateService.syncBindingsOnFieldChange(id, diff)

      res.json({
        block,
        diff: {
          added: diff.added.map(f => f.name),
          removed: diff.removed.map(f => f.name),
          unchanged: diff.unchanged.map(f => f.name)
        }
      })
    } catch (error: any) {
      console.error('Error refreshing fields:', error)
      res.status(500).json({ error: error.message })
    }
  }

  /**
   * POST /api/blocks/create-from-element
   * Создать новый блок из структуры элемента
   * Body: { name, structure, enableTemplate?, templateCategory? }
   */
  async createFromElement(req: Request, res: Response) {
    try {
      const { name, structure, enableTemplate = false, templateCategory = 'custom' } = req.body

      if (!structure) {
        return res.status(400).json({ error: 'Structure is required' })
      }

      // Создаем новый блок
      const block = blockRepository.create({
        name: name || 'New Block',
        type: structure.tagName || 'container',
        isReusable: true,
        structure,
        isTemplate: enableTemplate,
        templateCategory: enableTemplate ? templateCategory : undefined,
        detectedFields: enableTemplate 
          ? blockTemplateService.detectFieldsFromStructure(structure)
          : undefined
      })

      await blockRepository.save(block)

      res.status(201).json(block)
    } catch (error: any) {
      console.error('Error creating block from element:', error)
      res.status(500).json({ error: error.message })
    }
  }
}
