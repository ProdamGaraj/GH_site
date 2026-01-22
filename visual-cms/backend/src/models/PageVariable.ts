/**
 * PageVariable Model
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 6: Reactive Variables
 * 
 * Переменные страницы для реактивной связи между блоками.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { Page } from './Page'

// ==================== TYPES ====================

export type VariableScope = 'page' | 'session' | 'global'
export type VariableType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any'

export interface VariablePersistence {
  enabled: boolean
  storage: 'localStorage' | 'sessionStorage' | 'cookie'
  key?: string
  expiry?: number  // секунды
}

export interface VariableValidation {
  required?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  enum?: unknown[]
}

export interface VariableConfig {
  scope: VariableScope
  type: VariableType
  defaultValue?: unknown
  description?: string
  persistence?: VariablePersistence
  validation?: VariableValidation
  computed?: {
    expression: string
    dependencies: string[]
  }
  readOnly?: boolean
  debounceMs?: number
}

// ==================== ENTITY ====================

@Entity('page_variables')
@Index(['pageId', 'name'], { unique: true })
@Index(['scope'])
export class PageVariable {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid', nullable: true })
  pageId: string | null  // null для global variables

  @ManyToOne(() => Page, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'pageId' })
  page?: Page

  @Column({ length: 100 })
  name: string

  @Column({
    type: 'enum',
    enum: ['page', 'session', 'global'],
    default: 'page',
  })
  scope: VariableScope

  @Column({
    type: 'enum',
    enum: ['string', 'number', 'boolean', 'array', 'object', 'any'],
    default: 'string',
  })
  type: VariableType

  @Column({ type: 'jsonb', nullable: true })
  defaultValue: unknown

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'jsonb', nullable: true })
  config: Omit<VariableConfig, 'scope' | 'type' | 'defaultValue' | 'description'> | null

  @Column({ default: true })
  isActive: boolean

  @Column({ default: 0 })
  order: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  // ==================== METHODS ====================

  /**
   * Получить полную конфигурацию
   */
  getFullConfig(): VariableConfig {
    return {
      scope: this.scope,
      type: this.type,
      defaultValue: this.defaultValue,
      description: this.description || undefined,
      ...this.config,
    }
  }

  /**
   * Валидировать значение
   */
  validateValue(value: unknown): { valid: boolean; error?: string } {
    const validation = this.config?.validation

    // Type check
    if (!this.checkType(value)) {
      return { valid: false, error: `Expected ${this.type}, got ${typeof value}` }
    }

    if (!validation) {
      return { valid: true }
    }

    // Required
    if (validation.required && (value === null || value === undefined || value === '')) {
      return { valid: false, error: 'Value is required' }
    }

    // Number validation
    if (this.type === 'number' && typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        return { valid: false, error: `Value must be >= ${validation.min}` }
      }
      if (validation.max !== undefined && value > validation.max) {
        return { valid: false, error: `Value must be <= ${validation.max}` }
      }
    }

    // String validation
    if (this.type === 'string' && typeof value === 'string') {
      if (validation.minLength !== undefined && value.length < validation.minLength) {
        return { valid: false, error: `Length must be >= ${validation.minLength}` }
      }
      if (validation.maxLength !== undefined && value.length > validation.maxLength) {
        return { valid: false, error: `Length must be <= ${validation.maxLength}` }
      }
      if (validation.pattern) {
        const regex = new RegExp(validation.pattern)
        if (!regex.test(value)) {
          return { valid: false, error: `Value must match pattern: ${validation.pattern}` }
        }
      }
    }

    // Enum validation
    if (validation.enum && !validation.enum.includes(value)) {
      return { valid: false, error: `Value must be one of: ${validation.enum.join(', ')}` }
    }

    return { valid: true }
  }

  /**
   * Проверить тип значения
   */
  private checkType(value: unknown): boolean {
    if (value === null || value === undefined) return true
    if (this.type === 'any') return true

    switch (this.type) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && !Array.isArray(value)
      default:
        return true
    }
  }

  /**
   * Преобразовать значение к нужному типу
   */
  coerceValue(value: unknown): unknown {
    if (value === null || value === undefined) return this.defaultValue

    switch (this.type) {
      case 'string':
        return String(value)
      case 'number':
        const num = Number(value)
        return isNaN(num) ? this.defaultValue : num
      case 'boolean':
        if (typeof value === 'boolean') return value
        if (value === 'true' || value === '1') return true
        if (value === 'false' || value === '0') return false
        return Boolean(value)
      case 'array':
        if (Array.isArray(value)) return value
        try {
          const parsed = JSON.parse(String(value))
          return Array.isArray(parsed) ? parsed : [value]
        } catch {
          return [value]
        }
      case 'object':
        if (typeof value === 'object' && !Array.isArray(value)) return value
        try {
          return JSON.parse(String(value))
        } catch {
          return this.defaultValue
        }
      default:
        return value
    }
  }
}

export default PageVariable
