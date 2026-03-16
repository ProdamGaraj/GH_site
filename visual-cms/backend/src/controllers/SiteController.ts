import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Site } from '../models/Site'
import { Page } from '../models/Page'
import { asyncHandler, NotFoundError, AppError } from '../middleware'
import { cacheService } from '../services/CacheService'

const siteRepository = AppDataSource.getRepository(Site)
const pageRepository = AppDataSource.getRepository(Page)

export class SiteController {
  getAll = asyncHandler(async (_req: Request, res: Response) => {
    const sites = await siteRepository.find({
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    })

    // Count pages per site
    const sitesWithCounts = await Promise.all(
      sites.map(async (site) => {
        const pageCount = await pageRepository.count({ where: { siteId: site.id } })
        return { ...site, pageCount }
      })
    )

    res.json(sitesWithCounts)
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const site = await siteRepository.findOne({
      where: { id },
      relations: ['pages'],
    })

    if (!site) {
      throw new NotFoundError('Site', id)
    }

    res.json(site)
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const { name, slug, description, routingMode, hostname, settings, isDefault } = req.body

    // Validate slug uniqueness
    const existing = await siteRepository.findOne({ where: { slug } })
    if (existing) {
      throw new AppError(`Site with slug "${slug}" already exists`, 409)
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await siteRepository.update({ isDefault: true }, { isDefault: false })
    }

    const site = siteRepository.create({
      name,
      slug,
      description,
      routingMode: routingMode || 'subdomain',
      hostname,
      settings: settings || {},
      isDefault: isDefault || false,
      status: 'draft',
    })

    await siteRepository.save(site)
    await cacheService.invalidateByTag('sites')
    res.status(201).json(site)
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const site = await siteRepository.findOne({ where: { id } })

    if (!site) {
      throw new NotFoundError('Site', id)
    }

    const { name, slug, description, routingMode, hostname, settings, status, isDefault, homepageId } = req.body

    // If slug changed, check uniqueness
    if (slug && slug !== site.slug) {
      const existing = await siteRepository.findOne({ where: { slug } })
      if (existing) {
        throw new AppError(`Site with slug "${slug}" already exists`, 409)
      }
    }

    // If setting as default, unset others
    if (isDefault && !site.isDefault) {
      await siteRepository.update({ isDefault: true }, { isDefault: false })
    }

    if (name !== undefined) site.name = name
    if (slug !== undefined) site.slug = slug
    if (description !== undefined) site.description = description
    if (routingMode !== undefined) site.routingMode = routingMode
    if (hostname !== undefined) site.hostname = hostname
    if (settings !== undefined) site.settings = { ...site.settings, ...settings }
    if (status !== undefined) site.status = status
    if (isDefault !== undefined) site.isDefault = isDefault
    if (homepageId !== undefined) site.homepageId = homepageId

    await siteRepository.save(site)
    await cacheService.invalidateByTag('sites')
    res.json(site)
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const site = await siteRepository.findOne({ where: { id } })

    if (!site) {
      throw new NotFoundError('Site', id)
    }

    if (site.isDefault) {
      throw new AppError('Cannot delete the default site', 400)
    }

    // Unlink pages from this site (don't delete them)
    await pageRepository.update({ siteId: id }, { siteId: undefined as any })

    await siteRepository.remove(site)
    await cacheService.invalidateByTag('sites')
    res.json({ message: `Site "${site.name}" deleted` })
  })

  /** GET /api/sites/:id/pages — pages belonging to a site */
  getPages = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const site = await siteRepository.findOne({ where: { id } })

    if (!site) {
      throw new NotFoundError('Site', id)
    }

    const pages = await pageRepository.find({
      where: { siteId: id },
      relations: ['group'],
      order: { updatedAt: 'DESC' },
    })

    res.json(pages)
  })

  /** POST /api/sites/:id/pages/:pageId — assign page to site */
  assignPage = asyncHandler(async (req: Request, res: Response) => {
    const { id, pageId } = req.params
    const site = await siteRepository.findOne({ where: { id } })
    if (!site) throw new NotFoundError('Site', id)

    const page = await pageRepository.findOne({ where: { id: pageId } })
    if (!page) throw new NotFoundError('Page', pageId)

    page.siteId = id
    await pageRepository.save(page)
    await cacheService.invalidateByTag('pages')
    res.json(page)
  })

  /** DELETE /api/sites/:id/pages/:pageId — unassign page from site */
  unassignPage = asyncHandler(async (req: Request, res: Response) => {
    const { id, pageId } = req.params

    const page = await pageRepository.findOne({ where: { id: pageId, siteId: id } })
    if (!page) throw new NotFoundError('Page', pageId)

    page.siteId = undefined
    await pageRepository.save(page)
    await cacheService.invalidateByTag('pages')
    res.json(page)
  })

  /** PUT /api/sites/:id/settings — update only settings */
  updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const site = await siteRepository.findOne({ where: { id } })
    if (!site) throw new NotFoundError('Site', id)

    site.settings = { ...site.settings, ...req.body }
    await siteRepository.save(site)
    await cacheService.invalidateByTag('sites')
    res.json(site)
  })

  /** POST /api/sites/:id/duplicate — duplicate site (without pages) */
  duplicate = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const source = await siteRepository.findOne({ where: { id } })
    if (!source) throw new NotFoundError('Site', id)

    const newSite = siteRepository.create({
      name: `${source.name} (копия)`,
      slug: `${source.slug}-copy-${Date.now()}`,
      description: source.description,
      routingMode: source.routingMode,
      hostname: undefined,
      settings: { ...source.settings },
      isDefault: false,
      status: 'draft',
    })

    await siteRepository.save(newSite)
    res.status(201).json(newSite)
  })
}

export const siteController = new SiteController()
