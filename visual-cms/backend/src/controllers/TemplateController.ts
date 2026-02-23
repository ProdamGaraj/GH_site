import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { Template, TemplateCategory, TemplateStatus, DetectedField, DetectedFieldType } from '../models/Template'
import { v4 as uuidv4 } from 'uuid'
import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { asyncHandler, NotFoundError, AppError } from '../middleware'
import { cacheService } from '../services/CacheService'

/**
 * Template Controller
 * 
 * Согласно Т: docs/data-binding-system-spec.md
 * тап 3.1 Backend: Templates API
 * 
 * API для управления Templates с автоопределением полей
 */

const templateRepository = AppDataSource.getRepository(Template)

class TemplateController {
  /**
   * GET /api/templates
   * олучить список шаблонов
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { category, status, search, tags, isBuiltIn } = req.query

    const queryBuilder = templateRepository.createQueryBuilder('template')
      .orderBy('template.createdAt', 'DESC')

    if (category) {
      queryBuilder.andWhere('template.category = :category', { category })
    }

    if (status) {
      queryBuilder.andWhere('template.status = :status', { status })
    }

    if (search) {
      queryBuilder.andWhere(
        '(template.name ILIKE :search OR template.description ILIKE :search)',
        { search: `%${search}%` }
      )
    }

    if (isBuiltIn !== undefined) {
      queryBuilder.andWhere('template.isBuiltIn = :isBuiltIn', { 
        isBuiltIn: isBuiltIn === 'true' 
      })
    }

    // Filter by tags (PostgreSQL array contains)
    if (tags) {
      const tagList = (tags as string).split(',').map(t => t.trim())
      queryBuilder.andWhere('template.tags && ARRAY[:...tags]', { tags: tagList })
    }

    const templates = await queryBuilder.getMany()

    res.json(templates)
  })

  /**
   * GET /api/templates/:id
   * олучить шаблон по ID
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const template = await templateRepository.findOne({
      where: { id }
    })

    if (!template) {
      throw new NotFoundError('Template', id)
    }

    res.json(template)
  })

  /**
   * POST /api/templates
   * Создать новый шаблон
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const { 
      name, 
      description, 
      category, 
      htmlContent, 
      cssContent,
      settings,
      previewData,
      tags,
      sourceBlockId,
      autoDetectFields = true
    } = req.body

    // алидация
    // втоопределение полей
    let detectedFields: DetectedField[] = []
    if (autoDetectFields) {
      detectedFields = this.detectFields(htmlContent)
    }

    const template = templateRepository.create({
      name,
      description: description || null,
      category: category || 'custom',
      status: 'active' as TemplateStatus,
      htmlContent,
      cssContent: cssContent || null,
      detectedFields,
      settings: settings || null,
      previewData: previewData || null,
      tags: tags || null,
      isBuiltIn: false,
      sourceBlockId: sourceBlockId || null
    })

    await cacheService.invalidateByTag('templates')

    res.status(201).json(template)
  })

  /**
   * PUT /api/templates/:id
   * бновить шаблон
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const { 
      name, 
      description, 
      category, 
      status,
      htmlContent, 
      cssContent,
      settings,
      previewData,
      tags,
      redetectFields = false
    } = req.body

    const template = await templateRepository.findOne({ where: { id } })

    if (!template) {
      throw new NotFoundError('Template', id)
    }

    // бновляем поля
    if (name !== undefined) template.name = name
    if (description !== undefined) template.description = description
    if (category !== undefined) template.category = category
    if (status !== undefined) template.status = status
    if (htmlContent !== undefined) template.htmlContent = htmlContent
    if (cssContent !== undefined) template.cssContent = cssContent
    if (settings !== undefined) template.settings = settings
    if (previewData !== undefined) template.previewData = previewData
    if (tags !== undefined) template.tags = tags

    // ереопределение полей при изменении HTML
    if (redetectFields || (htmlContent !== undefined && htmlContent !== template.htmlContent)) {
      template.detectedFields = this.detectFields(template.htmlContent)
    }

    await cacheService.invalidateByTag('templates')

    res.json(template)
  })

  /**
   * DELETE /api/templates/:id
   * далить шаблон
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const template = await templateRepository.findOne({ where: { id } })

    if (!template) {
      throw new NotFoundError('Template', id)
    }

    // е позволяем удалять built-in шаблоны
    if (template.isBuiltIn) {
      throw new AppError('Built-in templates cannot be deleted', 403, 'BUILTIN_TEMPLATE')
    }

    await cacheService.invalidateByTag('templates')

    res.status(204).send()
  })

  /**
   * POST /api/templates/:id/duplicate
   * ублировать шаблон
   */
  duplicate = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const { name: newName } = req.body

    const original = await templateRepository.findOne({ where: { id } })

    if (!original) {
      throw new NotFoundError('Template', id)
    }

