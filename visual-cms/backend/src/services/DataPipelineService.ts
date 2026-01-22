/**
 * DataPipelineService
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 5: Mixed Data & Advanced Features
 * 
 * Сервис для последовательной обработки данных:
 * - Sequential steps (Fetch → Transform → Join → Compute)
 * - Caching intermediate results
 * - Error handling & recovery
 */

import { dataJoinService, DataSourceJoinConfig, JoinResult } from './DataJoinService'
import { dataTransformService, ComputedFieldConfig, ConditionalFieldConfig } from './DataTransformService'
import { dataFilterService } from './DataFilterService'
import { secureDataSourceService, FetchConfig } from './SecureDataSourceService'
import type { FilterConfig, SortConfig, FieldMapping } from '../models/DataBinding'

// ==================== TYPES ====================

export type PipelineStepType = 
  | 'fetch'       // Загрузка данных из источника
  | 'transform'   // Трансформация/маппинг
  | 'filter'      // Фильтрация
  | 'sort'        // Сортировка
  | 'join'        // Объединение с другим источником
  | 'compute'     // Вычисляемые поля
  | 'conditional' // Условная логика
  | 'aggregate'   // Агрегация
  | 'paginate'    // Пагинация
  | 'custom'      // Кастомный шаг

export interface PipelineStep {
  id: string
  type: PipelineStepType
  name?: string
  enabled?: boolean
  config: PipelineStepConfig
  cacheResult?: boolean
  cacheTTL?: number  // секунды
  onError?: 'stop' | 'skip' | 'fallback'
  fallbackValue?: unknown
}

export type PipelineStepConfig = 
  | FetchStepConfig
  | TransformStepConfig
  | FilterStepConfig
  | SortStepConfig
  | JoinStepConfig
  | ComputeStepConfig
  | ConditionalStepConfig
  | AggregateStepConfig
  | PaginateStepConfig
  | CustomStepConfig

export interface FetchStepConfig {
  type: 'fetch'
  fetchConfig: FetchConfig  // Используем FetchConfig из SecureDataSourceService
  params?: Record<string, unknown>
  headers?: Record<string, string>
}

export interface TransformStepConfig {
  type: 'transform'
  mappings: FieldMapping[]
}

export interface FilterStepConfig {
  type: 'filter'
  filters: FilterConfig[]
}

export interface SortStepConfig {
  type: 'sort'
  sorting: SortConfig[]
}

export interface JoinStepConfig {
  type: 'join'
  fetchConfig?: FetchConfig   // Или загружаем из источника
  data?: unknown[]            // Или используем inline данные
  joinConfig: Omit<DataSourceJoinConfig, 'data'>
}

export interface ComputeStepConfig {
  type: 'compute'
  fields: ComputedFieldConfig[]
}

export interface ConditionalStepConfig {
  type: 'conditional'
  fields: ConditionalFieldConfig[]
}

export interface AggregateStepConfig {
  type: 'aggregate'
  groupBy?: string[]
  aggregations: Array<{
    field: string
    operation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'first' | 'last' | 'concat'
    outputField: string
  }>
}

export interface PaginateStepConfig {
  type: 'paginate'
  page: number
  pageSize: number
  includeTotal?: boolean
}

export interface CustomStepConfig {
  type: 'custom'
  handler: string  // Имя зарегистрированного handler'а
  params?: Record<string, unknown>
}

// ==================== PIPELINE RESULT ====================

export interface PipelineStepResult {
  stepId: string
  stepType: PipelineStepType
  success: boolean
  data: unknown[]
  error?: string
  durationMs: number
  cached?: boolean
  stats?: Record<string, unknown>
}

export interface PipelineResult {
  success: boolean
  data: unknown[]
  steps: PipelineStepResult[]
  totalDurationMs: number
  fromCache?: boolean
  error?: string
}

// ==================== PIPELINE CONTEXT ====================

export interface PipelineContext {
  variables: Record<string, unknown>
  pageData: Record<string, unknown>
  dataSources: Record<string, unknown[]>
  stepResults: Record<string, unknown[]>  // Результаты предыдущих шагов по id
}

// ==================== SERVICE ====================

