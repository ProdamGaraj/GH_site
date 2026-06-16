import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

/**
 * Media Library Asset
 *
 * Хранит метаданные ассетов (image/video/document), сами файлы лежат в MinIO/S3
 * под ключом `storageKey`. URL вычисляется как `PUBLIC_MEDIA_URL + '/' + storageKey`.
 *
 * siteId nullable: null = глобальный ассет, доступен любому сайту.
 */
export type MediaKind = 'image' | 'video' | 'document'

/**
 * Адаптивный вариант изображения (один размер для srcset).
 * Хранится в jsonb-колонке `variants`. URL вычисляется так же, как у storageKey.
 */
export interface MediaVariant {
  /** Реальная ширина варианта в px (после ресайза). */
  width: number
  /** Реальная высота варианта в px. */
  height: number
  /** Ключ файла варианта в MinIO (например `<uuid>.w1280.webp`). */
  storageKey: string
  /** Размер файла варианта в байтах. */
  sizeBytes: number
}

@Entity('media_assets')
@Index(['siteId'])
@Index(['kind'])
@Index(['createdAt'])
@Index(['folderId'])
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** null = глобальный ассет (доступен всем сайтам) */
  @Column({ type: 'uuid', nullable: true })
  siteId?: string | null

  @Column({ type: 'varchar', length: 16 })
  kind!: MediaKind

  /** Оригинальное имя файла (для отображения в UI). */
  @Column({ type: 'varchar', length: 512 })
  fileName!: string

  /** MIME type, например image/jpeg, video/mp4. */
  @Column({ type: 'varchar', length: 128 })
  mimeType!: string

  /** Ключ в MinIO bucket (UUID + расширение). */
  @Column({ type: 'varchar', length: 512, unique: true })
  storageKey!: string

  /** Ключ постера (только для video), nullable. */
  @Column({ type: 'varchar', length: 512, nullable: true })
  posterStorageKey?: string | null

  /** Ключ миниатюры (webp, max 400px). Генерируется при загрузке изображений (кроме SVG). */
  @Column({ type: 'varchar', length: 512, nullable: true })
  thumbnailStorageKey?: string | null

  /**
   * Ключ оптимизированной (сжатой без заметной потери качества) версии (webp).
   * Создаётся опционально по галочке при загрузке. Оригинал при этом сохраняется.
   */
  @Column({ type: 'varchar', length: 512, nullable: true })
  optimizedStorageKey?: string | null

  /** Размер оптимизированной версии в байтах (для отображения экономии). */
  @Column({ type: 'bigint', nullable: true })
  optimizedSizeBytes?: number | null

  /**
   * Адаптивные варианты изображения для srcset (разные ширины экранов).
   * Создаются опционально при загрузке из размеров мониторов/брейкпоинтов проекта.
   */
  @Column({ type: 'jsonb', nullable: true })
  variants?: MediaVariant[] | null

  /** Папка медиатеки (null = корень). */
  @Column({ type: 'uuid', nullable: true })
  folderId?: string | null

  @Column({ type: 'bigint', default: 0 })
  sizeBytes!: number

  @Column({ type: 'integer', nullable: true })
  width?: number | null

  @Column({ type: 'integer', nullable: true })
  height?: number | null

  @Column({ type: 'integer', nullable: true })
  durationSec?: number | null

  /** Произвольное название (для UI). По умолчанию = fileName без расширения. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  title?: string | null

  /** alt-текст для изображения. */
  @Column({ type: 'varchar', length: 512, nullable: true })
  alt?: string | null

  @Column('simple-array', { nullable: true })
  tags?: string[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
