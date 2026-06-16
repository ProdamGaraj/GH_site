import { Request, Response } from 'express'
import { asyncHandler, NotFoundError, ValidationError } from '../middleware'
import { mediaService } from '../services/MediaService'
import { mediaFolderService } from '../services/MediaFolderService'
import { parseVariantWidths } from '../services/mediaVariants'
import {
  listMediaQuerySchema,
  updateMediaSchema,
  listFoldersQuerySchema,
  createFolderSchema,
  updateFolderSchema,
} from '../schemas/media.schema'

export class MediaController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const parsed = listMediaQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new ValidationError('Invalid query', { errors: parsed.error.flatten() })
    }
    const result = await mediaService.list({
      siteId: parsed.data.siteId ?? null,
      includeGlobal: parsed.data.includeGlobal ?? true,
      kind: parsed.data.kind,
      search: parsed.data.search,
      tag: parsed.data.tag,
      folderId: parsed.data.folderId,
      sort: parsed.data.sort,
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
      page: parsed.data.page,
      limit: parsed.data.limit,
    })
    res.json(result)
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const asset = await mediaService.getById(req.params.id)
    if (!asset) throw new NotFoundError('MediaAsset', req.params.id)
    res.json(mediaService.toDto(asset))
  })

  upload = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as
      | { file?: Express.Multer.File[]; poster?: Express.Multer.File[] }
      | undefined
    const file = files?.file?.[0]
    const poster = files?.poster?.[0]
    if (!file) throw new ValidationError('file is required (multipart field "file")')

    const tagsRaw = req.body?.tags
    let tags: string[] | undefined
    if (Array.isArray(tagsRaw)) tags = tagsRaw.map(String)
    else if (typeof tagsRaw === 'string' && tagsRaw.length > 0) {
      tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    }

    const siteId = typeof req.body?.siteId === 'string' && req.body.siteId.length > 0
      ? req.body.siteId
      : null

    const folderId = typeof req.body?.folderId === 'string' && req.body.folderId.length > 0
      ? req.body.folderId
      : null

    const optimize = req.body?.optimize === 'true' || req.body?.optimize === true
    const variantWidths = parseVariantWidths(req.body?.variantWidths)

    const asset = await mediaService.upload({
      file,
      poster,
      siteId,
      folderId,
      optimize,
      variantWidths,
      title: req.body?.title || null,
      alt: req.body?.alt || null,
      tags,
    })
    res.status(201).json(mediaService.toDto(asset))
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateMediaSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Invalid body', { errors: parsed.error.flatten() })
    }
    const updated = await mediaService.update(req.params.id, {
      title: parsed.data.title ?? undefined,
      alt: parsed.data.alt ?? undefined,
      tags: parsed.data.tags,
      folderId: parsed.data.folderId,
    })
    if (!updated) throw new NotFoundError('MediaAsset', req.params.id)
    res.json(mediaService.toDto(updated))
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    const ok = await mediaService.delete(req.params.id)
    if (!ok) throw new NotFoundError('MediaAsset', req.params.id)
    res.status(204).send()
  })

  // ---- Папки ----

  listFolders = asyncHandler(async (req: Request, res: Response) => {
    const parsed = listFoldersQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new ValidationError('Invalid query', { errors: parsed.error.flatten() })
    }
    const scope = {
      siteId: parsed.data.siteId ?? null,
      includeGlobal: parsed.data.includeGlobal ?? true,
    }
    const [folders, counts] = await Promise.all([
      mediaFolderService.list(scope),
      mediaService.getFolderCounts(scope),
    ])
    res.json({ items: folders.map((f) => mediaFolderService.toDto(f)), counts })
  })

  createFolder = asyncHandler(async (req: Request, res: Response) => {
    const parsed = createFolderSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Invalid body', { errors: parsed.error.flatten() })
    }
    const folder = await mediaFolderService.create({
      name: parsed.data.name,
      parentId: parsed.data.parentId ?? null,
      siteId: parsed.data.siteId ?? null,
    })
    res.status(201).json(mediaFolderService.toDto(folder))
  })

  updateFolder = asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateFolderSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new ValidationError('Invalid body', { errors: parsed.error.flatten() })
    }
    let folder = await mediaFolderService.getById(req.params.id)
    if (!folder) throw new NotFoundError('MediaFolder', req.params.id)

    if (parsed.data.name !== undefined) {
      folder = await mediaFolderService.rename(req.params.id, parsed.data.name)
    }
    if (parsed.data.parentId !== undefined) {
      folder = await mediaFolderService.move(req.params.id, parsed.data.parentId)
    }
    res.json(mediaFolderService.toDto(folder))
  })

  deleteFolder = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id
    const strategy = req.query.strategy

    if (strategy === 'delete-contents') {
      // Удалить папку вместе со всем содержимым (подпапки + файлы, с очисткой MinIO).
      const ids = await mediaFolderService.collectSubtreeIds(id)
      await mediaService.deleteAssetsInFolders(ids)
      await mediaFolderService.deleteFolders(ids)
      res.status(204).send()
      return
    }

    if (strategy === 'move-to-parent') {
      // Переместить содержимое в родительскую папку, затем удалить папку.
      await mediaFolderService.deleteMovingContentsToParent(id)
      res.status(204).send()
      return
    }

    if (strategy !== undefined) {
      throw new ValidationError('Invalid strategy (use "delete-contents" or "move-to-parent")')
    }

    // Без стратегии: удаляем только пустую папку (иначе 400).
    const ok = await mediaFolderService.delete(id)
    if (!ok) throw new NotFoundError('MediaFolder', id)
    res.status(204).send()
  })
}

export default new MediaController()
