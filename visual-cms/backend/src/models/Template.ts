import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index
} from 'typeorm'

/**
 * Template Model
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 3: Templates System
 * 
 * Хранит переиспользуемые шаблоны для Repeater mode.
 * Автоматически определяет bindable-поля в HTML структуре.
 */

/**
 * Категории шаблонов
 */
export type TemplateCategory = 
  | 'card'        // Карточка товара/услуги
  | 'list-item'   // Элемент списка
  | 'table-row'   // Строка таблицы
  | 'gallery'     // Элемент галереи
  | 'testimonial' // Отзыв
  | 'team-member' // Член команды
  | 'pricing'     // Тарифный план
  | 'feature'     // Особенность/фича
  | 'faq'         // Вопрос-ответ
  | 'blog-post'   // Пост блога
  | 'custom'      // Кастомный

/**
 * Тип определённого поля в шаблоне
 */
export type DetectedFieldType = 
  | 'text'        // Текстовый контент
  | 'richText'    // HTML контент
  | 'image'       // src изображения
  | 'link'        // href ссылки
  | 'number'      // Числовое значение
  | 'date'        // Дата
  | 'boolean'     // Checkbox/visibility
  | 'list'        // Массив значений
  | 'object'      // Вложенный объект

/**
 * Определённое bindable-поле в шаблоне
 */
export interface DetectedField {
  id: string
  name: string
  type: DetectedFieldType
  selector: string           // CSS selector до элемента
  attribute?: string         // Атрибут (src, href, data-*)
  defaultValue?: unknown     // Значение по умолчанию
  required: boolean
  description?: string
  // Для Smart Mapping
  semanticHints?: string[]   // Подсказки для автомаппинга (title, name, price, etc)
}

/**
 * Настройки шаблона
 */
export interface TemplateSettings {
  // Wrapper element
  wrapperTag?: string        // div, article, li, tr
  wrapperClass?: string      // CSS классы для wrapper
  // Анимации
  animation?: {
    type: 'fade' | 'slide' | 'zoom' | 'none'
    duration?: number
    delay?: number
    stagger?: number         // Задержка между элементами
  }
  // Responsive
  responsive?: {
    desktop?: { columns?: number; gap?: number }
    tablet?: { columns?: number; gap?: number }
    mobile?: { columns?: number; gap?: number }
  }
}

/**
 * Статус шаблона
 */
export type TemplateStatus = 'draft' | 'active' | 'archived'

@Entity('templates')
@Index(['category'])
@Index(['status'])
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 255 })
  @Index()
  name: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ 
    type: 'varchar', 
    length: 50, 
    default: 'custom' 
  })
  category: TemplateCategory

  @Column({ 
    type: 'varchar', 
    length: 20, 
    default: 'active' 
  })
  status: TemplateStatus

  @Column({ type: 'text' })
  htmlContent: string

  @Column({ type: 'text', nullable: true })
  cssContent: string | null

  @Column({ type: 'jsonb', default: [] })
  detectedFields: DetectedField[]

  @Column({ type: 'jsonb', nullable: true })
  settings: TemplateSettings | null

  @Column({ type: 'jsonb', nullable: true })
  previewData: Record<string, unknown> | null

  @Column({ type: 'text', nullable: true })
  thumbnail: string | null

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null

  @Column({ default: false })
  isBuiltIn: boolean

  @Column({ type: 'varchar', length: 255, nullable: true })
  sourceBlockId: string | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

export default Template
