import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm'
import { DataSource as DataSourceEntity } from './DataSource'
import { Page } from './Page'

/**
 * Data Binding Model
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 2.1 Backend: Data Fetching Service
 * 
 * Связь между блоком и источником данных.
 * Хранит конфигурацию биндинга (маппинг полей, фильтры, сортировка и т.д.)
 */

/**
 * Тип биндинга
 */
export type BindingType = 'input' | 'output'

/**
 * Режим INPUT биндинга
 */
export type InputMode = 'single' | 'repeater'

/**
 * Оператор фильтра
 */
export type FilterOperator = 
  | 'equals' 
  | 'notEquals'
  | 'contains' 
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan' 
  | 'greaterThanOrEqual'
  | 'lessThan' 
  | 'lessThanOrEqual'
  | 'in' 
  | 'notIn'
  | 'between'
  | 'exists'
  | 'notExists'
  | 'isEmpty'
  | 'isNotEmpty'

/**
 * Источник значения фильтра
 */
export type FilterValueSource = 'static' | 'variable' | 'urlParam' | 'formField'

/**
 * Конфигурация фильтра
 */
export interface FilterConfig {
  id: string
  field: string               // Поле для фильтрации
  operator: FilterOperator    // Оператор
  value?: unknown             // Значение (для static)
  valueSource: FilterValueSource
  variableName?: string       // Имя переменной (для variable)
  urlParamName?: string       // Имя URL параметра
  formFieldId?: string        // ID поля формы
  logicalOperator?: 'and' | 'or'  // Связь с предыдущим фильтром
}

/**
 * Конфигурация сортировки
 */
export interface SortConfig {
  field: string
  direction: 'asc' | 'desc'
  dataType?: 'string' | 'number' | 'date'
}

/**
 * Стиль пагинации
 */
export type PaginationStyle = 'numbers' | 'loadMore' | 'infinite'

/**
 * Конфигурация пагинации
 */
export interface PaginationConfig {
  enabled: boolean
  itemsPerPage: number
  style: PaginationStyle
  showTotal?: boolean
}

/**
 * Маппинг поля
 */
export interface FieldMapping {
  id: string
  targetProperty: string      // Свойство блока: content, attributes.src, styles.color
  sourceField: string         // Поле данных: title, user.profile.avatar
  transform?: string          // JavaScript функция для трансформации
  fallbackValue?: unknown     // Запасное значение
  fallbackField?: string      // Запасное поле
  condition?: ConditionalMapping // Условный маппинг
}

/**
 * Условный маппинг
 */
export interface ConditionalMapping {
  condition: {
    field: string
    operator: FilterOperator
    value: unknown
  }
  thenValue: unknown | { field: string }
  elseValue?: unknown | { field: string }
}

/**
 * Триггер для OUTPUT
 */
export type OutputTrigger = 
  | 'formSubmit' 
  | 'buttonClick' 
  | 'inputChange' 
  | 'onBlur' 
  | 'onInterval' 
  | 'pageUnload'
  | 'customEvent'

/**
 * Действие после успешной отправки
 */
export interface SuccessAction {
  type: 'showMessage' | 'redirect' | 'updateBlock' | 'showHide' | 'refreshData' | 'customScript'
  config: Record<string, unknown>
}

/**
 * Конфигурация INPUT биндинга
 */
export interface InputBindingConfig {
  mode: InputMode
  
  // Single Item mode
  fieldMappings?: FieldMapping[]
  
  // Repeater mode
  arrayPath?: string          // JSON path к массиву: data.items, response.products
  templateId?: string         // ID template для repeater
  useCurrentBlock?: boolean   // Использовать текущий блок как template
  keyField?: string           // Поле-идентификатор элемента
  
  // Общие настройки
  filters?: FilterConfig[]
  sorting?: SortConfig[]
  pagination?: PaginationConfig
  
  // Loading/Error states
  loadingTemplate?: string    // ID template или 'skeleton' | 'spinner'
  emptyStateTemplate?: string // ID template или текст сообщения
  errorStateTemplate?: string // ID template
  
  // Caching
  cacheEnabled?: boolean
  cacheTTL?: number           // секунды
  cachePolicy?: 'cache-first' | 'network-first' | 'network-only' | 'cache-only'
  
