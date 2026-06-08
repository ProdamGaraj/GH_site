/**
 * Data Transform Service
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 2.1 Backend: Data Fetching Service
 * Этап 5: Mixed Data & Advanced Features - Computed Fields
 * 
 * Сервис для трансформации данных, маппинга полей и вычисляемых значений.
 */

import { dataFilterService } from './DataFilterService'
import { logger } from './Logger'
import { evaluateSafeExpression } from './safeExpression'
import type { FieldMapping, ComputedField, ConditionalMapping, FilterOperator } from '../models/DataBinding'

// Типы
export interface TransformContext {
  item: unknown
  index?: number
  items?: unknown[]
  variables?: Record<string, unknown>
  pageData?: Record<string, unknown>
  dataSources?: Record<string, unknown[]>  // Доступ к другим источникам данных
}

export interface MappingResult {
  [targetProperty: string]: unknown
}

export interface ComputedFieldConfig {
  name: string
  expression: string  // JavaScript выражение
  isAsync?: boolean   // Требует async выполнение
  dependencies?: string[]  // Зависимости от других полей/источников
  cacheKey?: string   // Ключ для кэширования результата
}

export interface ConditionalFieldConfig {
  field: string
  conditions: Array<{
    when: {
      field: string
      operator: FilterOperator
      value: unknown
    }
    then: unknown | { field: string }
  }>
  else?: unknown | { field: string }
}

/**
 * Нормализовать произвольное значение в массив для операторов in/notIn.
 *
 * Поддерживает:
 * - массив → как есть
 * - строка JSON-массива "[1,2,3]" или "[\"a\",\"b\"]" → парсим
 * - строка с разделителями "1, 2, 3" → split по запятой/точке-с-запятой/новой строке + trim
 * - одиночное значение → [value]
 * - null/undefined → []
 *
 * Backward compatibility: старые сохранённые трансформации с value=строкой
 * (баг #1) продолжат работать.
 */
export function normalizeToList(value: unknown): unknown[] {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return []

    // JSON массив
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // fallthrough to split
      }
    }

    // CSV / новая строка / точка с запятой
    return trimmed
      .split(/[,;\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
  }

  // Число, boolean, объект — оборачиваем в [v]
  return [value]
}

class DataTransformService {
  /**
   * Применить маппинг полей к данным
   */
  applyMapping(
    data: unknown,
    mappings: FieldMapping[],
    context?: Partial<TransformContext>
  ): MappingResult {
    const result: MappingResult = {}
    const fullContext: TransformContext = {
      item: data,
      ...context
    }

    for (const mapping of mappings) {
      try {
        const value = this.resolveMapping(mapping, fullContext)
        // null/undefined — treated as absent; don't write the field to result
        if (value !== null && value !== undefined) {
          this.setNestedValue(result, mapping.targetProperty, value)
        }
      } catch (error) {
        logger.error(`Error applying mapping for ${mapping.targetProperty}`, error instanceof Error ? error : undefined)
        // Используем fallback при ошибке
        if (mapping.fallbackValue !== undefined) {
          this.setNestedValue(result, mapping.targetProperty, mapping.fallbackValue)
        }
      }
    }

    return result
  }

