import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm'
import { Site } from './Site'

@Entity('deploy_logs')
export class DeployLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => Site, { nullable: true, onDelete: 'SET NULL' })
  site?: Site

  @Column({ type: 'uuid', nullable: true })
  siteId?: string

  @Column({ type: 'uuid', nullable: true })
  pageId?: string

  @Column({ nullable: true })
  pageName?: string

  @Column({ nullable: true })
  pageSlug?: string

  @Column()
  action!: 'deploy' | 'rollback' | 'undeploy' | 'deploy-all' | 'deploy-site'

  @Column()
  status!: 'success' | 'failed' | 'partial'

  @Column({ nullable: true })
  message?: string

  @Column('simple-array', { nullable: true })
  deployedFiles?: string[]

  @Column('simple-array', { nullable: true })
  errors?: string[]

  /** Duration in milliseconds */
  @Column({ type: 'int', nullable: true })
  durationMs?: number

  @Column({ nullable: true })
  publicUrl?: string

  /** The version of the page at deploy time */
  @Column({ type: 'int', nullable: true })
  pageVersion?: number

  /** versionId reference (PageVersion) for rollback */
  @Column({ type: 'uuid', nullable: true })
  versionId?: string

  @CreateDateColumn()
  createdAt!: Date
}
