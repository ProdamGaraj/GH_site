/**
 * Data Transform Service
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 2.1 Backend: Data Fetching Service
 * Этап 5: Mixed Data & Advanced Features - Computed Fields
 * 
 * Сервис для трансформации данных, маппинга полей и вычисляемых значений.
 */

import vm from 'vm'
import { dataFilterService } from './DataFilterService'
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

class DataTransformService {
  private sandboxTimeout = 1000 // 1 секунда на выполнение скрипта

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
        this.setNestedValue(result, mapping.targetProperty, value)
      } catch (error) {
        console.error(`Error applying mapping for ${mapping.targetProperty}:`, error)
        // Используем fallback при ошибке
        if (mapping.fallbackValue !== undefined) {
          this.setNestedValue(result, mapping.targetProperty, mapping.fallbackValue)
        }
      }
    }

    return result
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
      value = this.executeTransform(mapping.transform, value, context)
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
    try {
      // Создаём безопасный sandbox
      const sandbox = {
        value,
        item: context.item,
        index: context.index,
        items: context.items,
        variables: context.variables || {},
        pageData: context.pageData || {},
        // Безопасные утилиты
        JSON: {
          parse: JSON.parse,
          stringify: JSON.stringify
        },
        String,
        Number,
        Boolean,
        Array,
        Object,
        Math,
        Date,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        // Результат
        result: undefined
      }

      // Оборачиваем код в функцию
      const wrappedCode = `
        result = (function(value, item, index, items, variables, pageData) {
          ${transformCode}
        })(value, item, index, items, variables, pageData);
      `

      // Создаём контекст и выполняем
      const vmContext = vm.createContext(sandbox)
      vm.runInContext(wrappedCode, vmContext, {
        timeout: this.sandboxTimeout,
        displayErrors: true
      })

      return sandbox.result
    } catch (error: any) {
      console.error('Transform execution error:', error.message)
      throw new Error(`Transform error: ${error.message}`)
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
        console.error(`Error computing field ${field.name}:`, error)
        result[field.name] = null
      }
    }

    return result
  }

  /**
   * Выполнить async вычисляемое поле
   */
  private async executeAsyncComputed(
    field: ComputedField,
    context: TransformContext
  ): Promise<unknown> {
    // Для async полей используем обычный eval с Promise
    // В продакшене это нужно заменить на более безопасное решение
    try {
      const asyncFunction = new Function(
        'value', 'item', 'index', 'items', 'variables', 'pageData',
        `return (async () => { ${field.expression} })()`
      )

      return await asyncFunction(
        context.item,
        context.item,
        context.index,
        context.items,
        context.variables,
        context.pageData
      )
    } catch (error: any) {
      throw new Error(`Async compute error: ${error.message}`)
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
            console.warn(`Transform error for ${mapping.sourceField}:`, error)
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
            console.error(`Error computing field "${field.name}":`, error)
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
                console.error(`Error computing async field "${field.name}":`, error)
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
      const sandbox = this.createSandbox(context)
      
      const wrappedCode = `
        result = (function() {
          const item = this.item;
          const index = this.index;
          const items = this.items;
          const $var = (name) => this.variables[name];
          const $data = (alias) => this.dataSources[alias] || [];
          const $page = this.pageData;
          
          ${expression}
        }).call(this);
      `

      const vmContext = vm.createContext(sandbox)
      vm.runInContext(wrappedCode, vmContext, {
        timeout: this.sandboxTimeout,
        displayErrors: true,
      })

      return sandbox.result
    }

    /**
     * Выполнить async вычисляемое поле
     */
    private async executeComputedFieldAsync(
      expression: string,
      context: TransformContext
    ): Promise<unknown> {
      // Для async полей используем eval с ограничениями
      // В production лучше использовать более безопасный подход
      const item = context.item
      const index = context.index
      const items = context.items
      const $var = (name: string) => context.variables?.[name]
      const $data = (alias: string) => context.dataSources?.[alias] || []
      const $page = context.pageData

      // Создаём async функцию
      const asyncFunc = new Function(
        'item', 'index', 'items', '$var', '$data', '$page', 'fetch',
        `return (async () => { ${expression} })()`
      )

      return await asyncFunc(item, index, items, $var, $data, $page, fetch)
    }

    /**
     * Создать sandbox для безопасного выполнения кода
     */
    private createSandbox(context: TransformContext): Record<string, unknown> {
      return {
        item: context.item,
        index: context.index,
        items: context.items,
        variables: context.variables || {},
        dataSources: context.dataSources || {},
        pageData: context.pageData || {},
        // Безопасные утилиты
        JSON: { parse: JSON.parse, stringify: JSON.stringify },
        String, Number, Boolean, Array, Object, Math, Date,
        parseInt, parseFloat, isNaN, isFinite,
        encodeURIComponent, decodeURIComponent,
        // Результат
        result: undefined,
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

}

export const dataTransformService = new DataTransformService()
export default DataTransformService

