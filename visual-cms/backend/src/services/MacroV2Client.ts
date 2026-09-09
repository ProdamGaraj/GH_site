/**
 * Клиент Macro CRM API v2 — endpoint estateComplexes/listStats.
 *
 * Назначение: одним POST-запросом получить агрегированную статистику продаж
 * по списку ЖК (комплексов). Macro считает min/max/count сама — нам остаётся
 * только смаппить в наш формат.
 *
 * Документация:
 *   POST /v2/estateComplexes/listStats
 *   body: { complexIds?: number[] }      // без фильтра — все ЖК компании
 *   resp: { data: ComplexStatsRaw[] }    // меты пагинации тут нет (один проход)
 *
 * Авторизация: Authorization: Bearer <JWT>.
 * Rate limit: 100 req/min на ключ (sliding_window).
 */

import { MacroHttp, type MacroHttpOptions } from './MacroHttp'

export interface ComplexStatsRoomBucket {
  minPrice: number
  maxPrice: number
  minArea: number
  maxArea: number
  countOnSale: number
}

export interface ComplexStatsCategory extends ComplexStatsRoomBucket {
  rooms?: Record<string, ComplexStatsRoomBucket>
}

export interface ComplexStatsRaw {
  id: number
  title?: string
  stats?: {
    categories?: Record<string, ComplexStatsCategory>
  }
}

/** Опции клиента статистики — те же, что у транспорта MacroHttp. */
export type MacroV2ClientOptions = MacroHttpOptions

export class MacroV2Client {
  private readonly http: MacroHttp

  constructor(opts: MacroV2ClientOptions) {
    this.http = new MacroHttp(opts)
  }

  /**
   * Получить статистику продаж по списку ЖК.
   * Если complexIds пустой массив — Macro вернёт всё (фильтр опционален по доке listStats).
   * Возвращаем массив "как есть" (нормализация id, защита от мусора).
   */
  async fetchComplexStats(complexIds: number[]): Promise<ComplexStatsRaw[]> {
    const url = '/estateComplexes/listStats'
    const body: Record<string, unknown> = {}
    if (Array.isArray(complexIds) && complexIds.length > 0) {
      body.complexIds = complexIds
    }

    const json = await this.http.post<{ data?: any[] }>(url, body)
    const items = Array.isArray(json?.data) ? json.data : []
    const out: ComplexStatsRaw[] = []
    for (const raw of items) {
      const id = Number(raw?.id)
      if (!Number.isFinite(id)) continue
      out.push({
        id,
        title: typeof raw.title === 'string' ? raw.title : undefined,
        stats: raw?.stats && typeof raw.stats === 'object' ? raw.stats : undefined,
      })
    }
    return out
  }

}
