/**
 * Media MIME classification (pure, dependency-light).
 *
 * Вынесено из MediaService, чтобы:
 *   1) классификация была переиспользуемой (DRY);
 *   2) логику можно было юнит-тестировать без БД/MinIO.
 *
 * `MediaKind` импортируется как тип (стирается при компиляции), поэтому
 * этот модуль не тянет typeorm в рантайме.
 */
import type { MediaKind } from '../models/MediaAsset'
import { ValidationError } from '../middleware/errorHandler'

export const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
])

export const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
])

export const DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
])

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 200 MB
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024 // 50 MB

export const MAX_BYTES_BY_KIND: Record<MediaKind, number> = {
  image: MAX_IMAGE_BYTES,
  video: MAX_VIDEO_BYTES,
  document: MAX_DOCUMENT_BYTES,
}

const EXT_BY_MIME: Record<string, string> = {
  // image
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  // video
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  // document
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

/** Определяет вид ассета по MIME. Бросает ValidationError для неподдерживаемых типов. */
export function detectKind(mime: string): MediaKind {
  if (IMAGE_MIMES.has(mime)) return 'image'
  if (VIDEO_MIMES.has(mime)) return 'video'
  if (DOCUMENT_MIMES.has(mime)) return 'document'
  throw new ValidationError(`Unsupported mime type: ${mime}`)
}

/** Возвращает расширение файла по MIME, либо fallback (без точки). */
export function extFromMime(mime: string, fallback: string): string {
  return EXT_BY_MIME[mime] ?? fallback
}

/** Проверяет размер файла против лимита для его вида. Бросает ValidationError при превышении. */
export function validateSize(kind: MediaKind, size: number): void {
  const limit = MAX_BYTES_BY_KIND[kind]
  if (size > limit) {
    throw new ValidationError(
      `File too large: ${size} bytes (max ${limit} for ${kind})`,
    )
  }
}
