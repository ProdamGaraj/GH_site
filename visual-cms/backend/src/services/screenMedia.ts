/**
 * Медиа элементов повтора по экранам — при публикации коллекций.
 *
 * Элемент массива, который шаблон повторяет через `_repeat` (слайд галереи
 * ЖК, слайд новости), может нести значения полей по экранам — тот же формат,
 * что у слайдов CMS: `item._responsive[поле][id экрана] = значение`
 * (id экрана = id брейкпоинта страницы-шаблона). Пустая строка — явно «нет»
 * (например, на телефоне фото вместо видео).
 *
 * Как это попадает на страницу. Копия шаблона подставляется для каждого
 * экрана отдельно и сравнивается с обычной копией узел в узел:
 *  - разошлись стили (фон, `--image`, позиция кадра) — узлу ставится
 *    `data-screen-key`, а в CSS страницы — правила для этого экрана с
 *    !important (базовые стили узла встроенные). Браузер грузит только
 *    картинку своего экрана, без подмены скриптом;
 *  - разошлись атрибуты (`data-slide-video` — видео слайда) — узел получает
 *    карту `data-screen-attrs` {атрибут: {экран: значение}}; значение под
 *    экран ставит рантайм карусели до создания видео и при смене экрана.
 *
 * Экраны каскадом, как у рантаймов (breakpointRuntime): экран без своего
 * значения берёт значение экрана шире, самый широкий — для всех экранов уже,
 * чем он, если у них нет своего. Правила идут от широкого к узкому, условие —
 * верхняя граница экрана из breakpointRanges; у самого широкого границы нет.
 *
 * Чистый модуль: без БД.
 */
import type { BreakpointDef } from '../types/blockNode'
import { computeBreakpointRanges } from './breakpointRanges'

export const SCREEN_KEY_ATTR = 'data-screen-key'
export const SCREEN_ATTRS_ATTR = 'data-screen-attrs'

type ResponsiveFields = Record<string, Record<string, unknown>>

function responsiveOf(item: unknown): ResponsiveFields | null {
  if (!item || typeof item !== 'object') return null
  const rm = (item as { _responsive?: unknown })._responsive
  return rm && typeof rm === 'object' && !Array.isArray(rm) ? (rm as ResponsiveFields) : null
}

/** id экранов, для которых у элемента есть хоть одно значение. */
export function screenIdsOf(item: unknown): string[] {
  const rm = responsiveOf(item)
  if (!rm) return []
  const ids = new Set<string>()
  for (const byScreen of Object.values(rm)) {
    if (!byScreen || typeof byScreen !== 'object') continue
    for (const [id, value] of Object.entries(byScreen)) if (typeof value === 'string') ids.add(id)
  }
  return [...ids]
}

/** Элемент, каким он выглядит на экране: поля с значением этого экрана подменены. */
export function itemForScreen(item: unknown, screenId: string): unknown {
  const rm = responsiveOf(item)
  if (!rm) return item
  const out: Record<string, unknown> = { ...(item as Record<string, unknown>) }
  for (const [field, byScreen] of Object.entries(rm)) {
    const value = byScreen && typeof byScreen === 'object' ? byScreen[screenId] : undefined
    if (typeof value === 'string') out[field] = value
  }
  return out
}

