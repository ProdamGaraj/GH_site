import crypto from 'crypto'
import { secureDataSourceService, FetchConfig, AuthConfig, FetchResult, RetryConfig } from './SecureDataSourceService'
import { cacheService } from './CacheService'

/**
 * Cached Data Source Service
 * 
 * Обёртка над SecureDataSourceService с кешированием сырых ответов от внешних API.
 * Кеш хранит raw data (до трансформаций), фильтрация/маппинг применяются при каждом запросе.
 * 
 * Особенности:
 * - Per-DataSource TTL через config.cacheTTL (0 = без кеша)
 * - Tag-based invalidation: 'ds-fetch:{dataSourceId}'
 * - Thundering herd protection: дедупликация параллельных запросов к одному ключу
 * - Ошибочные ответы (success: false) НЕ кешируются
 */

const CACHE_KEY_PREFIX = 'ds-fetch'
const DEFAULT_CACHE_TTL = parseInt(process.env.DATASOURCE_CACHE_TTL || '0', 10)

class CachedDataSourceService {
  // In-flight request deduplication map
  private inflightRequests: Map<string, Promise<FetchResult>> = new Map()

  /**
   * Получить данные с кешированием.
   * Если config.cacheTTL > 0 — используется кеш. Иначе — прямой запрос.
   */
  async fetchData(
    dataSourceId: string,
    config: FetchConfig,
    authConfig?: AuthConfig,
    retryConfig?: Partial<RetryConfig>
  ): Promise<FetchResult> {
    const cacheTTL = (config as any).cacheTTL ?? DEFAULT_CACHE_TTL

    // Кеширование отключено — прямой запрос
    if (!cacheTTL || cacheTTL <= 0) {
      return secureDataSourceService.fetchData(config, authConfig, retryConfig)
    }

    const cacheKey = this.buildCacheKey(dataSourceId, config)

    // Проверяем кеш
    const cached = await cacheService.get<FetchResult>(cacheKey)
    if (cached !== null) {
      return {
        ...cached,
        metadata: {
          ...cached.metadata!,
          responseTime: 0,
          headers: { ...cached.metadata!.headers, 'x-cache': 'HIT' }
        }
      }
    }

    // Thundering herd protection: если запрос уже в полёте — ждём его
    const inflight = this.inflightRequests.get(cacheKey)
    if (inflight) {
      return inflight
    }

    // Создаём запрос и регистрируем его
    const fetchPromise = this.fetchAndCache(cacheKey, dataSourceId, config, authConfig, retryConfig, cacheTTL)
    this.inflightRequests.set(cacheKey, fetchPromise)

    try {
      return await fetchPromise
    } finally {
      this.inflightRequests.delete(cacheKey)
    }
  }

  /**
   * Выполнить запрос и закешировать успешный результат
   */
  private async fetchAndCache(
    cacheKey: string,
    dataSourceId: string,
    config: FetchConfig,
    authConfig: AuthConfig | undefined,
    retryConfig: Partial<RetryConfig> | undefined,
    cacheTTL: number
  ): Promise<FetchResult> {
    const result = await secureDataSourceService.fetchData(config, authConfig, retryConfig)

    // Кешируем только успешные ответы
    if (result.success) {
      await cacheService.set(cacheKey, result, {
        ttl: cacheTTL,
        tags: [CACHE_KEY_PREFIX, `${CACHE_KEY_PREFIX}:${dataSourceId}`]
      })
    }

    return result
  }

  /**
   * Инвалидировать кеш для конкретного DataSource
   */
  async invalidateCache(dataSourceId: string): Promise<number> {
    return cacheService.invalidateByTag(`${CACHE_KEY_PREFIX}:${dataSourceId}`)
  }

  /**
   * Инвалидировать весь кеш fetch-данных
   */
  async invalidateAll(): Promise<number> {
    return cacheService.invalidateByTag(CACHE_KEY_PREFIX)
  }

  /**
   * Построить уникальный cache key на основе DS ID + параметров запроса
   */
  private buildCacheKey(dataSourceId: string, config: FetchConfig): string {
    const significant = {
      url: config.url,
      method: config.method,
      queryParams: config.queryParams,
      body: config.body,
      query: config.query,
      variables: config.variables,
    }

    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(significant))
      .digest('hex')
      .substring(0, 12)

    return `${CACHE_KEY_PREFIX}:${dataSourceId}:${hash}`
  }
}

export const cachedDataSourceService = new CachedDataSourceService()
export default CachedDataSourceService
