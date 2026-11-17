import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

/**
 * Вид заявки:
 *   callback — обратный звонок (главная, контакты, окно консультации);
 *   project  — форма на странице проекта (+ дома проекта);
 *   plan     — форма в окне планировки (+ всё о планировке).
 */
export type LeadKind = 'callback' | 'project' | 'plan'

/** pending — ещё не ушла, sent — CRM приняла, failed — не ушла (переотправить). */
export type LeadStatus = 'pending' | 'sent' | 'failed'

/**
 * Заявка с сайта. Сначала пишется сюда, потом уходит в MacroCRM — так лид не
 * теряется, если CRM недоступна. Таблица — migrations/add-leads.sql.
 */
@Entity('leads')
@Index(['phone', 'createdAt'])
@Index(['status', 'createdAt'])
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 20 })
  kind!: LeadKind

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: LeadStatus

  @Column({ type: 'varchar', length: 200, default: '' })
  name!: string

  /** Нормализованный телефон: «+» и цифры. */
  @Column({ type: 'varchar', length: 20 })
  phone!: string

  @Column({ type: 'varchar', length: 500, default: '' })
  pagePath!: string

  @Column({ type: 'varchar', length: 10, default: '' })
  lang!: string

  /** Что прислал браузер (после проверки схемы). */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  input!: Record<string, unknown>

  /** Тело запроса в CRM — повторная отправка шлёт его же. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload!: Record<string, unknown>

  @Column({ type: 'varchar', length: 64, nullable: true })
  crmId!: string | null

  @Column({ type: 'jsonb', nullable: true })
  crmResponse!: unknown

  @Column({ type: 'text', nullable: true })
  error!: string | null

  @Column({ type: 'int', default: 0 })
  attempts!: number

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent!: string | null

  @Column({ type: 'timestamptz', nullable: true })
  sentAt!: Date | null

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date
}
