/**
 * Сервис управления переводами контента страниц
 * 
 * Подход: Translation Overlay
 * - Основной контент хранится в BlockNode tree (page.structure) на языке по умолчанию
 * - Переводы хранятся как оверлеи у владельца узла: собственные узлы страницы —
 *   (pageId, locale, nodeId, field) в translations, узлы библиотечных блоков —
 *   (blockId, locale, nodeId, field) в block_translations (translationOwnership.ts)
 * - Перевод страницы = её строки + строки её блоков; запись уходит владельцу
 * - При рендеринге переводы применяются поверх оригинального контента; нет
 *   перевода — остаётся текст основного языка
 */
import { In, Repository } from 'typeorm'
import { AppDataSource } from '../config/database'
import { Translation } from '../models/Translation'
import { BlockTranslation } from '../models/BlockTranslation'
import { Block } from '../models/Block'
import { Page } from '../models/Page'
import { languageService } from './LanguageService'
import {
  ALL_LOCALES,
  Ownership,
  RowSource,
  SameMark,
  blockOwnerOf,
  buildTranslationMap,
  isSameByDefault,
  isSameEffective,
  markOf,
  marksOf,
  mergeRows,
  missingEntries,
  resolveOwnership,
} from './translationOwnership'
import { extractBgUrl, bgUrlPatch } from './cssBackground'
import { linkedBlocksService } from './LinkedBlocksService'

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

  // Text content. html-code исключаем: это сырой HTML/markup, руками не переводится
  // и может превышать лимиты (в т.ч. ломал экспорт XLSX) — вне системы переводов.
  if (
    node.elementType !== 'html-code' &&
    node.content && typeof node.content === 'string' && node.content.trim()
  ) {
    entries.push({ nodeId, field: 'content', value: node.content })
  }

  // Translatable attributes. data-title — подпись, которую скрипт блока
  // показывает по действию (заголовок над видео в каталоге на главной).
  const translatableAttrs = ['alt', 'placeholder', 'title', 'aria-label', 'data-title']
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
  // Фон видим и в background shorthand (градиент + url у импортированных страниц).
  const bgUrl = extractBgUrl(node.styles?.properties)
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
 * Значение целиком состоит из маркера подстановки?
 *
 * `{{item.name}}`, `{{$.label}}` — не копирайт, а адрес поля данных: его
 * подставляет `DeployService.substituteItemData` на деплое коллекции.
 * Переводить такое нечего, а перевод ломает подстановку молча:
 * `replaceTemplateVars` не находит маркер и оставляет пустую строку, то есть
 * на витрине пропадает название проекта или цена, и никакой ошибки при этом
 * не будет. Смешанные значения («{{item.name}} — Golden House») оставляем:
 * там есть что переводить, а маркер переводчик перенесёт.
 */
export function isPurePlaceholder(value: string): boolean {
  return /^\s*\{\{[^{}]+\}\}\s*$/.test(value)
}

/**
 * Схлопывает повторы по паре (nodeId, field).
 *
 * Один и тот же блок может быть подключён к странице дважды — тогда после
 * разворота его узлы встретятся с теми же id. Перевод адресуется парой
 * (nodeId, field), то есть для обоих вхождений он один; дубль в выдаче лишь
 * задваивал бы строки в файле на перевод.
 */