class DataPipelineService {
  private cache = new Map<string, { data: unknown[]; expiresAt: number }>()
  private customHandlers = new Map<string, (data: unknown[], params: Record<string, unknown>, context: PipelineContext) => Promise<unknown[]>>()

  /**
   * Выполнить pipeline
   */
  async executePipeline(
    steps: PipelineStep[],
    initialData: unknown[] = [],
    context: Partial<PipelineContext> = {}
  ): Promise<PipelineResult> {
    const startTime = Date.now()
    const stepResults: PipelineStepResult[] = []
    const fullContext: PipelineContext = {
      variables: context.variables || {},
      pageData: context.pageData || {},
      dataSources: context.dataSources || {},
      stepResults: {},
    }

    let currentData = initialData

    for (const step of steps) {
      if (step.enabled === false) continue

      const stepStartTime = Date.now()
      let stepResult: PipelineStepResult

      try {
        // Проверяем кэш
        const cacheKey = step.cacheResult ? this.getCacheKey(step, currentData) : null
        const cachedResult = cacheKey ? this.getFromCache(cacheKey) : null

        if (cachedResult) {
          stepResult = {
            stepId: step.id,
            stepType: step.type,
            success: true,
            data: cachedResult,
            durationMs: Date.now() - stepStartTime,
            cached: true,
          }
          currentData = cachedResult
        } else {
          // Выполняем шаг
          const result = await this.executeStep(step, currentData, fullContext)
          currentData = result.data

          // Кэшируем если нужно
          if (cacheKey && step.cacheTTL) {
            this.setCache(cacheKey, currentData, step.cacheTTL)
          }

          stepResult = {
            stepId: step.id,
            stepType: step.type,
            success: true,
            data: currentData,
            durationMs: Date.now() - stepStartTime,
            stats: result.stats,
          }
        }

        // Сохраняем результат шага в контекст
        fullContext.stepResults[step.id] = currentData

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        stepResult = {
          stepId: step.id,
          stepType: step.type,
          success: false,
          data: [],
          error: errorMessage,
          durationMs: Date.now() - stepStartTime,
        }

        // Обработка ошибки
        if (step.onError === 'stop') {
          stepResults.push(stepResult)
          return {
            success: false,
            data: [],
            steps: stepResults,
            totalDurationMs: Date.now() - startTime,
            error: `Pipeline stopped at step "${step.id}": ${errorMessage}`,
          }
        } else if (step.onError === 'fallback' && step.fallbackValue !== undefined) {
          currentData = Array.isArray(step.fallbackValue) ? step.fallbackValue : [step.fallbackValue]
          stepResult.data = currentData
        }
        // 'skip' - просто продолжаем с предыдущими данными
      }

      stepResults.push(stepResult)
    }

    return {
      success: true,
      data: currentData,
      steps: stepResults,
      totalDurationMs: Date.now() - startTime,
    }
  }

  /**
   * Выполнить отдельный шаг
   */
  private async executeStep(
    step: PipelineStep,
    data: unknown[],
    context: PipelineContext
  ): Promise<{ data: unknown[]; stats?: Record<string, unknown> }> {
    const config = step.config

    switch (config.type) {
      case 'fetch':
        return this.executeFetchStep(config, context)

      case 'transform':
        return this.executeTransformStep(config, data, context)

      case 'filter':
        return this.executeFilterStep(config, data)

      case 'sort':
        return this.executeSortStep(config, data)

      case 'join':
        return this.executeJoinStep(config, data, context)

      case 'compute':
        return this.executeComputeStep(config, data, context)

      case 'conditional':
        return this.executeConditionalStep(config, data, context)

      case 'aggregate':
        return this.executeAggregateStep(config, data)

      case 'paginate':
        return this.executePaginateStep(config, data)

      case 'custom':
        return this.executeCustomStep(config, data, context)

      default:
        throw new Error(`Unknown step type: ${(config as { type: string }).type}`)
    }
  }

  // ==================== STEP IMPLEMENTATIONS ====================

