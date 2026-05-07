/**
 * Thin-маппер: преобразует "сырую" статистику ЖК из Macro v2 (estateComplexes/listStats)
 * в формат ProjectStats, который ожидает шаблон проекта на сайте.
 *
 * Macro уже считает min/max/count сам — нам не нужно ничего агрегировать,
 * только выбрать нужную категорию (flat) и привести единицы.
 *
 * Цены Macro v2 хранит в МИНИМАЛЬНЫХ единицах валюты (копейки/тийины) — делим на 100.
 * Площади — в м² как есть.
 *
 * Студии: в v2 есть отдельный признак isStudio на уровне юнита, но в listStats отдельной
 * метрики студий нет. Если в stats.categories.flat.rooms есть ключ "0" с countOnSale > 0 —
 * считаем что студии есть. Этот ключ используется Macro для квартир без выделенных комнат.
 */

import type { ComplexStatsRaw, ComplexStatsCategory, ComplexStatsRoomBucket } from './MacroV2Client'

export interface ProjectStats {
  count: number
  hasStudios: boolean
  area_min: number | null
  area_max: number | null
  price_min: number | null
  price_max: number | null
  rooms_max: number | null
  currency: string | null
  /**
   * Разбивка по комнатности (опционально, для расширенной карточки).
   * Ключ — число комнат как строка ("1", "2", ...). "0" = студии.
   */
  byRooms?: Record<string, ProjectRoomStats>
}

export interface ProjectRoomStats {
  count: number
  area_min: number | null
  area_max: number | null
  price_min: number | null
  price_max: number | null
}

const PRICE_DIVISOR = 100 // копейки → рубли / тийины → сомы / etc

export function mapComplexStats(raw: ComplexStatsRaw, currency: string | null = null): ProjectStats {
  const empty: ProjectStats = {
    count: 0,
    hasStudios: false,
    area_min: null,
    area_max: null,
    price_min: null,
    price_max: null,
    rooms_max: null,
    currency,
  }
  const flat = raw?.stats?.categories?.flat
  if (!flat) return empty

  const count = numOrZero(flat.countOnSale)
  if (count === 0) return { ...empty, count: 0 }

  // Разбивка по комнатности → одновременно вычисляем rooms_max и hasStudios
  let hasStudios = false
  let roomsMax: number | null = null
  const byRooms: Record<string, ProjectRoomStats> = {}
  if (flat.rooms && typeof flat.rooms === 'object') {
    for (const [key, bucket] of Object.entries(flat.rooms)) {
      if (!bucket || numOrZero(bucket.countOnSale) === 0) continue
      const k = String(key)
      const n = Number(k)
      if (k === '0') {
        hasStudios = true
      } else if (Number.isFinite(n) && n > 0) {
        if (roomsMax === null || n > roomsMax) roomsMax = n
      }
      byRooms[k] = mapRoomBucket(bucket)
    }
  }

  return {
    count,
    hasStudios,
    area_min: numOrNull(flat.minArea),
    area_max: numOrNull(flat.maxArea),
    price_min: priceOrNull(flat.minPrice),
    price_max: priceOrNull(flat.maxPrice),
    rooms_max: roomsMax,
    currency,
    byRooms: Object.keys(byRooms).length > 0 ? byRooms : undefined,
  }
}

function mapRoomBucket(b: ComplexStatsRoomBucket): ProjectRoomStats {
  return {
    count: numOrZero(b.countOnSale),
    area_min: numOrNull(b.minArea),
    area_max: numOrNull(b.maxArea),
    price_min: priceOrNull(b.minPrice),
    price_max: priceOrNull(b.maxPrice),
  }
}

function numOrZero(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function numOrNull(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? round2(n) : null
}

function priceOrNull(v: unknown): number | null {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n / PRICE_DIVISOR)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
