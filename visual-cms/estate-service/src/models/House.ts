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
 * Дом / корпус — единица MacroCRM. Проект (Complex) объединяет дома: страница
 * и карточка на главной — только у проекта. Дом полей проекта не меняет — он
 * источник квартир, планировок и срока сдачи для страницы проекта.
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

  @OneToMany(() => Apartment, (apartment) => apartment.house)
  apartments!: Apartment[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
