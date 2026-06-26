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
 * Спец-поле перевода для CSS background-image (картинка-фон, в т.ч. фото-слайды карусели).
 * Значение перевода хранится как «голый» URL; в backgroundImage оборачивается в url("…").
 */
export const BG_IMAGE_FIELD = 'bg:image'

/**
 * Извлекает «голый» URL из одиночного значения CSS background-image вида url("…").
 * Возвращает null для градиентов, нескольких фонов, none и прочего «непростого» —
 * такие случаи не локализуем (иначе можно повредить стиль).
 */
export function parseCssUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  // Кавычки допускают ')' внутри URL; без кавычек — запрещаем ')' и запятые (отсекает множественные фоны).
  const m =
    v.match(/^url\(\s*"([^"]*)"\s*\)$/i) ||
    v.match(/^url\(\s*'([^']*)'\s*\)$/i) ||
    v.match(/^url\(\s*([^'")]+?)\s*\)$/i)
  const url = m?.[1]?.trim()
  return url ? url : null
}

/** Оборачивает URL обратно в CSS url("…"). Кавычки в URL экранируем. */
export function toCssUrl(url: string): string {
  return `url("${url.replace(/"/g, '%22')}")`
}

/**
 * Recursively extracts all translatable fields from a BlockNode tree.
 * Returns an array of { nodeId, field, value } for all text content and translatable attributes.
 */
export function extractTranslatableFields(node: any): TranslationEntry[] {
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

  // Media-атрибуты — разные файлы под язык:
  //  - src/poster  — <img>/<video>
  //  - href        — ссылки
  //  - data-slide-video — видео-фон слайда карусели
  const mediaAttrs = ['src', 'poster', 'href', 'data-slide-video']
  if (node.attributes) {
    for (const attr of mediaAttrs) {
      if (node.attributes[attr] && typeof node.attributes[attr] === 'string') {
        entries.push({ nodeId, field: attr, value: node.attributes[attr] })
      }
    }
  }

  // CSS background-image (фото-слайды карусели + любые фоны) — локализуем «голый» URL.
  const bgUrl = parseCssUrl(node.styles?.properties?.backgroundImage)
  if (bgUrl) {
    entries.push({ nodeId, field: BG_IMAGE_FIELD, value: bgUrl })
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

/**
 * Применяет переводы к одному узлу дерева (мутирует переданный узел) и рекурсивно к детям.
 * Узел должен быть уже копией (см. applyTranslationsToTree) — здесь мутируем на месте.
 */
export function applyNodeTranslations(node: any, map: TranslationMap): any {
  if (!node) return node

  const nodeTranslations = map[node.id]
  if (nodeTranslations) {
    // Текстовый контент
    if (nodeTranslations['content']) {
      node.content = nodeTranslations['content']
    }

    // Атрибуты (в т.ч. медиа: src/poster/href/data-slide-video)
    if (node.attributes) {
      const attrFields = ['src', 'alt', 'href', 'placeholder', 'title', 'poster', 'aria-label', 'data-slide-video']
      for (const field of attrFields) {
        if (nodeTranslations[field]) {
          node.attributes[field] = nodeTranslations[field]
        }
      }
    }

    // CSS background-image — оборачиваем «голый» URL обратно в url("…").
    if (nodeTranslations[BG_IMAGE_FIELD]) {
      if (!node.styles) node.styles = { properties: {} }
      if (!node.styles.properties) node.styles.properties = {}
      node.styles.properties.backgroundImage = toCssUrl(nodeTranslations[BG_IMAGE_FIELD])
    }
  }

  // Дети
  if (node.children && Array.isArray(node.children)) {
    node.children = node.children.map((child: any) => applyNodeTranslations(child, map))
  }

  // Дети из вариаций (specificChildren брейкпоинтов)
  if (node.variations) {
    for (const key of Object.keys(node.variations)) {
      if (node.variations[key].specificChildren) {
        node.variations[key].specificChildren = node.variations[key].specificChildren.map(
          (child: any) => applyNodeTranslations(child, map)
        )
      }
    }
  }

  return node
}

/**
 * Применяет переводы ко всему дереву (на копии) + к page-meta. Чистая функция (без БД).
 */
export function applyTranslationsToTree(
  structure: any,
  translationMap: TranslationMap,
  pageMetadata?: any
): { structure: any; metadata: any } {
  const translated = applyNodeTranslations(JSON.parse(JSON.stringify(structure)), translationMap)

  const metadata = pageMetadata ? { ...pageMetadata } : undefined
  if (metadata && translationMap['__page__']) {
    const pageTr = translationMap['__page__']
    if (pageTr['meta:title']) metadata.title = pageTr['meta:title']
    if (pageTr['meta:description']) metadata.description = pageTr['meta:description']
    if (pageTr['meta:ogImage']) metadata.ogImage = pageTr['meta:ogImage']
  }

  return { structure: translated, metadata }
}

// ──────────────────────────────────────────────────────────────────────────
// Локализация медиа в page-переменных (repeat-слайдеры).
//
// Медиа repeat-слайдов лежит не в дереве узлов, а в массиве page-переменной
// (например heroSlides[i].imageUrl). Кодируем такие переводы в общую overlay-модель
// синтетическими ключами:
//   nodeId = "pagevar:<varName>"
//   field  = "media:<index>:<sourceField>"
// На деплое applyVariableMediaTranslations накладывает их на dataConfig.variables.
// ──────────────────────────────────────────────────────────────────────────

export const PAGEVAR_PREFIX = 'pagevar:'
export const VAR_MEDIA_PREFIX = 'media:'

/** Похоже ли строковое значение на ссылку на медиа (картинку/видео). */
export function looksLikeMediaUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const v = value.trim()
  if (!v) return false
  if (v.startsWith('/media/')) return true
  return /\.(jpe?g|png|webp|gif|avif|svg|bmp|mp4|webm|mov|m4v|ogg|ogv)(\?.*)?$/i.test(v)
}

/** Разбирает field вида "media:<index>:<sourceField>". */
function parseVarMediaField(field: string): { index: number; sourceField: string } | null {
  if (typeof field !== 'string' || !field.startsWith(VAR_MEDIA_PREFIX)) return null
  const rest = field.slice(VAR_MEDIA_PREFIX.length)
  const colon = rest.indexOf(':')
  if (colon <= 0) return null
  const index = Number(rest.slice(0, colon))
  const sourceField = rest.slice(colon + 1)
  if (!Number.isInteger(index) || index < 0 || !sourceField) return null
  return { index, sourceField }
}

/**
 * Извлекает переводимые медиа-поля из envelope page-переменных
 * ({ variables: [{ name, defaultValue }] }). Для каждого массива-переменной,
 * каждого элемента и каждого строкового поля, похожего на медиа-URL, — одна запись.
 * Служебные поля (начинаются с '_': _id, _hidden, _*AssetId) пропускаем.
 */
export function extractVariableMediaFields(envelope: any): TranslationEntry[] {
  const entries: TranslationEntry[] = []
  const vars = envelope?.variables
  if (!Array.isArray(vars)) return entries

  for (const v of vars) {
    const name = v?.name
    const arr = v?.defaultValue
    if (typeof name !== 'string' || !Array.isArray(arr)) continue
    arr.forEach((item: any, index: number) => {
      if (!item || typeof item !== 'object') return
      for (const [field, value] of Object.entries(item as Record<string, unknown>)) {
        if (field.startsWith('_')) continue
        if (looksLikeMediaUrl(value)) {
          entries.push({
            nodeId: PAGEVAR_PREFIX + name,
            field: VAR_MEDIA_PREFIX + index + ':' + field,
            value: value as string,
          })
        }
      }
    })
  }
  return entries
}

/**
 * Накладывает переводы медиа page-переменных (ключи pagevar:/media:) на массив
 * dataConfig.variables. Возвращает НОВЫЙ массив (исходный не мутируется). Если
 * подходящих переводов нет — возвращает исходный массив без копирования.
 */
export function applyVariableMediaTranslations<T extends { name: string; defaultValue: unknown }>(
  variables: T[],
  map: TranslationMap
): T[] {
  if (!Array.isArray(variables)) return variables

  const byVar = new Map<string, Array<{ index: number; sourceField: string; value: string }>>()
  for (const [nodeId, fields] of Object.entries(map)) {
    if (!nodeId.startsWith(PAGEVAR_PREFIX)) continue
    const varName = nodeId.slice(PAGEVAR_PREFIX.length)
    for (const [field, value] of Object.entries(fields)) {
      const parsed = parseVarMediaField(field)
      if (!parsed) continue
      const list = byVar.get(varName) || []
      list.push({ index: parsed.index, sourceField: parsed.sourceField, value })
      byVar.set(varName, list)
    }
  }
  if (byVar.size === 0) return variables

  return variables.map((v): T => {
    const overrides = byVar.get(v.name)
    if (!overrides || !Array.isArray(v.defaultValue)) return v
    const arr = (v.defaultValue as unknown[]).map((item) =>
      item && typeof item === 'object' ? { ...(item as Record<string, unknown>) } : item
    )
    for (const o of overrides) {
      const item = arr[o.index]
      if (item && typeof item === 'object') {
        ;(item as Record<string, unknown>)[o.sourceField] = o.value
      }
    }
    return { ...v, defaultValue: arr }
  })
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

    // Медиа в page-переменных (repeat-слайдеры) — разные файлы под язык.
    if ((page as any).variables) {
      entries.push(...extractVariableMediaFields((page as any).variables))
    }

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
    return applyTranslationsToTree(structure, translationMap, pageMetadata)
  }
}

export const translationService = new TranslationService()
