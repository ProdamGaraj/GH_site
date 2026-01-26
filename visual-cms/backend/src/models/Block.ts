import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { Group } from './Group'
import type { DetectedField, TemplateSettings, TemplateCategory } from './Template'

@Entity('blocks')
export class Block {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  name!: string

  @Column()
  type!: string

  @ManyToOne(() => Group, { nullable: true, onDelete: 'SET NULL' })
  group?: Group

  @Column({ type: 'uuid', nullable: true })
  groupId?: string

  @Column({ default: false })
  isReusable!: boolean

  @Column('jsonb')
  structure!: any

  @Column({ nullable: true })
  thumbnail?: string

  @Column('text', { array: true, default: [] })
  tags!: string[]

  // Template functionality
  @Column({ default: false })
  isTemplate!: boolean

  @Column({ type: 'varchar', nullable: true })
  templateCategory?: TemplateCategory

  @Column('jsonb', { nullable: true })
  detectedFields?: DetectedField[]

  @Column('jsonb', { nullable: true })
  templateSettings?: TemplateSettings

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
