/**
 * Сервис управления переводами контента страниц
 * 
 * Подход: Translation Overlay
 * - Основной контент хранится в BlockNode tree (page.structure) на языке по умолчанию
 * - Переводы хранятся как оверлеи: (pageId, locale, nodeId, field) → value
 * - При рендеринге переводы применяются поверх оригинального контента
 */
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { Translation } from '../models/Translation'
import { Page } from '../models/Page'

export interface TranslationEntry {
  nodeId: string
  field: string
  value: string
  status?: 'draft' | 'review' | 'approved' | 'published'
}

export interface BulkTranslationUpdate {
  locale: string
  translations: TranslationEntry[]
}

export interface TranslationMap {
  [nodeId: string]: {
    [field: string]: string
  }
}

export interface TranslationProgress {
  locale: string
  total: number
  translated: number
  percentage: number
  byStatus: {
    draft: number
    review: number
    approved: number
    published: number
  }
}

/**
 * Recursively extracts all translatable fields from a BlockNode tree.
 * Returns an array of { nodeId, field, value } for all text content and translatable attributes.
 */
function extractTranslatableFields(node: any): TranslationEntry[] {
  const entries: TranslationEntry[] = []
  
  if (!node) return entries

  const nodeId = node.id

  // Text content
  if (node.content && typeof node.content === 'string' && node.content.trim()) {
    entries.push({ nodeId, field: 'content', value: node.content })
  }

  // Translatable attributes
  const translatableAttrs = ['alt', 'placeholder', 'title', 'aria-label']
  if (node.attributes) {
    for (const attr of translatableAttrs) {
      if (node.attributes[attr] && typeof node.attributes[attr] === 'string') {
        entries.push({ nodeId, field: attr, value: node.attributes[attr] })
      }
    }
  }

  // Media attributes (src, poster, href) - for different media per language
  const mediaAttrs = ['src', 'poster', 'href']
  if (node.attributes) {
    for (const attr of mediaAttrs) {
      if (node.attributes[attr] && typeof node.attributes[attr] === 'string') {
        entries.push({ nodeId, field: attr, value: node.attributes[attr] })
      }
    }
  }

  // Recurse into children
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      entries.push(...extractTranslatableFields(child))
    }
  }

  // Recurse into variations specificChildren
  if (node.variations) {
    for (const variation of Object.values(node.variations as Record<string, any>)) {
      if (variation.specificChildren && Array.isArray(variation.specificChildren)) {
        for (const child of variation.specificChildren) {
          entries.push(...extractTranslatableFields(child))
        }
      }
    }
  }

  return entries
}

export class TranslationService {
  private repository = AppDataSource.getRepository(Translation)
  private pageRepository = AppDataSource.getRepository(Page)

  /**
   * Get all translations for a page in a specific locale
   */
  async getPageTranslations(pageId: string, locale: string): Promise<Translation[]> {
    return this.repository.find({
      where: { pageId, locale },
      order: { nodeId: 'ASC', field: 'ASC' },
    })
  }

  /**
   * Get translations as a map: { [nodeId]: { [field]: value } }
   */
  async getTranslationMap(pageId: string, locale: string): Promise<TranslationMap> {
    const translations = await this.getPageTranslations(pageId, locale)
    const map: TranslationMap = {}
    
    for (const t of translations) {
      if (!map[t.nodeId]) map[t.nodeId] = {}
      map[t.nodeId][t.field] = t.value
    }
    
    return map
  }

  /**
   * Get all locales that have translations for a page
   */
  async getPageLocales(pageId: string): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder('t')
      .select('DISTINCT t.locale', 'locale')
      .where('t.pageId = :pageId', { pageId })
      .getRawMany()
    
