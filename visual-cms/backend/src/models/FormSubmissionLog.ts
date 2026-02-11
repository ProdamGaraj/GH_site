import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { Form } from './Form'

export type FormSubmissionStatus = 'success' | 'partial' | 'failed'

@Entity('form_submissions')
@Index(['formId', 'createdAt'])
@Index(['status', 'createdAt'])
export class FormSubmissionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid' })
  formId: string

  @ManyToOne(() => Form, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formId' })
  form: Form

  @Column({ type: 'jsonb' })
  data: Record<string, unknown>

  @Column({ type: 'varchar', length: 20 })
  status: FormSubmissionStatus

  @Column({ type: 'jsonb', nullable: true })
  destinationResults: {
    destinationId: string
    destinationName: string
    success: boolean
    error?: string
    durationMs: number
  }[] | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip: string | null

  @Column({ type: 'varchar', length: 300, nullable: true })
  userAgent: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  referrer: string | null

  @CreateDateColumn()
  createdAt: Date
}
