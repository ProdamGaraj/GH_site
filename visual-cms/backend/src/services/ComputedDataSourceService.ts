/**
 * ComputedDataSourceService — источник типа 'computed': объединяет/обогащает
 * результаты НЕСКОЛЬКИХ других источников на сервере.
 *
 * Безопасность: НЕ исполняет произвольный JS (после B1 vm-путь закрыт). Комбинация
 * описывается декларативным конфигом:
 *   mode 'concat' — конкатенация массивов всех источников;
 *   mode 'merge'  — JOIN: базовый массив обогащается полями из остальных по ключу.
 *
 * Защита: ограничение глубины вложенности (computed → computed) и детект циклов.
 */

import { AppDataSource } from '../config/database'
import { DataSource } from '../models/DataSource'
import { cachedDataSourceService } from './CachedDataSourceService'
import { CredentialsManager } from './CredentialsManager'
import { FetchConfig, AuthConfig, FetchResult } from './SecureDataSourceService'
import { logger } from './Logger'

const MAX_DEPTH = 3

export interface ComputedSourceRef {
  sourceId: string
  arrayPath?: string
}

export interface ComputedConfig {
  sources: ComputedSourceRef[]
  mode?: 'concat' | 'merge'
  joinKey?: { local: string; foreign: string }
}

/** Достать значение по dot-пути (a.b.c). */
function getByPath(obj: unknown, path?: string): unknown {
  if (!path) return obj
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/**
 * Нормализует ответ источника в массив записей (с учётом arrayPath и типовых
 * обёрток { data: [...] } / { items: [...] }).
 */
export function extractComputedArray(data: unknown, arrayPath?: string): unknown[] {
  const picked = arrayPath ? getByPath(data, arrayPath) : data
  if (Array.isArray(picked)) return picked
  if (picked && typeof picked === 'object') {
    const obj = picked as Record<string, unknown>
    if (Array.isArray(obj.data)) return obj.data
    if (Array.isArray(obj.items)) return obj.items
    return [picked]
  }
  if (picked === undefined || picked === null) return []
  return [picked]
}

/**
 * Объединяет массивы источников. Чистая функция (тестируется без БД).
 *  - 'concat' — все записи подряд.
 *  - 'merge'  — базовый массив (первый) обогащается полями совпавших записей из
 *    остальных по joinKey (поля базы при конфликте побеждают).
 */
export function combineSources(
  arrays: unknown[][],
  mode: 'concat' | 'merge' = 'concat',
  joinKey?: { local: string; foreign: string }
): unknown[] {
  if (arrays.length === 0) return []
  if (mode === 'merge' && joinKey) {
    let result = (arrays[0] || []).map(it => (it && typeof it === 'object' ? { ...(it as object) } : it))
    for (let k = 1; k < arrays.length; k++) {
      const map = new Map<string, Record<string, unknown>>()
      for (const o of arrays[k]) {
        if (o && typeof o === 'object') {
          map.set(String(getByPath(o, joinKey.foreign)), o as Record<string, unknown>)
        }
      }
      result = result.map(item => {
        if (!item || typeof item !== 'object') return item
        const match = map.get(String(getByPath(item, joinKey.local)))
        if (!match) return item
        // foreign-ключ — служебный артефакт join, в вывод его не тянем
        const { [joinKey.foreign]: _omitForeignKey, ...foreignFields } = match
        return { ...foreignFields, ...(item as object) }
      })
    }
    return result
  }
  // concat (по умолчанию)
  return ([] as unknown[]).concat(...arrays)
}

class ComputedDataSourceService {
  async resolve(
    config: ComputedConfig,
    visited: Set<string> = new Set(),
    depth = 0
  ): Promise<FetchResult> {
    const startTime = Date.now()
    try {
      if (depth > MAX_DEPTH) {
        throw new Error(`Слишком глубокая вложенность computed (>${MAX_DEPTH})`)
      }
      const sources = Array.isArray(config.sources) ? config.sources : []
      if (sources.length === 0) {
        throw new Error('Computed-источник не содержит sources')
      }

      const repo = AppDataSource.getRepository(DataSource)
      const arrays: unknown[][] = []

      for (const src of sources) {
        if (!src?.sourceId) continue
        if (visited.has(src.sourceId)) {
          throw new Error(`Обнаружен цикл computed-источников: ${src.sourceId}`)
        }
        const entity = await repo.findOne({ where: { id: src.sourceId } })
        if (!entity) {
          throw new Error(`Источник не найден: ${src.sourceId}`)
        }

        let data: unknown
        if (entity.type === 'computed') {
          const sub = await this.resolve(
            entity.config as unknown as ComputedConfig,
            new Set([...visited, src.sourceId]),
            depth + 1
          )
          if (!sub.success) return sub
          data = sub.data
        } else {
          let authConfig: AuthConfig | undefined
          if (entity.authConfig) {
            authConfig = (await CredentialsManager.decryptAuthConfig(entity.authConfig)) as unknown as AuthConfig
          }
          const fetchConfig = { type: entity.type, ...(entity.config as Record<string, unknown>) } as unknown as FetchConfig
          const res = await cachedDataSourceService.fetchData(entity.id, fetchConfig, authConfig)
          if (!res.success) return res
          data = res.data
        }
        arrays.push(extractComputedArray(data, src.arrayPath))
      }

      const combined = combineSources(arrays, config.mode || 'concat', config.joinKey)
      return {
        success: true,
        data: combined,
        metadata: {
          statusCode: 200,
          headers: { 'x-data-source-type': 'computed', 'x-computed-count': String(combined.length) },
          responseTime: Date.now() - startTime,
        },
      }
    } catch (error: any) {
      logger.warn('Computed source resolve failed', { message: error?.message })
      return {
        success: false,
        error: { code: 'COMPUTED_ERROR', message: error?.message || 'Computed source failed' },
        metadata: { statusCode: 0, headers: {}, responseTime: Date.now() - startTime },
      }
    }
  }
}

export const computedDataSourceService = new ComputedDataSourceService()
export default ComputedDataSourceService
