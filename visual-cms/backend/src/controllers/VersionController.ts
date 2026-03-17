import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { PageVersion } from '../models/PageVersion'
import { Page } from '../models/Page'
import { asyncHandler, NotFoundError, AppError } from '../middleware'

const versionRepository = AppDataSource.getRepository(PageVersion)
const pageRepository = AppDataSource.getRepository(Page)

export class VersionController {
  /** GET /api/pages/:pageId/versions — list all versions for a page */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { pageId } = req.params

    const versions = await versionRepository.find({
      where: { pageId },
      order: { version: 'DESC' },
      select: ['id', 'pageId', 'version', 'name', 'slug', 'status', 'source', 'label', 'createdAt'],
    })

    res.json(versions)
  })

  /** GET /api/pages/:pageId/versions/:versionId — get full version snapshot */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, versionId } = req.params

    const version = await versionRepository.findOne({
      where: { id: versionId, pageId },
    })

    if (!version) {
      throw new NotFoundError('PageVersion', versionId)
    }

    res.json(version)
  })

  /** POST /api/pages/:pageId/versions — manually create a named snapshot */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { pageId } = req.params
    const { label } = req.body

    const page = await pageRepository.findOne({ where: { id: pageId } })
    if (!page) {
      throw new NotFoundError('Page', pageId)
    }

    const version = versionRepository.create({
      pageId: page.id,
      version: page.version,
      structure: page.structure,
      metadata: page.metadata,
      name: page.name,
      slug: page.slug,
      status: page.status,
      source: 'manual',
      label: label || `Версия ${page.version}`,
    })

    await versionRepository.save(version)
    res.status(201).json(version)
  })

  /** POST /api/pages/:pageId/versions/:versionId/restore — restore page to this version */
  restore = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, versionId } = req.params

    const page = await pageRepository.findOne({ where: { id: pageId } })
    if (!page) {
      throw new NotFoundError('Page', pageId)
    }

    const version = await versionRepository.findOne({
      where: { id: versionId, pageId },
    })
    if (!version) {
      throw new NotFoundError('PageVersion', versionId)
    }

    // Save current state as a version before restoring
    const snapshotBeforeRestore = versionRepository.create({
      pageId: page.id,
      version: page.version,
      structure: page.structure,
      metadata: page.metadata,
      name: page.name,
      slug: page.slug,
      status: page.status,
      source: 'manual',
      label: `До восстановления v${version.version}`,
    })
    await versionRepository.save(snapshotBeforeRestore)

    // Restore
    page.structure = version.structure
    page.metadata = version.metadata || page.metadata
    page.version += 1
    await pageRepository.save(page)

    res.json({ success: true, page, restoredFrom: version.id })
  })

  /** PUT /api/pages/:pageId/versions/:versionId — update label */
  updateLabel = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, versionId } = req.params
    const { label } = req.body

    const version = await versionRepository.findOne({
      where: { id: versionId, pageId },
    })
    if (!version) {
      throw new NotFoundError('PageVersion', versionId)
    }

    version.label = label
    await versionRepository.save(version)

    res.json(version)
  })

  /** DELETE /api/pages/:pageId/versions/:versionId */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const { pageId, versionId } = req.params

    const result = await versionRepository.delete({ id: versionId, pageId })
    if (result.affected === 0) {
      throw new NotFoundError('PageVersion', versionId)
    }

    res.status(204).send()
  })
}

export const versionController = new VersionController()
