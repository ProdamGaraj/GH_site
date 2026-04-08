import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { Group } from './Group'
import { Site } from './Site'

@Entity('pages')
export class Page {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  name!: string

  @Column({ unique: true })
  slug!: string

  @ManyToOne(() => Site, site => site.pages, { nullable: true, onDelete: 'SET NULL' })
  site?: Site

  @Column({ type: 'uuid', nullable: true })
  siteId?: string

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

  @Column('jsonb', { nullable: true })
  structure?: any

  @Column({ default: 'draft' })
  status!: 'draft' | 'published' | 'archived'

  @Column({ type: 'boolean', default: false })
  isTemplate!: boolean

  @Column({ default: 1 })
  version!: number

  // Data Binding settings (Stage 3.5 & 3.6)
  @Column('jsonb', { nullable: true })
  dataSources?: {
    dataSources: Array<{
      id: string
      dataSourceId: string
      alias: string
      loadStrategy: 'pageLoad' | 'onDemand' | 'interval'
      loadInterval?: number
      cacheEnabled: boolean
      cacheTTL?: number
      priority: number
      dependsOn?: string[]
    }>
    variables: Record<string, unknown>
    cachePolicy: 'cache-first' | 'network-first' | 'network-only'
  }

  @Column('jsonb', { nullable: true })
  variables?: {
    variables: Array<{
      id: string
      name: string
      scope: 'page' | 'global' | 'session'
      type: 'string' | 'number' | 'boolean' | 'array' | 'object'
      defaultValue: unknown
      persist?: boolean
      reactive?: boolean
      computed?: string
    }>
  }

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
