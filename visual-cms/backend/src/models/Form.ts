import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { Page } from './Page'

// ─── Enums & Types ───────────────────────────────────────────────

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
  /** Built-in presets: email, phone, url */
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
  options?: FormFieldOption[]   // for select/radio/checkbox
  /** Column width in 12-col grid */
  width?: number
  order: number
}

export interface FormSettings {
  /** Message shown after successful submission */
  successMessage?: string
  /** Redirect URL after submission */
  redirectUrl?: string
  /** Submit button text */
  submitButtonText?: string
  /** Show reset button */
  showResetButton?: boolean
  /** Anti-spam: honeypot field name */
  honeypotField?: string
  /** Rate limit: max submissions per IP per minute */
  rateLimitPerMinute?: number
  /** Enable CAPTCHA */
  captchaEnabled?: boolean
  captchaType?: 'recaptcha-v2' | 'recaptcha-v3' | 'hcaptcha'
  captchaSiteKey?: string
  /** Store submissions in DB */
  storeSubmissions?: boolean
  /** Notification email for admin */
  notificationEmail?: string
  /** Custom CSS class for the form */
  cssClass?: string
}

// ─── Entity ──────────────────────────────────────────────────────

@Entity('forms')
@Index(['status'])
@Index(['pageId'])
export class Form {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 200 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'uuid', nullable: true })
  pageId: string | null

  @ManyToOne(() => Page, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pageId' })
  page: Page | null

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: FormStatus

  @Column({ type: 'jsonb', default: '[]' })
  fields: FormField[]

  @Column({ type: 'jsonb', default: '{}' })
  settings: FormSettings

  @OneToMany('FormDestination', 'form', {
    cascade: true,
    eager: true,
  })
  destinations: any[]

  @Column({ type: 'int', default: 0 })
  submissionsCount: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

// ─── DTOs ────────────────────────────────────────────────────────

export interface CreateFormDto {
  name: string
  description?: string
  pageId?: string
  status?: FormStatus
  fields: FormField[]
  settings?: FormSettings
}

export interface UpdateFormDto {
  name?: string
  description?: string
  pageId?: string | null
  status?: FormStatus
  fields?: FormField[]
  settings?: FormSettings
}

export interface PublicFormSubmitDto {
  formId: string
  data: Record<string, unknown>
  /** honeypot value — should be empty */
  _hp?: string
  /** CAPTCHA token */
  captchaToken?: string
  metadata?: {
    referrer?: string
    userAgent?: string
    ip?: string
  }
}

export interface FormSubmitResult {
  success: boolean
  message: string
  submissionId?: string
  errors?: Record<string, string>
  destinationResults?: {
    destinationId: string
    destinationName: string
    success: boolean
    error?: string
  }[]
}