    return result.map((r: any) => r.locale)
  }

  /**
   * Bulk upsert translations for a page in a specific locale
   */
  async bulkUpsert(pageId: string, locale: string, entries: TranslationEntry[]): Promise<Translation[]> {
    const results: Translation[] = []

    for (const entry of entries) {
      let existing = await this.repository.findOne({
        where: { pageId, locale, nodeId: entry.nodeId, field: entry.field },
      })

      if (existing) {
        existing.value = entry.value
        if (entry.status) existing.status = entry.status
        results.push(await this.repository.save(existing))
      } else {
        const translation = this.repository.create({
          pageId,
          locale,
          nodeId: entry.nodeId,
          field: entry.field,
          value: entry.value,
          status: entry.status || 'draft',
        })
        results.push(await this.repository.save(translation))
      }
    }

    return results
  }

  /**
   * Update a single translation
   */
  async upsertOne(pageId: string, locale: string, nodeId: string, field: string, value: string, status?: string): Promise<Translation> {
    let existing = await this.repository.findOne({
      where: { pageId, locale, nodeId, field },
    })

    if (existing) {
      existing.value = value
      if (status) existing.status = status as any
      return this.repository.save(existing)
    }

    const translation = this.repository.create({
      pageId,
      locale,
      nodeId,
      field,
      value,
      status: (status as any) || 'draft',
    })
    return this.repository.save(translation)
  }

  /**
   * Delete a single translation
   */
  async deleteOne(pageId: string, locale: string, nodeId: string, field: string): Promise<boolean> {
    const result = await this.repository.delete({ pageId, locale, nodeId, field })
    return (result.affected ?? 0) > 0
  }

  /**
   * Delete all translations for a page in a specific locale
   */
  async deleteLocale(pageId: string, locale: string): Promise<number> {
    const result = await this.repository.delete({ pageId, locale })
    return result.affected ?? 0
  }

  /**
   * Delete all translations for a page (all locales)
   */
  async deleteAllForPage(pageId: string): Promise<number> {
    const result = await this.repository.delete({ pageId })
    return result.affected ?? 0
  }

  /**
   * Extract all translatable fields from a page's structure
   * Returns the "source" content for translation
   */
  async extractTranslatableContent(pageId: string): Promise<TranslationEntry[]> {
    const page = await this.pageRepository.findOne({ where: { id: pageId } })
    if (!page || !page.structure) return []

    const entries: TranslationEntry[] = []

    // Page metadata
    if (page.metadata) {
      if (page.metadata.title) {
        entries.push({ nodeId: '__page__', field: 'meta:title', value: page.metadata.title })
      }
      if (page.metadata.description) {
        entries.push({ nodeId: '__page__', field: 'meta:description', value: page.metadata.description })
      }
    }

    // BlockNode tree content
    entries.push(...extractTranslatableFields(page.structure))

    return entries
  }

  /**
   * Get translation progress/stats for a page across all locales
   */
  async getProgress(pageId: string): Promise<TranslationProgress[]> {
    const sourceFields = await this.extractTranslatableContent(pageId)
    const total = sourceFields.length

    const locales = await this.getPageLocales(pageId)
    const progress: TranslationProgress[] = []

    for (const locale of locales) {
      const translations = await this.getPageTranslations(pageId, locale)
      const byStatus = { draft: 0, review: 0, approved: 0, published: 0 }
      
      for (const t of translations) {
        if (byStatus[t.status] !== undefined) {
          byStatus[t.status]++
        }
      }

      progress.push({
        locale,
        total,
        translated: translations.length,
        percentage: total > 0 ? Math.round((translations.length / total) * 100) : 0,
        byStatus,
      })
    }

    return progress
  }

  /**
   * Copy translations from one locale to another (useful for initializing)
   */
  async copyTranslations(pageId: string, fromLocale: string, toLocale: string): Promise<Translation[]> {
    const source = await this.getPageTranslations(pageId, fromLocale)
    const entries: TranslationEntry[] = source.map(t => ({
      nodeId: t.nodeId,
      field: t.field,
      value: t.value,
      status: 'draft' as const,
    }))

    return this.bulkUpsert(pageId, toLocale, entries)
  }

  /**
   * Apply translations to a BlockNode tree, returning a new tree with translated content.
   * Used during deploy to generate localized pages.
   */
  applyTranslations(structure: any, translationMap: TranslationMap, pageMetadata?: any): { structure: any; metadata: any } {
    const translated = this.applyNodeTranslations(JSON.parse(JSON.stringify(structure)), translationMap)
    
    let metadata = pageMetadata ? { ...pageMetadata } : undefined
    if (metadata && translationMap['__page__']) {
      const pageTr = translationMap['__page__']
      if (pageTr['meta:title']) metadata.title = pageTr['meta:title']
      if (pageTr['meta:description']) metadata.description = pageTr['meta:description']
      if (pageTr['meta:ogImage']) metadata.ogImage = pageTr['meta:ogImage']
    }

    return { structure: translated, metadata }
  }

  private applyNodeTranslations(node: any, map: TranslationMap): any {
    if (!node) return node

    const nodeTranslations = map[node.id]
    if (nodeTranslations) {
      // Apply content translation
      if (nodeTranslations['content']) {
        node.content = nodeTranslations['content']
      }

      // Apply attribute translations
      if (node.attributes) {
        const attrFields = ['src', 'alt', 'href', 'placeholder', 'title', 'poster', 'aria-label']
        for (const field of attrFields) {
          if (nodeTranslations[field]) {
            node.attributes[field] = nodeTranslations[field]
          }
        }
      }
    }

    // Recurse into children
    if (node.children && Array.isArray(node.children)) {
      node.children = node.children.map((child: any) => this.applyNodeTranslations(child, map))
    }

    // Recurse into variations specificChildren
    if (node.variations) {
      for (const key of Object.keys(node.variations)) {
        if (node.variations[key].specificChildren) {
          node.variations[key].specificChildren = node.variations[key].specificChildren.map(
            (child: any) => this.applyNodeTranslations(child, map)
          )
        }
      }
    }

    return node
  }
}

export const translationService = new TranslationService()
