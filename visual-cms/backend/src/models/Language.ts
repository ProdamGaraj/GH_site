import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('languages')
export class Language {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** ISO 639-1 code: en, ru, kz, de, etc. */
  @Column({ unique: true, length: 10 })
  code!: string

  /** English name: English, Russian, Kazakh */
  @Column({ length: 100 })
  name!: string

  /** Native name: English, Русский, Қазақша */
  @Column({ length: 100 })
  nativeName!: string

  /** Flag emoji or icon code */
  @Column({ length: 10, nullable: true })
  flag?: string

  /** Is this the default (source) language? Only one can be default */
  @Column({ default: false })
  isDefault!: boolean

  /** Is this language active and available for translation? */
  @Column({ default: true })
  isActive!: boolean

  /** Display order */
  @Column({ default: 0 })
  order!: number

  /** Text direction: ltr or rtl */
  @Column({ length: 3, default: 'ltr' })
  direction!: 'ltr' | 'rtl'

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
