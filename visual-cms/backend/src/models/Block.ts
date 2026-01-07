import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { Group } from './Group'

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

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
