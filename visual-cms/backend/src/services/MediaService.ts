import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { MediaAsset, MediaKind, MediaVariant } from '../models/MediaAsset'
import { minioStorageService } from './MinioStorageService'
import { mediaFolderService } from './MediaFolderService'
import { ValidationError } from '../middleware'
import { logger } from './Logger'
import { detectKind, extFromMime, validateSize, isInlineSafe, buildContentDisposition } from './mediaMime'
import { buildVariantPlan } from './mediaVariants'

/** Качество webp для оптимизированной версии и адаптивных вариантов (визуально без потерь). */
const OPTIMIZED_WEBP_QUALITY = 82
const VARIANT_WEBP_QUALITY = 80

export type MediaSort = 'newest' | 'oldest' | 'name' | 'largest' | 'smallest'

export interface UploadInput {
  file: Express.Multer.File
  poster?: Express.Multer.File
  siteId?: string | null
  title?: string | null
  alt?: string | null
  tags?: string[]
  folderId?: string | null
  /** Создать оптимизированную (сжатую) версию рядом с оригиналом. */
  optimize?: boolean
  /** Ширины экранов для адаптивных вариантов (срезаются по ширине оригинала). */
  variantWidths?: number[]
}

export interface ListFilter {
  siteId?: string | null
  includeGlobal?: boolean
  kind?: MediaKind
  search?: string
  tag?: string
  /** uuid папки, 'root' (только корень) или undefined (без фильтра по папке). */
  folderId?: string | 'root'
  sort?: MediaSort
  /** ISO-дата нижней границы createdAt (включительно). */
  dateFrom?: string
  /** ISO-дата верхней границы createdAt (включительно). */
  dateTo?: string
  page?: number
  limit?: number
}

export class MediaService {
  private repo() {
    return AppDataSource.getRepository(MediaAsset)
  }

