/**
 * Data Transform Types (Backend)
 * Типы для трансформации данных
 */

// ============ Операторы фильтрации ============

export type TransformFilterOperator =
  | 'eq'        // равно
  | 'neq'       // не равно
  | 'gt'        // больше
  | 'gte'       // больше или равно
  | 'lt'        // меньше
  | 'lte'       // меньше или равно
  | 'contains'  // содержит (строка)
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'in'        // входит в массив
  | 'notIn'     // не входит в массив
  | 'between'   // между двумя значениями
  | 'exists'    // поле существует
  | 'isEmpty'   // поле пустое

// ============ Типы трансформаций ============

export type TransformType = 
  | 'exclude'   // Исключить записи по условию
  | 'include'   // Оставить только записи по условию
  | 'prepend'   // Добавить элементы в начало
  | 'append'    // Добавить элементы в конец
  | 'sort'      // Сортировка
  | 'limit'     // Ограничить количество
  | 'map'       // Трансформация полей
  | 'unique'    // Убрать дубликаты

// ============ Базовый интерфейс трансформации ============

export interface BaseTransform {
  id: string
  type: TransformType
  enabled?: boolean
  description?: string
}

// ============ Условие фильтрации ============

export interface FilterCondition {
  field: string
  operator: TransformFilterOperator
  value: any
  valueSource?: 'static' | 'block' | 'url' | 'storage'
  blockId?: string
  urlParam?: string
  storageKey?: string
}

// ============ Типы трансформаций ============

export interface ExcludeTransform extends BaseTransform {
  type: 'exclude'
  filter: FilterCondition
}

export interface IncludeTransform extends BaseTransform {
  type: 'include'
  filter: FilterCondition
}

export interface PrependTransform extends BaseTransform {
  type: 'prepend'
  staticItems: Record<string, any>[]
}

export interface AppendTransform extends BaseTransform {
  type: 'append'
  staticItems: Record<string, any>[]
}

export interface SortTransform extends BaseTransform {
  type: 'sort'
  field: string
  order: 'asc' | 'desc'
  fieldSource?: 'static' | 'block'
  blockId?: string
}

export interface LimitTransform extends BaseTransform {
  type: 'limit'
  limit: number
  offset?: number
}

export interface MapTransform extends BaseTransform {
  type: 'map'
  mappings: {
    targetField: string
    sourceField?: string
    expression?: string
    defaultValue?: any
  }[]
}

export interface UniqueTransform extends BaseTransform {
  type: 'unique'
  field: string
  keepFirst?: boolean
}

export type DataTransform = 
  | ExcludeTransform
  | IncludeTransform
  | PrependTransform
  | AppendTransform
  | SortTransform
  | LimitTransform
  | MapTransform
  | UniqueTransform

// ============ Response Mapping ============

export interface ResponseMapping {
  dataPath: string
  totalCountPath?: string
  fieldMappings?: Record<string, string>
}

// ============ Запрос ============

export interface FetchWithTransformsRequest {
  bindingId: string
  
  filters?: FilterCondition[]
  
  search?: {
    query: string
    fields: string[]
  }
  
  sort?: {
    field: string
    order: 'asc' | 'desc'
  }
  
  pagination?: {
    page: number
    pageSize: number
  }
  
  transformsOverride?: DataTransform[]
}

// ============ Ответ ============

export interface FetchWithTransformsResponse<T = any> {
  success: boolean
  data: T[]
  
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
      count?: number
      sum?: Record<string, number>
      avg?: Record<string, number>
      min?: Record<string, number>
      max?: Record<string, number>
    }
    
    responseTime?: number
  }
  
  error?: string
}

// ============ Внутренние типы для сервиса ============

export interface TransformContext {
  originalCount: number
  currentItems: any[]
  computedValues: Record<string, any>
}

export interface AggregateResult {
  count: number
  sum: Record<string, number>
  avg: Record<string, number>
  min: Record<string, number>
  max: Record<string, number>
}
