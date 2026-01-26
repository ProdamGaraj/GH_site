/**
 * Block Template Service
 * 
 * Сервис для работы с Block в роли Template:
 * - Генерация HTML из Block.structure
 * - Автоопределение bindable полей
 * - Синхронизация с Data Bindings при изменении структуры
 */

import type { DetectedField, DetectedFieldType } from '../models/Template'
import { AppDataSource } from '../config/database'
import { DataBinding } from '../models/DataBinding'

const dataBindingRepository = AppDataSource.getRepository(DataBinding)

interface BlockNode {
  id: string
  tagName: string
  elementType: string
  content?: string
  attributes?: Record<string, string>
  styles?: {
    properties?: Record<string, string>
  }
  metadata?: {
    name?: string
  }
  children?: BlockNode[]
}

interface FieldDiff {
  added: DetectedField[]
  removed: DetectedField[]
  unchanged: DetectedField[]
}

export class BlockTemplateService {
  /**
   * Генерация HTML из Block.structure
   */
  generateHTMLFromStructure(node: BlockNode, depth = 0): string {
    const indent = '  '.repeat(depth)
    const { tagName = 'div', content = '', children = [], attributes = {}, metadata = {} } = node

    // Собираем атрибуты
    let attrs = ''
    Object.entries(attributes).forEach(([key, value]) => {
      attrs += ` ${key}="${this.escapeHtml(value as string)}"`
    })

    // Добавляем data-element-id для отслеживания
    attrs += ` data-element-id="${node.id}"`

    // Inline стили (временно, потом можно вынести в CSS)
    if (node.styles?.properties) {
      const styleString = Object.entries(node.styles.properties)
        .map(([k, v]) => `${this.camelToKebab(k)}: ${v}`)
        .join('; ')
      if (styleString) {
        attrs += ` style="${styleString}"`
      }
    }

    // Для data binding - добавляем data-bind атрибут если элемент bindable
    if (metadata?.name && this.isBindableElement(node)) {
      const fieldName = this.normalizeFieldName(metadata.name)
      attrs += ` data-bind="${fieldName}"`
    }

    // Генерация HTML
    const voidElements = ['img', 'input', 'br', 'hr', 'meta', 'link']
    
    if (voidElements.includes(tagName.toLowerCase())) {
      return `${indent}<${tagName}${attrs} />\n`
    }

    const childrenHTML = children
      ?.map((child: BlockNode) => this.generateHTMLFromStructure(child, depth + 1))
      .join('') || ''

    if (content && !childrenHTML) {
      return `${indent}<${tagName}${attrs}>${this.escapeHtml(content)}</${tagName}>\n`
    }

    if (!content && !childrenHTML) {
      return `${indent}<${tagName}${attrs}></${tagName}>\n`
    }

    return `${indent}<${tagName}${attrs}>\n${childrenHTML}${indent}</${tagName}>\n`
  }

  /**
   * Генерация CSS из Block.structure
   */
  generateCSSFromStructure(node: BlockNode): string {
    // TODO: Собрать все стили и создать CSS классы
    // Пока возвращаем пустую строку - стили inline
    return ''
  }

  /**
   * Автоопределение bindable полей из структуры блока
   */
  detectFieldsFromStructure(node: BlockNode): DetectedField[] {
    const fields: DetectedField[] = []
    const fieldNames = new Set<string>()

    const traverse = (n: BlockNode) => {
      // Если элемент имеет metadata.name и подходит для binding
      if (n.metadata?.name && this.isBindableElement(n)) {
        const fieldName = this.normalizeFieldName(n.metadata.name)
        
        // Избегаем дубликатов
        if (!fieldNames.has(fieldName)) {
          fieldNames.add(fieldName)
          
          const fieldType = this.getFieldType(n)

          fields.push({
            id: `field-${fieldName}`,
            name: fieldName,
            type: fieldType,
            selector: `[data-bind="${fieldName}"]`,
            attribute: this.getBindAttribute(fieldType),
            required: false,
            description: `Binding for ${n.metadata.name}`,
            semanticHints: [fieldName, n.metadata.name.toLowerCase()]
          })
        }
      }

      // Рекурсия по детям
      if (n.children) {
        n.children.forEach((child) => traverse(child))
      }
    }

    traverse(node)
    return fields
  }

  /**
   * Сравнить старые и новые поля (для синхронизации bindings)
   */
  diffFields(oldFields: DetectedField[], newFields: DetectedField[]): FieldDiff {
    const oldNames = new Set(oldFields.map(f => f.name))
    const newNames = new Set(newFields.map(f => f.name))

    const added = newFields.filter(f => !oldNames.has(f.name))
    const removed = oldFields.filter(f => !newNames.has(f.name))
    const unchanged = newFields.filter(f => oldNames.has(f.name))

    return { added, removed, unchanged }
  }

  /**
   * Синхронизировать Data Bindings при изменении полей блока
   */
  async syncBindingsOnFieldChange(blockId: string, diff: FieldDiff): Promise<void> {
    // Получаем все bindings связанные с этим блоком
    const bindings = await dataBindingRepository.find({
      where: { blockId }
    })

    for (const binding of bindings) {
      if (!binding.config) continue

      let configChanged = false
      const config = binding.config as any

      // Если есть fieldMappings - обновляем их
      if (config.fieldMappings && Array.isArray(config.fieldMappings)) {
        // Удаляем mappings для удалённых полей
        const removedFieldNames = new Set(diff.removed.map(f => f.name))
        config.fieldMappings = config.fieldMappings.filter((mapping: any) => {
          return !removedFieldNames.has(mapping.sourceField)
        })

        // Добавляем mappings для новых полей (с пустыми значениями)
        diff.added.forEach(field => {
          config.fieldMappings.push({
            id: `mapping-${field.name}-${Date.now()}`,
            sourceField: field.name,
            targetProperty: `data.${field.name}`,
            transform: undefined,
            fallbackValue: undefined
          })
        })

        configChanged = config.fieldMappings.length > 0
      }

      // Сохраняем обновлённый binding если были изменения
      if (configChanged) {
        binding.config = config
        await dataBindingRepository.save(binding)
      }
    }
  }

  /**
   * Проверить, можно ли элемент сделать bindable
   */
  private isBindableElement(node: BlockNode): boolean {
    const bindableTypes = ['text', 'image', 'button', 'link']
    return bindableTypes.includes(node.elementType)
  }

  /**
   * Определить тип поля для data binding
   */
  private getFieldType(node: BlockNode): DetectedFieldType {
    switch (node.elementType) {
      case 'image':
        return 'image'
      case 'text':
        return node.tagName === 'a' ? 'link' : 'text'
      case 'button':
        return 'text'
      case 'link':
        return 'link'
      default:
        return 'text'
    }
  }

  /**
   * Получить атрибут для binding в зависимости от типа
   */
  private getBindAttribute(fieldType: DetectedFieldType): string | undefined {
    switch (fieldType) {
      case 'image':
        return 'src'
      case 'link':
        return 'href'
      default:
        return undefined
    }
  }

  /**
   * Нормализовать имя поля (для использования в data-bind)
   */
  private normalizeFieldName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }

  /**
   * Преобразовать camelCase в kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase()
  }

  /**
   * Экранировать HTML спецсимволы
   */
  private escapeHtml(text: string): string {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}

export const blockTemplateService = new BlockTemplateService()
