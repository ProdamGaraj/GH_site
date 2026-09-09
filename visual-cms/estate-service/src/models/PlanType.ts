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
import { House } from './House'
import { Apartment } from './Apartment'

/** Файл планировки из MacroCRM (getFlatPlans). */
export interface PlanImage {
  title: string
  url: string
  thumbUrl: string
}

/**
 * Тип планировки — то, что показывается на странице проекта.
 *
 * Одна планировка приходится на много квартир: в доме 5139395 сто квартир дают
 * 57 разных пар (комнатность, площадь), а типов планировок заведомо меньше.
 * MacroCRM отдаёт планировку по одной квартире (getFlatPlans, один estateId за
 * вызов), поэтому мы обходим дом один раз, группируем ответы и храним тип.
 *
 * Ключ группировки — `signature`: planName плюс хеш набора ссылок на файлы.
 * Через planName в одиночку нельзя: имена вида «К2-54.65-6» уникальны в пределах
 * корпуса, но общий набор файлов надёжнее — он и есть то, что видит покупатель.
 *
 * Числовые агрегаты (диапазоны площади и цены, этажи, подъезды) лежат прямо
 * здесь: карточка фильтруется по ним, не поднимая квартиры.
 */
@Entity('plan_types')
@Index(['houseId', 'signature'], { unique: true })
export class PlanType {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  complexId!: string

  @ManyToOne(() => Complex, { onDelete: 'CASCADE' })
  complex!: Complex

  @Index()
  @Column({ type: 'uuid' })
  houseId!: string

  @ManyToOne(() => House, { onDelete: 'CASCADE' })
  house!: House

  /**
   * Ключ группировки. Стабилен между прогонами синка — на нём стоит upsert,
   * поэтому id типа переживает синхронизацию, а вместе с ним и переводы
   * в estate_translations.
   */
  @Column({ length: 200 })
  signature!: string

  /**
   * Имя планировки в CRM: «К2-54.65-6».
   *
   * Число внутри имени НЕ равно общей площади: у квартиры 5139408 planName
   * «К2-54.65-6» при areaTotal 56.12. Разбирать имя на части нельзя.
   */
  @Column({ length: 200, default: '' })
  planName!: string

  @Column({ type: 'jsonb', default: () => "'[]'" })
  images!: PlanImage[]

  /** 3D-тур. Есть примерно у половины квартир и только в одном доме. */
  @Column({ length: 500, default: '' })
  panoUrl!: string

  // --- Характеристики типа ---

  @Column({ type: 'int', default: 0 })
  rooms!: number

  @Column({ type: 'boolean', default: false })
  isStudio!: boolean

  /**
   * Площадь — диапазон: один planName накрывает квартиры, отличающиеся
   * на сотые доли метра. Показывать одно число значит врать.
   */
  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  areaMin!: number

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  areaMax!: number

  /** Цены в UZS. Macro отдаёт копейки — делим на приёме. */
  @Column({ type: 'bigint', default: 0 })
  priceMin!: string | number

  @Column({ type: 'bigint', default: 0 })
  priceMax!: string | number

  // --- Агрегаты по квартирам типа (для фильтров карточек) ---

  @Column({ type: 'int', default: 0 })
  apartmentsCount!: number

  @Column({ type: 'jsonb', default: () => "'[]'" })
  floors!: number[]

  @Column({ type: 'jsonb', default: () => "'[]'" })
  entrances!: number[]

  /** «двор», «бульвар», «ТРЦ Альфраганус» — заполнено у всех квартир. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  windowViews!: string[]

  @Column({ type: 'int', default: 0 })
  order!: number

  @OneToMany(() => Apartment, (apartment) => apartment.planType)
  apartments!: Apartment[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