  /**
   * Built-in transforms (safe, no VM overhead)
   */
  private applyBuiltInTransform(
    name: string,
    value: unknown
  ): { handled: boolean; result: unknown } {
    // Don't transform null/undefined - let fallback logic handle it
    if (value === null || value === undefined) {
      return { handled: true, result: value }
    }

    switch (name) {
      case 'uppercase':
        return { handled: true, result: String(value).toUpperCase() }
      case 'lowercase':
        return { handled: true, result: String(value).toLowerCase() }
      case 'trim':
        return { handled: true, result: String(value).trim() }
      case 'number':
        return { handled: true, result: Number(value) }
      case 'round':
        return { handled: true, result: Math.round(Number(value)) }
      case 'floor':
        return { handled: true, result: Math.floor(Number(value)) }
      case 'ceil':
        return { handled: true, result: Math.ceil(Number(value)) }
      case 'length':
        return {
          handled: true,
          result: Array.isArray(value) ? value.length : String(value).length,
        }
      case 'json':
        return { handled: true, result: JSON.stringify(value) }
      case 'boolean':
        return { handled: true, result: Boolean(value) }
      case 'string':
        return { handled: true, result: String(value) }
      default:
        // template:Шаблон {{value}} текст
        if (name.startsWith('template:')) {
          const tpl = name.slice('template:'.length)
          return { handled: true, result: tpl.replace(/\{\{value\}\}/g, String(value)) }
        }
        // replace:from|to — заменить все вхождения подстроки
        if (name.startsWith('replace:')) {
          const [from, to] = name.slice('replace:'.length).split('|')
          return { handled: true, result: String(value).split(from ?? '').join(to ?? '') }
        }
        // truncate:N — обрезать до N символов, добавить '…' если длиннее
        if (name.startsWith('truncate:')) {
          const n = parseInt(name.slice('truncate:'.length), 10)
          if (Number.isFinite(n) && n > 0) {
            const s = String(value)
            return { handled: true, result: s.length > n ? s.slice(0, n) + '…' : s }
          }
        }
        // slice:start[|end] — срез строки
        if (name.startsWith('slice:')) {
          const [a, b] = name.slice('slice:'.length).split('|').map((x) => parseInt(x, 10))
          if (Number.isFinite(a)) {
            const s = String(value)
            return { handled: true, result: Number.isFinite(b) ? s.slice(a, b) : s.slice(a) }
          }
        }
        return { handled: false, result: undefined }
    }
  }

  /**
   * Разрешить значение маппинга
   */
  private resolveMapping(
    mapping: FieldMapping,
    context: TransformContext
  ): unknown {
    // 1. Проверяем условный маппинг
    if (mapping.condition) {
      return this.evaluateConditionalMapping(mapping.condition, context)
    }

    // 2. Получаем значение из источника
    let value = dataFilterService.getValueByPath(context.item, mapping.sourceField)

    // 3. Применяем трансформацию
    if (mapping.transform && value !== undefined) {
      const builtIn = this.applyBuiltInTransform(mapping.transform, value)
      if (builtIn.handled) {
        value = builtIn.result
      } else {
        value = this.executeTransform(mapping.transform, value, context)
      }
    }

    // 4. Проверяем fallback
    if ((value === undefined || value === null || value === '') && mapping.fallbackField) {
      value = dataFilterService.getValueByPath(context.item, mapping.fallbackField)
    }

    if ((value === undefined || value === null || value === '') && mapping.fallbackValue !== undefined) {
      value = mapping.fallbackValue
    }

    return value
  }

  /**
   * Оценить условный маппинг
   */
  private evaluateConditionalMapping(
    conditional: ConditionalMapping,
    context: TransformContext
  ): unknown {
    const { condition, thenValue, elseValue } = conditional
    
    // Получаем значение поля для условия
    const fieldValue = dataFilterService.getValueByPath(context.item, condition.field)
    
    // Проверяем условие
    const conditionMet = this.evaluateCondition(fieldValue, condition.operator, condition.value)

    // Возвращаем соответствующее значение
    const resultValue = conditionMet ? thenValue : elseValue
    
    // Если значение - объект с field, получаем значение из данных
    if (resultValue && typeof resultValue === 'object' && 'field' in resultValue) {
      return dataFilterService.getValueByPath(context.item, (resultValue as { field: string }).field)
    }
    
    return resultValue
  }

  /**
   * Проверить условие
   */
  private evaluateCondition(
    value: unknown,
    operator: FilterOperator,
    compareValue: unknown
  ): boolean {
    // Используем тот же метод сравнения, что и в фильтрах
    switch (operator) {
      case 'equals':
        return value === compareValue
      case 'notEquals':
        return value !== compareValue
      case 'contains':
        return String(value).toLowerCase().includes(String(compareValue).toLowerCase())
      case 'greaterThan':
        return Number(value) > Number(compareValue)
      case 'lessThan':
        return Number(value) < Number(compareValue)
      case 'exists':
        return value !== undefined && value !== null
      case 'notExists':
        return value === undefined || value === null
      case 'isEmpty':
        return this.isEmpty(value)
      case 'isNotEmpty':
        return !this.isEmpty(value)
      default:
        return true
    }
  }

