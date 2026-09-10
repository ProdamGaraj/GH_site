/**
 * Транспорт к MacroCRM API v2.
 *
 * Все методы API — POST, даже читающие. Авторизация — Bearer JWT; заголовок
 * AppId нужен только старым ключам, у новых он зашит внутрь ключа. Ответ всегда
 * { data, meta }, где meta.next — курсор следующей страницы или null.
 *
 * Лимит на ключ — 100 запросов в минуту (sliding window). Синк планировок
 * обходит сотни квартир подряд, поэтому темп держится здесь, а не в каждом
 * вызывающем: иначе первый же забывчивый цикл упрётся в 429 на середине.
 *
 * Транспорт выделен отдельно, потому что клиентов к Macro у нас два —
 * статистика ЖК и объекты продажи. Второй экземпляр авторизации, пауз и
 * ретраев, написанный по месту, разошёлся бы с первым молча.
 */

import { insecureFetch } from './macroInsecureFetch'

export interface MacroHttpOptions {
  baseUrl: string
  token: string
  /**
   * Заголовок AppId.
   *
   * Ключам нового формата не нужен — AppId зашит внутрь самого ключа. Пустое
   * значение означает «не слать заголовок вовсе», а не «слать пустым».
   */
  appId?: string
  /** Таймаут одного HTTP-запроса, мс. По умолчанию 30 секунд. */
  timeoutMs?: number
  /**
   * Минимальный промежуток между запросами, мс. По умолчанию 667 — это
   * 90 запросов в минуту при лимите 100, с запасом на параллельных клиентов.
   */
  minIntervalMs?: number
  /** Сколько раз повторять 429 и 5xx. По умолчанию 4 повтора. */
  maxRetries?: number
  /** Стартовая пауза перед повтором, мс. Дальше удваивается. */
  retryBackoffMs?: number
  fetchImpl?: typeof fetch
  /**
   * Не проверять TLS-сертификат Macro.
   *
   * Заплатка: сертификат api.macrocrm.gh.uz истёк 25.09.2025. Отключение
   * касается только запросов этого клиента — см. macroInsecureFetch. Явный
   * fetchImpl (тесты) имеет приоритет и флагом не подменяется.
   */
  allowExpiredCertificate?: boolean
  /** Подменяется в тестах, чтобы не ждать по-настоящему. */
  sleepImpl?: (ms: number) => Promise<void>
  /** Подменяется в тестах вместе со sleepImpl, иначе паузы не отсчитываются. */
  nowImpl?: () => number
}

/** Стандартная обёртка ответа Macro. */
export interface MacroEnvelope<T> {
  data?: T
  meta?: { next?: number | null } | null
}

const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_MIN_INTERVAL_MS = 667
const DEFAULT_MAX_RETRIES = 4
const DEFAULT_RETRY_BACKOFF_MS = 5000

export class MacroHttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string
  ) {
    super(`MacroCRM ${status} ${path}: ${body.slice(0, 300)}`)
    this.name = 'MacroHttpError'
  }
}

export class MacroHttp {
  private readonly baseUrl: string
  private readonly token: string
  private readonly appId: string
  private readonly timeoutMs: number
  private readonly minIntervalMs: number
  private readonly maxRetries: number
  private readonly retryBackoffMs: number
  private readonly fetchImpl: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly now: () => number

  /** Сколько запросов ушло в API. Журнал синка пишет это число. */
  private requestCount = 0
  private lastCallAt = 0
  /**
   * Очередь пауз: без неё два параллельных вызова посчитают промежуток от
   * одного и того же lastCallAt и уйдут в API одновременно.
   */
  private pacing: Promise<void> = Promise.resolve()

  constructor(opts: MacroHttpOptions) {
    if (!opts.baseUrl) throw new Error('MacroHttp: нужен baseUrl')
    if (!opts.token) throw new Error('MacroHttp: нужен token')
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.token = opts.token
    this.appId = opts.appId ?? ''
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.minIntervalMs = opts.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES
    this.retryBackoffMs = opts.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS
    this.fetchImpl =
      opts.fetchImpl ?? (opts.allowExpiredCertificate ? insecureFetch : fetch)
    this.sleep = opts.sleepImpl ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.now = opts.nowImpl ?? Date.now
  }

  get calls(): number {
    return this.requestCount
  }

  /** POST с соблюдением темпа и повторами. */
  async post<T>(path: string, body: unknown): Promise<T> {
    await this.waitForSlot()
    return this.attempt<T>(path, body, 0)
  }

  /**
   * Проходит курсорную пагинацию до конца.
   *
   * `startFrom` позволяет продолжить прерванный обход, не начиная заново:
   * повторный проход по уже прочитанным страницам съедает лимит дважды.
   */
  async postAll<T>(
    path: string,
    body: Record<string, unknown>,
    startFrom?: number | null
  ): Promise<T[]> {
    const out: T[] = []
    let from = startFrom ?? undefined
    // Курсор Macro — id последней записи, он строго растёт. Если API вернёт
    // тот же курсор, цикл станет бесконечным — сторожим это явно.
    const seen = new Set<number>()

    for (;;) {
      const payload = from === undefined ? body : { ...body, from }
      const json = await this.post<MacroEnvelope<T[]>>(path, payload)
      if (Array.isArray(json?.data)) out.push(...json.data)

      const next = json?.meta?.next
      if (next === null || next === undefined) break
      if (seen.has(next)) {
        throw new Error(`MacroHttp: курсор ${next} повторился на ${path} — обход зациклился`)
      }
      seen.add(next)
      from = next
    }

    return out
  }

  /**
   * Ставит вызов в очередь и ждёт своей очереди.
   *
   * Промежуток отсчитывается от момента, когда предыдущий запрос был отпущен,
   * а не когда он завершился: лимит считает отправленные запросы.
   */
  private waitForSlot(): Promise<void> {
    const slot = this.pacing.then(async () => {
      const elapsed = this.now() - this.lastCallAt
      const wait = this.minIntervalMs - elapsed
      if (wait > 0) await this.sleep(wait)
      this.lastCallAt = this.now()
    })
    // Ошибка одного вызова не должна ломать очередь для следующих.
    this.pacing = slot.catch(() => undefined)
    return slot
  }

  private async attempt<T>(path: string, body: unknown, retry: number): Promise<T> {
    const url = this.baseUrl + path
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    this.requestCount++

    let res: Response
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
      if (this.appId) headers['AppId'] = this.appId

      res = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    // 429 и 5xx — временные: ждём и повторяем. Остальные 4xx означают ошибку
    // в самом запросе, и повтор даст ровно тот же ответ.
    if (res.status === 429 || res.status >= 500) {
      if (retry >= this.maxRetries) {
        const text = await res.text().catch(() => '')
        throw new MacroHttpError(res.status, path, text)
      }
      await this.sleep(this.retryBackoffMs * Math.pow(2, retry))
      await this.waitForSlot()
      return this.attempt<T>(path, body, retry + 1)
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new MacroHttpError(res.status, path, text)
    }

    return (await res.json()) as T
  }
}
