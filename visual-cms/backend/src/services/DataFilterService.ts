/**
 * Data Filter Service
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 2.1 Backend: Data Fetching Service
 * 
 * Сервис для фильтрации, сортировки и пагинации данных.
 */

import type { 
  FilterConfig, 
  SortConfig, 
  PaginationConfig,
  FilterOperator 
} from '../models/DataBinding'

// Типы
export interface FilterResult<T = unknown> {
  items: T[]
  total: number
  filtered: number
  page?: number
  totalPages?: number
}

class DataFilterService {
  /**
   * Применить все операции: фильтрация -> сортировка -> пагинация
   */
  process<T = unknown>(
    data: T[],
    filters?: FilterConfig[],
    sorting?: SortConfig[],
    pagination?: PaginationConfig
  ): FilterResult<T> {
    const total = data.length
    
    // 1. Фильтрация
    let result = filters && filters.length > 0 
      ? this.applyFilters(data, filters) 
      : [...data]
    
    const filtered = result.length
    
    // 2. Сортировка
    if (sorting && sorting.length > 0) {
      result = this.applySorting(result, sorting)
    }
    
    // 3. Пагинация
    let page: number | undefined
    let totalPages: number | undefined
    
    if (pagination?.enabled) {
      const paginationResult = this.applyPagination(result, pagination)
      result = paginationResult.items as T[]
      page = paginationResult.page
      totalPages = paginationResult.totalPages
    }
    
    return {
      items: result,
      total,
      filtered,
      page,
      totalPages
    }
  }

  /**
   * Применить фильтры к данным
   */
  applyFilters<T = unknown>(data: T[], filters: FilterConfig[]): T[] {
    if (!filters || filters.length === 0) {
      return data
    }

    return data.filter(item => {
      let result = true
      let previousResult = true

      for (let i = 0; i < filters.length; i++) {
        const filter = filters[i]
        const filterResult = this.evaluateFilter(item, filter)

        if (i === 0) {
          result = filterResult
        } else {
          const operator = filter.logicalOperator || 'and'
          
          if (operator === 'and') {
            result = previousResult && filterResult
          } else {
            result = previousResult || filterResult
          }
        }

        previousResult = result
      }

      return result
    })
  }

  /**
   * Оценить один фильтр для элемента
   */
  private evaluateFilter(item: unknown, filter: FilterConfig): boolean {
    const value = this.getValueByPath(item, filter.field)
    const filterValue = filter.value

    return this.compareValues(value, filterValue, filter.operator)
  }

  /**
   * Сравнить значения по оператору
   */
  private compareValues(
    value: unknown, 
    filterValue: unknown, 
    operator: FilterOperator
  ): boolean {
    // Нормализация значений
    const normalizedValue = this.normalizeValue(value)
    const normalizedFilterValue = this.normalizeValue(filterValue)

    switch (operator) {
      case 'equals':
        return normalizedValue === normalizedFilterValue

      case 'notEquals':
        return normalizedValue !== normalizedFilterValue

      case 'contains':
        return String(normalizedValue).toLowerCase()
          .includes(String(normalizedFilterValue).toLowerCase())

      case 'notContains':
        return !String(normalizedValue).toLowerCase()
          .includes(String(normalizedFilterValue).toLowerCase())

      case 'startsWith':
        return String(normalizedValue).toLowerCase()
          .startsWith(String(normalizedFilterValue).toLowerCase())

      case 'endsWith':
        return String(normalizedValue).toLowerCase()
          .endsWith(String(normalizedFilterValue).toLowerCase())

      case 'greaterThan':
        return Number(normalizedValue) > Number(normalizedFilterValue)

      case 'greaterThanOrEqual':
        return Number(normalizedValue) >= Number(normalizedFilterValue)

      case 'lessThan':
        return Number(normalizedValue) < Number(normalizedFilterValue)

      case 'lessThanOrEqual':
        return Number(normalizedValue) <= Number(normalizedFilterValue)

      case 'in':
        if (Array.isArray(normalizedFilterValue)) {
          return normalizedFilterValue.some(v => 
            this.normalizeValue(v) === normalizedValue
          )
        }
        return false

      case 'notIn':
        if (Array.isArray(normalizedFilterValue)) {
          return !normalizedFilterValue.some(v => 
            this.normalizeValue(v) === normalizedValue
          )
        }
        return true

      case 'between':
        if (Array.isArray(normalizedFilterValue) && normalizedFilterValue.length >= 2) {
          const numValue = Number(normalizedValue)
          const min = Number(normalizedFilterValue[0])
          const max = Number(normalizedFilterValue[1])
          return numValue >= min && numValue <= max
        }
        return false

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
   * Применить сортировку
   */
  applySorting<T = unknown>(data: T[], sorting: SortConfig[]): T[] {
    if (!sorting || sorting.length === 0) {
      return data
    }

    return [...data].sort((a, b) => {
      for (const sort of sorting) {
        const aValue = this.getValueByPath(a, sort.field)
        const bValue = this.getValueByPath(b, sort.field)
        
        const comparison = this.compareForSort(aValue, bValue, sort.dataType)
        
        if (comparison !== 0) {
          return sort.direction === 'desc' ? -comparison : comparison
        }
      }
      return 0
    })
  }

  /**
   * Сравнить значения для сортировки
   */
  private compareForSort(
    a: unknown, 
    b: unknown, 
    dataType?: 'string' | 'number' | 'date'
  ): number {
    // Null/undefined всегда в конце
    if (a === null || a === undefined) return 1
    if (b === null || b === undefined) return -1

    switch (dataType) {
      case 'number':
        return Number(a) - Number(b)
      
      case 'date':
        return new Date(String(a)).getTime() - new Date(String(b)).getTime()
      
      case 'string':
      default:
        return String(a).localeCompare(String(b))
    }
  }

  /**
   * Применить пагинацию
   */
  applyPagination<T = unknown>(
    data: T[], 
    config: PaginationConfig,
    page: number = 1
  ): FilterResult<T> {
    if (!config.enabled) {
      return {
        items: data,
        total: data.length,
        filtered: data.length
      }
    }

    const itemsPerPage = config.itemsPerPage || 10
    const totalPages = Math.ceil(data.length / itemsPerPage)
    const currentPage = Math.min(Math.max(1, page), totalPages || 1)
    
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    
    return {
      items: data.slice(startIndex, endIndex),
      total: data.length,
      filtered: data.length,
      page: currentPage,
      totalPages
    }
  }

  /**
   * Получить значение по JSON path
   * Поддерживает: obj.field, obj.nested.field, obj.array[0], obj.array[*].field
   */
  getValueByPath(obj: unknown, path: string): unknown {
    if (!obj || !path) {
      return undefined
    }

    const parts = path.split('.')
    let current: unknown = obj

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined
      }

      // Проверка на индекс массива: field[0] или field[*]
      const arrayMatch = part.match(/^(\w+)\[(\d+|\*)\]$/)
      
      if (arrayMatch) {
        const [, fieldName, index] = arrayMatch
        current = (current as Record<string, unknown>)[fieldName]
        
        if (!Array.isArray(current)) {
          return undefined
        }
        
        if (index === '*') {
          // Вернуть все элементы массива (для следующего поля)
          return current
        } else {
          current = current[parseInt(index, 10)]
        }
      } else {
        current = (current as Record<string, unknown>)[part]
      }
    }

    // null terminal value is treated as absent — consistent with "field doesn't exist"
    return current === null ? undefined : current
  }

