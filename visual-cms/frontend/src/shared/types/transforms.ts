/**
 * Data Transform Types
 * Типы для трансформации данных на бэкенде
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

// ============ Фильтрующие трансформации ============

export interface FilterCondition {
  field: string
  operator: TransformFilterOperator
  value: any
  // Для связи со значением из блока-фильтра
  valueSource?: 'static' | 'block' | 'url' | 'storage'
  blockId?: string      // ID блока-источника значения
  urlParam?: string     // Имя URL параметра
  storageKey?: string   // Ключ в localStorage
}

export interface ExcludeTransform extends BaseTransform {
  type: 'exclude'
  filter: FilterCondition
}

export interface IncludeTransform extends BaseTransform {
  type: 'include'
  filter: FilterCondition
}

// ============ Добавляющие трансформации ============

export interface PrependTransform extends BaseTransform {
  type: 'prepend'
  staticItems: Record<string, any>[]
}

export interface AppendTransform extends BaseTransform {
  type: 'append'
  staticItems: Record<string, any>[]
}

// ============ Сортировка ============

export interface SortTransform extends BaseTransform {
  type: 'sort'
  field: string
  order: 'asc' | 'desc'
  // Для динамической сортировки из блока
  fieldSource?: 'static' | 'block'
  blockId?: string
}

// ============ Лимит ============

export interface LimitTransform extends BaseTransform {
  type: 'limit'
  limit: number
  offset?: number
}

// ============ Маппинг полей ============

export interface MapTransform extends BaseTransform {
  type: 'map'
  mappings: {
    targetField: string
    sourceField?: string
    expression?: string  // JavaScript выражение для вычисления
    defaultValue?: any
  }[]
}

// ============ Уникальность ============

export interface UniqueTransform extends BaseTransform {
  type: 'unique'
  field: string
  keepFirst?: boolean  // Оставить первый или последний дубликат
}

// ============ Объединённый тип ============

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
  // Путь к массиву данных в ответе API
  dataPath: string              // "data", "results", "response.items"
  
  // Путь к общему количеству записей (если API отдаёт)
  totalCountPath?: string       // "meta.total", "pagination.totalCount"
  
  // Нормализация имён полей
  fieldMappings?: {
    [ourFieldName: string]: string  // { "title": "project_name", "image": "photo_url" }
  }
}

// ============ Пагинация ============

export interface TransformPagination {
  enabled: boolean
  pageSize: number
  // Связь с блоком пагинации
  controlBlockId?: string
  // Текущая страница (для запросов)
  currentPage?: number
}

// ============ Поиск ============

export interface TransformSearch {
  enabled: boolean
  // Блок с поисковым инпутом
  controlBlockId?: string
  // Поля для поиска
  searchFields: string[]
  // Минимальная длина запроса
  minLength?: number
}

// ============ Динамические фильтры ============

export interface DynamicFilter {
  id: string
  // Связь с блоком-фильтром
  sourceBlockId: string
  sourceProperty?: string  // Какое свойство блока использовать (default: value)
  // Какое поле фильтровать
  field: string
  operator: TransformFilterOperator
  // Применять только если значение не пустое
  skipIfEmpty?: boolean
  // Путь к полю данных API для заполнения select-а (напр. houses[0].address)
  populateFrom?: string
  // JS-выражение для извлечения части значения. Переменная: value (строка).
  // Пример: "value.split(',')[2].trim()" → вырежет третью часть адреса
  valueExtract?: string
}

// ============ Вычисляемые значения (для зависимых блоков) ============

export type ComputeType = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last' | 'custom'

export interface ComputedOutput {
  id: string
  // Тип вычисления
  computeType: ComputeType
  // Поле для агрегации (для sum, avg, min, max)
  field?: string
  // JavaScript выражение (для custom)
  expression?: string
  // Целевой блок для вывода
  targetBlockId: string
  // Свойство целевого блока
  targetProperty?: 'content' | 'style' | 'attribute'
  // Шаблон для форматирования
  template?: string  // "Найдено {value} проектов"
}

// ============ Расширенный InputConfig ============

export interface ExtendedInputConfig {
  mode: 'single' | 'repeater'
  templateId?: string
  arrayPath?: string
  fieldMappings?: Array<{
    id: string
    sourceField: string
    targetProperty: string
  }>
  
  // === НОВЫЕ ПОЛЯ ===
  
  // Трансформации данных (применяются последовательно)
  transforms?: DataTransform[]
  
  // Динамические фильтры (связь с блоками)
  dynamicFilters?: DynamicFilter[]
  
  // Пагинация
  pagination?: TransformPagination
  
  // Поиск
  search?: TransformSearch
  
  // Вычисляемые значения для зависимых блоков
  computedOutputs?: ComputedOutput[]
}

// ============ Расширенный DataSource config ============

export interface ExtendedDataSourceConfig {
  type: 'rest-api' | 'graphql' | 'static'
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: any
  
  // === НОВЫЕ ПОЛЯ ===
  
  // Как парсить ответ от внешнего API
  responseMapping?: ResponseMapping
  
  // Кэширование ответов
  cache?: {
    enabled: boolean
    ttlSeconds: number  // Время жизни кэша
  }
}

// ============ Запрос на fetch с трансформациями ============

export interface FetchWithTransformsRequest {
  // ID привязки
  bindingId: string
  
  // Динамические фильтры от блоков
  filters?: FilterCondition[]
  
  // Поисковый запрос
  search?: {
    query: string
    fields: string[]
  }
  
  // Сортировка
  sort?: {
    field: string
    order: 'asc' | 'desc'
  }
  
  // Пагинация
  pagination?: {
    page: number
    pageSize: number
  }
  
  // Переопределение трансформаций (опционально)
  transformsOverride?: DataTransform[]
}

// ============ Ответ с метаданными ============

export interface FetchWithTransformsResponse<T = any> {
  success: boolean
  data: T[]
  
  meta: {
    // Количество записей
    totalCount: number      // Всего в источнике
    filteredCount: number   // После фильтрации
    returnedCount: number   // В текущем ответе
    
    // Пагинация
    page?: number
    pageSize?: number
    totalPages?: number
    hasNextPage?: boolean
    hasPrevPage?: boolean
    
    // Вычисленные агрегаты
    computed?: {
      count?: number
      sum?: Record<string, number>
      avg?: Record<string, number>
      min?: Record<string, number>
      max?: Record<string, number>
    }
    
    // Время выполнения
    responseTime?: number
  }
  
  error?: string
}