  async upload(input: UploadInput): Promise<MediaAsset> {
    const { file, poster, siteId, title, alt, tags, optimize, variantWidths } = input
    if (!file) throw new ValidationError('file is required')

    const kind = detectKind(file.mimetype)
    validateSize(kind, file.size)

    const folderId = await this.resolveFolderId(input.folderId ?? null, siteId ?? null)

    const fallbackExt = (file.originalname.split('.').pop() || '').toLowerCase()
    const ext = extFromMime(file.mimetype, fallbackExt || 'bin')
    const id = uuidv4()
    const storageKey = `${id}.${ext}`

    // Не inline-safe (SVG, PDF, office, любые файлы) отдаём как attachment —
    // чтобы при открытии по ссылке файл скачивался, а не исполнялся в браузере.
    const disposition = isInlineSafe(file.mimetype)
      ? undefined
      : buildContentDisposition(file.originalname)
    await minioStorageService.putObject(storageKey, file.buffer, file.mimetype, disposition)

    // Производные для растровых изображений (SVG — векторы, пропускаем).
    let thumbnailStorageKey: string | null = null
    let optimizedStorageKey: string | null = null
    let optimizedSizeBytes: number | null = null
    let variants: MediaVariant[] | null = null
    let width: number | null = null
    let height: number | null = null
    if (kind === 'image' && file.mimetype !== 'image/svg+xml') {
      try {
        const meta = await sharp(file.buffer, { failOn: 'none' }).metadata()
        // Учитываем EXIF-ориентацию: при повороте 90/270 ширина и высота меняются местами.
        const swap = (meta.orientation ?? 1) >= 5
        const ow = swap ? meta.height : meta.width
        const oh = swap ? meta.width : meta.height
        if (ow) width = ow
        if (oh) height = oh

        // Миниатюра (как раньше).
        const thumb = await sharp(file.buffer, { failOn: 'none' })
          .rotate() // respect EXIF orientation
          .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer()
        thumbnailStorageKey = `${id}.thumb.webp`
        await minioStorageService.putObject(thumbnailStorageKey, thumb, 'image/webp')

        // Оптимизированная версия (по галочке). Оригинал не трогаем.
        // Сохраняем только если она реально меньше оригинала.
        if (optimize) {
          const optBuf = await sharp(file.buffer, { failOn: 'none' })
            .rotate()
            .webp({ quality: OPTIMIZED_WEBP_QUALITY })
            .toBuffer()
          if (optBuf.length < file.size) {
            optimizedStorageKey = `${id}.opt.webp`
            optimizedSizeBytes = optBuf.length
            await minioStorageService.putObject(optimizedStorageKey, optBuf, 'image/webp')
          }
        }

        // Адаптивные варианты (по списку ширин). Без апскейла — только < ширины оригинала.
        const plan = buildVariantPlan(width, variantWidths ?? [])
        if (plan.length > 0) {
          const built: MediaVariant[] = []
          for (const w of plan) {
            const buf = await sharp(file.buffer, { failOn: 'none' })
              .rotate()
              .resize({ width: w, withoutEnlargement: true })
              .webp({ quality: VARIANT_WEBP_QUALITY })
              .toBuffer()
            const vh = oh && ow ? Math.round((w * oh) / ow) : 0
            const variantKey = `${id}.w${w}.webp`
            await minioStorageService.putObject(variantKey, buf, 'image/webp')
            built.push({ width: w, height: vh, storageKey: variantKey, sizeBytes: buf.length })
          }
          variants = built.length > 0 ? built : null
        }
      } catch (err: any) {
        logger.warn(`[MediaService] image processing failed for ${file.originalname}`, { error: err?.message })
        // Производные best-effort: если sharp упал, ассет всё равно создаём (с оригиналом).
        thumbnailStorageKey = thumbnailStorageKey ?? null
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
      // SVG-постер тоже проходит проверку 'image' — отдаём его как attachment.
      const posterDisposition = isInlineSafe(poster.mimetype)
        ? undefined
        : buildContentDisposition(poster.originalname)
      await minioStorageService.putObject(
        posterStorageKey,
        poster.buffer,
        poster.mimetype,
        posterDisposition,
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
      optimizedStorageKey,
      optimizedSizeBytes,
      variants,
      folderId,
      sizeBytes: file.size,
      width,
      height,
      title: title ?? file.originalname.replace(/\.[^.]+$/, ''),
      alt: alt ?? null,
      tags: tags && tags.length > 0 ? tags : undefined,
    })
    return this.repo().save(asset)
  }

  /**
   * Проверяет, что папка существует и совместима по области видимости с ассетом.
   * Глобальная папка (siteId=null) принимает любой ассет; сайтовая — только того же сайта.
   * Возвращает folderId (или null), бросает ValidationError при несовместимости.
   */
  private async resolveFolderId(folderId: string | null, siteId: string | null): Promise<string | null> {
    if (!folderId) return null
    const folder = await mediaFolderService.getById(folderId)
    if (!folder) throw new ValidationError('Folder not found')
    if (folder.siteId != null && folder.siteId !== siteId) {
      throw new ValidationError('Folder belongs to a different site')
    }
    return folder.id
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

    // Папка: 'root' = только корень (folderId IS NULL); uuid = конкретная папка.
    if (filter.folderId === 'root') {
      qb.andWhere('m."folderId" IS NULL')
    } else if (filter.folderId) {
      qb.andWhere('m."folderId" = :fid', { fid: filter.folderId })
    }

    if (filter.dateFrom) qb.andWhere('m."createdAt" >= :dateFrom', { dateFrom: filter.dateFrom })
    if (filter.dateTo) qb.andWhere('m."createdAt" <= :dateTo', { dateTo: filter.dateTo })

    this.applySort(qb, filter.sort)
    qb.skip((page - 1) * limit).take(limit)

    const [items, total] = await qb.getManyAndCount()
    return {
      items: items.map((it) => this.toDto(it)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  private applySort(qb: import('typeorm').SelectQueryBuilder<MediaAsset>, sort?: MediaSort): void {
    switch (sort) {
      case 'oldest':
        qb.orderBy('m."createdAt"', 'ASC')
        break
      case 'name':
        qb.orderBy('m."fileName"', 'ASC')
        break
      case 'largest':
        qb.orderBy('m."sizeBytes"', 'DESC')
        break
      case 'smallest':
        qb.orderBy('m."sizeBytes"', 'ASC')
        break
      case 'newest':
      default:
        qb.orderBy('m."createdAt"', 'DESC')
        break
    }
  }

  /**
   * Кол-во файлов по папкам в заданной области видимости (прямые файлы, без подпапок).
   * Возвращает: byFolder[folderId], root (файлы вне папок) и total.
   */
  async getFolderCounts(filter: {
    siteId?: string | null
    includeGlobal?: boolean
  }): Promise<{ byFolder: Record<string, number>; root: number; total: number }> {
    const qb = this.repo()
      .createQueryBuilder('m')
      .select('m."folderId"', 'folderId')
      .addSelect('COUNT(*)', 'cnt')

    if (filter.siteId) {
      if (filter.includeGlobal) {
        qb.where('(m."siteId" = :siteId OR m."siteId" IS NULL)', { siteId: filter.siteId })
      } else {
        qb.where('m."siteId" = :siteId', { siteId: filter.siteId })
      }
    } else if (filter.includeGlobal === false) {
      qb.where('m."siteId" IS NOT NULL')
    }

    const rows = await qb.groupBy('m."folderId"').getRawMany<{ folderId: string | null; cnt: string }>()

    const byFolder: Record<string, number> = {}
    let root = 0
    let total = 0
    for (const r of rows) {
      const n = Number(r.cnt)
      total += n
      if (r.folderId == null) root += n
      else byFolder[r.folderId] = n
    }
    return { byFolder, root, total }
  }

  async getById(id: string): Promise<MediaAsset | null> {
    return this.repo().findOne({ where: { id } })
  }

  async update(
    id: string,
    patch: { title?: string; alt?: string; tags?: string[]; folderId?: string | null },
  ): Promise<MediaAsset | null> {
    const asset = await this.getById(id)
    if (!asset) return null
    if (patch.title !== undefined) asset.title = patch.title
    if (patch.alt !== undefined) asset.alt = patch.alt
    if (patch.tags !== undefined) asset.tags = patch.tags
    if (patch.folderId !== undefined) {
      // null = переместить в корень; uuid = проверяем существование/область видимости.
      asset.folderId = await this.resolveFolderId(patch.folderId, asset.siteId ?? null)
    }
    return this.repo().save(asset)
  }

  async delete(id: string): Promise<boolean> {
    const asset = await this.getById(id)
    if (!asset) return false
    // Удаляем сначала из MinIO (best-effort), затем из БД.
    // Собираем все ключи: оригинал + постер + миниатюра + оптимизированная + все варианты,
    // чтобы не оставлять «осиротевшие» файлы в хранилище.
    const keys = [
      asset.storageKey,
      asset.posterStorageKey,
      asset.thumbnailStorageKey,
      asset.optimizedStorageKey,
      ...(asset.variants ?? []).map((v) => v.storageKey),
    ].filter((k): k is string => !!k)

    for (const key of keys) {
      try {
        await minioStorageService.deleteObject(key)
      } catch (err: any) {
        logger.warn(`[MediaService] failed to delete object ${key}`, { error: err.message })
      }
    }
    await this.repo().delete(id)
    return true
  }

  /**
   * Удаляет все ассеты, лежащие в указанных папках (с очисткой файлов в MinIO).
   * Используется при удалении папки «вместе с содержимым».
   */
  async deleteAssetsInFolders(folderIds: string[]): Promise<void> {
    if (folderIds.length === 0) return
    const assets = await this.repo().find({ where: { folderId: In(folderIds) } })
    for (const asset of assets) {
      await this.delete(asset.id)
    }
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
      optimizedUrl: asset.optimizedStorageKey
        ? minioStorageService.publicUrl(asset.optimizedStorageKey)
        : null,
      optimizedSizeBytes:
        asset.optimizedSizeBytes != null ? Number(asset.optimizedSizeBytes) : null,
      variants: (asset.variants ?? []).map((v) => ({
        width: v.width,
        height: v.height,
        url: minioStorageService.publicUrl(v.storageKey),
        sizeBytes: Number(v.sizeBytes),
      })),
      folderId: asset.folderId ?? null,
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
