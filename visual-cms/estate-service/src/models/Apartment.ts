import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'
import { House } from './House'
import { PlanType } from './PlanType'

/**
 * Квартира / планировка внутри дома.
 *
 * Цена в UZS хранится как bigint (числом), форматирование ("1 354 320 000 UZS")
 * и производные подписи (title "4-комн. 114 м²", meta "№ 102 | 8/9 этаж | …")
 * собираются в API по языку (см. services/i18n.ts).
 */
@Entity('apartments')
export class Apartment {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  houseId!: string

  @ManyToOne(() => House, (house) => house.apartments, { onDelete: 'CASCADE' })
  house!: House

  /** ID объекта продажи в MacroCRM. По нему идёт upsert синка. */
  @Index({ unique: true })
  @Column({ type: 'int', nullable: true })
  externalId!: number | null

  /** Тип планировки. null — планировка в CRM не заведена. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  planTypeId!: string | null

  @ManyToOne(() => PlanType, (planType) => planType.apartments, { onDelete: 'SET NULL' })
  planType!: PlanType | null

  /**
   * dateModified из CRM. Если не поменялся с прошлого прогона — планировку
   * повторно не запрашиваем: это единственное, что удерживает второй синк
   * от повторного обхода всех 339 квартир.
   */
  @Column({ type: 'timestamptz', nullable: true })
  dateModified!: Date | null

  /** Когда последний раз ходили в getFlatPlans по этой квартире. */
  @Column({ type: 'timestamptz', nullable: true })
  planProbedAt!: Date | null

  @Column({ type: 'int', default: 0 })
  order!: number

  // --- Числовые ---
  @Column({ type: 'int', default: 0 })
  rooms!: number

  /** Площадь м², numeric для дробных (78.81). */
  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0 })
  areaM2!: number

  /** Цена в UZS. bigint возвращается pg строкой — нормализуем в API. */
  @Column({ type: 'bigint', default: 0 })
  price!: string | number

  @Column({ type: 'bigint', nullable: true })
  oldPrice?: string | number | null

  @Column({ type: 'int', nullable: true })
  entrance?: number | null

  /**
   * Этаж числом — для фильтрации и агрегатов.
   *
   * Поле floor ниже остаётся строкой «8/9»: оно переводимое и показывается
   * как есть. Сортировать и сравнивать по нему нельзя, отсюда второе поле.
   */
  @Column({ type: 'int', nullable: true })
  floorNumber!: number | null

  // --- Строковые/переводимые ---
  /** Класс квартиры (первый бейдж): Бизнес / Комфорт+ … */
  @Column({ length: 60, default: '' })
  apartmentClass!: string

  /** Доп. бейджи-теги: Акция / Ипотека / Рассрочка. Переводимо. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  badges!: string[]

  /** Этаж/всего: "8/9". */
  @Column({ length: 20, default: '' })
  floor!: string

  /** Номер квартиры: "102" (без префикса №). */
  @Column({ length: 40, default: '' })
  number!: string

  /** Срок сдачи: "1 кв. 2028". Переводимо. */
  @Column({ length: 60, default: '' })
  deadline!: string

  /** Плашка предложения: "Акция" / "Последняя планировка". Переводимо. */
  @Column({ length: 80, default: '' })
  offerLabel!: string

  /** Вид из окон: «двор», «бульвар», «ТРЦ Альфраганус». Заполнен у всех. */
  @Column({ length: 120, default: '' })
  windowView!: string

  @Column({ length: 20, default: 'available' })
  status!: string

  // --- Медиа ---
  @Column({ length: 500, default: '' })
  planImage!: string

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
