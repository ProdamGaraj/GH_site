/**
 * Output Binding Types
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Типы для отправки данных (формы, кнопки, API calls).
 */

// ============ Validation Types ============

/**
 * Типы правил валидации
 */
export type ValidationRuleType = 
  | 'required'
  | 'email'
  | 'url'
  | 'phone'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'enum'
  | 'date'
  | 'dateRange'
  | 'creditCard'
  | 'custom'

/**
 * Правило валидации
 */
export interface ValidationRule {
  type: ValidationRuleType
  value?: unknown
  message?: string
  condition?: string
}

/**
 * Правило санитизации
 */
export interface SanitizeRule {
  type: 'trim' | 'lowercase' | 'uppercase' | 'stripHtml' | 'escapeHtml' | 'normalizePhone' | 'custom'
  customFn?: string
}

/**
 * Конфигурация валидации поля
 */
export interface FieldValidation {
  fieldName: string
  rules: ValidationRule[]
  sanitize?: SanitizeRule[]
}

// ============ Output Binding Types ============

/**
 * HTTP методы для отправки
 */
export type OutputMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Trigger типы
 */
export type OutputTrigger = 
  | 'form_submit'    // При отправке формы
  | 'button_click'   // При клике на кнопку
  | 'input_change'   // При изменении input
  | 'input_blur'     // При потере фокуса
  | 'interval'       // По интервалу
  | 'custom_event'   // Кастомное событие

/**
 * Типы трансформации полей
 */
export type FieldTransform = 'none' | 'toString' | 'toNumber' | 'toBoolean' | 'toDate' | 'custom'

/**
 * Mapping одного поля
 */
export interface FieldMapping {
  sourceField: string        // Имя поля в форме/блоке
  targetField: string        // Имя поля в API
  transform?: FieldTransform
  customTransform?: string   // JS функция для custom transform
  defaultValue?: unknown     // Значение по умолчанию
  skipIfEmpty?: boolean      // Не отправлять если пустое
  required?: boolean         // Обязательное поле
}

/**
 * Дополнительные данные для отправки
 */
export interface AdditionalData {
  timestamp?: boolean
  pageUrl?: boolean
  sessionId?: boolean
  customFields?: Record<string, unknown>
  // Расширенные поля
  static?: Record<string, unknown>  // Статические данные
  includeTimestamp?: boolean
  includePageInfo?: boolean
  includeUserAgent?: boolean
  includeReferrer?: boolean
}

/**
 * Действие при успехе
 */
export type SuccessActionType = 
  | 'show_message'
  | 'redirect'
  | 'update_block'
  | 'show_element'
  | 'hide_element'
  | 'reset_form'
  | 'custom'

/**
 * Конфигурация действия при успехе
 */
export interface SuccessAction {
  type: SuccessActionType
  message?: string           // Для show_message
  redirectUrl?: string       // Для redirect
  redirectDelay?: number     // Задержка перед redirect (ms)
  blockId?: string           // Для update_block
  elementSelector?: string   // Для show/hide_element
  customAction?: string      // JS код для custom
}

/**
 * Действие при ошибке
 */
export type ErrorActionType = 
  | 'show_message'
  | 'show_inline_errors'
  | 'show_toast'
  | 'scroll_to_error'
  | 'focus_error_field'
  | 'shake_form'
  | 'custom'

/**
 * Конфигурация действия при ошибке
 */
export interface ErrorAction {
  type: ErrorActionType
  message?: string
  showFieldErrors?: boolean
  customAction?: string
}

/**
 * Настройки retry
 */
export interface RetryConfig {
  enabled: boolean
  maxAttempts: number
  delayMs: number
  exponentialBackoff?: boolean
  retryOn?: number[]  // HTTP коды для retry
}

/**
 * Состояния кнопки/формы
 */
export interface ButtonStates {
  normal: {
    text: string
    className?: string
    icon?: string
  }
  loading: {
    text: string
    className?: string
    showSpinner?: boolean
    disabled?: boolean
  }
  success: {
    text: string
    className?: string
    icon?: string
    duration?: number  // Как долго показывать
  }
  error: {
    text: string
    className?: string
    icon?: string
    duration?: number
  }
}

/**
 * Конфигурация условного trigger
 */
export interface ConditionalTrigger {
  trigger: OutputTrigger     // Тип триггера
  condition: string          // JS выражение
  triggerOnTrue?: boolean    // Trigger если true (по умолчанию)
  enabled: boolean           // Включен ли
  description?: string       // Описание условия
}

/**
 * Output Binding - полная конфигурация
 */
export interface OutputBinding {
  id: string
  name: string
  description?: string
  
  // Куда отправляем
  dataSourceId?: string      // Ссылка на Data Source
  endpoint?: string          // Или прямой URL
  method: OutputMethod
  contentType?: string       // Content-Type заголовок
  
  // Что отправляем
  fieldMappings: FieldMapping[]
  additionalData?: AdditionalData
  
  // Когда отправляем
  trigger: OutputTrigger
  triggerElementSelector?: string  // CSS selector элемента (для button_click)
  triggerCondition?: ConditionalTrigger
  conditionalTriggers?: ConditionalTrigger[]  // Дополнительные условные триггеры
  intervalMs?: number        // Для interval trigger
  customEventName?: string   // Для custom_event
  
  // Валидация
  validations: FieldValidation[]
  validateOnChange?: boolean
  validateOnBlur?: boolean
  
  // Обработка ответа
  successActions: SuccessAction[]
  errorActions: ErrorAction[]
  retryConfig?: RetryConfig
  
  // UI состояния
  buttonStates?: ButtonStates
  
