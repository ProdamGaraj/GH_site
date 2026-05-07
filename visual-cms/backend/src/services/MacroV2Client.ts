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

export interface MacroV2ClientOptions {
  baseUrl: string
  token: string
  /** Таймаут одного HTTP-запроса в мс. По умолчанию 30 секунд. */
  timeoutMs?: number
  /** Кастомный fetch (для тестов). */
  fetchImpl?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 30000

export class MacroV2Client {
  private readonly baseUrl: string
  private readonly token: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(opts: MacroV2ClientOptions) {
    if (!opts.baseUrl) throw new Error('MacroV2Client: baseUrl is required')
    if (!opts.token) throw new Error('MacroV2Client: token is required')
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.token = opts.token
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  /**
   * Получить статистику продаж по списку ЖК.
   * Если complexIds пустой массив — Macro вернёт всё (фильтр опционален по доке listStats).
   * Возвращаем массив "как есть" (нормализация id, защита от мусора).
   */
  async fetchComplexStats(complexIds: number[]): Promise<ComplexStatsRaw[]> {
    const url = `${this.baseUrl}/estateComplexes/listStats`
    const body: Record<string, unknown> = {}
    if (Array.isArray(complexIds) && complexIds.length > 0) {
      body.complexIds = complexIds
    }

    const json = await this.postJson<{ data?: any[] }>(url, body)
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

  private async postJson<T>(url: string, body: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`MacroV2 ${res.status} ${res.statusText}: ${text.slice(0, 300)}`)
      }
      return (await res.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }
}
