import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Collection } from '../models/Collection'
import { CollectionOverride } from '../models/CollectionOverride'
import { Page } from '../models/Page'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { asyncHandler, NotFoundError, ValidationError, ConflictError } from '../middleware'
import { cacheService } from '../services/CacheService'

export class CollectionController {
  private getRepository() {
    return AppDataSource.getRepository(Collection)
  }
  private getOverrideRepository() {
    return AppDataSource.getRepository(CollectionOverride)
  }
  private getPageRepository() {
    return AppDataSource.getRepository(Page)
  }
  private getDataSourceRepository() {
    return AppDataSource.getRepository(DataSourceEntity)
  }

  // ─── CRUD коллекций ───────────────────────────────────────────

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const repo = this.getRepository()
    const { siteId } = req.query
    const where: any = {}
    if (siteId) where.siteId = siteId as string

    const items = await repo.find({
      where,
      relations: ['dataSource', 'templatePage', 'overrides'],
      order: { createdAt: 'DESC' },
    })

    res.json(items.map(c => ({
      ...c,
      overridesCount: c.overrides?.length || 0,
    })))
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const repo = this.getRepository()
    const { id } = req.params

    const collection = await repo.findOne({
      where: { id },
      relations: ['dataSource', 'templatePage', 'overrides', 'overrides.customPage'],
    })
    if (!collection) throw new NotFoundError('Collection', id)

    res.json(collection)
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const repo = this.getRepository()
    const data = req.body

    // Валидация ссылок
    const [dataSource, templatePage] = await Promise.all([
      this.getDataSourceRepository().findOne({ where: { id: data.dataSourceId } }),
      this.getPageRepository().findOne({ where: { id: data.templatePageId } }),
    ])
    if (!dataSource) throw new ValidationError('Data source not found')
    if (!templatePage) throw new ValidationError('Template page not found')

    // Проверка конфликта basePath с существующими страницами (Проблема 3)
    await this.checkBasePathConflict(data.siteId, data.basePath)

    // Помечаем страницу как шаблон
    templatePage.isTemplate = true
    await this.getPageRepository().save(templatePage)

    const collection = repo.create(data)
    await repo.save(collection)
    await cacheService.invalidateByTag('collections')

    res.status(201).json(collection)
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const repo = this.getRepository()
    const { id } = req.params
    const data = req.body

    const collection = await repo.findOne({ where: { id } })
    if (!collection) throw new NotFoundError('Collection', id)

    if (data.basePath && data.basePath !== collection.basePath) {
      await this.checkBasePathConflict(collection.siteId, data.basePath)
    }

    if (data.templatePageId && data.templatePageId !== collection.templatePageId) {
      const page = await this.getPageRepository().findOne({ where: { id: data.templatePageId } })
      if (!page) throw new ValidationError('Template page not found')
      page.isTemplate = true
      await this.getPageRepository().save(page)
    }

    Object.assign(collection, data)
    await repo.save(collection)
    await cacheService.invalidateByTag('collections')

    res.json(collection)
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    const repo = this.getRepository()
    const { id } = req.params

    const collection = await repo.findOne({ where: { id } })
    if (!collection) throw new NotFoundError('Collection', id)

    await repo.remove(collection)
    await cacheService.invalidateByTag('collections')