  // Мета
  enabled: boolean
  order?: number             // Порядок выполнения если несколько bindings
}

/**
 * Сокращённая версия для создания
 */
export interface CreateOutputBindingRequest {
  name: string
  description?: string
  dataSourceId?: string
  endpoint?: string
  method?: OutputMethod
  fieldMappings?: FieldMapping[]
  additionalData?: AdditionalData
  trigger?: OutputTrigger
  triggerElementSelector?: string
  triggerCondition?: ConditionalTrigger
  intervalMs?: number
  customEventName?: string
  validations?: FieldValidation[]
  validateOnChange?: boolean
  validateOnBlur?: boolean
  successActions?: SuccessAction[]
  errorActions?: ErrorAction[]
  retryConfig?: RetryConfig
  buttonStates?: ButtonStates
  enabled?: boolean
}

/**
 * Запрос на отправку данных
 */
export interface SubmitDataRequest {
  dataSourceId?: string
  outputBindingId?: string
  endpoint?: string
  method?: OutputMethod
  data: Record<string, unknown>
  fieldMapping?: Record<string, string>
  additionalData?: AdditionalData
  validations?: FieldValidation[]
  pageId?: string
  blockId?: string
  trigger?: OutputTrigger
  isRetry?: boolean
  attemptNumber?: number
  originalSubmissionId?: string
}

/**
 * Результат отправки
 */
export interface SubmitResult {
  success: boolean
  submissionId: string
  data?: unknown
  status?: number
  error?: {
    code: string
    message: string
    details?: unknown
  }
  validationErrors?: Record<string, string[]>
}

/**
 * Результат клиентской валидации
 */
export interface ClientValidationResult {
  isValid: boolean
  errors: Record<string, string[]>
  firstErrorField?: string
}

/**
 * Состояние отправки
 */
export type SubmitState = 'idle' | 'validating' | 'submitting' | 'success' | 'error'

/**
 * Состояние hook useOutputBinding
 */
export interface OutputBindingState {
  state: SubmitState
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error: string | null
  validationErrors: Record<string, string[]>
  lastResult: SubmitResult | null
  attemptCount: number
}

// ============ Submission Log Types ============

/**
 * Статус отправки
 */
export type SubmissionStatus = 'pending' | 'success' | 'failed' | 'timeout' | 'cancelled'

/**
 * Запись о submission (для аналитики)
 */
export interface DataSubmission {
  id: string
  dataSourceId: string | null
  pageId: string | null
  blockId: string | null
  outputBindingId: string | null
  method: OutputMethod
  endpoint: string | null
  trigger: OutputTrigger
  status: SubmissionStatus
  responseStatusCode: number | null
  durationMs: number | null
  fieldsCount: number
  fieldNames: string[] | null
  errorMessage: string | null
  errorCode: string | null
  validationErrorsCount: number
  validationErrorFields: string[] | null
  anonymizedIp: string | null
  userAgent: string | null
  referrer: string | null
  isRetry: boolean
  attemptNumber: number
  createdAt: string
}

/**
 * Статистика submissions
 */
export interface SubmissionStats {
  total: number
  byStatus: Array<{
    status: SubmissionStatus
    count: number
    avg_duration: number
    validation_errors: number
  }>
}

// ============ Default Values ============

/**
 * Default button states
 */
export const DEFAULT_BUTTON_STATES: ButtonStates = {
  normal: {
    text: 'Отправить',
  },
  loading: {
    text: 'Отправка...',
    showSpinner: true,
    disabled: true,
  },
  success: {
    text: 'Отправлено!',
    icon: '✓',
    duration: 3000,
  },
  error: {
    text: 'Ошибка',
    icon: '✗',
    duration: 3000,
  },
}

/**
 * Default retry config
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  enabled: false,
  maxAttempts: 3,
  delayMs: 1000,
  exponentialBackoff: true,
}

/**
 * Список доступных правил валидации
 */
export const VALIDATION_RULES: Record<ValidationRuleType, { label: string; hasValue: boolean; valueType?: string }> = {
  required: { label: 'Обязательное', hasValue: false },
  email: { label: 'Email', hasValue: false },
  url: { label: 'URL', hasValue: false },
  phone: { label: 'Телефон', hasValue: false },
  minLength: { label: 'Мин. длина', hasValue: true, valueType: 'number' },
  maxLength: { label: 'Макс. длина', hasValue: true, valueType: 'number' },
  min: { label: 'Мин. значение', hasValue: true, valueType: 'number' },
  max: { label: 'Макс. значение', hasValue: true, valueType: 'number' },
  pattern: { label: 'Паттерн (regex)', hasValue: true, valueType: 'string' },
  enum: { label: 'Допустимые значения', hasValue: true, valueType: 'array' },
  date: { label: 'Дата', hasValue: false },
  dateRange: { label: 'Диапазон дат', hasValue: true, valueType: 'object' },
  creditCard: { label: 'Номер карты', hasValue: false },
  custom: { label: 'Кастомная', hasValue: true, valueType: 'function' },
}

/**
 * Trigger labels
 */
export const TRIGGER_LABELS: Record<OutputTrigger, string> = {
  form_submit: 'При отправке формы',
  button_click: 'При клике на кнопку',
  input_change: 'При изменении поля',
  input_blur: 'При потере фокуса',
  interval: 'По интервалу',
  custom_event: 'Кастомное событие',
}

/**
 * Method labels
 */
export const METHOD_LABELS: Record<OutputMethod, string> = {
  POST: 'POST - Создание',
  PUT: 'PUT - Замена',
  PATCH: 'PATCH - Обновление',
  DELETE: 'DELETE - Удаление',
}