  /**
   * Выполнить трансформацию (JavaScript функция)
   */
  executeTransform(
    transformCode: string,
    value: unknown,
    context: TransformContext
  ): unknown {
    // B1 фаза 2.C: только expr-eval. vm-путь удалён.
    const safeSandbox: Record<string, unknown> = {
      value,
      item: context.item,
      index: context.index,
      items: context.items,
      variables: context.variables || {},
      pageData: context.pageData || {},
    }
    try {
      return evaluateSafeExpression(transformCode, safeSandbox)
    } catch (safeErr) {
      logger.warn('Transform expression rejected by safe evaluator', { transformCode })
      throw new Error(`Transform error: ${(safeErr as Error).message}`)
    }
  }

  /**
   * Применить вычисляемые поля
   */
  async applyComputedFields(
    data: unknown,
    computedFields: ComputedField[],
    context?: Partial<TransformContext>
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}
    const fullContext: TransformContext = {
      item: data,
      ...context
    }

    for (const field of computedFields) {
      try {
        if (field.isAsync) {
          result[field.name] = await this.executeAsyncComputed(field, fullContext)
        } else {
          result[field.name] = this.executeTransform(
            field.expression,
            data,
            fullContext
          )
        }
      } catch (error) {
        logger.error(`Error computing field ${field.name}`, error instanceof Error ? error : undefined)
        result[field.name] = null
      }
    }

