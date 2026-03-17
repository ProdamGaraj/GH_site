import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm'
import { Page } from './Page'

@Entity('page_versions')
export class PageVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => Page, { onDelete: 'CASCADE' })
  page!: Page

  @Column({ type: 'uuid' })
  pageId!: string

  @Column()
  version!: number

  @Column('jsonb')
  structure!: any

  @Column('jsonb', { nullable: true })
  metadata?: {
    title: string
    description: string
    keywords: string[]
    ogImage?: string
  }

  @Column({ nullable: true })
  name?: string

  @Column({ nullable: true })
  slug?: string

  @Column({ default: 'draft' })
  status!: 'draft' | 'published' | 'archived'

  /** What triggered this version: 'manual' save, 'auto' autosave, 'deploy' publish */
  @Column({ default: 'manual' })
  source!: 'manual' | 'auto' | 'deploy'

  /** Optional user-provided label like "Before redesign" */
  @Column({ nullable: true })
  label?: string

  @CreateDateColumn()
  createdAt!: Date
}
