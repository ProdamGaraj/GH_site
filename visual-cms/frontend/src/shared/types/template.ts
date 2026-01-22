/**
 * Template Types
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 3: Templates System
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
  semanticHints?: string[]   // Подсказки для автомаппинга
  validation?: {
    pattern?: string         // Regex pattern для валидации
    min?: number            // Минимальное значение для number
    max?: number            // Максимальное значение для number
    minLength?: number      // Минимальная длина для text
    maxLength?: number      // Максимальная длина для text
  }
}

/**
 * Настройки шаблона
 */
export interface TemplateSettings {
  wrapperTag?: string
  wrapperClass?: string
  animation?: {
    type: 'fade' | 'slide' | 'zoom' | 'none'
    duration?: number
    delay?: number
    stagger?: number
  }
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

/**
 * Шаблон (Template)
 */
export interface Template {
  id: string
  name: string
  description: string | null
  category: TemplateCategory
  status: TemplateStatus
  htmlContent: string
  cssContent: string | null
  detectedFields: DetectedField[]
  settings: TemplateSettings | null
  previewData: Record<string, unknown> | null
  thumbnail: string | null
  tags: string[] | null
  isBuiltIn: boolean
  sourceBlockId: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Запрос на создание шаблона
 */
export interface CreateTemplateRequest {
  name: string
  description?: string
  category?: TemplateCategory
  htmlContent: string
  cssContent?: string
  settings?: TemplateSettings
  previewData?: Record<string, unknown>
  tags?: string[]
  sourceBlockId?: string
  autoDetectFields?: boolean
}

/**
 * Запрос на обновление шаблона
 */
export interface UpdateTemplateRequest {
  name?: string
  description?: string
  category?: TemplateCategory
  status?: TemplateStatus
  htmlContent?: string
  cssContent?: string
  settings?: TemplateSettings
  previewData?: Record<string, unknown>
  tags?: string[]
  redetectFields?: boolean
}

/**
 * Фильтры для списка шаблонов
 */
export interface TemplateFilters {
  category?: TemplateCategory
  status?: TemplateStatus
  search?: string
  tags?: string[]
  isBuiltIn?: boolean
}

/**
 * Информация о категории
 */
export const TEMPLATE_CATEGORIES: Record<TemplateCategory, { label: string; icon: string; description: string }> = {
  card: { label: 'Карточка', icon: '🎴', description: 'Карточка товара, услуги или контента' },
  'list-item': { label: 'Элемент списка', icon: '📋', description: 'Элемент для списков' },
  'table-row': { label: 'Строка таблицы', icon: '📊', description: 'Строка для таблиц данных' },
  gallery: { label: 'Галерея', icon: '🖼️', description: 'Элемент галереи изображений' },
  testimonial: { label: 'Отзыв', icon: '💬', description: 'Отзыв клиента' },
  'team-member': { label: 'Член команды', icon: '👤', description: 'Карточка сотрудника' },
  pricing: { label: 'Тарифный план', icon: '💰', description: 'Карточка тарифа/плана' },
  feature: { label: 'Особенность', icon: '✨', description: 'Описание функции/особенности' },
  faq: { label: 'FAQ', icon: '❓', description: 'Вопрос-ответ' },
  'blog-post': { label: 'Пост блога', icon: '📝', description: 'Превью статьи блога' },
  custom: { label: 'Кастомный', icon: '🔧', description: 'Пользовательский шаблон' }
}

/**
 * Информация о типе поля
 */
export const FIELD_TYPES: Record<DetectedFieldType, { label: string; icon: string }> = {
  text: { label: 'Текст', icon: '📝' },
  richText: { label: 'HTML', icon: '📄' },
  image: { label: 'Изображение', icon: '🖼️' },
  link: { label: 'Ссылка', icon: '🔗' },
  number: { label: 'Число', icon: '🔢' },
  date: { label: 'Дата', icon: '📅' },
  boolean: { label: 'Да/Нет', icon: '✅' },
  list: { label: 'Список', icon: '📋' },
  object: { label: 'Объект', icon: '📦' }
}
