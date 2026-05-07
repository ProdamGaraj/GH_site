import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index
} from 'typeorm'

/**
 * Типы источников данных
 */
export type DataSourceType = 
  | 'rest-api'
  | 'feed'
  | 'graphql'
  | 'database'
  | 'external'
  | 'static'
  | 'computed'
  | 'form-data'
  | 'page-variable'

/**
 * Статус источника данных
 */
export type DataSourceStatus = 'active' | 'draft' | 'archived'

/**
 * Статус последнего запроса
 */
export type LastFetchStatus = 'success' | 'error'

/**
 * Модель Data Source
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 1.1 Backend: Models & API
 */
@Entity('data_sources')
@Index(['type'])
@Index(['status'])
@Index(['pollingEnabled'])
export class DataSource {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 255 })
  name!: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ 
    type: 'varchar', 
    length: 50 
  })
  type!: DataSourceType

  /**
   * Конфигурация источника данных
   * Содержит URL, headers, query params, body и т.д.
   * Структура зависит от типа источника
   */
  @Column('jsonb')
  config!: Record<string, unknown>

  /**
   * Конфигурация авторизации
   * Credentials ЗАШИФРОВАНЫ при сохранении
   * Содержит type, token/key/username/password и т.д.
   */
  @Column('jsonb', { nullable: true })
  authConfig?: Record<string, unknown>

  @Column({ 
    type: 'varchar', 
    length: 20, 
    default: 'active' 
  })
  status!: DataSourceStatus

  /**
   * ID группы/папки для организации
   */
  @Column({ type: 'uuid', nullable: true })
  groupId?: string

  /**
   * Теги для поиска и фильтрации
   */
  @Column('simple-array', { nullable: true })
  tags?: string[]

  /**
   * Время последнего запроса данных
   */
  @Column({ type: 'timestamp', nullable: true })
  lastFetchAt?: Date

  /**
   * Статус последнего запроса
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  lastFetchStatus?: LastFetchStatus

  /**
   * Сообщение об ошибке последнего запроса
   */
  @Column({ type: 'text', nullable: true })
  lastFetchError?: string

  // === Feed-specific fields ===

  /**
   * Включен ли polling (для Feed источников)
   */
  @Column({ type: 'boolean', default: false })
  pollingEnabled!: boolean

  /**
   * Интервал polling в секундах
   */
  @Column({ type: 'integer', nullable: true })
  pollingInterval?: number

  /**
   * Секрет для webhook нотификаций (Feed)
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  webhookSecret?: string

  // === Versioning ===

  @Column({ type: 'integer', default: 1 })
  version!: number

  // === Audit ===

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  /**
   * ID пользователя-создателя
   */
  @Column({ type: 'uuid', nullable: true })
  createdBy?: string
}
