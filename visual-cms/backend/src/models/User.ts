import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

/**
 * Учётная запись для входа в Visual CMS.
 * Пароль хранится только как bcrypt-хеш (см. AuthService).
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** Логин для входа. Уникален. */
  @Column({ unique: true, length: 100 })
  username!: string

  /** bcrypt-хеш пароля. Plaintext не хранится никогда. */
  @Column()
  passwordHash!: string

  /** Роль. Сейчас один уровень ('admin'); поле — задел под роли. */
  @Column({ length: 32, default: 'admin' })
  role!: string

  /** Деактивированный пользователь не может войти. */
  @Column({ default: true })
  isActive!: boolean

  /** Время последнего успешного входа. */
  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