  private async executeFetchStep(
    config: FetchStepConfig,
    context: PipelineContext
  ): Promise<{ data: unknown[]; stats?: Record<string, unknown> }> {
    const result = await secureDataSourceService.fetchData(config.fetchConfig)

    const data = Array.isArray(result.data) ? result.data : [result.data]
    
    // Сохраняем в dataSources для доступа из других шагов по URL или имени
    const sourceKey = config.fetchConfig.url || 'static'
    context.dataSources[sourceKey] = data

    return {
      data,
      stats: {
        fetchedCount: data.length,
        statusCode: result.metadata?.statusCode,
      }
    }
  }

  private executeTransformStep(
    config: TransformStepConfig,
    data: unknown[],
    context: PipelineContext
  ): { data: unknown[]; stats?: Record<string, unknown> } {
    const transformed = data.map((item, index) => {
      const result = dataTransformService.applyMapping(item, config.mappings, {
        index,
        items: data,
        variables: context.variables,
        pageData: context.pageData,
      })
      return { ...(item as object), ...result }
    })

    return { data: transformed }
  }

  private executeFilterStep(
    config: FilterStepConfig,
    data: unknown[]
  ): { data: unknown[]; stats?: Record<string, unknown> } {
    const filtered = dataFilterService.applyFilters(data, config.filters)
    return {
      data: filtered,
      stats: {
        beforeCount: data.length,
        afterCount: filtered.length,
        filteredOut: data.length - filtered.length,
      }
    }
  }

  private executeSortStep(
    config: SortStepConfig,
    data: unknown[]
  ): { data: unknown[]; stats?: Record<string, unknown> } {
    // applySorting возвращает отсортированный массив
    const sorted = dataFilterService.process(data, undefined, config.sorting)
    return { data: sorted.items }
  }

  private async executeJoinStep(
    config: JoinStepConfig,
    data: unknown[],
    context: PipelineContext
  ): Promise<{ data: unknown[]; stats?: Record<string, unknown> }> {
    let additionalData = config.data

    // Загружаем данные из источника если указан fetchConfig
    if (config.fetchConfig && !additionalData) {
      const sourceKey = config.fetchConfig.url || 'static'
      // Проверяем, загружены ли уже данные
      if (context.dataSources[sourceKey]) {
        additionalData = context.dataSources[sourceKey]
      } else {
        const fetchResult = await secureDataSourceService.fetchData(config.fetchConfig)
        additionalData = Array.isArray(fetchResult.data) ? fetchResult.data : [fetchResult.data]
        context.dataSources[sourceKey] = additionalData
      }
    }

    if (!additionalData) {
      throw new Error('Join step requires data or fetchConfig')
    }

    const joinResult: JoinResult = dataJoinService.joinDataSources(data, [{
      ...config.joinConfig,
      data: additionalData,
    }])

    return {
      data: joinResult.data,
      stats: joinResult.stats,
    }
  }

  private executeComputeStep(
    config: ComputeStepConfig,
    data: unknown[],
    context: PipelineContext
  ): { data: unknown[]; stats?: Record<string, unknown> } {
    const hasAsync = config.fields.some(f => f.isAsync)

    if (hasAsync) {
      // Для async полей возвращаем Promise
      // В реальном использовании нужно await
      throw new Error('Use executeComputeStepAsync for async computed fields')
    }

    const computed = dataTransformService.addComputedFields(data, config.fields, {
      variables: context.variables,
      pageData: context.pageData,
      dataSources: context.dataSources,
    })

    return {
      data: computed,
      stats: {
        fieldsAdded: config.fields.length,
      }
    }
  }

  private executeConditionalStep(
    config: ConditionalStepConfig,
    data: unknown[],
    context: PipelineContext
  ): { data: unknown[]; stats?: Record<string, unknown> } {
    const processed = dataTransformService.applyConditionalFields(data, config.fields, {
      variables: context.variables,
      pageData: context.pageData,
    })

    return {
      data: processed,
      stats: {
        conditionalFields: config.fields.length,
      }
    }
  }

