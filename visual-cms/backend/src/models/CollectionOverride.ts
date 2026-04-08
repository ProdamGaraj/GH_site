import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique
} from 'typeorm'
import { Collection } from './Collection'
import { Page } from './Page'

@Entity('collection_overrides')
@Unique(['collectionId', 'apiItemId'])
export class CollectionOverride {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => Collection, collection => collection.overrides, { onDelete: 'CASCADE' })
  collection?: Collection

  @Column({ type: 'uuid' })
  collectionId!: string

  @Column({ type: 'varchar', length: 255 })
  apiItemId!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  apiItemSlug?: string

  @ManyToOne(() => Page, { onDelete: 'CASCADE' })
  customPage?: Page

  @Column({ type: 'uuid' })
  customPageId!: string

  @CreateDateColumn()
  createdAt!: Date
}
