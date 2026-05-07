import { Request, Response } from 'express'
import { asyncHandler, NotFoundError, ValidationError } from '../middleware'
import { mediaService } from '../services/MediaService'
import { listMediaQuerySchema, updateMediaSchema } from '../schemas/media.schema'

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

    const asset = await mediaService.upload({
      file,
      poster,
      siteId,
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
    })
    if (!updated) throw new NotFoundError('MediaAsset', req.params.id)
    res.json(mediaService.toDto(updated))
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    const ok = await mediaService.delete(req.params.id)
    if (!ok) throw new NotFoundError('MediaAsset', req.params.id)
    res.status(204).send()
  })
}

export default new MediaController()
