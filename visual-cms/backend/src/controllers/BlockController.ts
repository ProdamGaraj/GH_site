import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { blockTemplateService } from '../services/BlockTemplateService'
import { linkedBlocksService } from '../services/LinkedBlocksService'
import { asyncHandler, NotFoundError, ValidationError } from '../middleware'
import { cacheService } from '../services/CacheService'
import { logger } from '../services/Logger'
import { blockDataAnchorsService } from '../services/BlockDataAnchorsService'

const blockRepository = AppDataSource.getRepository(Block)

/**
 * Библиотечный блок по определению не может быть linked-инстансом: linkedBlockId и
 * styleOverrides на корне структуры — артефакты записи инстанса со страницы (исторически
 * фронт пушил их как есть, и блок в библиотеке получал ссылку сам на себя). Срезаем на
 * любом пути записи в библиотеку; вложенные linkedBlockId не трогаем — это легальные
 * ссылки на другие блоки.
 */
function stripInstanceArtifacts(structure: any): void {
  if (structure?.metadata) {
    delete structure.metadata.linkedBlockId
    delete structure.metadata.styleOverrides
  }
}

export class BlockController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    // no-store: список библиотеки должен быть всегда свежим (нельзя кэшировать ни
    // в браузере, ни в прокси) — иначе новый блок «не появляется» после создания.
    res.setHeader('Cache-Control', 'no-store')
    const blocks = await blockRepository.find({
      relations: ['group'],
      order: { updatedAt: 'DESC' },
    })
    res.json(blocks)
  })

  getReusable = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store')
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
    stripInstanceArtifacts(req.body.structure)
    const block = blockRepository.create(req.body)
    await blockRepository.save(block)
    await cacheService.invalidateByTag('blocks')
    res.status(201).json(block)
  })

  /**
   * GET /api/blocks/:id/data-anchors — якоря блока, кандидаты в якоря
   * («данные» / «похоже на интерфейс»), где блок используется и что с ним
   * можно сделать для новости (use | copy | rewrite).
   */
  getDataAnchors = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json(await blockDataAnchorsService.info(req.params.id, req.query.usage !== '0'))
  })

  /**
   * POST /api/blocks/:id/data-anchors { mode, picks, name? } — переписать блок
   * якорями (только если он нигде не показывается со своим текстом) или
   * создать копию-блок данных с новыми id. Возвращает id блока данных.
   */
  makeDataBlock = asyncHandler(async (req: Request, res: Response) => {
    const { mode, picks, name } = req.body
    const result = await blockDataAnchorsService.makeDataBlock(req.params.id, mode, picks, name)
    res.status(mode === 'copy' ? 201 : 200).json(result)
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const block = await blockRepository.findOne({ where: { id } })

    if (!block) {
      throw new NotFoundError('Block', id)
    }

    const oldStructure = block.structure
    const oldFields = block.detectedFields || []
    // Запоминаем, были ли detectedFields явно переданы в запросе
    const explicitFields = Object.prototype.hasOwnProperty.call(req.body, 'detectedFields')

    stripInstanceArtifacts(req.body.structure)
    Object.assign(block, req.body)

    // Если block является Template и структура изменилась — пересчитываем поля,
    // НО только если поля не были явно переданы в теле запроса (ручное управление).
    if (block.isTemplate && !explicitFields && JSON.stringify(oldStructure) !== JSON.stringify(block.structure)) {
      const newFields = blockTemplateService.detectFieldsFromStructure(block.structure)
      const diff = blockTemplateService.diffFields(oldFields, newFields)

      block.detectedFields = newFields

      // Sync bindings asynchronously
      blockTemplateService.syncBindingsOnFieldChange(id, diff).catch((err: unknown) => {
        logger.error('Error syncing bindings', err instanceof Error ? err : undefined)
      })
    }

    await blockRepository.save(block)
    await cacheService.invalidateByTag('blocks')

    // Пропавшие якоря, которые используют новости: сохраняем, но предупреждаем.
    let lostAnchors: { keys: string[]; news: Array<{ id: string; title: string }> } | undefined
    if (req.body.structure) {
      try {
        const lost = await blockDataAnchorsService.lostAnchorsInNews(id, oldStructure, block.structure)
        if (lost.keys.length > 0 && lost.news.length > 0) lostAnchors = lost
      } catch (err) {
        logger.warn(`Проверка якорей блока ${id} не удалась: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    const warn = lostAnchors ? { _lostAnchors: lostAnchors } : {}

    // Синхронизируем обновлённый блок на все страницы, где он используется
    if (req.body.structure) {
      try {
        const syncResult = await linkedBlocksService.syncBlockToAllPages(id, block.structure)
        if (syncResult.updatedPages.length > 0) {
          logger.info(`[BlockSync] Блок ${block.name} синхронизирован на страницы: ${syncResult.updatedPages.join(', ')}`)
          // Затронутые страницы изменились — кеш страниц устарел
          await cacheService.invalidateByTag('pages')
        }
        if (syncResult.errors.length > 0) {
          logger.error(`[BlockSync] Ошибки: ${syncResult.errors.join('; ')}`)
        }
        // Возвращаем результат синхронизации вместе с блоком
        res.json({
          ...block,
          ...warn,
          _syncResult: {
            updatedPages: syncResult.updatedPages,
            errors: syncResult.errors,
          }
        })
      } catch (syncErr: any) {
        logger.error('[BlockSync] Sync failed', syncErr instanceof Error ? syncErr : undefined)
        // Блок уже сохранён — возвращаем его даже если синхронизация упала
        res.json({ ...block, ...warn })
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
    res.setHeader('Cache-Control', 'no-store')
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
    stripInstanceArtifacts(structure)

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
