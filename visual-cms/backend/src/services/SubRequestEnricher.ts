/**
 * SubRequestEnricher — обогащение массива элементов под-запросами (цепочка).
 *
 * Используется привязками блоков: основной запрос привязки возвращает массив,
 * затем каждый элемент обогащается данными доп.источников (как в коллекциях):
 *  - mainExtract: извлечение значений из всего массива → {{extract.name}}
 *  - per-source: endpoint с плейсхолдерами {{item.field}} / {{extract.name}},
 *    arrayPath, extract (цепочка), join (по ключу), itemKey (куда прикрепить)
 *
 * Одинаковые по сигнатуре запросы (например, один батч listStats для всех элементов)
 * выполняются один раз — это даёт паттерн «1 запрос + локальный JOIN».
 */
import { AppDataSource } from '../config/database'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { secureDataSourceService, FetchConfig, AuthConfig, FetchResult } from './SecureDataSourceService'
import { CredentialsManager } from './CredentialsManager'
import { logger } from './Logger'

export interface SubRequestSourceDef {
  /** Ключ, под который прикрепляются данные к элементу: {{item.<itemKey>.*}}. */
  itemKey: string
  dataSourceId: string
  arrayPath?: string
  endpoint?: {
    path?: string
    method?: string
    headers?: Record<string, string>
    queryParams?: Record<string, string>
    body?: string
    bodyFormat?: string
  }
  /** dot-notation пути для извлечения значений → {{extract.name}} в следующих источниках. */
  extract?: Record<string, string>
  /** JOIN: если ответ массив — прикрепить элемент, где source[sourceField] === item[itemField]. */
  join?: { itemField: string; sourceField: string }
}

class SubRequestEnricher {
  private dsRepo = AppDataSource.getRepository(DataSourceEntity)

  private getNested(obj: any, path: string): any {
    if (!obj || !path) return undefined
    return path.split('.').reduce((cur, key) => (cur == null ? cur : cur[key]), obj)
  }

  /** Извлечение с поддержкой array-mapping: "data[].id" → [id1, id2, ...]. */
  private resolveExtractPath(obj: any, path: string): unknown {
    const m = path.match(/^([^[]*)\[\]\.?(.*)$/)
    if (m) {
      const [, arrPath, fieldPath] = m
      const arr = arrPath ? this.getNested(obj, arrPath) : obj
      if (!Array.isArray(arr)) return undefined
      return fieldPath ? arr.map(it => this.getNested(it, fieldPath)) : arr
    }
    return this.getNested(obj, path)
  }

  /** Подстановка {{item.field}} и {{extract.name}}. Объекты/массивы → JSON. */
  private resolvePlaceholders(template: string, item: any, extracted: Record<string, unknown>): string {
    return template.replace(/\{\{(item|extract)\.([^}]+)\}\}/g, (_, prefix, path) => {
      const val = prefix === 'extract' ? extracted[path] : this.getNested(item, path)
      if (val === undefined || val === null) return ''
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    })
  }

  private applyJoin(data: unknown, join: SubRequestSourceDef['join'], item: any): unknown {
    if (!join || !Array.isArray(data)) return data
    const itemVal = this.getNested(item, join.itemField)
    const match = data.find(el => String(this.getNested(el, join.sourceField)) === String(itemVal))
    return match ?? null
  }

