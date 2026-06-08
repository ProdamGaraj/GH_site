/**
 * Серверный планировщик обновления feed-источников.
 *
 * Раз в минуту (node-cron) проверяет активные feed-источники с включённым
 * polling и проактивно обновляет их TTL-кэш, если истёк pollingInterval. Это
 * дополняет клиентский авто-refresh: данные «прогреваются» на сервере, и первый
 * посетитель получает свежий кэш без ожидания запроса к внешнему API.
 *
 * Гранулярность тика — 1 минута (pollingInterval < 60s сервер не различает;
 * для суб-минутной свежести используется клиентский polling).
 *
 * Состояние переживает рестарты: due-проверка опирается на lastFetchAt в БД.
 * Отключается переменной FEED_POLLING_ENABLED=false.
 */

import { AppDataSource } from '../config/database'
import { DataSource } from '../models/DataSource'
import { cachedDataSourceService } from './CachedDataSourceService'
import { CredentialsManager } from './CredentialsManager'
import { FetchConfig, AuthConfig } from './SecureDataSourceService'
import { logger } from './Logger'

/**
 * Пора ли обновлять источник: прошёл ли pollingInterval с lastFetchAt.
 * Чистая функция — тестируется без БД/таймеров.
 */
export function isFeedDue(
  lastFetchAt: Date | string | null | undefined,
  intervalSec: number | null | undefined,
  now: number
): boolean {
  if (!intervalSec || intervalSec <= 0) return false
  if (!lastFetchAt) return true
  const last = lastFetchAt instanceof Date ? lastFetchAt.getTime() : new Date(lastFetchAt).getTime()
  if (Number.isNaN(last)) return true
  return now - last >= intervalSec * 1000
}

export class FeedPollingScheduler {
  private task: { stop: () => void } | null = null
  private running = false

  /**
   * Запускает cron-задачу (раз в минуту). Идемпотентно; уважает
   * FEED_POLLING_ENABLED=false (и не стартует в тестах).
   */
  start(): void {
    if (this.task) return
    if (process.env.FEED_POLLING_ENABLED === 'false') {
      logger.info('Feed polling scheduler disabled via FEED_POLLING_ENABLED=false')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cron = require('node-cron')
    this.task = cron.schedule('* * * * *', () => {
      this.tick().catch((e: any) => logger.warn('Feed polling tick failed', { message: e?.message }))
    })
    logger.info('Feed polling scheduler started (every minute)')
  }

  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
    }
  }

  /**
   * Один проход: находит due-источники и обновляет их кэш.
   * Не накладывается сам на себя (guard running).
   */
  async tick(now: number = Date.now()): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      const repo = AppDataSource.getRepository(DataSource)
      const feeds = await repo.find({ where: { type: 'feed', pollingEnabled: true, status: 'active' } })
      for (const ds of feeds) {
        const interval = ds.pollingInterval ?? (ds.config as Record<string, unknown>)?.pollingInterval as number | undefined
        if (!isFeedDue(ds.lastFetchAt, interval, now)) continue
        await this.refreshSource(ds)
      }
    } finally {
      this.running = false
    }
  }

  /**
   * Инвалидирует и заново наполняет кэш одного источника, фиксирует lastFetch*.
   */
  async refreshSource(ds: DataSource): Promise<void> {
    try {
      let authConfig: AuthConfig | undefined
      if (ds.authConfig) {
        authConfig = (await CredentialsManager.decryptAuthConfig(ds.authConfig)) as unknown as AuthConfig
      }
      const config = { type: ds.type, ...(ds.config as Record<string, unknown>) } as unknown as FetchConfig

      await cachedDataSourceService.invalidateCache(ds.id)
      const result = await cachedDataSourceService.fetchData(ds.id, config, authConfig)

      const repo = AppDataSource.getRepository(DataSource)
      ds.lastFetchAt = new Date()
      ds.lastFetchStatus = result.success ? 'success' : 'error'
      ds.lastFetchError = result.success ? undefined : result.error?.message
      await repo.save(ds)
      logger.debug('Feed source refreshed', { id: ds.id, success: result.success })
    } catch (e: any) {
      logger.warn('Feed source refresh failed', { id: ds.id, message: e?.message })
    }
  }
}

export const feedPollingScheduler = new FeedPollingScheduler()
export default FeedPollingScheduler
