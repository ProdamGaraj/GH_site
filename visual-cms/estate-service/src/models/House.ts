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
 * Дом / корпус внутри ЖК.
 *
 * `floors` — строка ("16", "9 и 16"): этажность может быть текстом → переводимо.
 * `deadline` — срок сдачи ("1 кв. 2028") → переводимо.
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
   * ID дома в MacroCRM. Квартиры из CRM привязаны к houseId, а у нас висят на
   * House через FK — синк по этому полю находит или заводит дом, не трогая
   * заведённые руками.
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

  @OneToMany(() => Apartment, (apartment) => apartment.house)
  apartments!: Apartment[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