  private async buildFetchConfig(
    source: SubRequestSourceDef,
    item: any,
    extracted: Record<string, unknown>,
    dsCache: Map<string, DataSourceEntity>,
    authCache: Map<string, AuthConfig | undefined>
  ): Promise<{ fetchConfig: FetchConfig; authConfig?: AuthConfig; signature: string }> {
    let ds = dsCache.get(source.dataSourceId)
    if (!ds) {
      const found = await this.dsRepo.findOne({ where: { id: source.dataSourceId } })
      if (!found) throw new Error(`DataSource not found: ${source.dataSourceId}`)
      ds = found
      dsCache.set(source.dataSourceId, ds)
    }

    let authConfig = authCache.get(source.dataSourceId)
    if (!authCache.has(source.dataSourceId)) {
      authConfig = ds.authConfig
        ? ((await CredentialsManager.decryptAuthConfig(ds.authConfig as Record<string, unknown>)) as unknown as AuthConfig)
        : undefined
      authCache.set(source.dataSourceId, authConfig)
    }

    const config = ds.config as any
    if (!config?.url) throw new Error(`DataSource has no URL: ${source.dataSourceId}`)

    const fetchConfig: FetchConfig = { type: ds.type as FetchConfig['type'], ...config }
    const ec = source.endpoint
    if (ec) {
      if (ec.path) {
        const resolvedPath = this.resolvePlaceholders(ec.path, item, extracted)
        const base = (config.url as string).replace(/\/+$/, '')
        const suffix = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`
        fetchConfig.url = `${base}${suffix}`
      }
      if (ec.method) fetchConfig.method = ec.method as FetchConfig['method']
      if (ec.headers) fetchConfig.headers = { ...(fetchConfig.headers || {}), ...ec.headers }
      if (ec.queryParams) {
        const resolved: Record<string, string> = {}
        for (const [k, v] of Object.entries(ec.queryParams)) resolved[k] = this.resolvePlaceholders(v, item, extracted)
        fetchConfig.queryParams = { ...(fetchConfig.queryParams || {}), ...resolved }
      }
      if (ec.body !== undefined) {
        const bodyStr = this.resolvePlaceholders(ec.body, item, extracted)
        if (ec.bodyFormat === 'raw') {
          fetchConfig.body = bodyStr
        } else {
          try { fetchConfig.body = JSON.parse(bodyStr) } catch { fetchConfig.body = bodyStr }
        }
        if (ec.bodyFormat) fetchConfig.bodyFormat = ec.bodyFormat as FetchConfig['bodyFormat']
      }
    }

    const signature = JSON.stringify({
      u: fetchConfig.url,
      m: fetchConfig.method || 'GET',
      b: fetchConfig.body ?? null,
      q: fetchConfig.queryParams ?? null,
    })
    return { fetchConfig, authConfig, signature }
  }

  /**
   * Обогащает массив элементов под-запросами. Мутирует элементы (прикрепляет itemKey).
   * Возвращает массив (тот же) и список уникальных ошибок.
   */
  async enrichItems(
    items: any[],
    sources: SubRequestSourceDef[] | undefined,
    mainExtract?: Record<string, string>
  ): Promise<{ items: any[]; errors: string[] }> {
    if (!Array.isArray(items) || items.length === 0 || !sources?.length) {
      return { items, errors: [] }
    }

    // Базовый extract из всего массива (mainExtract).
    const baseExtract: Record<string, unknown> = {}
    if (mainExtract) {
      for (const [name, path] of Object.entries(mainExtract)) {
        baseExtract[name] = this.resolveExtractPath(items, path)
      }
    }

    const dsCache = new Map<string, DataSourceEntity>()
    const authCache = new Map<string, AuthConfig | undefined>()
    const fetchCache = new Map<string, Promise<FetchResult>>()
    const errorSet = new Set<string>()

    for (const item of items) {
      const extracted: Record<string, unknown> = { ...baseExtract }
      for (const source of sources) {
        try {
          const { fetchConfig, authConfig, signature } = await this.buildFetchConfig(
            source, item, extracted, dsCache, authCache
          )
          let p = fetchCache.get(signature)
          if (!p) {
            p = secureDataSourceService.fetchData(fetchConfig, authConfig)
            fetchCache.set(signature, p)
          }
          const result = await p
          if (!result.success) throw new Error(result.error?.message || 'fetch failed')

          const data = source.arrayPath ? this.getNested(result.data, source.arrayPath) : result.data
          if (source.extract) {
            for (const [name, dotPath] of Object.entries(source.extract)) {
              extracted[name] = this.resolveExtractPath(data, dotPath)
            }
          }
          if (source.itemKey) (item as any)[source.itemKey] = this.applyJoin(data, source.join, item)
        } catch (err: any) {
          errorSet.add(`Sub-request "${source.itemKey}": ${err.message}`)
          if (source.itemKey) (item as any)[source.itemKey] = null
        }
      }
    }

    if (errorSet.size) logger.warn(`SubRequestEnricher: ${errorSet.size} sub-request error(s)`)
    return { items, errors: Array.from(errorSet) }
  }
}

export const subRequestEnricher = new SubRequestEnricher()
export default SubRequestEnricher