  /**
   * Установить значение по JSON path
   */
  setValueByPath(obj: unknown, path: string, value: unknown): void {
    if (!obj || !path) {
      return
    }

    const parts = path.split('.')
    let current: Record<string, unknown> = obj as Record<string, unknown>

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      
      if (current[part] === undefined) {
        // Определяем, нужен ли массив или объект
        const nextPart = parts[i + 1]
        current[part] = /^\d+$/.test(nextPart) ? [] : {}
      }
      
      current = current[part] as Record<string, unknown>
    }

    const lastPart = parts[parts.length - 1]
    current[lastPart] = value
  }

  /**
   * Нормализовать значение для сравнения
   */
  private normalizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null
    }
    
    if (typeof value === 'string') {
      // Пробуем парсить числа
      const num = Number(value)
      if (!isNaN(num) && value.trim() !== '') {
        return num
      }
      
      // Пробуем парсить boolean
      if (value.toLowerCase() === 'true') return true
      if (value.toLowerCase() === 'false') return false
      
      return value.toLowerCase()
    }
    
    return value
  }

  /**
   * Проверить, пустое ли значение
   */
  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true
    }
    
    if (typeof value === 'string') {
      return value.trim() === ''
    }
    
    if (Array.isArray(value)) {
      return value.length === 0
    }
    
    if (typeof value === 'object') {
      return Object.keys(value).length === 0
    }
    
    return false
  }

  /**
   * Построить dynamic filter value
   * Получить значение фильтра из переменной, URL параметра и т.д.
   */
  resolveFilterValue(
    filter: FilterConfig,
    context: {
      variables?: Record<string, unknown>
      urlParams?: Record<string, string>
      formData?: Record<string, unknown>
    }
  ): unknown {
    switch (filter.valueSource) {
      case 'static':
        return filter.value

      case 'variable':
        return filter.variableName 
          ? context.variables?.[filter.variableName] 
          : undefined

      case 'urlParam':
        return filter.urlParamName 
          ? context.urlParams?.[filter.urlParamName] 
          : undefined

      case 'formField':
        return filter.formFieldId 
          ? context.formData?.[filter.formFieldId] 
          : undefined

      default:
        return filter.value
    }
  }

  /**
   * Подготовить фильтры с resolved значениями
   */
  prepareFilters(
    filters: FilterConfig[],
    context: {
      variables?: Record<string, unknown>
      urlParams?: Record<string, string>
      formData?: Record<string, unknown>
    }
  ): FilterConfig[] {
    return filters.map(filter => ({
      ...filter,
      value: this.resolveFilterValue(filter, context)
    }))
  }
}

export const dataFilterService = new DataFilterService()
export default DataFilterService
