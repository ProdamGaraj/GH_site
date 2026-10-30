import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

/**
 * Версия блока библиотеки — его состояние до изменения или удаления.
 *
 * Пишет триггер blocks_versioning (migrations/add-block-versions.sql) на
 * каждый UPDATE и DELETE таблицы blocks, из любого места: редактор, страница,
 * скрипты, SQL. Связи с blocks нет — версии удалённого блока остаются.
 */
export type BlockVersionSource = 'update' | 'delete' | 'restore' | 'manual' | 'initial'

@Entity('block_versions')
export class BlockVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  blockId!: string

  @Column()
  version!: number

  @Column()
  name!: string

  @Column('jsonb')
  structure!: any

  /** Прочие поля строки блока (type, isReusable, groupId, tags, …). */
  @Column('jsonb', { default: {} })
  extra!: Record<string, unknown>

  @Column({ type: 'varchar', length: 20, default: 'update' })
  source!: BlockVersionSource

  @Column({ type: 'varchar', length: 255, nullable: true })
  label?: string | null

  /** Когда это состояние было сохранено. */
  @Column({ type: 'timestamp', nullable: true })
  savedAt?: Date | null

  /** Когда его заменили (или удалили, или сделали снимок). */
  @CreateDateColumn()
  createdAt!: Date
}