  private executeAggregateStep(
    config: AggregateStepConfig,
    data: unknown[]
  ): { data: unknown[]; stats?: Record<string, unknown> } {
    if (config.groupBy && config.groupBy.length > 0) {
      // Группировка
      const groups = new Map<string, unknown[]>()

      for (const item of data) {
        const key = config.groupBy
          .map(field => String(this.getNestedValue(item, field)))
          .join('|')
        
        const group = groups.get(key) || []
        group.push(item)
        groups.set(key, group)
      }

      // Агрегация по группам
      const result: unknown[] = []
      
      for (const [, groupItems] of groups) {
        const aggregated: Record<string, unknown> = {}

        // Добавляем значения groupBy полей
        if (groupItems.length > 0) {
          for (const field of config.groupBy) {
            aggregated[field] = this.getNestedValue(groupItems[0], field)
          }
        }

        // Вычисляем агрегации
        for (const agg of config.aggregations) {
          aggregated[agg.outputField] = this.computeAggregation(
            groupItems.map(i => this.getNestedValue(i, agg.field)),
            agg.operation
          )
        }

        result.push(aggregated)
      }

      return {
        data: result,
        stats: {
          groupCount: groups.size,
          originalCount: data.length,
        }
      }
    } else {
      // Без группировки - агрегация всех данных
      const aggregated: Record<string, unknown> = {}

      for (const agg of config.aggregations) {
        aggregated[agg.outputField] = this.computeAggregation(
          data.map(i => this.getNestedValue(i, agg.field)),
          agg.operation
        )
      }

      return {
        data: [aggregated],
        stats: { originalCount: data.length }
      }
    }
  }

  private executePaginateStep(
    config: PaginateStepConfig,
    data: unknown[]
  ): { data: unknown[]; stats?: Record<string, unknown> } {
    const start = (config.page - 1) * config.pageSize
    const end = start + config.pageSize
    const paginated = data.slice(start, end)

    const stats: Record<string, unknown> = {
      page: config.page,
      pageSize: config.pageSize,
      itemsOnPage: paginated.length,
    }

    if (config.includeTotal) {
      stats.totalItems = data.length
      stats.totalPages = Math.ceil(data.length / config.pageSize)
    }

    return { data: paginated, stats }
  }

  private async executeCustomStep(
    config: CustomStepConfig,
    data: unknown[],
    context: PipelineContext
  ): Promise<{ data: unknown[]; stats?: Record<string, unknown> }> {
    const handler = this.customHandlers.get(config.handler)
    
    if (!handler) {
      throw new Error(`Custom handler "${config.handler}" not registered`)
    }

    const result = await handler(data, config.params || {}, context)
    return { data: result }
  }

  // ==================== HELPERS ====================

  private computeAggregation(values: unknown[], operation: AggregateStepConfig['aggregations'][0]['operation']): unknown {
    const numbers = values
      .filter(v => v !== null && v !== undefined)
      .map(v => Number(v))
      .filter(n => !isNaN(n))

    switch (operation) {
      case 'sum':
        return numbers.reduce((a, b) => a + b, 0)
      case 'avg':
        return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0
      case 'min':
        return numbers.length > 0 ? Math.min(...numbers) : null
      case 'max':
        return numbers.length > 0 ? Math.max(...numbers) : null
      case 'count':
        return values.filter(v => v !== null && v !== undefined).length
      case 'first':
        return values[0]
      case 'last':
        return values[values.length - 1]
      case 'concat':
        return values.filter(v => v !== null && v !== undefined)
      default:
        return null
    }
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined
    const keys = path.split('.')
    let current: unknown = obj
    for (const key of keys) {
      if (current === null || current === undefined) return undefined
      current = (current as Record<string, unknown>)[key]
    }
    return current
  }

  // ==================== CACHING ====================

  private getCacheKey(step: PipelineStep, data: unknown[]): string {
    return `${step.id}:${JSON.stringify(step.config)}:${data.length}`
  }

  private getFromCache(key: string): unknown[] | null {
    const cached = this.cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data
    }
    if (cached) {
      this.cache.delete(key)
    }
    return null
  }

  private setCache(key: string, data: unknown[], ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }

  /**
   * Очистить кэш
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Зарегистрировать custom handler
   */
  registerCustomHandler(
    name: string,
    handler: (data: unknown[], params: Record<string, unknown>, context: PipelineContext) => Promise<unknown[]>
  ): void {
    this.customHandlers.set(name, handler)
  }
}

export const dataPipelineService = new DataPipelineService()
export default dataPipelineService
