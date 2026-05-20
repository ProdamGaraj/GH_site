/**
 * DataJoinService
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 5: Mixed Data & Advanced Features
 * 
 * Сервис для объединения данных из нескольких источников:
 * - LEFT и INNER join
 * - Merge стратегии при конфликтах
 * - Data enrichment
 */

import { logger } from './Logger'

export type JoinType = 'left' | 'inner' | 'full' | 'cross'

export type MergeStrategy = 
  | 'primary_wins'      // При конфликте берём значение из primary
  | 'additional_wins'   // При конфликте берём значение из additional
  | 'concat'            // Объединяем в массив
  | 'merge_objects'     // Для объектов - глубокое слияние
  | 'custom'            // Кастомная функция

export interface JoinCondition {
  primaryField: string      // Поле в primary источнике
  additionalField: string   // Поле в additional источнике
  operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex'
}

export interface DataSourceJoinConfig {
  alias: string                   // Алиас для additional источника
  data: unknown[]                 // Данные additional источника
  joinType: JoinType              // Тип join
  conditions: JoinCondition[]     // Условия join (AND между ними)
  mergeStrategy?: MergeStrategy   // Стратегия слияния
  prefix?: string                 // Префикс для полей additional
}

export interface JoinResult {
  data: unknown[]
  stats: {
    primaryCount: number
    additionalCount: number
    matchedCount: number
    unmatchedCount: number
    joinType: JoinType
    processingTimeMs: number
  }
}

