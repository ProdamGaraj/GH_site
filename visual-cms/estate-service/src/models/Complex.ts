import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'
import { House } from './House'

/**
 * Жилой комплекс (ЖК).
 *
 * Базовые значения хранятся на языке по умолчанию (ru). Переводы (uz/en)
 * лежат оверлеем в `estate_translations` и накладываются при чтении по ?lang=
 * с фолбэком на ru (см. services/i18n.ts, паттерн overlay из CMS Translation).
 *
 * Медиа-поля хранят URL на существующие ассеты (не переводятся в MVP).
 */
@Entity('complexes')
export class Complex {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /**
   * Числовой ID проекта во внешней системе (CRM). По нему на деплое тянутся
   * квартиры отдельным источником: {{item.externalId}} в запросе.
   * null — проект не сопоставлен с CRM.
   */
  @Index({ unique: true })
  @Column({ type: 'int', nullable: true })
  externalId!: number | null

  /** URL-идентификатор: slug страницы проекта (assalom-dostlik). Уникален. */
  @Index({ unique: true })
  @Column({ length: 160 })
  slug!: string

  /** Порядок в каталоге. */
  @Column({ type: 'int', default: 0 })
  order!: number

  /** active | sold_out */
  @Column({ length: 20, default: 'active' })
  status!: string

  // --- Переводимые текстовые поля (ru = база) ---
  @Column({ length: 200 })
  name!: string

  /** Класс жилья: Комфорт / Комфорт+ / Бизнес / Премиум. */
  @Column({ length: 60, default: '' })
  className!: string

  @Column({ type: 'text', default: '' })
  intro!: string

  @Column({ type: 'text', default: '' })
  about!: string

  /** Заголовок секции «О проекте» (был захардкожен в блоке CMS). */
  @Column({ length: 200, default: '' })
  aboutTitle!: string

  @Column({ type: 'text', default: '' })
  aboutExtra!: string

  // Hall (дизайнерские холлы)
  @Column({ length: 200, default: '' })
  hallTitle!: string

  @Column({ type: 'text', default: '' })
  hallText!: string

  /** Адрес под названием ЖК в секции «Выбрать». */
  @Column({ length: 300, default: '' })
  address!: string

  // Location (расположение)
  @Column({ length: 200, default: '' })
  locationTitle!: string

  @Column({ type: 'text', default: '' })
  locationText!: string

  /**
   * Подписи на карте проекта: [{label, accent, top, left}].
   * top/left — CSS-проценты ('46%'): метка указывает на место конкретной
   * карты, поэтому координаты — часть данных проекта, а не вёрстки.
   */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  locationLabels!: Array<{ label: string; accent?: boolean; top: string; left: string }>

  // Yard (дворовое пространство) — плоские поля для простого оверлея
  @Column({ length: 120, default: '' })
  yardEyebrow!: string

  @Column({ length: 200, default: '' })
  yardTitle!: string

  @Column({ type: 'text', default: '' })
  yardText!: string

  /** string[] — переводимый (список удобств двора). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  yardFeatures!: string[]

  /** Array<{value,label}> — переводимый (ключевые параметры). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  stats!: Array<{ value: string; label: string }>

  // --- Медиа (URL, не переводятся в MVP) ---
  @Column({ length: 500, default: '' })
  logo!: string

  @Column({ length: 60, default: '' })
  logoClass!: string

  @Column({ length: 500, default: '' })
  media!: string

  @Column({ length: 500, default: '' })
  aboutVideo!: string

  @Column({ length: 500, default: '' })
  mapUrl!: string

  @Column({ length: 500, default: '' })
  mapImage!: string

  /** Ссылка на панораму 360° (кнопка в секции «Расположение»). */
  @Column({ length: 500, default: '' })
  panoramaUrl!: string

  @Column({ type: 'jsonb', default: () => "'[]'" })
  heroImages!: string[]

  @Column({ type: 'jsonb', default: () => "'[]'" })
  gallery!: string[]

  @Column({ type: 'jsonb', default: () => "'[]'" })
  hallGallery!: string[]

  @Column({ type: 'jsonb', default: () => "'[]'" })
  yardGallery!: string[]

  @OneToMany(() => House, (house) => house.complex)
  houses!: House[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
