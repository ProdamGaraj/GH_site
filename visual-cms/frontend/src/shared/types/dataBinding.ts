/**
 * Data Binding Types
 * ���� ��� ������� �������� ������ � ������
 */

// ��� ��������
export type BindingType = 'input' | 'output' | 'bidirectional' | 'computed'

// ���� ��������� ������
export type InputMode = 'single' | 'repeater' | 'paginated'

// �������� ����������
export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterOrEqual'
  | 'lessOrEqual'
  | 'between'
  | 'in'
  | 'notIn'
  | 'exists'
  | 'isEmpty'
  | 'regex'

/**
 * ����������� �������
 */
export interface FilterConfig {
  id: string
  field: string
  operator: FilterOperator
  value: unknown
  isActive?: boolean
  // �� ������������ ��������
  valueSource?: 'static' | 'variable' | 'urlParam'
  variableName?: string
  paramName?: string
}

/**
 * ����������� ����������
 */
export interface SortConfig {
  id: string
  field: string
  direction: 'asc' | 'desc'
  isActive?: boolean
}

/**
 * ����������� ���������
 */
export interface PaginationConfig {
  enabled: boolean
  pageSize?: number
  strategy?: 'offset' | 'cursor'
  cursorField?: string
}

/**
 * ������� �������
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
 * ������ ����
 */
export interface FieldMapping {
  id: string
  targetProperty: string      // �������� �����: content, attributes.src, styles.color
  sourceField: string         // ��� ������: title, user.profile.avatar
  transform?: string          // JavaScript ������� ��� �������������
  fallbackValue?: unknown     // ������� ��������
  fallbackField?: string      // ������� ����
  condition?: ConditionalMapping // ������� �������
}

/**
 * ����������� ������� �������� (������ ������)
 */
/**
 * ����������� ��������� Repeater
 */
export interface RepeaterStatesConfig {
  loadingState?: {
    enabled: boolean
    showIcon?: boolean
    icon?: string
    message?: string
    template?: string
    useBlock?: boolean
    blockId?: string
  }
  emptyState?: {
    enabled: boolean
    showIcon?: boolean
    icon?: string
    message?: string
    template?: string
    useBlock?: boolean
    blockId?: string
  }
  errorState?: {
    enabled: boolean
    showIcon?: boolean
    icon?: string
    message?: string
    template?: string
    useBlock?: boolean
    blockId?: string
    showRetry?: boolean
    retryText?: string
  }
}

/**
 * ����������� UI ���������
 */
export interface PaginationUIConfig {
  style: 'pages' | 'loadMore' | 'infiniteScroll' | 'prevNext'
  showTotal?: boolean
  showPerPage?: boolean
  perPageOptions?: number[]
  maxPagesToShow?: number
  loadMoreText?: string
  prevText?: string
  nextText?: string
  position?: 'top' | 'bottom' | 'both'
}

export interface InputBindingConfig {
  mode: InputMode
  arrayPath?: string              // Путь к массиву для Repeater: data.items
  templateId?: string             // ID шаблона для рендеринга элементов Repeater
  filters?: FilterConfig[]        // Настройки фильтрации
  sorting?: SortConfig[]          // Настройки сортировки
  pagination?: PaginationConfig   // Настройки пагинации
  fieldMappings?: FieldMapping[]  // Маппинг полей источник -> свойство блока
  computedFields?: ComputedField[] // Вычисляемые поля
  repeaterStates?: RepeaterStatesConfig    // Состояния: loading, empty, error
  paginationUI?: PaginationUIConfig        // Кастомный UI пагинации
  transforms?: import('./transforms').DataTransform[]         // Серверные трансформации данных
  dynamicFilters?: import('./transforms').DynamicFilter[]     // Динамические фильтры (связь с блоками)
  cacheSettings?: {
    enabled: boolean
    ttl: number                   // Сколь хранить кэш в секундах
    invalidateOn?: string[]       // События для сбрасывания: ['submit', 'interval']
  }
}

/**
 * ���������� ����
 */
export interface ComputedField {
  id: string
  name: string                    // �� ��������������� ����
  expression: string              // JavaScript ���������
  dependencies?: string[]         // ���������� �� ����� ���������
}

