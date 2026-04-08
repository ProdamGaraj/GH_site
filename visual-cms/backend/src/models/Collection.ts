import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm'
import { Site } from './Site'
import { DataSource } from './DataSource'
import { Page } from './Page'
import { CollectionOverride } from './CollectionOverride'

export type CollectionLinkMode = 'auto' | 'manual' | 'disabled'
export type CollectionItemsOrder = 'api' | 'alphabetical' | 'custom'

@Entity('collections')
@Index(['siteId'])
@Index(['dataSourceId'])
export class Collection {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 255 })
  name!: string

  // --- Связь с сайтом ---
  @ManyToOne(() => Site, { onDelete: 'CASCADE' })
  site?: Site

  @Column({ type: 'uuid' })
  siteId!: string

  // --- Источник данных ---
  @ManyToOne(() => DataSource, { onDelete: 'RESTRICT' })
  dataSource?: DataSource

  @Column({ type: 'uuid' })
  dataSourceId!: string

  @Column({ type: 'varchar', length: 255, default: 'data' })
  arrayPath!: string

  // --- Шаблон ---
  @ManyToOne(() => Page, { onDelete: 'RESTRICT' })
  templatePage?: Page

  @Column({ type: 'uuid' })
  templatePageId!: string

  // --- URL-генерация ---
  @Column({ type: 'varchar', length: 255 })
  basePath!: string

  @Column({ type: 'varchar', length: 255 })
  slugField!: string

  @Column({ type: 'varchar', length: 255, default: 'title' })
  titleField!: string

  // --- Авто-ссылки ---
  @Column({ type: 'varchar', length: 50, default: 'auto' })
  linkMode!: CollectionLinkMode

  @Column({ type: 'varchar', length: 255, nullable: true })
  linkTextField?: string

  // --- Настройки ---
  @Column({ type: 'boolean', default: true })
  isActive!: boolean

  @Column({ type: 'varchar', length: 50, default: 'api' })
  itemsOrder!: CollectionItemsOrder

  // --- Кеш и polling (Проблема 4 & 8) ---
  @Column({ type: 'boolean', default: true })
  useCache!: boolean

  @Column({ type: 'int', default: 600 })
  cacheTtl!: number

  @Column({ type: 'int', default: 300 })
  pollInterval!: number

  // --- Индексная страница (зарезервировано, Проблема 5) ---
  @ManyToOne(() => Page, { nullable: true, onDelete: 'SET NULL' })
  indexPage?: Page

  @Column({ type: 'uuid', nullable: true })
  indexPageId?: string

  // --- Кеш данных API (Проблема 8) ---
  @Column('jsonb', { nullable: true })
  cachedApiData?: unknown[]

  @Column({ type: 'timestamptz', nullable: true })
  lastCachedAt?: Date

  // --- Overrides ---
  @OneToMany(() => CollectionOverride, override => override.collection)
  overrides?: CollectionOverride[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
