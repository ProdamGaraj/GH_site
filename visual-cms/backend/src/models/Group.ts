import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  name!: string

  @Column()
  type!: 'pages' | 'blocks'

  @ManyToOne(() => Group, { nullable: true, onDelete: 'CASCADE' })
  parent?: Group

  @Column({ type: 'uuid', nullable: true })
  parentId?: string

  @Column({ default: 0 })
  order!: number

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