export function dedupeEntries(entries: TranslationEntry[]): TranslationEntry[] {
  const seen = new Set<string>()
  const out: TranslationEntry[] = []
  for (const entry of entries) {
    const key = `${entry.nodeId}\u0000${entry.field}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry)
  }
  return out
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
      // data-header-theme — фон под шапкой над слайдом на этом языке (dark | light |
      // auto): задаётся в «Медиа слайда по языкам», в тексты на перевод не выдаётся.
      const attrFields = ['src', 'alt', 'href', 'placeholder', 'title', 'poster', 'aria-label', 'data-slide-video', 'data-title', 'data-header-theme']
      for (const field of attrFields) {
        if (nodeTranslations[field]) {
          node.attributes[field] = nodeTranslations[field]
        }
      }
    }

    // CSS background-image — подменяем url там, где фон реально живёт
    // (backgroundImage или background shorthand), сохраняя градиентные слои.
    if (nodeTranslations[BG_IMAGE_FIELD]) {
      if (!node.styles) node.styles = { properties: {} }
      if (!node.styles.properties) node.styles.properties = {}
      const patch = bgUrlPatch(node.styles.properties, nodeTranslations[BG_IMAGE_FIELD])
      for (const [k, v] of Object.entries(patch)) {
        if (v) node.styles.properties[k] = v
        else delete node.styles.properties[k]
      }
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
//   field  = "media:<_id слайда>:<sourceField>"
// На деплое applyVariableMediaTranslations накладывает их на dataConfig.variables.
//
// Слайд адресуется постоянным _id, а не номером в массиве: при номере удаление,
// перестановка или копирование слайда молча отдавали языковые варианты чужим
// слайдам (видно было только на языковой версии сайта).
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

/**
 * Ключ слайда в переводе — его постоянный _id (выдаёт панель слайдов при
 * создании и копировании, хранится в самой переменной). Слайд без _id
 * адресовать нечем: его медиа на перевод не выдаётся, пока слайды не
 * сохранят из панели.
 */
export function slideKeyOf(item: unknown): string | null {
  const id = item && typeof item === 'object' ? (item as { _id?: unknown })._id : undefined
  // Двоеточие разделяет части ключа "media:<id>:<поле>" — такой id не адресуем.
  return typeof id === 'string' && id.trim() !== '' && !id.includes(':') ? id : null
}

/** Разбирает field вида "media:<_id слайда>:<sourceField>". */
function parseVarMediaField(field: string): { slideKey: string; sourceField: string } | null {
  if (typeof field !== 'string' || !field.startsWith(VAR_MEDIA_PREFIX)) return null
  const rest = field.slice(VAR_MEDIA_PREFIX.length)
  const colon = rest.indexOf(':')
  if (colon <= 0) return null
  const slideKey = rest.slice(0, colon)
  const sourceField = rest.slice(colon + 1)
  if (!sourceField) return null
  return { slideKey, sourceField }
}

/**
 * Извлекает переводимые медиа-поля из envelope page-переменных
 * ({ variables: [{ name, defaultValue }] }). Для каждого массива-переменной,
 * каждого элемента с _id и каждого строкового поля, похожего на медиа-URL, —
 * одна запись. Служебные поля (начинаются с '_': _id, _hidden, _*AssetId) пропускаем.
 */
export function extractVariableMediaFields(envelope: any): TranslationEntry[] {
  const entries: TranslationEntry[] = []
  const vars = envelope?.variables
  if (!Array.isArray(vars)) return entries

  for (const v of vars) {
    const name = v?.name
    const arr = v?.defaultValue
    if (typeof name !== 'string' || !Array.isArray(arr)) continue
    arr.forEach((item: any) => {
      const key = slideKeyOf(item)
      if (key === null) return
      for (const [field, value] of Object.entries(item as Record<string, unknown>)) {
        if (field.startsWith('_')) continue
        if (looksLikeMediaUrl(value)) {
          entries.push({
            nodeId: PAGEVAR_PREFIX + name,
            field: VAR_MEDIA_PREFIX + key + ':' + field,
            value: value as string,
          })
        }
      }
      // Пер-брейкпоинтные варианты медиа слайда: item._responsive[field][bp].
      const rm = (item as { _responsive?: unknown })._responsive
      if (rm && typeof rm === 'object') {
        for (const [field, byBp] of Object.entries(rm as Record<string, unknown>)) {
          if (!byBp || typeof byBp !== 'object') continue
          for (const [bp, url] of Object.entries(byBp as Record<string, unknown>)) {
            if (looksLikeMediaUrl(url)) {
              entries.push({
                nodeId: PAGEVAR_PREFIX + name,
                field: VAR_MEDIA_PREFIX + key + ':' + field + '@' + bp,
                value: url as string,
              })
            }
          }
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

  const byVar = new Map<string, Array<{ slideKey: string; sourceField: string; value: string }>>()
  for (const [nodeId, fields] of Object.entries(map)) {
    if (!nodeId.startsWith(PAGEVAR_PREFIX)) continue
    const varName = nodeId.slice(PAGEVAR_PREFIX.length)
    for (const [field, value] of Object.entries(fields)) {
      const parsed = parseVarMediaField(field)
      if (!parsed) continue
      const list = byVar.get(varName) || []
      list.push({ slideKey: parsed.slideKey, sourceField: parsed.sourceField, value })
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
    const bySlide = new Map<string, Record<string, unknown>>()
    for (const item of arr) {
      const key = slideKeyOf(item)
      if (key !== null) bySlide.set(key, item as Record<string, unknown>)
    }
    for (const o of overrides) {
      // Слайда с таким _id нет (удалён) — вариант ничей и не применяется.
      const rec = bySlide.get(o.slideKey)
      if (!rec) continue
      const at = o.sourceField.indexOf('@')
      if (at > 0) {
        // Пер-брейкпоинтный вариант: пишем в _responsive[field][bp] (новые объекты, без мутации оригинала).
        const field = o.sourceField.slice(0, at)
        const bp = o.sourceField.slice(at + 1)
        const curResp = rec._responsive && typeof rec._responsive === 'object' ? (rec._responsive as Record<string, Record<string, unknown>>) : {}
        const curField = curResp[field] && typeof curResp[field] === 'object' ? curResp[field] : {}
        rec._responsive = { ...curResp, [field]: { ...curField, [bp]: o.value } }
      } else {
        rec[o.sourceField] = o.value
      }
    }
    return { ...v, defaultValue: arr }
  })
}

/**
 * Извлекает пер-брейкпоинтные медиа-поля из variations дерева.
 * Экранные оверрайды (базовый язык) хранятся в
 * variations[bpId].inheritedOverrides[nodeId] — берём `.attributes.src` и
 * `.styles.backgroundImage` (голый URL). Кодируем брейкпоинт в имя поля:
 *   `src@<bpId>` / `bg:image@<bpId>`
 * «Оригинал» такого поля = экранное значение базового языка; так пер-брейкпоинтное
 * медиа видно и в панели переводов, и в экспорте, и в прогрессе.
 */
export function extractResponsiveMediaFields(root: any): TranslationEntry[] {
  const entries: TranslationEntry[] = []

  const walk = (node: any): void => {
    if (!node) return
    if (node.variations) {
      for (const [bpId, variation] of Object.entries(node.variations as Record<string, any>)) {
        const io = variation?.inheritedOverrides
        if (io) {
          for (const [descId, ov] of Object.entries(io as Record<string, any>)) {
            const src = ov?.attributes?.src
            if (typeof src === 'string' && src.trim()) {
              entries.push({ nodeId: descId, field: `src@${bpId}`, value: src })
            }
            const bgUrl = parseCssUrl(ov?.styles?.backgroundImage)
            if (bgUrl) {
              entries.push({ nodeId: descId, field: `${BG_IMAGE_FIELD}@${bpId}`, value: bgUrl })
            }
          }
        }
        for (const sc of variation?.specificChildren || []) walk(sc)
      }
    }
    for (const child of node.children || []) walk(child)
  }

  walk(root)
  return entries
}

/** Перевод, как его видит страница: строка страницы или блока. */
export interface PageTranslationRow {
  id: string
  pageId: string
  locale: string
  nodeId: string
  field: string
  value: string
  status: 'draft' | 'review' | 'approved' | 'published'
  /** page — свой узел страницы; block — перевод блока; legacy — копия перевода блока в странице (до переноса). */
  source: RowSource
  /** Блок-владелец узла — для source block и legacy. */
  blockId?: string
}

/** Поле страницы для панели переводов: оригинал, перевод языка, владелец, отметка. */
export interface TranslationOverviewEntry extends TranslationEntry {
  /** Перевод на запрошенный язык; нет — undefined. */
  translation?: string
  translationStatus?: string
  owner: { kind: 'page' } | { kind: 'block'; blockId: string; blockName: string; pageCount: number }
  /** Отметка «один текст для всех языков»; нет — по умолчанию поля. */
  mark?: SameMark
  /** Действует ли «один текст для всех языков» (с учётом умолчания). */
  same: boolean
  /** Поле по умолчанию общее (ссылки, медиа). */
  sameByDefault: boolean
  missing: boolean
}

export interface TranslationOverview {
  locale: string
  total: number
  missing: number
  entries: TranslationOverviewEntry[]
}

/** Дерево страницы с развёрнутыми блоками и владельцы его узлов. */
interface PageContext {
  page: Page
  expanded: any
  ownership: Ownership
}

type Scope = { pageId: string } | { blockId: string }

export class TranslationService {
  private repository = AppDataSource.getRepository(Translation)
  private blockRepository = AppDataSource.getRepository(BlockTranslation)
  private pageRepository = AppDataSource.getRepository(Page)

  /**
   * Страница, её дерево с развёрнутыми блоками (как на деплое) и владельцы
   * узлов. Страницы нет — пустой контекст: строки страницы видны как есть.
   */
  private async context(pageId: string): Promise<PageContext | null> {
    const page = await this.pageRepository.findOne({ where: { id: pageId } })
    if (!page) return null
    const expanded = page.structure ? await linkedBlocksService.updateLinkedBlocks(page.structure) : null
    return { page, expanded, ownership: resolveOwnership(expanded) }
  }

  private ownershipOf(ctx: PageContext | null): Ownership {
    return ctx?.ownership ?? { blockOf: new Map(), ambiguous: new Set(), blockIds: [] }
  }

  /** Строки языка (или '*'), как их видит страница: свои + блоков. */
  private async effectiveRows(pageId: string, locale: string, ctx?: PageContext | null): Promise<PageTranslationRow[]> {
    const context = ctx === undefined ? await this.context(pageId) : ctx
    const ownership = this.ownershipOf(context)
    const pageRows = await this.repository.find({ where: { pageId, locale } })
    const blockRows = ownership.blockIds.length
      ? await this.blockRepository.find({ where: { blockId: In(ownership.blockIds), locale } })
      : []
    const byKey = new Map<string, { id: string; status: string }>()
    for (const r of pageRows) byKey.set(`page\u0000${r.nodeId}\u0000${r.field}`, r)
    for (const r of blockRows) byKey.set(`${r.blockId}\u0000${r.nodeId}\u0000${r.field}`, r)
    return mergeRows(ownership, pageRows, blockRows).map((row) => {
      const stored = byKey.get(`${row.source === 'block' ? row.blockId : 'page'}\u0000${row.nodeId}\u0000${row.field}`)
      return {
        id: stored?.id ?? '',
        pageId,
        locale: row.locale,
        nodeId: row.nodeId,
        field: row.field,
        value: row.value,
        status: (row.status as PageTranslationRow['status']) ?? 'draft',
        source: row.source,
        ...(row.blockId ? { blockId: row.blockId } : {}),
      }
    })
  }

  /**
   * Переводы страницы на язык: строки её собственных узлов и переводы её
   * блоков (у каждой строки — откуда она: source, blockId).
   */
  async getPageTranslations(pageId: string, locale: string): Promise<PageTranslationRow[]> {
    return this.effectiveRows(pageId, locale)
  }

  /**
   * Карта переводов языка { [nodeId]: { [field]: value } } — то, что деплой
   * накладывает на дерево. Поля «один текст для всех языков» в неё не входят:
   * на всех языках остаётся текст основного языка.
   */
  async getTranslationMap(pageId: string, locale: string): Promise<TranslationMap> {
    const ctx = await this.context(pageId)
    const rows = await this.effectiveRows(pageId, locale, ctx)
    const marks = marksOf(await this.effectiveRows(pageId, ALL_LOCALES, ctx))
    return buildTranslationMap(rows, marks)
  }

  /**
   * Языки, на которые у страницы есть хоть один перевод — своих узлов или её
   * блоков. По ним переключатель языка показывает языковые версии.
   * Отметки «один текст для всех языков» языком не считаются.
   */
  async getPageLocales(pageId: string): Promise<string[]> {
    const ctx = await this.context(pageId)
    const ownership = this.ownershipOf(ctx)
    const pageLocales = await this.repository
      .createQueryBuilder('t')
      .select('DISTINCT t.locale', 'locale')
      .where('t.pageId = :pageId', { pageId })
      .andWhere('t.locale <> :all', { all: ALL_LOCALES })
      .getRawMany()
    const locales = new Set<string>(pageLocales.map((r: any) => r.locale))
    if (ownership.blockIds.length) {
      // Строки блока — только по узлам, которые на этой странице его.
      const rows = await this.blockRepository.find({
        where: { blockId: In(ownership.blockIds) },
        select: { blockId: true, nodeId: true, locale: true },
      })
      for (const r of rows) {
        if (r.locale !== ALL_LOCALES && blockOwnerOf(ownership, r.nodeId) === r.blockId) locales.add(r.locale)
      }
    }
    return [...locales].sort()
  }

  /**
   * Пишет строки одного владельца одного языка пачкой: существующие —
   * одним запросом, сохранение кусками. Повторы ключа во входе — побеждает
   * последний.
   */
  private async upsertScoped(
    scope: Scope,
    locale: string,
    entries: TranslationEntry[]
  ): Promise<{ saved: Array<Translation | BlockTranslation>; inserted: number; updated: number; unchanged: number }> {
    const repo: Repository<Translation | BlockTranslation> =
      'blockId' in scope ? (this.blockRepository as any) : (this.repository as any)
    const existing = await repo.find({ where: { ...scope, locale } as any })
    const byKey = new Map<string, Translation | BlockTranslation>()
    for (const t of existing) byKey.set(`${t.nodeId}\u0000${t.field}`, t)
    const dedup = new Map<string, TranslationEntry>()
    for (const e of entries) dedup.set(`${e.nodeId}\u0000${e.field}`, e)

    const toSave: Array<Translation | BlockTranslation> = []
    const saved: Array<Translation | BlockTranslation> = []
    let inserted = 0
    let updated = 0
    let unchanged = 0
    for (const [key, e] of dedup) {
      const cur = byKey.get(key)
      if (cur) {
        const statusChanged = !!e.status && cur.status !== e.status
        if (cur.value !== e.value || statusChanged) {
          cur.value = e.value
          if (e.status) cur.status = e.status
          toSave.push(cur)
          updated++
        } else {
          unchanged++
          saved.push(cur)
        }
      } else {
        toSave.push(repo.create({ ...scope, locale, nodeId: e.nodeId, field: e.field, value: e.value, status: e.status || 'draft' } as any) as any)
        inserted++
      }
    }
    if (toSave.length > 0) saved.push(...(await repo.save(toSave as any[], { chunk: 200 })))
    return { saved, inserted, updated, unchanged }
  }

  /** Записи по владельцам узлов: страница и каждый блок отдельно. */
  private groupByOwner(pageId: string, ownership: Ownership, entries: TranslationEntry[]): Array<{ scope: Scope; entries: TranslationEntry[] }> {
    const groups = new Map<string, { scope: Scope; entries: TranslationEntry[] }>()
    for (const e of entries) {
      const blockId = blockOwnerOf(ownership, e.nodeId)
      const key = blockId ? `block:${blockId}` : 'page'
      const group = groups.get(key) ?? { scope: blockId ? { blockId } : { pageId }, entries: [] }
      group.entries.push(e)
      groups.set(key, group)
    }
    return [...groups.values()]
  }

  /**
   * Пачка переводов языка. Каждая строка уходит владельцу узла: перевод
   * текста блока — блоку (меняется на всех страницах с этим блоком), своих
   * узлов — странице.
   */
  async bulkUpsert(pageId: string, locale: string, entries: TranslationEntry[]): Promise<Array<Translation | BlockTranslation>> {
    const ownership = this.ownershipOf(await this.context(pageId))
    const saved: Array<Translation | BlockTranslation> = []
    for (const group of this.groupByOwner(pageId, ownership, entries)) {
      saved.push(...(await this.upsertScoped(group.scope, locale, group.entries)).saved)
    }
    return saved
  }

  /** Как bulkUpsert, но со счётчиками (импорт XLSX). */
  async bulkUpsertBatched(
    pageId: string,
    locale: string,
    entries: TranslationEntry[],
  ): Promise<{ inserted: number; updated: number; unchanged: number }> {
    const total = { inserted: 0, updated: 0, unchanged: 0 }
    if (entries.length === 0) return total
    const ownership = this.ownershipOf(await this.context(pageId))
    for (const group of this.groupByOwner(pageId, ownership, entries)) {
      const r = await this.upsertScoped(group.scope, locale, group.entries)
      total.inserted += r.inserted
      total.updated += r.updated
      total.unchanged += r.unchanged
    }
    return total
  }

  /** Один перевод — владельцу узла. */
  async upsertOne(pageId: string, locale: string, nodeId: string, field: string, value: string, status?: string): Promise<Translation | BlockTranslation> {
    const [saved] = await this.bulkUpsert(pageId, locale, [{ nodeId, field, value, status: status as TranslationEntry['status'] }])
    return saved
  }

  /**
   * Отметка «один текст для всех языков» у поля: same — всегда текст
   * основного языка; translate — переводить, даже если поле по умолчанию
   * общее (ссылки, медиа); default — снять отметку. Переводы языков при этом
   * не удаляются: снятая отметка возвращает их в работу.
   */
  async setSameMark(pageId: string, nodeId: string, field: string, mode: SameMark | 'default'): Promise<void> {
    if (mode === 'default') {
      await this.deleteOne(pageId, ALL_LOCALES, nodeId, field)
      return
    }
    await this.upsertOne(pageId, ALL_LOCALES, nodeId, field, mode, 'published')
  }

  /**
   * Удаляет перевод поля у владельца. У перевода блока заодно уходят его
   * копии в страницах с этим блоком (так хранилось до переноса) — иначе
   * удалённый перевод вернулся бы из копии.
   */
  async deleteOne(pageId: string, locale: string, nodeId: string, field: string): Promise<boolean> {
    const ownership = this.ownershipOf(await this.context(pageId))
    const blockId = blockOwnerOf(ownership, nodeId)
    if (!blockId) {
      const result = await this.repository.delete({ pageId, locale, nodeId, field })
      return (result.affected ?? 0) > 0
    }
    const own = await this.blockRepository.delete({ blockId, locale, nodeId, field })
    const pageIds = await this.pagesLinkingBlock(blockId)
    const copies = pageIds.length ? await this.repository.delete({ pageId: In(pageIds), locale, nodeId, field }) : { affected: 0 }
    return (own.affected ?? 0) + (copies.affected ?? 0) > 0
  }

  /** Страницы, к которым подключён блок (по ссылке в структуре). */
  private async pagesLinkingBlock(blockId: string): Promise<string[]> {
    const rows = await this.pageRepository
      .createQueryBuilder('p')
      .select('p.id', 'id')
      .where('p.structure::text LIKE :id', { id: `%${blockId}%` })
      .getRawMany()
    return rows.map((r: any) => r.id)
  }

  /**
   * Удаляет язык страницы: только переводы её собственных узлов. Переводы
   * блоков (и их копии в странице до переноса) остаются — блок общий, и
   * удаление языка на одной странице не должно стирать шапку на всех.
   */
  async deleteLocale(pageId: string, locale: string): Promise<number> {
    const ownership = this.ownershipOf(await this.context(pageId))
    const rows = await this.repository.find({ where: { pageId, locale }, select: { id: true, nodeId: true } })
    const ids = rows.filter((r) => !blockOwnerOf(ownership, r.nodeId)).map((r) => r.id)
    if (ids.length === 0) return 0
    const result = await this.repository.delete({ id: In(ids) })
    return result.affected ?? 0
  }

  /** Все строки страницы (страница удаляется). Переводы блоков не трогаются. */
  async deleteAllForPage(pageId: string): Promise<number> {
    const result = await this.repository.delete({ pageId })
    return result.affected ?? 0
  }

  /**
   * Extract all translatable fields from a page's structure
   * Returns the "source" content for translation
   *
   * Структура разворачивается по linked-блокам, как на деплое. В сырой
   * `page.structure` у такого блока `children` пуст, поэтому раньше на перевод
   * не выдавалось ни слова из шапки, подвала и любой секции, подключённой
   * блоком: у страницы-шаблона проекта это весь её контент. При этом
   * `applyTranslations` на деплое работает по `nodeId` и применил бы такие
   * строки — сломана была только выдача, из-за чего перевести их было нечем.
   */
  async extractTranslatableContent(pageId: string, ctx?: PageContext | null): Promise<TranslationEntry[]> {
    const context = ctx === undefined ? await this.context(pageId) : ctx
    if (!context || !context.page.structure) return []
    const { page, expanded: structure } = context

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
    entries.push(...extractTranslatableFields(structure))

    // Пер-брейкпоинтные медиа (матрица «экран × язык»): src@bp / bg:image@bp.
    entries.push(...extractResponsiveMediaFields(structure))

    // Медиа в page-переменных (repeat-слайдеры) — разные файлы под язык.
    if ((page as any).variables) {
      entries.push(...extractVariableMediaFields((page as any).variables))
    }

    return dedupeEntries(entries.filter((e) => !isPurePlaceholder(e.value)))
  }

  /**
   * Поля страницы для панели переводов на язык: оригинал, перевод, чей узел
   * (страницы или блока — и на скольких страницах блок), отметка «один текст
   * для всех языков» и не переведено ли поле. Тот же расчёт решает noindex
   * языковой версии на деплое — панель и сайт не расходятся.
   */
  async getOverview(pageId: string, locale: string): Promise<TranslationOverview> {
    const ctx = await this.context(pageId)
    const entries = await this.extractTranslatableContent(pageId, ctx)
    const rows = await this.effectiveRows(pageId, locale, ctx)
    const marks = marksOf(await this.effectiveRows(pageId, ALL_LOCALES, ctx))
    const missing = new Set(missingEntries(entries, rows, marks).map((e) => `${e.nodeId}\u0000${e.field}`))
    const byKey = new Map(rows.map((r) => [`${r.nodeId}\u0000${r.field}`, r]))

    const ownership = this.ownershipOf(ctx)
    const blockInfo = new Map<string, { blockName: string; pageCount: number }>()
    if (ownership.blockIds.length) {
      const blocks = await AppDataSource.getRepository(Block).find({ where: { id: In(ownership.blockIds) }, select: { id: true, name: true } })
      for (const b of blocks) blockInfo.set(b.id, { blockName: b.name, pageCount: (await this.pagesLinkingBlock(b.id)).length })
    }

    const out: TranslationOverviewEntry[] = entries.map((e) => {
      const key = `${e.nodeId}\u0000${e.field}`
      const row = byKey.get(key)
      const mark = markOf(marks, e.nodeId, e.field)
      const blockId = blockOwnerOf(ownership, e.nodeId)
      const info = blockId ? blockInfo.get(blockId) : undefined
      return {
        ...e,
        ...(row ? { translation: row.value, translationStatus: row.status } : {}),
        owner: blockId ? { kind: 'block', blockId, blockName: info?.blockName ?? 'Блок', pageCount: info?.pageCount ?? 0 } : { kind: 'page' },
        ...(mark ? { mark } : {}),
        same: isSameEffective(e.field, mark),
        sameByDefault: isSameByDefault(e.field),
        missing: missing.has(key),
      }
    })
    return { locale, total: out.length, missing: missing.size, entries: out }
  }

  /** Сколько полей страницы не переведено на язык (для noindex языковой версии). */
  async countMissing(pageId: string, locale: string): Promise<number> {
    const ctx = await this.context(pageId)
    const entries = await this.extractTranslatableContent(pageId, ctx)
    const rows = await this.effectiveRows(pageId, locale, ctx)
    const marks = marksOf(await this.effectiveRows(pageId, ALL_LOCALES, ctx))
    return missingEntries(entries, rows, marks).length
  }

  /**
   * Прогресс перевода страницы по всем активным языкам, кроме основного:
   * переведено = есть перевод или поле «одно для всех языков».
   */
  async getProgress(pageId: string): Promise<TranslationProgress[]> {
    const ctx = await this.context(pageId)
    const entries = await this.extractTranslatableContent(pageId, ctx)
    const total = entries.length
    const marks = marksOf(await this.effectiveRows(pageId, ALL_LOCALES, ctx))
    const languages = (await languageService.getActive()).filter((l) => !l.isDefault)
    const progress: TranslationProgress[] = []

    for (const { code: locale } of languages) {
      const rows = await this.effectiveRows(pageId, locale, ctx)
      const byStatus = { draft: 0, review: 0, approved: 0, published: 0 }
      for (const t of rows) {
        if (byStatus[t.status] !== undefined) byStatus[t.status]++
      }
      const translated = total - missingEntries(entries, rows, marks).length
      progress.push({
        locale,
        total,
        translated,
        percentage: total > 0 ? Math.round((translated / total) * 100) : 100,
        byStatus,
      })
    }

    return progress
  }

  /** Копирует переводы страницы между языками; строки уходят владельцам узлов. */
  async copyTranslations(pageId: string, fromLocale: string, toLocale: string): Promise<Array<Translation | BlockTranslation>> {
    const source = await this.effectiveRows(pageId, fromLocale)
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
