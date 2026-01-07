import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { Group } from './Group'

@Entity('pages')
export class Page {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  name!: string

  @Column({ unique: true })
  slug!: string

  @ManyToOne(() => Group, { nullable: true, onDelete: 'SET NULL' })
  group?: Group

  @Column({ type: 'uuid', nullable: true })
  groupId?: string

  @Column('jsonb')
  metadata!: {
    title: string
    description: string
    keywords: string[]
    ogImage?: string
  }

  @Column({ type: 'uuid', nullable: true })
  rootBlockId?: string

  @Column('jsonb', { nullable: true })
  rootBlock?: any

  @Column({ default: 'draft' })
  status!: 'draft' | 'published' | 'archived'

  @Column({ default: 1 })
  version!: number

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
