import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { Form } from './Form'

// ─── Destination Types ───────────────────────────────────────────

export type DestinationType =
  | 'email'
  | 'webhook'
  | 'telegram'
  | 'rest-api'
  | 'google-sheets'
  | 'slack'
  | 'custom'

// ─── Destination Configs ─────────────────────────────────────────

export interface EmailDestinationConfig {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  /** Template with {{fieldName}} placeholders */
  bodyTemplate: string
  /** 'text' | 'html' */
  format?: 'text' | 'html'
  /** SMTP server override (otherwise uses system default) */
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
  /** Auth for webhook */
  authType?: 'none' | 'bearer' | 'api-key' | 'basic'
  authToken?: string
  authHeaderName?: string
  /** Send raw field data or wrap into an envelope */
  payloadFormat?: 'raw' | 'envelope'
  /** Custom payload template (JSON string with {{field}} placeholders) */
  payloadTemplate?: string
  /** Timeout in ms */
  timeout?: number
  /** Retry on failure */
  retryCount?: number
  retryDelayMs?: number
}

export interface TelegramDestinationConfig {
  botToken: string
  chatId: string
  /** Message template with {{fieldName}} placeholders */
  messageTemplate: string
  /** Parse mode: MarkdownV2, HTML, or plain */
  parseMode?: 'MarkdownV2' | 'HTML' | ''
  /** Disable web page preview */
  disablePreview?: boolean
}

export interface GoogleSheetsDestinationConfig {
  spreadsheetId: string
  sheetName: string
  /** Service account credentials JSON */
  credentials: string
  /** Column mapping: formFieldName -> column letter/name */
  columnMapping: Record<string, string>
  /** Add timestamp column */
  addTimestamp?: boolean
  timestampColumn?: string
}

export interface SlackDestinationConfig {
  webhookUrl: string
  channel?: string
  username?: string
  iconEmoji?: string
  /** Message template with {{fieldName}} placeholders */
  messageTemplate: string
}

export interface RestApiDestinationConfig {
  url: string
  method: 'POST' | 'PUT' | 'PATCH'
  headers?: Record<string, string>
  authType?: 'none' | 'bearer' | 'api-key' | 'basic' | 'oauth2'
  authConfig?: Record<string, string>
  /** Field mapping: formFieldName -> apiFieldName */
  fieldMapping?: Record<string, string>
  /** Static extra fields to include */
  extraFields?: Record<string, unknown>
  timeout?: number
  retryCount?: number
}

export interface CustomDestinationConfig {
  /** Handler function name (for server-side plugins) */
  handler: string
  config: Record<string, unknown>
}

export type DestinationConfig =
  | EmailDestinationConfig
  | WebhookDestinationConfig
  | TelegramDestinationConfig
  | GoogleSheetsDestinationConfig
  | SlackDestinationConfig
  | RestApiDestinationConfig
  | CustomDestinationConfig

// ─── Field Mapping ───────────────────────────────────────────────

export interface FieldMappingRule {
  /** Source form field name */
  sourceField: string
  /** Target field name in destination */
  targetField: string
  /** Optional transform: 'uppercase' | 'lowercase' | 'trim' | 'date-format' */
  transform?: string
  /** Static value (overrides sourceField if set) */
  staticValue?: string
}

// ─── Entity ──────────────────────────────────────────────────────

@Entity('form_destinations')
@Index(['formId'])
@Index(['type'])
export class FormDestination {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  formId: string

  @ManyToOne(() => Form, (form) => form.destinations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formId' })
  form: Form

  @Column({ type: 'varchar', length: 100 })
  name: string

  @Column({ type: 'varchar', length: 30 })
  type: DestinationType

  @Column({ type: 'jsonb' })
  config: DestinationConfig

  @Column({ type: 'jsonb', default: '[]' })
  fieldMapping: FieldMappingRule[]

  @Column({ type: 'boolean', default: true })
  isActive: boolean

  @Column({ type: 'int', default: 0 })
  priority: number

  @Column({ type: 'int', default: 0 })
  successCount: number

  @Column({ type: 'int', default: 0 })
  failureCount: number

  @Column({ type: 'text', nullable: true })
  lastError: string | null

  @Column({ type: 'timestamp', nullable: true })
  lastSuccessAt: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

// ─── DTOs ────────────────────────────────────────────────────────

export interface CreateFormDestinationDto {
  name: string
  type: DestinationType
  config: DestinationConfig
  fieldMapping?: FieldMappingRule[]
  isActive?: boolean
  priority?: number
}

export interface UpdateFormDestinationDto {
  name?: string
  type?: DestinationType
  config?: DestinationConfig
  fieldMapping?: FieldMappingRule[]
  isActive?: boolean
  priority?: number
}