    return result
  }

  /**
   * Выполнить async вычисляемое поле (безопасно через vm sandbox)
   */
  private async executeAsyncComputed(
    field: ComputedField,
    context: TransformContext
  ): Promise<unknown> {
    // B1 фаза 2.C: только expr-eval (sync). Для асинхронных вычислений
    // используйте `additionalDataSources` + join вместо JS-await.
    const safeSandbox: Record<string, unknown> = {
      value: context.item,
      item: context.item,
      index: context.index,
      items: context.items,
      variables: context.variables || {},
      pageData: context.pageData || {},
    }
    try {
      return evaluateSafeExpression(field.expression, safeSandbox)
    } catch (safeErr) {
      logger.warn('Async-computed expression rejected by safe evaluator', { fieldName: field.name })
      throw new Error(`Async compute error: ${(safeErr as Error).message}`)
    }
  }

  /**
   * Обработать массив данных с маппингом
   */
  processArray(
    items: unknown[],
    mappings: FieldMapping[],
    context?: Partial<TransformContext>
  ): MappingResult[] {
    return items.map((item, index) => 
      this.applyMapping(item, mappings, {
        ...context,
        item,
        index,
        items
      })
    )
  }

  /**
   * Объединить данные из нескольких источников
   */
  joinData(
    primary: unknown[],
    additional: unknown[],
    primaryField: string,
    additionalField: string,
    joinType: 'left' | 'inner' = 'left',
    alias: string = 'joined'
  ): unknown[] {
    // Создаём индекс для additional данных
    const additionalIndex = new Map<unknown, unknown>()
    for (const item of additional) {
      const key = dataFilterService.getValueByPath(item, additionalField)
      if (key !== undefined) {
        additionalIndex.set(key, item)
      }
    }

    const result: unknown[] = []

    for (const primaryItem of primary) {
      const key = dataFilterService.getValueByPath(primaryItem, primaryField)
      const additionalItem = additionalIndex.get(key)

      if (joinType === 'inner' && !additionalItem) {
        continue // Пропускаем элементы без соответствия при INNER join
      }

      result.push({
        ...primaryItem as object,
        [alias]: additionalItem || null
      })
    }

    return result
  }

  /**
   * Flatten вложенных данных
   */
  flattenData(
    data: unknown,
    prefix: string = ''
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    const flatten = (obj: unknown, currentPrefix: string) => {
      if (obj === null || obj === undefined) {
        result[currentPrefix] = obj
        return
      }

      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          flatten(item, `${currentPrefix}[${index}]`)
        })
        return
      }

      if (typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj as object)) {
          const newPrefix = currentPrefix ? `${currentPrefix}.${key}` : key
          flatten(value, newPrefix)
        }
        return
      }

      result[currentPrefix] = obj
    }

    flatten(data, prefix)
    return result
  }

  /**
   * Установить вложенное значение
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    dataFilterService.setValueByPath(obj, path, value)
  }

  /**
   * ������� ��������� ��������
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return dataFilterService.getValueByPath(obj, path)
  }

  /**
   * Проверить пустое значение
   */
  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim() === ''
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'object') return Object.keys(value).length === 0
    return false
  }

  /**
   * Создать шаблон для Repeater из данных
   */
  generateTemplateFields(structure: unknown): string[] {
    const fields: string[] = []
    
    const extract = (obj: unknown, prefix: string = '') => {
      if (!obj || typeof obj !== 'object') return
      
      for (const [key, value] of Object.entries(obj as object)) {
        const path = prefix ? `${prefix}.${key}` : key
        
        // Ищем элементы с id
        if (key === 'id' && typeof value === 'string') {
          fields.push(prefix || value)
        }
        
        if (Array.isArray(value)) {
          value.forEach((item, i) => extract(item, `${path}[${i}]`))
        } else if (typeof value === 'object') {
          extract(value, path)
        }
      }
    }
    
    extract(structure)
    return fields
  }


    /**
     * Применить маппинг полей к OUTPUT payload
     * Преобразование данных формы в payload для API
     */
    async applyFieldMappingsToPayload(
      formData: Record<string, unknown>,
      mappings: FieldMapping[]
    ): Promise<Record<string, unknown>> {
      const result: Record<string, unknown> = {}

      for (const mapping of mappings) {
        // sourceField = поле формы (откуда беру)
        // targetProperty = поле в payload (куда пишу)
        const sourceValue = this.getNestedValue(formData, mapping.sourceField)

        // Применяем трансформацию если есть
        let finalValue = sourceValue
        if (mapping.transform && sourceValue !== undefined) {
          try {
            finalValue = this.executeTransform(
              mapping.transform,
              sourceValue,
              { item: formData }
            )
          } catch (error) {
            logger.warn(`Transform error for ${mapping.sourceField}`, undefined, error instanceof Error ? error : undefined)
            // Fallback на оригинальное значение
          }
        }

        // Fallback если значение пустое
        if (finalValue === undefined || finalValue === null || finalValue === '') {
          if (mapping.fallbackValue !== undefined) {
            finalValue = mapping.fallbackValue
          } else if (mapping.fallbackField) {
            finalValue = this.getNestedValue(formData, mapping.fallbackField)
          }
        }

        // Устанавливаем значение по пути targetProperty
        if (finalValue !== undefined) {
          this.setNestedValue(result, mapping.targetProperty, finalValue)
        }
      }

      return result
    }

    // ==================== COMPUTED FIELDS (Этап 5) ====================

    /**
     * Добавить вычисляемые поля к данным
     */
    addComputedFields(
      data: unknown[],
      computedFields: ComputedFieldConfig[],
      context?: Partial<TransformContext>
    ): unknown[] {
      return data.map((item, index) => {
        const enriched = { ...(item as Record<string, unknown>) }
        const fullContext: TransformContext = {
          item,
          index,
          items: data,
          variables: context?.variables || {},
          pageData: context?.pageData || {},
          dataSources: context?.dataSources || {},
        }

        for (const field of computedFields) {
          if (field.isAsync) {
            // Async поля пропускаем - используйте addComputedFieldsAsync
            continue
          }

          try {
            enriched[field.name] = this.executeComputedField(field.expression, fullContext)
          } catch (error) {
            logger.error(`Error computing field "${field.name}"`, error instanceof Error ? error : undefined)
            enriched[field.name] = null
          }
        }

        return enriched
      })
    }

    /**
     * Добавить async вычисляемые поля (для API вызовов)
     */
    async addComputedFieldsAsync(
      data: unknown[],
      computedFields: ComputedFieldConfig[],
      context?: Partial<TransformContext>,
      concurrency: number = 5
    ): Promise<unknown[]> {
      const results: unknown[] = []
      const asyncFields = computedFields.filter(f => f.isAsync)
      const syncFields = computedFields.filter(f => !f.isAsync)

      // Сначала добавляем sync поля
      const withSyncFields = syncFields.length > 0 
        ? this.addComputedFields(data, syncFields, context)
        : data

      // Затем async поля батчами
      for (let i = 0; i < withSyncFields.length; i += concurrency) {
        const batch = withSyncFields.slice(i, i + concurrency)
        
        const batchResults = await Promise.all(
          batch.map(async (item, batchIndex) => {
            const enriched = { ...(item as Record<string, unknown>) }
            const fullContext: TransformContext = {
              item,
              index: i + batchIndex,
              items: withSyncFields,
              variables: context?.variables || {},
              pageData: context?.pageData || {},
              dataSources: context?.dataSources || {},
            }

            for (const field of asyncFields) {
              try {
                enriched[field.name] = await this.executeComputedFieldAsync(
                  field.expression, 
                  fullContext
                )
              } catch (error) {
                logger.error(`Error computing async field "${field.name}"`, error instanceof Error ? error : undefined)
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
     * Выполнить вычисляемое поле (sync)
     */
    private executeComputedField(
      expression: string,
      context: TransformContext
    ): unknown {
      // B1 фаза 2.C: только expr-eval. Доступны helpers $var/$data и переменная $page.
      const safeSandbox: Record<string, unknown> = {
        item: context.item,
        index: context.index,
        items: context.items,
        $page: context.pageData || {},
      }
      const extraHelpers: Record<string, unknown> = {
        $var: (name: string) => (context.variables || {} as Record<string, unknown>)[name],
        $data: (alias: string) =>
          ((context.dataSources || {}) as Record<string, unknown[]>)[alias] || [],
      }
      try {
        return evaluateSafeExpression(expression, safeSandbox, extraHelpers)
      } catch (safeErr) {
        logger.warn('Computed expression rejected by safe evaluator', { expression })
        throw safeErr
      }
    }

    /**
     * Выполнить async вычисляемое поле (sync через expr-eval; обёрнуто в Promise).
     */
    private async executeComputedFieldAsync(
      expression: string,
      context: TransformContext
    ): Promise<unknown> {
      // B1 фаза 2.C: только expr-eval. Для асинхронных вычислений используйте
      // additionalDataSources + join вместо JS-await.
      const safeSandbox: Record<string, unknown> = {
        item: context.item,
        index: context.index,
        items: context.items,
        $page: context.pageData || {},
      }
      const extraHelpers: Record<string, unknown> = {
        $var: (name: string) => (context.variables || {} as Record<string, unknown>)[name],
        $data: (alias: string) =>
          ((context.dataSources || {}) as Record<string, unknown[]>)[alias] || [],
      }
      try {
        return evaluateSafeExpression(expression, safeSandbox, extraHelpers)
      } catch (safeErr) {
        logger.warn('Async-computed expression rejected by safe evaluator', { expression })
        throw safeErr
      }
    }

    // ==================== CONDITIONAL FIELDS (Этап 5.3) ====================

    /**
     * Применить условную логику к полям
     */
    applyConditionalFields(
      data: unknown[],
      conditionalFields: ConditionalFieldConfig[],
      context?: Partial<TransformContext>
    ): unknown[] {
      return data.map((item, index) => {
        const processed = { ...(item as Record<string, unknown>) }
        
        for (const config of conditionalFields) {
          const value = this.evaluateConditionalField(config, item, context)
          if (value !== undefined) {
            processed[config.field] = value
          }
        }

        return processed
      })
    }

    /**
     * Вычислить условное поле
     */
    private evaluateConditionalField(
      config: ConditionalFieldConfig,
      item: unknown,
      context?: Partial<TransformContext>
    ): unknown {
      for (const condition of config.conditions) {
        const fieldValue = dataFilterService.getValueByPath(item, condition.when.field)
        const conditionMet = this.evaluateCondition(
          fieldValue, 
          condition.when.operator, 
          condition.when.value
        )

        if (conditionMet) {
          return this.resolveConditionalValue(condition.then, item)
        }
      }

      // Если ни одно условие не выполнено, возвращаем else
      if (config.else !== undefined) {
        return this.resolveConditionalValue(config.else, item)
      }

      return undefined
    }

    /**
     * Разрешить условное значение (может быть ссылкой на поле)
     */
    private resolveConditionalValue(
      value: unknown | { field: string },
      item: unknown
    ): unknown {
      if (value && typeof value === 'object' && 'field' in value) {
        return dataFilterService.getValueByPath(item, (value as { field: string }).field)
      }
      return value
    }

    // ==================== FALLBACK CHAINS (Этап 5.3) ====================

    /**
     * Применить fallback chain к данным
     */
    applyFallbackChain(
      item: unknown,
      fieldChain: string[],
      defaultValue?: unknown
    ): unknown {
      for (const field of fieldChain) {
        const value = dataFilterService.getValueByPath(item, field)
        if (value !== undefined && value !== null && value !== '') {
          return value
        }
      }
      return defaultValue
    }

    /**
     * Применить fallback chains к массиву данных
     */
    applyFallbackChainsToData(
      data: unknown[],
      fallbackConfigs: Array<{
        targetField: string
        sourceChain: string[]
        defaultValue?: unknown
      }>
    ): unknown[] {
      return data.map(item => {
        const processed = { ...(item as Record<string, unknown>) }
        
        for (const config of fallbackConfigs) {
          processed[config.targetField] = this.applyFallbackChain(
            item,
            config.sourceChain,
            config.defaultValue
          )
        }

        return processed
      })
    }

    // ============ НОВЫЕ МЕТОДЫ ДЛЯ TRANSFORMS ============

    /**
     * Полная обработка данных с трансформациями, фильтрами, поиском и пагинацией
     */
    async processWithTransforms(
      rawData: unknown,
      options: {
        dataPath?: string
        fieldMappings?: Record<string, string>
        transforms?: DataTransformConfig[]
        filters?: FilterConditionConfig[]
        search?: { query: string; fields: string[] }
        sort?: { field: string; order: 'asc' | 'desc' }
        pagination?: { page: number; pageSize: number }
        computeFields?: string[]
      }
    ): Promise<TransformResult> {
      const startTime = Date.now()
      
      try {
        // 1. Извлекаем массив из ответа
        let items = this.extractArrayFromPath(rawData, options.dataPath || '')
        const originalCount = items.length
        
        // 2. Нормализуем поля если есть маппинг
        if (options.fieldMappings) {
          items = this.normalizeFieldNames(items, options.fieldMappings)
        }
        
        // 3. Применяем статические трансформации
        if (options.transforms?.length) {
          for (const transform of options.transforms) {
            if (transform.enabled === false) continue
            items = this.applyDataTransform(items, transform)
          }
        }
        
        // 4. Применяем динамические фильтры
        if (options.filters?.length) {
          for (const filter of options.filters) {
            items = this.applyFilterCondition(items, filter)
          }
        }
        
        // 5. Применяем поиск
        if (options.search?.query && options.search.query.length > 0) {
          items = this.applySearchFilter(items, options.search.query, options.search.fields)
        }
        
        const filteredCount = items.length
        
        // 6. Вычисляем агрегаты ДО пагинации
        const computed = this.computeDataAggregates(items, options.computeFields)
        
        // 7. Применяем сортировку
        if (options.sort) {
          items = this.applySortOrder(items, options.sort.field, options.sort.order)
        }
        
        // 8. Применяем пагинацию
        let paginationMeta: PaginationMeta = {}
        if (options.pagination) {
          const { page, pageSize } = options.pagination
          const totalPages = Math.ceil(filteredCount / pageSize)
          const offset = (page - 1) * pageSize
          
          items = items.slice(offset, offset + pageSize)
          
          paginationMeta = {
            page,
            pageSize,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
        
        const responseTime = Date.now() - startTime
        
        return {
          success: true,
          data: items,
          meta: {
            totalCount: originalCount,
            filteredCount,
            returnedCount: items.length,
            ...paginationMeta,
            computed: {
              count: filteredCount,
              ...computed
            },
            responseTime
          }
        }
      } catch (error: any) {
        logger.error('Transform error', error instanceof Error ? error : undefined)
        return {
          success: false,
          data: [],
          meta: {
            totalCount: 0,
            filteredCount: 0,
            returnedCount: 0,
            responseTime: Date.now() - startTime
          },
          error: error.message
        }
      }
    }

    /**
     * Извлечь массив по пути
     */
    extractArrayFromPath(data: unknown, path: string): unknown[] {
      if (!path || path === '') {
        return Array.isArray(data) ? data : []
      }
      
      const value = dataFilterService.getValueByPath(data, path)
      return Array.isArray(value) ? value : []
    }

    /**
     * Нормализовать имена полей
     */
    normalizeFieldNames(items: unknown[], mappings: Record<string, string>): unknown[] {
      return items.map(item => {
        const normalized = { ...(item as Record<string, unknown>) }
        
        for (const [ourField, sourceField] of Object.entries(mappings)) {
          const value = dataFilterService.getValueByPath(item, sourceField)
          if (value !== undefined) {
            normalized[ourField] = value
          }
        }
        
        return normalized
      })
    }

    /**
     * Применить одну трансформацию
     */
    applyDataTransform(items: unknown[], transform: DataTransformConfig): unknown[] {
      switch (transform.type) {
        case 'exclude':
          return items.filter(item => !this.matchesFilterCondition(item, transform.filter!))
          
        case 'include':
          return items.filter(item => this.matchesFilterCondition(item, transform.filter!))
          
        case 'prepend':
          return [...(transform.staticItems || []), ...items]
          
        case 'append':
          return [...items, ...(transform.staticItems || [])]
          
        case 'sort':
          return this.applySortOrder(items, transform.field!, transform.order || 'asc')
          
        case 'limit':
          const offset = transform.offset || 0
          return items.slice(offset, offset + (transform.limit || 10))
          
        case 'unique':
          return this.applyUniqueFilter(items, transform.field!, transform.keepFirst !== false)
          
        default:
          logger.warn(`Unknown transform type: ${(transform as any).type}`)
          return items
      }
    }

    /**
     * Применить фильтр
     */
    applyFilterCondition(items: unknown[], filter: FilterConditionConfig): unknown[] {
      return items.filter(item => this.matchesFilterCondition(item, filter))
    }

    /**
     * Проверить соответствие условию
     */
    matchesFilterCondition(item: unknown, condition: FilterConditionConfig): boolean {
      const value = dataFilterService.getValueByPath(item, condition.field)
      const targetValue = condition.value
      
      // Извлечь число из строки ("от $120,000" → 120000, "2025 Q2" → 2025)
      function extractNumber(val: unknown): number {
        if (typeof val === 'number') return val
        const s = String(val).replace(/[^0-9.,-]/g, '').replace(/,/g, '')
        const n = parseFloat(s)
        return isNaN(n) ? NaN : n
      }

      switch (condition.operator) {
        case 'eq':
          // Нестрогое сравнение для чисел и строк (1 == "1")
          return value == targetValue
        case 'neq':
          return value != targetValue
        case 'gt':
          return extractNumber(value) > extractNumber(targetValue)
        case 'gte':
          return extractNumber(value) >= extractNumber(targetValue)
        case 'lt':
          return extractNumber(value) < extractNumber(targetValue)
        case 'lte':
          return extractNumber(value) <= extractNumber(targetValue)
        case 'contains':
          return String(value).toLowerCase().includes(String(targetValue).toLowerCase())
        case 'containsAny':
          if (Array.isArray(targetValue)) {
            return targetValue.some(tv => String(value).toLowerCase().includes(String(tv).toLowerCase()))
          }
          return String(value).toLowerCase().includes(String(targetValue).toLowerCase())
        case 'notContains':
          return !String(value).toLowerCase().includes(String(targetValue).toLowerCase())
        case 'startsWith':
          return String(value).toLowerCase().startsWith(String(targetValue).toLowerCase())
        case 'endsWith':
          return String(value).toLowerCase().endsWith(String(targetValue).toLowerCase())
        case 'in': {
          // Нормализуем targetValue в массив:
          // - массив → как есть
          // - строка вида "[1,2,3]" → парсим как JSON
          // - строка вида "1, 2, 3" → split по запятой
          // - одиночное значение → [value]
          const list = normalizeToList(targetValue)
          // Loose equality (1 == "1") — симметрично с case 'eq'
          // eslint-disable-next-line eqeqeq
          return list.some(tv => tv == value)
        }
        case 'notIn': {
          const list = normalizeToList(targetValue)
          // eslint-disable-next-line eqeqeq
          return !list.some(tv => tv == value)
        }
        case 'between':
          if (Array.isArray(targetValue) && targetValue.length === 2) {
            const num = Number(value)
            return num >= Number(targetValue[0]) && num <= Number(targetValue[1])
          }
          return false
        case 'exists':
          return value !== undefined && value !== null
        case 'isEmpty':
          return this.isEmpty(value)
        default:
          logger.warn(`Unknown operator: ${condition.operator}`)
          return true
      }
    }

    /**
     * Применить поиск
     */
    applySearchFilter(items: unknown[], query: string, fields: string[]): unknown[] {
      const lowerQuery = query.toLowerCase().trim()
      if (!lowerQuery) return items
      
      return items.filter(item => {
        return fields.some(field => {
          const value = dataFilterService.getValueByPath(item, field)
          if (value === null || value === undefined) return false
          return String(value).toLowerCase().includes(lowerQuery)
        })
      })
    }

    /**
     * Применить сортировку
     */
    applySortOrder(items: unknown[], field: string, order: 'asc' | 'desc'): unknown[] {
      return [...items].sort((a, b) => {
        const aVal = dataFilterService.getValueByPath(a, field)
        const bVal = dataFilterService.getValueByPath(b, field)
        
        // Обработка null/undefined
        if (aVal === null || aVal === undefined) return order === 'asc' ? 1 : -1
        if (bVal === null || bVal === undefined) return order === 'asc' ? -1 : 1
        
        // Числовое сравнение
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return order === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        // Строковое сравнение
        const comparison = String(aVal).localeCompare(String(bVal))
        return order === 'asc' ? comparison : -comparison
      })
    }

    /**
     * Убрать дубликаты
     */
    applyUniqueFilter(items: unknown[], field: string, keepFirst: boolean): unknown[] {
      const seen = new Map<unknown, unknown>()
      
      for (const item of items) {
        const key = dataFilterService.getValueByPath(item, field)
        if (!seen.has(key)) {
          seen.set(key, item)
        } else if (!keepFirst) {
          seen.set(key, item)
        }
      }
      
      return Array.from(seen.values())
    }

    /**
     * Вычислить агрегаты
     */
    computeDataAggregates(items: unknown[], fields?: string[]): AggregateValues {
      const result: AggregateValues = {
        sum: {},
        avg: {},
        min: {},
        max: {}
      }
      
      if (!fields || fields.length === 0) {
        return result
      }
      
      for (const field of fields) {
        const values = items
          .map(item => dataFilterService.getValueByPath(item, field))
          .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
          .map(v => Number(v))
        
        if (values.length === 0) continue
        
        result.sum[field] = values.reduce((a, b) => a + b, 0)
        result.avg[field] = result.sum[field] / values.length
        result.min[field] = Math.min(...values)
        result.max[field] = Math.max(...values)
      }
      
      return result
    }

}

// Типы для новых методов
export interface DataTransformConfig {
  id?: string
  type: 'exclude' | 'include' | 'prepend' | 'append' | 'sort' | 'limit' | 'unique'
  enabled?: boolean
  filter?: FilterConditionConfig
  staticItems?: unknown[]
  field?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
  keepFirst?: boolean
}

export interface FilterConditionConfig {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'containsAny' | 'notContains' | 
            'startsWith' | 'endsWith' | 'in' | 'notIn' | 'between' | 'exists' | 'isEmpty'
  value: unknown
}

export interface PaginationMeta {
  page?: number
  pageSize?: number
  totalPages?: number
  hasNextPage?: boolean
  hasPrevPage?: boolean
}

export interface AggregateValues {
  sum: Record<string, number>
  avg: Record<string, number>
  min: Record<string, number>
  max: Record<string, number>
}

export interface TransformResult {
  success: boolean
  data: unknown[]
  meta: {
    totalCount: number
    filteredCount: number
    returnedCount: number
    page?: number
    pageSize?: number
    totalPages?: number
    hasNextPage?: boolean
    hasPrevPage?: boolean
    computed?: {
      count: number
      sum?: Record<string, number>
      avg?: Record<string, number>
      min?: Record<string, number>
      max?: Record<string, number>
    }
    responseTime: number
  }
  error?: string
}

export const dataTransformService = new DataTransformService()
export default DataTransformService