/** camelCase → kebab-case; CSS-переменные (`--image`) — как есть. */
function cssProperty(name: string): string {
  if (name.startsWith('--')) return name
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/**
 * Значение, которое можно вставить в CSS: без символов, которые закрыли бы
 * правило или тег. Ссылки на медиа и позиции кадра их не содержат.
 */
function safeCssValue(value: string): boolean {
  return !/[<>{};]/.test(value)
}

interface Node {
  attributes?: Record<string, unknown>
  styles?: { properties?: Record<string, unknown> }
  children?: Node[]
}

/** Сборщик правил страницы: ключи узлов и правила по экранам. */
export class ScreenMediaCollector {
  private next = 1
  /** id экрана → правила `[data-screen-key="sN"] { … }`. */
  private rules = new Map<string, string[]>()

  get size(): number {
    let n = 0
    for (const list of this.rules.values()) n += list.length
    return n
  }

  /** Ключ узла для правил; узел получает атрибут один раз. */
  keyOf(node: Node): string {
    node.attributes = node.attributes ?? {}
    const existing = node.attributes[SCREEN_KEY_ATTR]
    if (typeof existing === 'string' && existing) return existing
    const key = `s${this.next++}`
    node.attributes[SCREEN_KEY_ATTR] = key
    return key
  }

  addRule(screenId: string, key: string, declarations: Record<string, string>): void {
    const body = Object.entries(declarations)
      .filter(([, value]) => safeCssValue(value))
      .map(([prop, value]) => `${cssProperty(prop)}: ${value} !important;`)
      .join(' ')
    if (!body) return
    const list = this.rules.get(screenId) ?? []
    list.push(`[${SCREEN_KEY_ATTR}="${key}"] { ${body} }`)
    this.rules.set(screenId, list)
  }

  /**
   * CSS по экранам страницы: от широкого к узкому, условие — верхняя граница
   * экрана; экраны, которых у страницы нет, пропускаются.
   */
  css(breakpoints: BreakpointDef[] | undefined): string {
    if (this.rules.size === 0 || !breakpoints?.length) return ''
    const blocks: string[] = []
    for (const range of computeBreakpointRanges(breakpoints)) {
      const rules = this.rules.get(range.id)
      if (!rules?.length) continue
      const body = rules.map((r) => `  ${r}`).join('\n')
      blocks.push(range.maxWidth === null ? body.replace(/^ {2}/gm, '') : `@media (max-width: ${range.maxWidth}px) {\n${body}\n}`)
    }
    if (blocks.length === 0) return ''
    return `/* ==== медиа по экранам (публикация коллекции) ==== */\n${blocks.join('\n')}\n`
  }
}

function stringProps(record: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(record ?? {})) if (typeof value === 'string') out[key] = value
  return out
}

/**
 * Сравнивает копию шаблона для экрана с обычной копией (одинаковое дерево)
 * и записывает разницу: стили — правилом сборщика, атрибуты — картой
 * `data-screen-attrs` на узле обычной копии.
 */
export function applyScreenVariant(base: Node, variant: Node, screenId: string, collector: ScreenMediaCollector): void {
  const baseStyles = stringProps(base.styles?.properties)
  const changedStyles: Record<string, string> = {}
  for (const [prop, value] of Object.entries(stringProps(variant.styles?.properties))) {
    if (baseStyles[prop] !== value) changedStyles[prop] = value
  }
  if (Object.keys(changedStyles).length > 0) collector.addRule(screenId, collector.keyOf(base), changedStyles)

  const baseAttrs = stringProps(base.attributes)
  const changedAttrs: Record<string, string> = {}
  for (const [attr, value] of Object.entries(stringProps(variant.attributes))) {
    if (attr === SCREEN_KEY_ATTR || attr === SCREEN_ATTRS_ATTR) continue
    if (baseAttrs[attr] !== value) changedAttrs[attr] = value
  }
  if (Object.keys(changedAttrs).length > 0) {
    base.attributes = base.attributes ?? {}
    let map: Record<string, Record<string, string>> = {}
    try {
      map = JSON.parse(String(base.attributes[SCREEN_ATTRS_ATTR] ?? '{}'))
    } catch {
      map = {}
    }
    for (const [attr, value] of Object.entries(changedAttrs)) map[attr] = { ...(map[attr] ?? {}), [screenId]: value }
    base.attributes[SCREEN_ATTRS_ATTR] = JSON.stringify(map)
  }

  const baseChildren = base.children ?? []
  const variantChildren = variant.children ?? []
  // Дерево одно и то же: экран меняет значения медиа, а не состав. Разошлось
  // число детей (вложенный повтор по другому списку) — дальше не сравниваем.
  if (baseChildren.length !== variantChildren.length) return
  for (let i = 0; i < baseChildren.length; i++) applyScreenVariant(baseChildren[i], variantChildren[i], screenId, collector)
}

/** Экран страницы-шаблона для админок сервисов (поля медиа по экранам). */
export interface TemplateScreen {
  id: string
  name: string
  width: number
}

/**
 * Экраны страниц-шаблонов (metadata.breakpoints) одним списком: по id без
 * повторов (первое описание главнее), от широкого к узкому. Мусор отбрасывается.
 */
export function templateScreens(lists: unknown[]): TemplateScreen[] {
  const byId = new Map<string, TemplateScreen>()
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue
      const bp = raw as Record<string, unknown>
      if (typeof bp.id !== 'string' || !bp.id || typeof bp.width !== 'number' || !Number.isFinite(bp.width)) continue
      if (byId.has(bp.id)) continue
      byId.set(bp.id, { id: bp.id, name: typeof bp.name === 'string' && bp.name ? bp.name : bp.id, width: bp.width })
    }
  }
  return [...byId.values()].sort((a, b) => b.width - a.width)
}
