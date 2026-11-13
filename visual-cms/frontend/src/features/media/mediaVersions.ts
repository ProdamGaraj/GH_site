/**
 * Версии одного файла медиатеки (pure, для юнит-тестов).
 *
 * При загрузке картинки рядом с оригиналом создаются сжатая версия и
 * уменьшенные копии по ширинам экранов. Отдельных плиток в медиатеке у них
 * нет — это один файл, сайт сам берёт нужную версию. Здесь — их список для
 * окна «Размеры».
 */
import type { MediaAsset } from '@/shared/api/mediaApi'

export type MediaVersionKind = 'original' | 'optimized' | 'variant'

export interface MediaVersion {
  kind: MediaVersionKind
  label: string
  /** Где версия используется на сайте. */
  note: string
  width: number | null
  height: number | null
  sizeBytes: number
  url: string
}

/** Оригинал, сжатая версия и размеры — от широких к узким. */
export function listMediaVersions(asset: MediaAsset): MediaVersion[] {
  const versions: MediaVersion[] = [
    {
      kind: 'original',
      label: 'Оригинал',
      note: asset.optimizedUrl ? 'Хранится, на сайте не показывается' : 'Показывается на широких экранах',
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.sizeBytes,
      url: asset.url,
    },
  ]
  if (asset.optimizedUrl) {
    versions.push({
      kind: 'optimized',
      label: 'Сжатая, полный размер',
      note: 'Показывается на широких экранах',
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.optimizedSizeBytes ?? 0,
      url: asset.optimizedUrl,
    })
  }
  const variants = [...asset.variants].sort((a, b) => b.width - a.width)
  for (const v of variants) {
    versions.push({
      kind: 'variant',
      label: `${v.width} px`,
      note: 'Для экранов поуже',
      width: v.width,
      height: v.height || null,
      sizeBytes: v.sizeBytes,
      url: v.url,
    })
  }
  return versions
}

/** Есть ли у файла что показать в окне «Размеры», кроме самого оригинала. */
export function hasDerivedVersions(asset: MediaAsset): boolean {
  return !!asset.optimizedUrl || asset.variants.length > 0
}

/** Вес файла: «640 Б», «87 КБ», «1,4 МБ». */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} Б`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} КБ`
  const mb = kb / 1024
  return `${(mb < 10 ? mb.toFixed(1) : String(Math.round(mb))).replace('.', ',')} МБ`
}

/** Насколько версия легче оригинала: «−82%»; не легче или вес неизвестен — пусто. */
export function savingLabel(sizeBytes: number, originalBytes: number): string {
  if (!(sizeBytes > 0) || !(originalBytes > 0) || sizeBytes >= originalBytes) return ''
  const percent = Math.round((1 - sizeBytes / originalBytes) * 100)
  return percent > 0 ? `−${percent}%` : ''
}