    res.json({ message: 'Collection deleted' })
  })

  // ─── Элементы коллекции (из API) ─────────────────────────────

  getItems = asyncHandler(async (req: Request, res: Response) => {
    const repo = this.getRepository()
    const { id } = req.params

    const collection = await repo.findOne({
      where: { id },
      relations: ['dataSource', 'overrides', 'overrides.customPage'],
    })
    if (!collection) throw new NotFoundError('Collection', id)

    // Загружаем данные из data source
    let items: any[] = []
    let fetchError: string | null = null

    try {
      items = await this.fetchCollectionItems(collection)
      // Обновляем кеш
      collection.cachedApiData = items
      collection.lastCachedAt = new Date()
      await repo.save(collection)
    } catch (err: any) {
      fetchError = err.message
      // Fallback на кеш (Проблема 8)
      if (collection.useCache && collection.cachedApiData) {
        items = collection.cachedApiData as any[]
      }
    }

    // Мёржим с overrides
    const overridesMap = new Map(
      (collection.overrides || []).map(o => [o.apiItemId, o])
    )

    const enrichedItems = items.map((item: any) => {
      const itemId = String(item.id || item._id || '')
      const itemSlug = this.getNestedValue(item, collection.slugField) || itemId
      const itemTitle = this.getNestedValue(item, collection.titleField) || ''
      const override = overridesMap.get(itemId)

      // Проверка рассинхронизации slug (Проблема 6)
      let slugWarning: string | undefined
      if (override?.apiItemSlug && override.apiItemSlug !== itemSlug) {
        slugWarning = `Slug changed: "${override.apiItemSlug}" → "${itemSlug}"`
      }

      return {
        apiItemId: itemId,
        slug: itemSlug,
        title: itemTitle,
        generatedUrl: `${collection.basePath}/${itemSlug}`,
        mode: override ? 'custom' : 'template',
        customPageId: override?.customPageId,
        customPageName: override?.customPage?.name,
        overrideId: override?.id,
        slugWarning,
      }
    })

    res.json({
      collection: {
        id: collection.id,
        name: collection.name,
        basePath: collection.basePath,
      },
      items: enrichedItems,
      fetchError,
      fromCache: fetchError !== null && items.length > 0,
    })
  })

  // ─── CRUD overrides ───────────────────────────────────────────

  createOverride = asyncHandler(async (req: Request, res: Response) => {
    const overrideRepo = this.getOverrideRepository()
    const { id: collectionId } = req.params
    const { apiItemId, apiItemSlug, customPageId } = req.body

    // Проверяем коллекцию
    const collection = await this.getRepository().findOne({ where: { id: collectionId } })
    if (!collection) throw new NotFoundError('Collection', collectionId)

    // Проверяем кастомную страницу
    const page = await this.getPageRepository().findOne({ where: { id: customPageId } })
    if (!page) throw new ValidationError('Custom page not found')

    // Проверяем уникальность
    const existing = await overrideRepo.findOne({
      where: { collectionId, apiItemId },
    })
    if (existing) throw new ConflictError('Override already exists for this item')

    const override = overrideRepo.create({
      collectionId,
      apiItemId,
      apiItemSlug,
      customPageId,
    })
    await overrideRepo.save(override)
    await cacheService.invalidateByTag('collections')

    res.status(201).json(override)
  })

  updateOverride = asyncHandler(async (req: Request, res: Response) => {
    const overrideRepo = this.getOverrideRepository()
    const { overrideId } = req.params
    const data = req.body

    const override = await overrideRepo.findOne({ where: { id: overrideId } })
    if (!override) throw new NotFoundError('CollectionOverride', overrideId)

    if (data.customPageId) override.customPageId = data.customPageId
    if (data.apiItemSlug !== undefined) override.apiItemSlug = data.apiItemSlug

    await overrideRepo.save(override)
    await cacheService.invalidateByTag('collections')

    res.json(override)
  })

  deleteOverride = asyncHandler(async (req: Request, res: Response) => {
    const overrideRepo = this.getOverrideRepository()
    const { overrideId } = req.params

    const override = await overrideRepo.findOne({ where: { id: overrideId } })
    if (!override) throw new NotFoundError('CollectionOverride', overrideId)

    await overrideRepo.remove(override)
    await cacheService.invalidateByTag('collections')

    res.json({ message: 'Override deleted' })
  })

  // ─── Helpers ──────────────────────────────────────────────────

  /**
   * Загружает элементы коллекции из data source
   */
  private async fetchCollectionItems(collection: Collection): Promise<any[]> {
    const ds = collection.dataSource
    if (!ds) throw new Error('Data source not loaded')

    const config = ds.config as any
    const url = config.url
    if (!url) throw new Error('Data source has no URL configured')

    const response = await fetch(url, {
      headers: config.headers || {},
    })

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`)
    }

    const json = await response.json()
    const items = this.getNestedValue(json, collection.arrayPath)

    if (!Array.isArray(items)) {
      throw new Error(`Expected array at path "${collection.arrayPath}", got ${typeof items}`)
    }

    return items
  }

  /**
   * Получает значение по вложенному пути (dot notation)
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Проверяет конфликт basePath с существующими страницами (Проблема 3)
   */
  private async checkBasePathConflict(siteId: string, basePath: string): Promise<void> {
    const pathWithoutLeadingSlash = basePath.replace(/^\//, '')
    const pages = await this.getPageRepository().find({ where: { siteId } })
    
    const conflicting = pages.find(p => {
      return p.slug === pathWithoutLeadingSlash || p.slug.startsWith(pathWithoutLeadingSlash + '/')
    })

    if (conflicting) {
      throw new ConflictError(
        `Base path "${basePath}" conflicts with existing page "${conflicting.name}" (slug: ${conflicting.slug})`
      )
    }
  }
}

export default new CollectionController()
