import { Request, Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { AppDataSource } from '../config/database'
import { Collection } from '../models/Collection'
import { CollectionOverride } from '../models/CollectionOverride'
import { Page } from '../models/Page'
import { Site } from '../models/Site'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { asyncHandler, NotFoundError, ValidationError, ConflictError } from '../middleware'
import { cacheService } from '../services/CacheService'
import { cachedDataSourceService } from '../services/CachedDataSourceService'
import { FetchConfig, AuthConfig } from '../services/SecureDataSourceService'
import { CredentialsManager } from '../services/CredentialsManager'
import { deployService } from '../services/DeployService'
import { applyCollectionTransforms } from '../utils/collectionTransforms'

const PUBLIC_DIR = process.env.PUBLIC_SITE_DIR || '/app/public-site'

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

    // Опциональный stats data source
    if (data.statsDataSourceId) {
      const statsDs = await this.getDataSourceRepository().findOne({ where: { id: data.statsDataSourceId } })
      if (!statsDs) throw new ValidationError('Stats data source not found')
    }

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

    const collection = await repo.findOne({ where: { id }, relations: ['site'] })
    if (!collection) throw new NotFoundError('Collection', id)

    // При смене basePath — удалить старые сгенерированные файлы
    if (data.basePath && data.basePath !== collection.basePath) {
      await this.checkBasePathConflict(collection.siteId, data.basePath)
      this.cleanCollectionDir(collection.site ?? null, collection.basePath)
    }

    if (data.templatePageId && data.templatePageId !== collection.templatePageId) {
      const page = await this.getPageRepository().findOne({ where: { id: data.templatePageId } })
      if (!page) throw new ValidationError('Template page not found')
      page.isTemplate = true
      await this.getPageRepository().save(page)
    }

    // Опциональный stats data source: пустое значение/null — отвязать; UUID — проверить существование.
    // Используем 'in' чтобы отличать "не передавали" (не трогаем) от "передали null" (отвязать).
    if ('statsDataSourceId' in data && data.statsDataSourceId) {
      const statsDs = await this.getDataSourceRepository().findOne({ where: { id: data.statsDataSourceId } })
      if (!statsDs) throw new ValidationError('Stats data source not found')
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

    // Серверные трансформации элементов коллекции (include/exclude/sort/limit/unique/...).
    // Кеш (cachedApiData) хранит сырой массив; трансформации применяются на чтении.
    items = applyCollectionTransforms(items, collection.transforms)

    // Мёржим с overrides — match по apiItemId, затем fallback по apiItemSlug
    const overridesByItemId = new Map(
      (collection.overrides || []).filter(o => o.apiItemId).map(o => [o.apiItemId, o])
    )
    const overridesBySlug = new Map(
      (collection.overrides || []).filter(o => o.apiItemSlug).map(o => [o.apiItemSlug, o])
    )

    const warnings: string[] = []
    const enrichedItems = items.map((item: any) => {
      const itemId = String(item.id || item._id || '')
      const itemTitle = this.getNestedValue(item, collection.titleField) || ''
      const rawSlug = this.getNestedValue(item, collection.slugField)
      // Всегда нормализуем slug через slugify (транслит, нижний регистр, без спецсимволов)
      let itemSlug = this.slugify(String(rawSlug || itemTitle || '')) || itemId

      // Ищем override: сначала по id, затем fallback по slug
      const override = overridesByItemId.get(itemId) || overridesBySlug.get(itemSlug)

      // Override может задать кастомный slug — тоже нормализуем
      if (override?.apiItemSlug) {
        itemSlug = this.slugify(override.apiItemSlug) || itemSlug
      }

      // Проверка рассинхронизации slug (Проблема 6)
      if (override?.apiItemSlug && override.apiItemSlug !== itemSlug) {
        warnings.push(`Slug changed for "${itemTitle}": "${override.apiItemSlug}" → "${itemSlug}"`)
      }

      return {
        apiItemId: itemId,
        slug: itemSlug,
        title: itemTitle,
        generatedUrl: `${collection.basePath.replace(/\/+$/, '')}/${itemSlug}`,
        mode: override ? 'custom' : 'template',
        customPageId: override?.customPageId,
        customPageName: override?.customPage?.name,
        overrideId: override?.id,
      }
    })

    res.json({
      items: enrichedItems,
      total: enrichedItems.length,
      warnings: [...warnings, ...(fetchError ? [`API error: ${fetchError}`] : [])],
      fromCache: fetchError !== null && items.length > 0,
    })
  })

  // ─── Превью цепочки запросов ──────────────────────────────────

  /**
   * GET /api/collections/:id/preview-request
   * Выполняет реальную цепочку запросов (основной + доп.источники на первом элементе)
   * и возвращает по-шаговую раскладку. Не пишет файлов, не трогает кеш.
   */
  previewRequest = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const collection = await this.getRepository().findOne({ where: { id } })
    if (!collection) throw new NotFoundError('Collection', id)

    const preview = await deployService.previewCollectionRequest(id)
    res.json(preview)
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
    if (!config.url) throw new Error('Data source has no URL configured')

    let authConfig: AuthConfig | undefined = undefined
    if (ds.authConfig) {
      authConfig = (await CredentialsManager.decryptAuthConfig(ds.authConfig)) as unknown as AuthConfig
    }

    const ec = collection.endpointConfig

    // Строим базовый fetchConfig из DataSource, затем применяем override из endpointConfig
    const fetchConfig: FetchConfig = { type: ds.type, ...config }

    if (ec) {
      // Путь: если указан — строим полный URL как baseUrl + path
      if (ec.path) {
        const base = (config.url as string).replace(/\/+$/, '')
        const suffix = ec.path.startsWith('/') ? ec.path : `/${ec.path}`
        fetchConfig.url = `${base}${suffix}`
      }
      if (ec.method) fetchConfig.method = ec.method
      if (ec.headers) fetchConfig.headers = { ...(fetchConfig.headers || {}), ...ec.headers }
      if (ec.queryParams) fetchConfig.queryParams = { ...(fetchConfig.queryParams || {}), ...ec.queryParams }
      if (ec.body !== undefined) {
        fetchConfig.body = ec.body
        if (ec.bodyFormat) fetchConfig.bodyFormat = ec.bodyFormat as FetchConfig['bodyFormat']
      }
    }

    const result = await cachedDataSourceService.fetchData(ds.id, fetchConfig, authConfig)

    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to fetch collection data')
    }

    const json = result.data
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
   * Удаляет директорию сгенерированных файлов коллекции
   */
  private cleanCollectionDir(site: Site | null, basePath: string): void {
    const siteDir = site?.slug
      ? path.join(PUBLIC_DIR, 'sites', site.slug)
      : PUBLIC_DIR
    const collectionDir = path.join(siteDir, basePath.replace(/^\//, ''))

    // Защита от удаления корневой директории сайта
    if (collectionDir === siteDir || collectionDir === PUBLIC_DIR) {
      return
    }

    if (fs.existsSync(collectionDir)) {
      fs.rmSync(collectionDir, { recursive: true, force: true })
    }
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

  /**
   * Транслитерация и slugify строки для URL-безопасного имени файла.
   */
  private slugify(str: string): string {
    const cyrillic: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
      з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
      п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
      ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
      я: 'ya',
    }
    return str
      .toLowerCase()
      .split('')
      .map(ch => cyrillic[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100)
  }
}

export default new CollectionController()
