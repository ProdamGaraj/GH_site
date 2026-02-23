import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { blockTemplateService } from '../services/BlockTemplateService'
import { linkedBlocksService } from '../services/LinkedBlocksService'
import { asyncHandler, NotFoundError, ValidationError } from '../middleware'
import { cacheService } from '../services/CacheService'

const blockRepository = AppDataSource.getRepository(Block)

export class BlockController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const blocks = await blockRepository.find({
      relations: ['group'],
      order: { updatedAt: 'DESC' },
    })
    res.json(blocks)
  })

  getReusable = asyncHandler(async (req: Request, res: Response) => {
    const blocks = await blockRepository.find({
      where: { isReusable: true },
      relations: ['group'],
      order: { updatedAt: 'DESC' },
    })
    res.json(blocks)
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const block = await blockRepository.findOne({
      where: { id },
      relations: ['group'],
    })

    if (!block) {
      throw new NotFoundError('Block', id)
    }

    res.json(block)
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const block = blockRepository.create(req.body)
    await blockRepository.save(block)
    await cacheService.invalidateByTag('blocks')
    res.status(201).json(block)
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const block = await blockRepository.findOne({ where: { id } })

    if (!block) {
      throw new NotFoundError('Block', id)
    }

    const oldStructure = block.structure
    const oldFields = block.detectedFields || []

    Object.assign(block, req.body)

    // If block is a Template and structure changed - recalculate fields
    if (block.isTemplate && JSON.stringify(oldStructure) !== JSON.stringify(block.structure)) {
      const newFields = blockTemplateService.detectFieldsFromStructure(block.structure)
      const diff = blockTemplateService.diffFields(oldFields, newFields)

      block.detectedFields = newFields

      // Sync bindings asynchronously
      blockTemplateService.syncBindingsOnFieldChange(id, diff).catch(err => {
        console.error('Error syncing bindings:', err)
      })
    }

    await blockRepository.save(block)
    await cacheService.invalidateByTag('blocks')

    // Синхронизируем обновлённый блок на все страницы, где он используется
    if (req.body.structure) {
      try {
        const syncResult = await linkedBlocksService.syncBlockToAllPages(id, block.structure)
        if (syncResult.updatedPages.length > 0) {
          console.log(`[BlockSync] Блок ${block.name} синхронизирован на страницы: ${syncResult.updatedPages.join(', ')}`)
        }
        if (syncResult.errors.length > 0) {
          console.error(`[BlockSync] Ошибки: ${syncResult.errors.join('; ')}`)
        }
        // Возвращаем результат синхронизации вместе с блоком
        res.json({
          ...block,
          _syncResult: {
            updatedPages: syncResult.updatedPages,
            errors: syncResult.errors,
          }
        })
      } catch (syncErr: any) {
        console.error('[BlockSync] Sync failed:', syncErr)
        // Блок уже сохранён — возвращаем его даже если синхронизация упала
        res.json(block)
      }
    } else {
      res.json(block)
    }
  })

  getUsages = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const block = await blockRepository.findOne({ where: { id } })

    if (!block) {
      throw new NotFoundError('Block', id)
    }

    const usages = await linkedBlocksService.findBlockUsages(id)
    res.json(usages)
  })

  getAllWithUsages = asyncHandler(async (req: Request, res: Response) => {
    const blocks = await blockRepository.find({
      relations: ['group'],
      order: { updatedAt: 'DESC' },
    })

    const usagesMap = await linkedBlocksService.findAllBlockUsages()

    const blocksWithUsages = blocks.map(block => ({
      ...block,
      usages: usagesMap.get(block.id) || [],
    }))

    res.json(blocksWithUsages)
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const result = await blockRepository.delete(id)

    if (result.affected === 0) {
      throw new NotFoundError('Block', id)
    }

    await cacheService.invalidateByTag('blocks')
    res.status(204).send()
  })

  enableTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const { templateCategory = 'custom', autoDetectFields = true } = req.body

    const block = await blockRepository.findOne({ where: { id } })

    if (!block) {
      throw new NotFoundError('Block', id)
    }

    block.isTemplate = true
    block.templateCategory = templateCategory

    if (autoDetectFields) {
      block.detectedFields = blockTemplateService.detectFieldsFromStructure(block.structure)
    }

    await blockRepository.save(block)
    await cacheService.invalidateByTag('blocks')

    res.json({
      block,
      message: `Template mode enabled. Detected ${block.detectedFields?.length || 0} fields.`
    })
  })

  disableTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const block = await blockRepository.findOne({ where: { id } })

    if (!block) {
      throw new NotFoundError('Block', id)
    }

    block.isTemplate = false
    block.detectedFields = undefined
    block.templateSettings = undefined

    await blockRepository.save(block)
    await cacheService.invalidateByTag('blocks')

    res.json({
      block,
      message: 'Template mode disabled.'
    })
  })

  getHTML = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const block = await blockRepository.findOne({ where: { id } })

    if (!block) {
      throw new NotFoundError('Block', id)
    }

    if (!block.isTemplate) {
      throw new ValidationError('Block is not in template mode', {
        hint: 'Enable template mode first using POST /api/blocks/:id/enable-template'
      })
    }

    const html = blockTemplateService.generateHTMLFromStructure(block.structure)
    const css = blockTemplateService.generateCSSFromStructure(block.structure)

    res.json({
      html,
      css,
      detectedFields: block.detectedFields
    })
  })

  refreshFields = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const block = await blockRepository.findOne({ where: { id } })

    if (!block) {
      throw new NotFoundError('Block', id)
    }

    if (!block.isTemplate) {
      throw new ValidationError('Block is not in template mode')
    }

    const oldFields = block.detectedFields || []
    const newFields = blockTemplateService.detectFieldsFromStructure(block.structure)
    const diff = blockTemplateService.diffFields(oldFields, newFields)

    block.detectedFields = newFields
    await blockRepository.save(block)

    await blockTemplateService.syncBindingsOnFieldChange(id, diff)

    res.json({
      block,
      diff: {
        added: diff.added.map(f => f.name),
        removed: diff.removed.map(f => f.name),
        unchanged: diff.unchanged.map(f => f.name)
      }
    })
  })

  createFromElement = asyncHandler(async (req: Request, res: Response) => {
    const { name, structure, enableTemplate = false, templateCategory = 'custom' } = req.body

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
  })
}
