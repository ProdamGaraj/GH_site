import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm'

/**
 * Оверлей-переводы полей estate-сущностей (паттерн из CMS `Translation`).
 *
 * Контент языка по умолчанию (ru) лежит в самих сущностях. Здесь — только
 * оверрайды для uz/en, по ключу (entityType, entityId, locale, field).
 *
 * `value` — text. Для jsonb-полей (yardFeatures, stats, badges) значение
 * хранится как JSON-строка и парсится при наложении (см. services/i18n.ts).
 *
 * Отсутствие строки = фолбэк на базовое (ru) значение.
 */
@Entity('estate_translations')
@Unique(['entityType', 'entityId', 'locale', 'field'])
@Index(['entityType', 'entityId', 'locale'])
export class EstateTranslation {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** complex | house | apartment */
  @Column({ length: 20 })
  entityType!: string

  @Column({ type: 'uuid' })
  entityId!: string

  /** Язык оверрайда: uz | en (ru не хранится — он базовый). */
  @Column({ length: 10 })
  locale!: string

  /** Имя переводимого поля (name, intro, yardFeatures, stats, badges, …). */
  @Column({ length: 60 })
  field!: string

  @Column({ type: 'text', default: '' })
  value!: string

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