  // Loading strategy
  loadOn?: 'pageLoad' | 'userInteraction' | 'interval' | 'onDemand' | 'onEvent' | 'onVariableChange'
  loadInterval?: number       // секунды (для interval)
  loadEvent?: string          // имя события (для onEvent)
  loadVariable?: string       // имя переменной (для onVariableChange)
}

/**
 * Правило валидации
 */
export interface ValidationRule {
  type: 'required' | 'email' | 'url' | 'phone' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'custom'
  value?: unknown             // Параметр правила (min length, pattern и т.д.)
  message: string             // Сообщение об ошибке
  customFunction?: string     // JS функция для custom валидации
}

/**
 * Конфигурация OUTPUT биндинга
 */
export interface OutputBindingConfig {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  endpointPath?: string       // Динамический путь (может содержать переменные)
  
  // Payload
  payloadMappings: FieldMapping[]
  additionalData?: {
    includeTimestamp?: boolean
    includePageUrl?: boolean
    includeUserAgent?: boolean
    includeReferrer?: boolean
    includeUrlParams?: boolean
    customFields?: Record<string, unknown>
  }
  
  // Trigger
  trigger: OutputTrigger
  triggerCondition?: ConditionalMapping
  triggerInterval?: number    // секунды (для onInterval)
  triggerEvent?: string       // имя события (для customEvent)
  
  // Validation
  validationRules?: Record<string, ValidationRule[]> // fieldId -> rules
  
  // Response handling
  onSuccess?: SuccessAction[]
  onError?: {
    showMessage?: string
    retryEnabled?: boolean
    retryAttempts?: number
    retryDelay?: number       // миллисекунды
  }
  
  // Button states
  buttonStates?: {
    loading?: { text?: string; disabled?: boolean }
    success?: { text?: string; duration?: number }
    error?: { text?: string; duration?: number }
  }
}

/**
 * Дополнительный источник данных для join
 */
export interface AdditionalDataSource {
  dataSourceId: string
  alias: string
  joinCondition: {
    primaryField: string
    additionalField: string
  }
  joinType: 'left' | 'inner'
}

/**
 * Вычисляемое поле
 */
export interface ComputedField {
  name: string
  expression: string          // JavaScript функция
  isAsync?: boolean
  dependencies?: string[]     // Поля, от которых зависит
}

/**
 * Полная конфигурация биндинга
 */
export interface DataBindingFullConfig {
  // Основной источник
  dataSourceId: string
  
  // INPUT или OUTPUT
  bindingType: BindingType
  
  // Конфигурация в зависимости от типа
  inputConfig?: InputBindingConfig
  outputConfig?: OutputBindingConfig
  
  // Дополнительные источники (для join)
  additionalSources?: AdditionalDataSource[]
  
  // Вычисляемые поля
  computedFields?: ComputedField[]
  
  // Tracking
  trackingEnabled?: boolean
  excludeFromTracking?: string[] // Поля для исключения из логов
}

@Entity('data_bindings')
@Index(['blockId'])
@Index(['pageId'])
export class DataBinding {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * ID блока, к которому привязаны данные
   */
  @Column({ type: 'varchar', length: 255 })
  blockId: string

  /**
   * Связь со страницей
   */
  @Column({ type: 'uuid', nullable: true })
  pageId: string | null

  @ManyToOne(() => Page, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pageId' })
  page: Page | null

  /**
   * Связь с источником данных
   */
  @Column({ type: 'uuid' })
  dataSourceId: string

  @ManyToOne(() => DataSourceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dataSourceId' })
  dataSource: DataSourceEntity

  /**
   * Тип биндинга: input (чтение) или output (запись)
   */
  @Column({ type: 'varchar', length: 20 })
  bindingType: BindingType

  /**
   * Полная конфигурация биндинга (JSONB)
   */
  @Column({ type: 'jsonb' })
  config: DataBindingFullConfig

  /**
   * Активен ли биндинг
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean

  /**
   * Приоритет (для определения порядка выполнения)
   */
  @Column({ type: 'int', default: 0 })
  priority: number

  /**
   * Время последнего успешного fetch
   */
  @Column({ type: 'timestamp', nullable: true })
  lastFetchAt: Date | null

  /**
   * Статус последнего fetch
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  lastFetchStatus: 'success' | 'error' | null

  /**
   * Ошибка последнего fetch
   */
  @Column({ type: 'text', nullable: true })
  lastFetchError: string | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

export default DataBinding
