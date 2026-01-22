import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm'
import { DataSource } from './DataSource'

/**
 * DataSubmission Model
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Логирование всех отправок данных для аналитики.
 * PII данные не сохраняются, IP анонимизируется.
 */

/**
 * Статус отправки
 */
export type SubmissionStatus = 'pending' | 'success' | 'failed' | 'timeout' | 'cancelled'

/**
 * Тип trigger, который вызвал отправку
 */
export type SubmissionTrigger = 
  | 'form_submit'    // Отправка формы
  | 'button_click'   // Клик по кнопке
  | 'input_change'   // Изменение input
  | 'input_blur'     // Потеря фокуса
  | 'interval'       // По интервалу
  | 'custom_event'   // Кастомное событие
  | 'api_call'       // Прямой API вызов

/**
 * HTTP методы для отправки
 */
export type SubmissionMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

@Entity('data_submissions')
@Index(['dataSourceId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['pageId', 'createdAt'])
export class DataSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /**
   * Data Source, на который отправлялись данные
   */
  @Column({ type: 'uuid', nullable: true })
  dataSourceId: string | null

  @ManyToOne(() => DataSource, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'dataSourceId' })
  dataSource: DataSource | null

  /**
   * Страница, с которой была отправка
   */
  @Column({ type: 'uuid', nullable: true })
  pageId: string | null

  /**
   * Блок, инициировавший отправку
   */
  @Column({ type: 'uuid', nullable: true })
  blockId: string | null

  /**
   * Output Binding ID
   */
  @Column({ type: 'uuid', nullable: true })
  outputBindingId: string | null

  /**
   * HTTP метод
   */
  @Column({ 
    type: 'varchar', 
    length: 10,
    default: 'POST'
  })
  method: SubmissionMethod

  /**
   * Endpoint URL (без sensitive данных)
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  endpoint: string | null

  /**
   * Trigger, вызвавший отправку
   */
  @Column({ 
    type: 'varchar', 
    length: 50,
    default: 'form_submit'
  })
  trigger: SubmissionTrigger

  /**
   * Статус отправки
   */
  @Column({ 
    type: 'varchar', 
    length: 20,
    default: 'pending'
  })
  status: SubmissionStatus

  /**
   * HTTP статус код ответа
   */
  @Column({ type: 'int', nullable: true })
  responseStatusCode: number | null

  /**
   * Время выполнения в миллисекундах
   */
  @Column({ type: 'int', nullable: true })
  durationMs: number | null

  /**
   * Количество полей в отправке (без значений для privacy)
   */
  @Column({ type: 'int', default: 0 })
  fieldsCount: number

  /**
   * Имена полей (без значений)
   */
  @Column({ type: 'jsonb', nullable: true })
  fieldNames: string[] | null

  /**
   * Сообщение об ошибке (если была)
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null

  /**
   * Код ошибки
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  errorCode: string | null

  /**
   * Количество validation ошибок
   */
  @Column({ type: 'int', default: 0 })
  validationErrorsCount: number

  /**
   * Имена полей с validation ошибками
   */
  @Column({ type: 'jsonb', nullable: true })
  validationErrorFields: string[] | null

  /**
   * Анонимизированный IP (первые 3 октета для IPv4)
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  anonymizedIp: string | null

  /**
   * User Agent (укороченный)
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  userAgent: string | null

  /**
   * Referrer URL
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  referrer: string | null

  /**
   * Session ID (если есть)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  sessionId: string | null

  /**
   * Была ли повторная попытка
   */
  @Column({ type: 'boolean', default: false })
  isRetry: boolean

  /**
   * Номер попытки (1 = первая)
   */
  @Column({ type: 'int', default: 1 })
  attemptNumber: number

  /**
   * ID оригинальной submission (если это retry)
   */
  @Column({ type: 'uuid', nullable: true })
  originalSubmissionId: string | null

  /**
   * Дополнительные метаданные (без PII)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null

  @CreateDateColumn()
  createdAt: Date
}

/**
 * DTO для создания записи о submission
 */
export interface CreateSubmissionDto {
  dataSourceId?: string
  pageId?: string
  blockId?: string
  outputBindingId?: string
  method: SubmissionMethod
  endpoint?: string
  trigger: SubmissionTrigger
  fieldsCount: number
  fieldNames?: string[]
  ip?: string
  userAgent?: string
  referrer?: string
  sessionId?: string
  isRetry?: boolean
  attemptNumber?: number
  originalSubmissionId?: string
  metadata?: Record<string, unknown>
}

/**
 * DTO для обновления результата submission
 */
export interface UpdateSubmissionResultDto {
  status: SubmissionStatus
  responseStatusCode?: number
  durationMs?: number
  errorMessage?: string
  errorCode?: string
  validationErrorsCount?: number
  validationErrorFields?: string[]
}
