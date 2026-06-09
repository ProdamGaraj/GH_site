import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import { AppDataSource } from '../config/database'
import { MediaAsset, MediaKind } from '../models/MediaAsset'
import { minioStorageService } from './MinioStorageService'
import { ValidationError } from '../middleware'
import { logger } from './Logger'
import { detectKind, extFromMime, validateSize } from './mediaMime'

export interface UploadInput {
  file: Express.Multer.File
  poster?: Express.Multer.File
  siteId?: string | null
  title?: string | null
  alt?: string | null
  tags?: string[]
}

export interface ListFilter {
  siteId?: string | null
  includeGlobal?: boolean
  kind?: MediaKind
  search?: string
  tag?: string
  page?: number
  limit?: number
}

export class MediaService {
  private repo() {
    return AppDataSource.getRepository(MediaAsset)
  }

  async upload(input: UploadInput): Promise<MediaAsset> {
    const { file, poster, siteId, title, alt, tags } = input
    if (!file) throw new ValidationError('file is required')

    const kind = detectKind(file.mimetype)
    validateSize(kind, file.size)

    const fallbackExt = (file.originalname.split('.').pop() || '').toLowerCase()
    const ext = extFromMime(file.mimetype, fallbackExt || 'bin')
    const id = uuidv4()
    const storageKey = `${id}.${ext}`

    await minioStorageService.putObject(storageKey, file.buffer, file.mimetype)

    // Generate thumbnail for raster images (skip SVG — vectors don't need it).
    let thumbnailStorageKey: string | null = null
    let width: number | null = null
    let height: number | null = null
    if (kind === 'image' && file.mimetype !== 'image/svg+xml') {
      try {
        const img = sharp(file.buffer, { failOn: 'none' })
        const meta = await img.metadata()
        if (meta.width) width = meta.width
        if (meta.height) height = meta.height
        const thumb = await img
          .rotate() // respect EXIF orientation
          .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer()
        thumbnailStorageKey = `${id}.thumb.webp`
        await minioStorageService.putObject(thumbnailStorageKey, thumb, 'image/webp')
      } catch (err: any) {
        logger.warn(`[MediaService] thumbnail generation failed for ${file.originalname}`, { error: err?.message })
        thumbnailStorageKey = null
      }
    }

    let posterStorageKey: string | null = null
    if (kind === 'video' && poster) {
      const posterKind = detectKind(poster.mimetype)
      if (posterKind !== 'image') {
        throw new ValidationError('poster must be an image')
      }
      validateSize('image', poster.size)
      const posterExt = extFromMime(
        poster.mimetype,
        (poster.originalname.split('.').pop() || 'jpg').toLowerCase(),
      )
      posterStorageKey = `${id}-poster.${posterExt}`
      await minioStorageService.putObject(
        posterStorageKey,
        poster.buffer,
        poster.mimetype,
      )
    }

    const asset = this.repo().create({
      siteId: siteId ?? null,
      kind,
      fileName: file.originalname,
      mimeType: file.mimetype,
      storageKey,
      posterStorageKey,
      thumbnailStorageKey,
      sizeBytes: file.size,
      width,
      height,
      title: title ?? file.originalname.replace(/\.[^.]+$/, ''),
      alt: alt ?? null,
      tags: tags && tags.length > 0 ? tags : undefined,
    })
    return this.repo().save(asset)
  }

  async list(filter: ListFilter) {
    const page = Math.max(1, filter.page ?? 1)
    const limit = Math.min(100, Math.max(1, filter.limit ?? 30))

    const qb = this.repo().createQueryBuilder('m')

    if (filter.siteId) {
      if (filter.includeGlobal) {
        qb.andWhere('(m."siteId" = :siteId OR m."siteId" IS NULL)', {
          siteId: filter.siteId,
        })
      } else {
        qb.andWhere('m."siteId" = :siteId', { siteId: filter.siteId })
      }
    } else if (filter.includeGlobal === false) {
      qb.andWhere('m."siteId" IS NOT NULL')
    }

    if (filter.kind) qb.andWhere('m.kind = :kind', { kind: filter.kind })
    if (filter.search) {
      qb.andWhere(
        '(m."fileName" ILIKE :q OR m.title ILIKE :q OR m.alt ILIKE :q)',
        { q: `%${filter.search}%` },
      )
    }
    if (filter.tag) {
      qb.andWhere('m.tags ILIKE :tag', { tag: `%${filter.tag}%` })
    }

    qb.orderBy('m."createdAt"', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)

    const [items, total] = await qb.getManyAndCount()
    return {
      items: items.map((it) => this.toDto(it)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getById(id: string): Promise<MediaAsset | null> {
    return this.repo().findOne({ where: { id } })
  }

  async update(
    id: string,
    patch: { title?: string; alt?: string; tags?: string[] },
  ): Promise<MediaAsset | null> {
    const asset = await this.getById(id)
    if (!asset) return null
    if (patch.title !== undefined) asset.title = patch.title
    if (patch.alt !== undefined) asset.alt = patch.alt
    if (patch.tags !== undefined) asset.tags = patch.tags
    return this.repo().save(asset)
  }

  async delete(id: string): Promise<boolean> {
    const asset = await this.getById(id)
    if (!asset) return false
    // Удаляем сначала из MinIO (best-effort), затем из БД.
    try {
      await minioStorageService.deleteObject(asset.storageKey)
      if (asset.posterStorageKey) {
        await minioStorageService.deleteObject(asset.posterStorageKey)
      }
      if (asset.thumbnailStorageKey) {
        await minioStorageService.deleteObject(asset.thumbnailStorageKey)
      }
    } catch (err: any) {
      logger.warn(`[MediaService] failed to delete object ${asset.storageKey}`, { error: err.message })
    }
    await this.repo().delete(id)
    return true
  }

  toDto(asset: MediaAsset) {
    return {
      id: asset.id,
      siteId: asset.siteId ?? null,
      kind: asset.kind,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      url: minioStorageService.publicUrl(asset.storageKey),
      posterUrl: asset.posterStorageKey
        ? minioStorageService.publicUrl(asset.posterStorageKey)
        : null,
      thumbnailUrl: asset.thumbnailStorageKey
        ? minioStorageService.publicUrl(asset.thumbnailStorageKey)
        : null,
      sizeBytes: Number(asset.sizeBytes),
      width: asset.width ?? null,
      height: asset.height ?? null,
      durationSec: asset.durationSec ?? null,
      title: asset.title ?? null,
      alt: asset.alt ?? null,
      tags: asset.tags ?? [],
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    }
  }
}

export const mediaService = new MediaService()
