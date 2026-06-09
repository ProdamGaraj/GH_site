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

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 200 MB
export const MAX_DOCUMENT_BYTES = 200 * 1024 * 1024 // 200 MB (catch-all: PDF, office, любые файлы)

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

/**
 * Определяет вид ассета по MIME (catch-all, не бросает ошибку).
 * image/* и video/* по известным наборам, всё остальное (PDF, office,
 * архивы, любые файлы) попадает в 'document' — чтобы можно было загрузить
 * что угодно, а функция сама распределила файл по категории.
 */
export function detectKind(mime: string): MediaKind {
  if (IMAGE_MIMES.has(mime)) return 'image'
  if (VIDEO_MIMES.has(mime)) return 'video'
  return 'document'
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

/**
 * Можно ли безопасно отдавать файл inline (в браузере), не рискуя исполнением.
 *
 * Inline-safe: растровые изображения и видео — они отображаются на сайте через
 * <img>/<video> и не исполняют скрипты при прямом открытии.
 *
 * НЕ inline-safe (нужен Content-Disposition: attachment):
 *   - SVG — может исполнять скрипты, если открыт как top-level документ;
 *   - PDF/office/архивы/любые прочие файлы.
 *
 * Заголовок attachment не мешает встраиванию через <img>/<video> (для subresource
 * он игнорируется), но при прямом переходе по ссылке файл скачивается, а не исполняется.
 */
export function isInlineSafe(mime: string): boolean {
  if (mime === 'image/svg+xml') return false
  return IMAGE_MIMES.has(mime) || VIDEO_MIMES.has(mime)
}

/**
 * Строит значение заголовка `Content-Disposition: attachment` с именем файла.
 *
 * Безопасность:
 *   - CR/LF вырезаются (защита от header-инъекции);
 *   - в ASCII-варианте все не-печатные символы и кавычки/бэкслеши → '_';
 *   - не-ASCII (кириллица) отдаётся через RFC 5987 `filename*` с percent-кодированием,
 *     поэтому в итоговый заголовок не попадают «сырые» управляющие символы.
 */
export function buildContentDisposition(fileName: string): string {
  const clean = (fileName || 'download').replace(/[\r\n]/g, '').trim() || 'download'
  // ASCII-fallback: всё, кроме печатного ASCII (0x20..0x7e), а также " и \ → '_'
  const ascii = clean.replace(/[^ -~]/g, '_').replace(/["\\]/g, '_')
  // RFC 5987: encodeURIComponent + доэкранирование символов, которые он пропускает
  const encoded = encodeURIComponent(clean).replace(
    /['()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
