/**
 * Клиент админ-API estate-service со стороны CMS.
 *
 * Синк живёт здесь, а данные — там, поэтому общение идёт по HTTP под
 * X-Estate-Token. Три метода: список проектов (чтобы узнать, у каких заведён
 * внешний id дома), состояние дома (кого уже опрашивали) и приём выгрузки.
 *
 * Выгрузка уходит ОДНИМ запросом на дом. Поштучное админ-API дало бы 339
 * запросов и полусостояние базы при обрыве на середине.
 */

export interface EstateComplexSummary {
  slug: string
  name: string
  externalHouseId: number | null
}

/** Что estate-service уже знает о квартире дома. */
export interface KnownApartment {
  externalId: number
  dateModified: string | null
  probedAt: string | null
}

export interface SyncHousePayload {
  externalHouseId: number
  house: { name: string; floorsCount: number | null; address: string }
  planTypes: unknown[]
  apartments: unknown[]
}

export interface SyncHouseResult {
  apartmentsCreated: number
  apartmentsUpdated: number
  apartmentsGone: number
  planTypesCreated: number
  planTypesUpdated: number
  planTypesEmpty: number
}

export interface EstateSyncApiOptions {
  /** Базовый адрес estate-service, например http://estate-service:3100 */
  baseUrl: string
  /** Значение X-Estate-Token. */
  token: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 60000

export class EstateSyncApiError extends Error {
  constructor(readonly status: number, readonly path: string, body: string) {
    super(`estate-service ${status} ${path}: ${body.slice(0, 300)}`)
    this.name = 'EstateSyncApiError'
  }
}

export class EstateSyncApi {
  private readonly baseUrl: string
  private readonly token: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(opts: EstateSyncApiOptions) {
    if (!opts.baseUrl) throw new Error('EstateSyncApi: нужен baseUrl')
    if (!opts.token) throw new Error('EstateSyncApi: нужен token')
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.token = opts.token
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  /** Проекты с заведённым внешним id дома — только их и синхронизируем. */
  async listSyncableComplexes(): Promise<EstateComplexSummary[]> {
    const json = await this.request<any>('GET', '/api/complexes')
    const items: any[] = Array.isArray(json) ? json : json?.items ?? json?.data ?? []
    return items
      .map((item) => ({
        slug: String(item?.slug ?? ''),
        name: String(item?.name ?? ''),
        externalHouseId:
          typeof item?.externalHouseId === 'number' ? item.externalHouseId : null,
      }))
      .filter((item) => item.slug !== '' && item.externalHouseId !== null)
  }

  async getHouseState(externalHouseId: number): Promise<KnownApartment[]> {
    const json = await this.request<{ known?: KnownApartment[] }>(
      'GET',
      `/api/admin/sync/house/${externalHouseId}/state`
    )
    return Array.isArray(json?.known) ? json.known : []
  }

  async syncHouse(payload: SyncHousePayload): Promise<SyncHouseResult> {
    return this.request<SyncHouseResult>('POST', '/api/admin/sync/house', payload)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers: {
          'X-Estate-Token': this.token,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new EstateSyncApiError(res.status, path, text)
      }
      return (await res.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }
}