/**
 * Получить вложенное значение по пути
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  
  const keys = path.split('.')
  let current: unknown = obj
  
  for (const key of keys) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  
  return current
}

/**
 * Установить вложенное значение по пути
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.')
  let current = obj
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  
  current[keys[keys.length - 1]] = value
}

class DataJoinService {
  /**
   * Объединить primary данные с несколькими additional источниками
   */
  joinDataSources(
    primaryData: unknown[],
    additionalSources: DataSourceJoinConfig[]
  ): JoinResult {
    const startTime = Date.now()
    
    if (!Array.isArray(primaryData)) {
      return {
        data: [],
        stats: {
          primaryCount: 0,
          additionalCount: 0,
          matchedCount: 0,
          unmatchedCount: 0,
          joinType: 'left',
          processingTimeMs: Date.now() - startTime,
        }
      }
    }
    
    let result = [...primaryData]
    let totalMatched = 0
    let totalUnmatched = 0
    let totalAdditionalCount = 0
    let lastJoinType: JoinType = 'left'
    
    // Применяем join последовательно для каждого additional источника
    for (const source of additionalSources) {
      const joinResult = this.joinTwo(result, source)
      result = joinResult.data as unknown[]
      totalMatched += joinResult.stats.matchedCount
      totalUnmatched += joinResult.stats.unmatchedCount
      totalAdditionalCount += joinResult.stats.additionalCount
      lastJoinType = joinResult.stats.joinType
    }
    
    return {
      data: result,
      stats: {
        primaryCount: primaryData.length,
        additionalCount: totalAdditionalCount,
        matchedCount: totalMatched,
        unmatchedCount: totalUnmatched,
        joinType: lastJoinType,
        processingTimeMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Объединить два источника данных
   */
  private joinTwo(
    primaryData: unknown[],
    config: DataSourceJoinConfig
  ): JoinResult {
    const startTime = Date.now()
    const { data: additionalData, joinType, conditions, mergeStrategy = 'primary_wins', prefix, alias } = config
    
    if (!Array.isArray(additionalData)) {
      return {
        data: primaryData,
        stats: {
          primaryCount: primaryData.length,
          additionalCount: 0,
          matchedCount: 0,
          unmatchedCount: primaryData.length,
          joinType,
          processingTimeMs: Date.now() - startTime,
        }
      }
    }
    
    const result: unknown[] = []
    let matchedCount = 0
    const matchedAdditionalIndices = new Set<number>()
    
    // Для каждой записи primary ищем совпадения в additional
    for (const primaryRecord of primaryData) {
      const matches = this.findMatches(primaryRecord, additionalData, conditions)
      
      if (matches.length > 0) {
        matchedCount++
        matches.forEach(m => matchedAdditionalIndices.add(m.index))
        
        // Merge с первым совпадением (или всеми для concat стратегии)
        const merged = this.mergeRecords(
          primaryRecord as Record<string, unknown>,
          matches.map(m => m.record),
          mergeStrategy,
          prefix,
          alias
        )
        result.push(merged)
      } else {
        // LEFT и FULL join - включаем без match
        if (joinType === 'left' || joinType === 'full') {
          result.push(primaryRecord)
        }
        // INNER join - пропускаем
      }
    }
    
    // FULL join - добавляем unmatched из additional
    if (joinType === 'full') {
      additionalData.forEach((record, index) => {
        if (!matchedAdditionalIndices.has(index)) {
          const prefixed = this.prefixRecord(record as Record<string, unknown>, prefix, alias)
          result.push(prefixed)
        }
      })
    }
    
    // CROSS join - декартово произведение
    if (joinType === 'cross') {
      const crossResult: unknown[] = []
      for (const primary of primaryData) {
        for (const additional of additionalData) {
          const merged = this.mergeRecords(
            primary as Record<string, unknown>,
            [additional as Record<string, unknown>],
            mergeStrategy,
            prefix,
            alias
          )
          crossResult.push(merged)
        }
      }
      return {
        data: crossResult,
        stats: {
          primaryCount: primaryData.length,
          additionalCount: additionalData.length,
          matchedCount: primaryData.length * additionalData.length,
          unmatchedCount: 0,
          joinType,
          processingTimeMs: Date.now() - startTime,
        }
      }
    }
    
    return {
      data: result,
      stats: {
        primaryCount: primaryData.length,
        additionalCount: additionalData.length,
        matchedCount,
        unmatchedCount: primaryData.length - matchedCount,
        joinType,
        processingTimeMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Найти совпадающие записи по условиям
   */
  private findMatches(
    primaryRecord: unknown,
    additionalData: unknown[],
    conditions: JoinCondition[]
  ): Array<{ record: Record<string, unknown>; index: number }> {
    const matches: Array<{ record: Record<string, unknown>; index: number }> = []
    
    additionalData.forEach((additionalRecord, index) => {
      const allConditionsMet = conditions.every(condition => {
        const primaryValue = getNestedValue(primaryRecord, condition.primaryField)
        const additionalValue = getNestedValue(additionalRecord, condition.additionalField)
        
        return this.evaluateCondition(primaryValue, additionalValue, condition.operator || 'equals')
      })
      
      if (allConditionsMet) {
        matches.push({ record: additionalRecord as Record<string, unknown>, index })
      }
    })
    
    return matches
  }

  /**
   * Проверить условие
   */
  private evaluateCondition(
    primaryValue: unknown,
    additionalValue: unknown,
    operator: JoinCondition['operator']
  ): boolean {
    if (primaryValue === undefined || additionalValue === undefined) {
      return false
    }
    
    const pStr = String(primaryValue)
    const aStr = String(additionalValue)
    
    switch (operator) {
      case 'equals':
        return primaryValue === additionalValue || pStr === aStr
        
      case 'contains':
        return pStr.includes(aStr) || aStr.includes(pStr)
        
      case 'startsWith':
        return pStr.startsWith(aStr)
        
      case 'endsWith':
        return pStr.endsWith(aStr)
        
      case 'regex':
        try {
          return new RegExp(aStr).test(pStr)
        } catch {
          return false
        }
        
      default:
        return primaryValue === additionalValue
    }
  }

  /**
   * Объединить записи согласно стратегии
   */
  private mergeRecords(
    primary: Record<string, unknown>,
    additionals: Record<string, unknown>[],
    strategy: MergeStrategy,
    prefix?: string,
    alias?: string
  ): Record<string, unknown> {
    const result = { ...primary }
    
    for (const additional of additionals) {
      const prefixed = this.prefixRecord(additional, prefix, alias)
      
      for (const [key, value] of Object.entries(prefixed)) {
        if (key in result) {
          // Конфликт - применяем стратегию
          switch (strategy) {
            case 'primary_wins':
              // Оставляем значение из primary
              break
              
            case 'additional_wins':
              result[key] = value
              break
              
            case 'concat':
              const existing = result[key]
              if (Array.isArray(existing)) {
                result[key] = [...existing, value]
              } else {
                result[key] = [existing, value]
              }
              break
              
            case 'merge_objects':
              if (typeof result[key] === 'object' && typeof value === 'object' && 
                  result[key] !== null && value !== null &&
                  !Array.isArray(result[key]) && !Array.isArray(value)) {
                result[key] = { 
                  ...(result[key] as Record<string, unknown>), 
                  ...(value as Record<string, unknown>) 
                }
              } else {
                result[key] = value
              }
              break
              
            default:
              // По умолчанию primary wins
              break
          }
        } else {
          result[key] = value
        }
      }
    }
    
    return result
  }

  /**
   * Добавить префикс/алиас к полям записи
   */
  private prefixRecord(
    record: Record<string, unknown>,
    prefix?: string,
    alias?: string
  ): Record<string, unknown> {
    if (!prefix && !alias) return record

    // Explicit prefix -> flat keys (dept_name, dept_budget)
    if (prefix) {
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(record)) {
        result[`${prefix}${key}`] = value
      }
      return result
    }

    // Alias only -> nested object ({ department: { name, budget } })
    return { [alias!]: { ...record } }
  }

  /**
   * Enrich данные вычисляемыми полями
   */
  enrichData(
    data: unknown[],
    computedFields: Array<{
      name: string
      compute: (record: unknown, allData: unknown[], variables: Record<string, unknown>) => unknown
    }>,
    variables: Record<string, unknown> = {}
  ): unknown[] {
    return data.map(record => {
      const enriched = { ...(record as Record<string, unknown>) }
      
      for (const field of computedFields) {
        try {
          enriched[field.name] = field.compute(record, data, variables)
        } catch (error) {
          logger.error(`Error computing field "${field.name}"`, error as Error)
          enriched[field.name] = null
        }
      }
      
      return enriched
    })
  }

  /**
   * Async enrich - для полей требующих API вызовы
   */
  async enrichDataAsync(
    data: unknown[],
    computedFields: Array<{
      name: string
      compute: (record: unknown, allData: unknown[], variables: Record<string, unknown>) => Promise<unknown>
    }>,
    variables: Record<string, unknown> = {},
    concurrency: number = 5
  ): Promise<unknown[]> {
    const results: unknown[] = []
    
    // Обрабатываем батчами для контроля concurrency
    for (let i = 0; i < data.length; i += concurrency) {
      const batch = data.slice(i, i + concurrency)
      
      const batchResults = await Promise.all(
        batch.map(async (record) => {
          const enriched = { ...(record as Record<string, unknown>) }
          
          for (const field of computedFields) {
            try {
              enriched[field.name] = await field.compute(record, data, variables)
            } catch (error) {
              logger.error(`Error computing async field "${field.name}"`, error as Error)
              enriched[field.name] = null
            }
          }
          
          return enriched
        })
      )
      
      results.push(...batchResults)
    }
    
    return results
  }

  /**
   * Создать индекс для быстрого поиска
   */
  createIndex(
    data: unknown[],
    keyField: string
  ): Map<unknown, unknown[]> {
    const index = new Map<unknown, unknown[]>()
    
    for (const record of data) {
      const key = getNestedValue(record, keyField)
      if (key !== undefined) {
        const existing = index.get(key) || []
        existing.push(record)
        index.set(key, existing)
      }
    }
    
    return index
  }

  /**
   * Быстрый join с использованием индекса
   */
  joinWithIndex(
    primaryData: unknown[],
    additionalIndex: Map<unknown, unknown[]>,
    primaryKeyField: string,
    joinType: JoinType = 'left',
    mergeStrategy: MergeStrategy = 'primary_wins',
    prefix?: string,
    alias?: string
  ): JoinResult {
    const startTime = Date.now()
    const result: unknown[] = []
    let matchedCount = 0
    
    for (const primaryRecord of primaryData) {
      const key = getNestedValue(primaryRecord, primaryKeyField)
      const matches = key !== undefined ? additionalIndex.get(key) : undefined
      
      if (matches && matches.length > 0) {
        matchedCount++
        const merged = this.mergeRecords(
          primaryRecord as Record<string, unknown>,
          matches as Record<string, unknown>[],
          mergeStrategy,
          prefix,
          alias
        )
        result.push(merged)
      } else if (joinType === 'left' || joinType === 'full') {
        result.push(primaryRecord)
      }
    }
    
    return {
      data: result,
      stats: {
        primaryCount: primaryData.length,
        additionalCount: additionalIndex.size,
        matchedCount,
        unmatchedCount: primaryData.length - matchedCount,
        joinType,
        processingTimeMs: Date.now() - startTime,
      }
    }
  }
}

export const dataJoinService = new DataJoinService()
export default dataJoinService
