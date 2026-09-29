import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'
import { Complex } from './Complex'
import { Apartment } from './Apartment'

/**
 * Дом / корпус — единица MacroCRM. Проект (Complex) объединяет дома в одну
 * страницу и, по желанию, одну карточку на главной.
 *
 * Общие тексты, медиа и карта — у проекта; дом уточняет своё: пустое поле
 * дома берётся из проекта.
 *
 * `floors` — строка ("16", "9 и 16"): этажность может быть текстом → переводимо.
 * `deadline` — ручной срок сдачи ("1 кв. 2028") → переводимо; пусто — срок из
 * CRM (`crmServiceYear/Month`) на языке страницы.
 */
@Entity('houses')
export class House {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  complexId!: string

  @ManyToOne(() => Complex, (complex) => complex.houses, { onDelete: 'CASCADE' })
  complex!: Complex

  /**
   * ID дома в MacroCRM — единственная связь с CRM. Квартиры из CRM привязаны к
   * houseId; синхронизация находит дом по этому полю. Дом заводит админ
   * (с ID), синхронизация его только наполняет.
   */
  @Index({ unique: true })
  @Column({ type: 'int', nullable: true })
  externalId!: number | null

  @Column({ type: 'int', default: 0 })
  order!: number

  // --- Переводимые ---
  @Column({ length: 120, default: '' })
  name!: string

  @Column({ length: 60, default: '' })
  floors!: string

  @Column({ length: 60, default: '' })
  deadline!: string

  @Column({ length: 60, default: '' })
  className!: string

  // --- Числовые ---
  @Column({ type: 'int', nullable: true })
  entrances?: number | null

  // --- Срок сдачи из CRM (inServiceYear/Month) ---
  @Column({ type: 'int', nullable: true })
  crmServiceYear!: number | null

  @Column({ type: 'int', nullable: true })
  crmServiceMonth!: number | null

  // --- Карточка дома на главной (когда проект показывается домами) ---
  @Column({ type: 'boolean', default: true })
  showOnSite!: boolean

  /** active | sold_out — «Распродано» на карточке дома. */
  @Column({ length: 20, default: 'active' })
  status!: string

  /** Описание карточки; пусто — интро проекта. Переводимо. */
  @Column({ type: 'text', default: '' })
  intro!: string

  /** Картинка карточки; пусто — как у проекта. */
  @Column({ length: 500, default: '' })
  cardImage!: string

  /** Теги карточки; пусто — как у проекта. Переводимый список. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  cardTags!: string[]

  /** Класс для фильтра на главной; пусто — как у проекта. */
  @Column({ length: 20, default: '' })
  filterClass!: string

  @OneToMany(() => Apartment, (apartment) => apartment.house)
  apartments!: Apartment[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
