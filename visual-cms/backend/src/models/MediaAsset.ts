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
 * Хранит метаданные ассетов (image/video), сами файлы лежат в MinIO/S3
 * под ключом `storageKey`. URL вычисляется как `PUBLIC_MEDIA_URL + '/' + storageKey`.
 *
 * siteId nullable: null = глобальный ассет, доступен любому сайту.
 */
export type MediaKind = 'image' | 'video'

@Entity('media_assets')
@Index(['siteId'])
@Index(['kind'])
@Index(['createdAt'])
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