/**
 * ������� ��� ������
 */
export interface SuccessAction {
  action: 'none' | 'showMessage' | 'redirect' | 'refreshData' | 'resetForm' | 'hideBlock' | 'custom'
  message?: string
  redirectUrl?: string
  callback?: string
}

/**
 * ������� ��� ������
 */
export interface ErrorAction {
  action: 'showError' | 'showField' | 'retry' | 'custom'
  message?: string
  retryCount?: number
  retryDelay?: number
  callback?: string
}

/**
 * ��������� ������
 */
export interface ButtonStates {
  loading?: string
  success?: string
  error?: string
  disableOnSubmit?: boolean
}

/**
 * ����������� �������� �������� (������ ������)
 */
export interface OutputBindingConfig {
  trigger: 'submit' | 'click' | 'change' | 'blur' | 'interval' | 'custom'
  endpoint?: string               // URL ��� ������������� endpoint
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  contentType?: string            // Content-Type ���������
  payloadMappings: FieldMapping[] // ������ ������� ����� -> ���� �������
  debounce?: number               // ������� ��� change trigger
  intervalSeconds?: number        // ������� ��� ������������
  customTrigger?: string          // �� ���������� �������
  validation?: {
    enabled: boolean
    rules?: ValidationRule[]
  }
  onSuccess?: SuccessAction       // ������� ��� ������
  onError?: ErrorAction           // ������� ��� ������
  buttonStates?: ButtonStates     // ��������� ������
}

/**
 * ������ ���������
 */
export interface ValidationRule {
  field: string
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern' | 'min' | 'max' | 'custom'
  value?: unknown
  message: string
}

/**
 * ����������� ��������
 */
export interface BindingConfig {
  inputConfig?: InputBindingConfig
  outputConfig?: OutputBindingConfig
  computedFields?: ComputedField[]
  refreshInterval?: number        // �� real-time ���������� (ms)
}

/**
 * ����� �������� ������
 */
export interface DataBinding {
  id: string
  blockId: string                 // ID �����
  pageId?: string | null          // ID �������� (�����������)
  dataSourceId: string            // ID ��������� ������
  bindingType: BindingType        // ��� ��������
  config: BindingConfig           // �����������
  isActive: boolean               // ������ �� ��������
  priority: number                // �������� (��� ������������� ��������)
  lastFetchAt?: string | null     // ���� ���������� �������
  lastFetchStatus?: 'success' | 'error' | 'pending' | null
  lastFetchError?: string | null
  createdAt: string
  updatedAt: string
  dataSource?: {
    id: string
    name: string
    type: string
  }
}

/**
 * ����� �� �������� ��������
 */
export interface CreateDataBindingRequest {
  blockId: string
  pageId?: string
  dataSourceId: string
  bindingType: BindingType
  config: BindingConfig
  isActive?: boolean
  priority?: number
}

/**
 * ����� �� ���������� ��������
 */
export interface UpdateDataBindingRequest {
  dataSourceId?: string
  bindingType?: BindingType
  config?: BindingConfig
  isActive?: boolean
  priority?: number
}

/**
 * ����� �� ��������� ������ ����� ��������
 */
export interface FetchWithBindingRequest {
  bindingId?: string
  blockId?: string
  pageId?: string
  page?: number
  variables?: Record<string, unknown>
  urlParams?: Record<string, string>
}

/**
 * �������� ��������� ������
 */
export interface FetchDataResult {
  success: boolean
  data: unknown
  error?: string
  metadata: {
    total: number
    filtered: number
    mode?: InputMode
    page?: number
    totalPages?: number
    responseTime: number
  }
}

/**
 * �������� ��������� ������ ��������
 */
export interface DirectFetchRequest {
  dataSourceId: string
  filters?: FilterConfig[]
  sorting?: SortConfig[]
  pagination?: PaginationConfig
  arrayPath?: string
  page?: number
  variables?: Record<string, unknown>
  urlParams?: Record<string, string>
}

/**
 * ����� ���� ������ (��� ��������������� ��������)
 */
export interface DataFieldSchema {
  path: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null'
  sample?: unknown
  children?: DataFieldSchema[]
}