    const duplicate = templateRepository.create({
      ...original,
      id: undefined as any, // удет сгенерирован новый UUID
      name: newName || `${original.name} (копия)`,
      isBuiltIn: false,
      createdAt: undefined as any,
      updatedAt: undefined as any
    })

    await cacheService.invalidateByTag('templates')

    res.status(201).json(duplicate)
  })

  /**
   * POST /api/templates/:id/detect-fields
   * ереопределить поля шаблона
   */
  detectFieldsEndpoint = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params

    const template = await templateRepository.findOne({ where: { id } })

    if (!template) {
      throw new NotFoundError('Template', id)
    }

    const detectedFields = this.detectFields(template.htmlContent)
    template.detectedFields = detectedFields

    await cacheService.invalidateByTag('templates')

    res.json({
      templateId: id,
      detectedFields
    })
  })

  /**
   * POST /api/templates/detect-fields
   * пределить поля из HTML (без сохранения)
   */
  detectFieldsFromHtml = asyncHandler(async (req: Request, res: Response) => {
    const { html } = req.body

    const detectedFields = this.detectFields(html)

    res.json({ detectedFields })
  })

  /**
   * Автоопределение bindable-полей в HTML
   */
  private detectFields(html: string): DetectedField[] {
    const fields: DetectedField[] = []
    const $ = cheerio.load(html)

    // 1. Текстовые элементы с data-bind атрибутом
    $('[data-bind]').each((_: number, el: Element) => {
      const $el = $(el)
      const bindName = $el.attr('data-bind')
      if (bindName) {
        fields.push(this.createField({
          name: bindName,
          type: 'text',
          selector: this.getSelector($, el),
          attribute: 'data-bind',
          semanticHints: this.getSemanticHints(bindName)
        }))
      }
    })

    // 2. Изображения
    $('img').each((_: number, el: Element) => {
      const $el = $(el)
      const src = $el.attr('src') || ''
      const alt = $el.attr('alt') || ''
      const dataBind = $el.attr('data-bind-src')
      
      // Пропускаем статичные изображения (data URIs, CDN)
      if (!src.startsWith('data:') && !src.includes('cdn')) {
        const name = dataBind || this.extractFieldName(alt) || this.extractFieldName(src) || 'image'
        fields.push(this.createField({
          name,
          type: 'image',
          selector: this.getSelector($, el),
          attribute: 'src',
          defaultValue: src,
          semanticHints: ['image', 'photo', 'picture', 'thumbnail', 'avatar']
        }))
      }
    })

    // 3. Ссылки
    $('a[href]').each((_: number, el: Element) => {
      const $el = $(el)
      const href = $el.attr('href') || ''
      const dataBind = $el.attr('data-bind-href')
      
      // Пропускаем якоря и javascript
      if (!href.startsWith('#') && !href.startsWith('javascript:')) {
        const name = dataBind || this.extractFieldName($el.text()) || 'link'
        fields.push(this.createField({
          name: `${name}Url`,
          type: 'link',
          selector: this.getSelector($, el),
          attribute: 'href',
          defaultValue: href,
          semanticHints: ['url', 'link', 'href']
        }))
      }
    })

    // 4. Заголовки (h1-h6)
    $('h1, h2, h3, h4, h5, h6').each((_: number, el: Element) => {
      const $el = $(el)
      const text = $el.text().trim()
      if (text && !this.isPlaceholder(text)) {
        const tagName = el.tagName?.toLowerCase() || 'h'
        const name = $el.attr('data-bind') || this.extractFieldName(text) || `${tagName}Title`
        fields.push(this.createField({
          name,
          type: 'text',
          selector: this.getSelector($, el),
          defaultValue: text,
          semanticHints: ['title', 'heading', 'name']
        }))
      }
    })

    // 5. Параграфы с контентом
    $('p').each((_: number, el: Element) => {
      const $el = $(el)
      const text = $el.text().trim()
      if (text && text.length > 10 && !this.isPlaceholder(text)) {
        const name = $el.attr('data-bind') || 'description'
        fields.push(this.createField({
          name,
          type: 'text',
          selector: this.getSelector($, el),
          defaultValue: text,
          semanticHints: ['description', 'text', 'content', 'body']
        }))
      }
    })

    // 6. Элементы с data-* атрибутами
    $('[data-value], [data-id], [data-price], [data-date]').each((_: number, el: Element) => {
      const $el = $(el)
      const attrs = ['data-value', 'data-id', 'data-price', 'data-date']
      
      for (const attr of attrs) {
        const value = $el.attr(attr)
        if (value) {
          const name = attr.replace('data-', '')
          const type = this.inferType(name, value)
          fields.push(this.createField({
            name,
            type,
            selector: this.getSelector($, el),
            attribute: attr,
            defaultValue: value,
            semanticHints: [name]
          }))
        }
      }
    })

    // 7. Спаны с классами, указывающими на данные
    $('span.price, span.date, span.rating, span.count, .price, .date, .rating').each((_: number, el: Element) => {
      const $el = $(el)
      const className = $el.attr('class') || ''
      const text = $el.text().trim()
      
      const matches = className.match(/(price|date|rating|count|badge)/i)
      if (matches) {
        const name = matches[1].toLowerCase()
        fields.push(this.createField({
          name,
          type: this.inferType(name, text),
          selector: this.getSelector($, el),
          defaultValue: text,
          semanticHints: [name]
        }))
      }
    })

    // Убираем дубликаты по selector
    const uniqueFields = this.deduplicateFields(fields)

    return uniqueFields
  }

  /**
   * Создать объект поля
   */
  private createField(params: {
    name: string
    type: DetectedFieldType
    selector: string
    attribute?: string
    defaultValue?: unknown
    semanticHints?: string[]
  }): DetectedField {
    return {
      id: uuidv4(),
      name: this.camelCase(params.name),
      type: params.type,
      selector: params.selector,
      attribute: params.attribute,
      defaultValue: params.defaultValue,
      required: false,
      semanticHints: params.semanticHints
    }
  }

  /**
   * Получить уникальный CSS selector для элемента
   */
  private getSelector($: cheerio.CheerioAPI, el: Element): string {
    const $el = $(el)
    
    // Если есть ID
    const id = $el.attr('id')
    if (id) {
      return `#${id}`
    }

    // Если есть data-bind
    const dataBind = $el.attr('data-bind')
    if (dataBind) {
      return `[data-bind="${dataBind}"]`
    }

    // Строим путь
    const tagName = el.tagName?.toLowerCase() || 'div'
    const classes = ($el.attr('class') || '').split(' ').filter((c: string) => c.trim())
    
    if (classes.length > 0) {
      return `${tagName}.${classes.slice(0, 2).join('.')}`
    }

    // Fallback: nth-child
    const parent = $el.parent()
    const siblings = parent.children(tagName)
    const index = siblings.index($el) + 1
    return `${tagName}:nth-child(${index})`
  }

  /**
   * Извлечь имя поля из текста
   */
  private extractFieldName(text: string): string {
    if (!text) return ''
    
    // Убираем спецсимволы и ограничиваем длину
    const cleaned = text
      .replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, '')
      .trim()
      .slice(0, 30)
    
    // Преобразуем в camelCase
    return this.camelCase(cleaned)
  }

  /**
   * camelCase преобразование
   */
  private camelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^./, chr => chr.toLowerCase())
  }

  /**
   * Определить тип данных по имени и значению
   */
  private inferType(name: string, value: string): DetectedFieldType {
    const nameLower = name.toLowerCase()
    const valueLower = value.toLowerCase()

    // По имени
    if (/price|cost|amount|sum/i.test(nameLower)) return 'number'
    if (/date|time|created|updated/i.test(nameLower)) return 'date'
    if (/image|photo|picture|avatar|thumbnail/i.test(nameLower)) return 'image'
    if (/url|link|href/i.test(nameLower)) return 'link'
    if (/active|enabled|visible|checked/i.test(nameLower)) return 'boolean'
    if (/items|list|array|tags/i.test(nameLower)) return 'list'

    // По значению
    if (/^\d+([.,]\d+)?$/.test(value)) return 'number'
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date'
    if (/^(true|false)$/i.test(valueLower)) return 'boolean'

    return 'text'
  }

  /**
   * Проверить, является ли текст плейсхолдером
   */
  private isPlaceholder(text: string): boolean {
    const placeholders = [
      'lorem ipsum',
      'placeholder',
      'sample text',
      'example',
      '...'
    ]
    const textLower = text.toLowerCase()
    return placeholders.some(p => textLower.includes(p))
  }

  /**
   * Получить семантические подсказки по имени поля
   */
  private getSemanticHints(name: string): string[] {
    const nameLower = name.toLowerCase()
    const hints: string[] = [nameLower]

    // Добавляем синонимы
    const synonyms: Record<string, string[]> = {
      title: ['name', 'heading', 'label'],
      description: ['text', 'content', 'body', 'summary'],
      image: ['photo', 'picture', 'avatar', 'thumbnail', 'src'],
      price: ['cost', 'amount', 'value', 'sum'],
      date: ['time', 'datetime', 'created', 'updated'],
      url: ['link', 'href', 'path']
    }

    for (const [key, values] of Object.entries(synonyms)) {
      if (nameLower.includes(key) || values.some(v => nameLower.includes(v))) {
        hints.push(key, ...values)
      }
    }

    return [...new Set(hints)]
  }

  /**
   * Убрать дубликаты полей по selector
   */
  private deduplicateFields(fields: DetectedField[]): DetectedField[] {
    const seen = new Set<string>()
    return fields.filter(field => {
      const key = `${field.selector}:${field.attribute || 'content'}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }
}

export default new TemplateController()
