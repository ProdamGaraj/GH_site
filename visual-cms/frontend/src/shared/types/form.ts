// ─── Form Types ──────────────────────────────────────────────────

export type FormStatus = 'draft' | 'active' | 'disabled'

export type FormFieldType =
  | 'text' | 'email' | 'phone' | 'textarea' | 'number'
  | 'select' | 'radio' | 'checkbox' | 'date' | 'time'
  | 'file' | 'hidden' | 'rating' | 'range'

export interface FormFieldOption {
  label: string
  value: string
}

export interface FormFieldValidation {
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  patternMessage?: string
  preset?: 'email' | 'phone' | 'url' | 'none'
}

export interface FormField {
  id: string
  name: string
  label: string
  type: FormFieldType
  placeholder?: string
  defaultValue?: string
  helpText?: string
  validation: FormFieldValidation
  options?: FormFieldOption[]
  width?: number
  order: number
}

export interface FormSettings {
  successMessage?: string
  redirectUrl?: string
  submitButtonText?: string
  showResetButton?: boolean
  honeypotField?: string
  rateLimitPerMinute?: number
  captchaEnabled?: boolean
  captchaType?: 'recaptcha-v2' | 'recaptcha-v3' | 'hcaptcha'
  captchaSiteKey?: string
  storeSubmissions?: boolean
  notificationEmail?: string
  cssClass?: string
}

export interface Form {
  id: string
  name: string
  description: string | null
  pageId: string | null
  status: FormStatus
  fields: FormField[]
  settings: FormSettings
  destinations: FormDestination[]
  submissionsCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateFormRequest {
  name: string
  description?: string
  pageId?: string
  status?: FormStatus
  fields: FormField[]
  settings?: FormSettings
}

export interface UpdateFormRequest {
  name?: string
  description?: string
  pageId?: string | null
  status?: FormStatus
  fields?: FormField[]
  settings?: FormSettings
}

// ─── Destination Types ───────────────────────────────────────────

export type DestinationType =
  | 'email' | 'webhook' | 'telegram' | 'rest-api'
  | 'google-sheets' | 'slack' | 'custom'

export interface EmailDestinationConfig {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  bodyTemplate: string
  format?: 'text' | 'html'
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPass?: string
  smtpSecure?: boolean
  fromName?: string
  fromEmail?: string
}

export interface WebhookDestinationConfig {
  url: string
  method: 'POST' | 'PUT' | 'PATCH'
  headers?: Record<string, string>
  authType?: 'none' | 'bearer' | 'api-key' | 'basic'
  authToken?: string
  authHeaderName?: string
  payloadFormat?: 'raw' | 'envelope'
  payloadTemplate?: string
  timeout?: number
  retryCount?: number
  retryDelayMs?: number
}

export interface TelegramDestinationConfig {
  botToken: string
  chatId: string
  messageTemplate: string
  parseMode?: 'MarkdownV2' | 'HTML' | ''
  disablePreview?: boolean
}

export interface GoogleSheetsDestinationConfig {
  spreadsheetId: string
  sheetName: string
  credentials: string
  columnMapping: Record<string, string>
  addTimestamp?: boolean
  timestampColumn?: string
}

export interface SlackDestinationConfig {
  webhookUrl: string
  channel?: string
  username?: string
  iconEmoji?: string
  messageTemplate: string
}

export interface RestApiDestinationConfig {
  url: string
  method: 'POST' | 'PUT' | 'PATCH'
  headers?: Record<string, string>
  authType?: 'none' | 'bearer' | 'api-key' | 'basic' | 'oauth2'
  authConfig?: Record<string, string>
  fieldMapping?: Record<string, string>
  extraFields?: Record<string, unknown>
  timeout?: number
  retryCount?: number
}

export type DestinationConfig =
  | EmailDestinationConfig
  | WebhookDestinationConfig
  | TelegramDestinationConfig
  | GoogleSheetsDestinationConfig
  | SlackDestinationConfig
  | RestApiDestinationConfig

export interface FieldMappingRule {
  sourceField: string
  targetField: string
  transform?: string
  staticValue?: string
}

export interface FormDestination {
  id: string
  formId: string
  name: string
  type: DestinationType
  config: DestinationConfig
  fieldMapping: FieldMappingRule[]
  isActive: boolean
  priority: number
  successCount: number
  failureCount: number
  lastError: string | null
  lastSuccessAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateDestinationRequest {
  name: string
  type: DestinationType
  config: DestinationConfig
  fieldMapping?: FieldMappingRule[]
  isActive?: boolean
  priority?: number
}

export interface UpdateDestinationRequest {
  name?: string
  type?: DestinationType
  config?: DestinationConfig
  fieldMapping?: FieldMappingRule[]
  isActive?: boolean
  priority?: number
}

// ─── Submission Types ────────────────────────────────────────────

export type FormSubmissionStatus = 'success' | 'partial' | 'failed'

export interface FormSubmissionLog {
  id: string
  formId: string
  data: Record<string, unknown>
  status: FormSubmissionStatus
  destinationResults: {
    destinationId: string
    destinationName: string
    success: boolean
    error?: string
    durationMs: number
  }[] | null
  ip: string | null
  userAgent: string | null
  referrer: string | null
  createdAt: string
}

export interface SubmissionStats {
  formId: string
  total: number
  byStatus: { status: string; count: number }[]
}

export interface DestinationTestResult {
  destinationId: string
  destinationName: string
  success: boolean
  error?: string
  durationMs: number
}

// ─── Constants ───────────────────────────────────────────────────

export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Текст',
  email: 'Email',
  phone: 'Телефон',
  textarea: 'Многострочный текст',
  number: 'Число',
  select: 'Выпадающий список',
  radio: 'Радио-кнопки',
  checkbox: 'Чекбокс',
  date: 'Дата',
  time: 'Время',
  file: 'Файл',
  hidden: 'Скрытое поле',
  rating: 'Рейтинг',
  range: 'Ползунок',
}

export const DESTINATION_TYPE_LABELS: Record<DestinationType, string> = {
  email: 'Email',
  webhook: 'Webhook',
  telegram: 'Telegram',
  'rest-api': 'REST API',
  'google-sheets': 'Google Sheets',
  slack: 'Slack',
  custom: 'Пользовательский',
}

export const DESTINATION_TYPE_ICONS: Record<DestinationType, string> = {
  email: '📧',
  webhook: '🔗',
  telegram: '✈️',
  'rest-api': '🌐',
  'google-sheets': '📊',
  slack: '💬',
  custom: '⚙️',
}
