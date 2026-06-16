import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

/**
 * Папка медиатеки (дерево).
 *
 * Организует ассеты в иерархию. `parentId = null` — папка в корне.
 * `siteId = null` — глобальная папка (доступна всем сайтам), как и у MediaAsset.
 *
 * Дерево читается одним запросом «все папки сайта» и строится на клиенте —
 * папок мало, рекурсивный SQL не нужен.
 */
@Entity('media_folders')
@Index(['siteId'])
@Index(['parentId'])
export class MediaFolder {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** null = глобальная папка (доступна всем сайтам). */
  @Column({ type: 'uuid', nullable: true })
  siteId?: string | null

  /** null = папка в корне. */
  @Column({ type: 'uuid', nullable: true })
  parentId?: string | null

  @Column({ type: 'varchar', length: 255 })
  name!: string

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
