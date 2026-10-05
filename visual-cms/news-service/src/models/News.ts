import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import type { GalleryItem } from '../services/mediaSlides'
import type { NewsSection, NewsStatus } from '../services/news'

/**
 * Новость: данные карточки и тело страницы. Базовый язык — ru, переводы —
 * NewsTranslation. Состав и порядок блоков страницы — `sections`
 * (см. services/news.ts: шаблон-страница рисует заготовку нужного типа).
 */
@Entity('news')
export class News {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** Адрес: /<язык>/news/<slug>/. После первой публикации фиксируется. */
  @Column({ type: 'varchar', length: 120 })
  slug!: string

  @Column({ type: 'boolean', default: false })
  slugLocked!: boolean

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: NewsStatus

  /** Дата новости: ставится при первой публикации, правится вручную. */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null

  @Column({ type: 'varchar', length: 40, nullable: true })
  categoryKey!: string | null

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tagKeys!: string[]

  @Column({ type: 'varchar', length: 300, default: '' })
  title!: string

  @Column({ type: 'text', default: '' })
  lead!: string

  /** Обложка карточки; пусто — первый слайд hero. */
  @Column({ type: 'jsonb', nullable: true })
  cover!: GalleryItem | null

  @Column({ type: 'jsonb', default: () => "'[]'" })
  hero!: GalleryItem[]

  @Column({ type: 'jsonb', default: () => "'[]'" })
  sections!: NewsSection[]

  /** Языки кроме ru, на которых новость публикуется (при полном переводе). */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  publishOn!: string[]

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date
}
