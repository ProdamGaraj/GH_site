/**
 * CSS элемента одним текстом: основная версия + блок `@media` на каждый экран.
 *
 *     display: flex;
 *     gap: 8px;
 *
 *   /* Tablet (768px) *\/
 *   @media (max-width: 1439px) {
 *     display: grid;
 *   }
 *
 * Верхние объявления — стили основной версии узла. Блок экрана — его экранные
 * правки (variations[bp].inheritedOverrides[узел].styles), условие `@media` то
 * же, что эмитит деплой (breakpointRanges.ts). Текст — буквальная картина того,
 * что уйдёт на сайт: удалённая в блоке строка снимает правку (значение снова
 * берётся из основной версии), а чтобы убрать свойство на экране — пишут сброс
 * (`display: revert;`).
 *
 * Модуль чистый: чтение модели из дерева, текст ↔ модель, запись в дерево.
 */
import type { BlockNode } from '@/shared/types'
import { computeBreakpointRanges, type BreakpointLike, type BreakpointRange } from './breakpointRanges'
import { adoptStrayOverrides, findBaseParent, resolveOwnScreenOverride, type ScreenOverride } from './screenOverrides'

export type CssDeclarations = Record<string, string>

export interface NodeCssScreen {
  /** id breakpoint'а. */
  id: string
  /** Подпись в комментарии над блоком. */
  label: string
  /** Условие `@media` — как на деплое. */
  media: string
  styles: CssDeclarations
}

export interface NodeCssModel {
  base: CssDeclarations
  /** Экраны в порядке каскада деплоя (от широкого к узкому). Пусто, если узлу экранные правки недоступны. */
  screens: NodeCssScreen[]
}

export interface ParsedNodeCss {
  base: CssDeclarations
  /** Стили по id экрана — для КАЖДОГО экрана модели (нет блока в тексте → пусто). */
  screens: Record<string, CssDeclarations>
  errors: string[]
}

// ───────────────────────── дерево ─────────────────────────

const variationChildren = (node: BlockNode): BlockNode[] =>
  Object.values(node.variations || {}).flatMap(v => v.specificChildren || [])

/** Узел базового дерева по id (включая specificChildren — у них тоже есть основные стили). */
function findRawNode(node: BlockNode, nodeId: string): BlockNode | null {
  if (node.id === nodeId) return node
  for (const child of [...(node.children || []), ...variationChildren(node)]) {
    const found = findRawNode(child, nodeId)
    if (found) return found
  }
  return null
}

/** Заменяет узел с данным id результатом `update` (children и specificChildren). */
function mapNode(node: BlockNode, nodeId: string, update: (n: BlockNode) => BlockNode): BlockNode {
  if (node.id === nodeId) return update(node)

  let next = node
  const children = node.children || []
  const nextChildren = children.map(child => mapNode(child, nodeId, update))
  if (nextChildren.some((c, i) => c !== children[i])) next = { ...next, children: nextChildren }

  for (const [bpId, variation] of Object.entries(node.variations || {})) {
    const specific = variation.specificChildren
    if (!specific) continue
    const nextSpecific = specific.map(child => mapNode(child, nodeId, update))
    if (nextSpecific.some((c, i) => c !== specific[i])) {
      next = {
        ...next,
        variations: { ...(next.variations || {}), [bpId]: { ...variation, specificChildren: nextSpecific } },
      }
    }
  }
  return next
}

const rangeMedia = (range: BreakpointRange): string =>
  range.minWidth !== null ? `(min-width: ${range.minWidth}px)` : `(max-width: ${range.maxWidth}px)`

const toDeclarations = (styles: Record<string, unknown> | undefined): CssDeclarations => {
  const out: CssDeclarations = {}
  for (const [key, value] of Object.entries(styles || {})) {
    if (value === undefined || value === null || value === '') continue
    out[key] = String(value)
  }
  return out
}

/**
 * CSS узла из дерева. Экраны есть только у узла с родителем в базовом дереве:
 * у корня и у элементов, добавленных для одного экрана, экранных правок нет.
 */
export function readNodeCss(
  root: BlockNode,
  nodeId: string,
  breakpoints: Array<BreakpointLike & { name?: string }>,
): NodeCssModel {
  const node = findRawNode(root, nodeId)
  const base = toDeclarations(node?.styles?.properties as Record<string, unknown> | undefined)
  if (!node || !findBaseParent(root, nodeId)) return { base, screens: [] }

  const names = new Map((breakpoints || []).map(bp => [bp.id, bp.name || bp.id]))
  const screens = computeBreakpointRanges(breakpoints || []).map((range): NodeCssScreen => {
    const own = resolveOwnScreenOverride(root, nodeId, range.id)
    const styles = toDeclarations(own?.styles as Record<string, unknown> | undefined)
    // Узел, скрытый на экране, на сайте получает display: none.
    if (own?.hidden) styles.display = 'none'
    return {
      id: range.id,
      label: `${names.get(range.id)} (${range.width}px)`,
      media: rangeMedia(range),
      styles,
    }
  })
  return { base, screens }
}

// ───────────────────────── модель → текст ─────────────────────────

/** camelCase → kebab-case; пользовательские свойства (`--x`) не трогаем. */
export const cssPropertyName = (key: string): string =>
  key.startsWith('--') ? key : key.replace(/([A-Z])/g, '-$1').toLowerCase()

/** kebab-case → camelCase (`-webkit-x` → `WebkitX`); `--x` не трогаем. */
export const stylePropertyKey = (name: string): string =>
  name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_m, ch: string) => ch.toUpperCase())

const formatDeclarations = (styles: CssDeclarations): string =>
  Object.entries(styles).map(([key, value]) => `  ${cssPropertyName(key)}: ${value};`).join('\n')

export function formatNodeCss(model: NodeCssModel): string {
  const parts: string[] = []
  const base = formatDeclarations(model.base)
  if (base) parts.push(base)
  for (const screen of model.screens) {
    const body = formatDeclarations(screen.styles)
    parts.push(`/* ${screen.label} */\n@media ${screen.media} {\n${body ? `${body}\n` : ''}}`)
  }
  return parts.join('\n\n')
}

// ───────────────────────── текст → модель ─────────────────────────

const normalizeMedia = (condition: string): string => condition.replace(/\s+/g, '').toLowerCase()

/**
 * Делит текст на объявления: разделитель — `;` или перевод строки вне скобок и
 * кавычек (чтобы `url("data:…;base64,…")` и многострочные значения не рвались).
 */
function splitDeclarations(text: string): string[] {
  const chunks: string[] = []
  let current = ''
  let depth = 0
  let quote: string | null = null
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null
      current += ch
      continue
    }
    if (ch === '"' || ch === "'") quote = ch
    else if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if ((ch === ';' || ch === '\n') && depth === 0) {
      chunks.push(current)
      current = ''
      continue
    }
    current += ch
  }
  chunks.push(current)
  return chunks.map(c => c.trim()).filter(Boolean)
}

function parseDeclarations(text: string, where: string, errors: string[]): CssDeclarations {
  const styles: CssDeclarations = {}
  for (const chunk of splitDeclarations(text)) {
    const colon = chunk.indexOf(':')
    const name = colon > 0 ? chunk.slice(0, colon).trim() : ''
    const value = colon > 0 ? chunk.slice(colon + 1).trim() : ''
    if (!name || !/^-{0,2}[a-zA-Z_][\w-]*$/.test(name)) {
      errors.push(`${where}: не удалось разобрать «${chunk.length > 60 ? `${chunk.slice(0, 60)}…` : chunk}»`)
      continue
    }
    // Свойство без значения — как удалённая строка.
    if (!value) continue
    styles[stylePropertyKey(name)] = value
  }
  return styles
}

/**
 * Разбирает текст редактора. Блок `@media` должен совпадать с условием одного
 * из экранов; чужое условие — ошибка (такой блок некуда сохранить; для
 * произвольных @media есть «Общий CSS»). При ошибках применять результат нельзя.
 */
export function parseNodeCss(text: string, screens: NodeCssScreen[]): ParsedNodeCss {
  const errors: string[] = []
  const source = (text || '').replace(/\/\*[\s\S]*?\*\//g, '')
  const byMedia = new Map(screens.map(screen => [normalizeMedia(screen.media), screen]))
  const screenStyles: Record<string, CssDeclarations> = Object.fromEntries(screens.map(s => [s.id, {}]))

  let baseText = ''
  let i = 0
  while (i < source.length) {
    const offset = source.slice(i).search(/@media/i)
    const at = offset === -1 ? -1 : i + offset
    if (at === -1) {
      baseText += source.slice(i)
      break
    }
    baseText += `${source.slice(i, at)}\n`

    const open = source.indexOf('{', at)
    if (open === -1) {
      errors.push('У блока @media нет открывающей скобки «{»')
      break
    }
    let depth = 1
    let close = open + 1
    for (; close < source.length && depth > 0; close++) {
      if (source[close] === '{') depth++
      else if (source[close] === '}') depth--
    }
    if (depth !== 0) {
      errors.push('У блока @media нет закрывающей скобки «}»')
      break
    }

    const condition = source.slice(at + '@media'.length, open).trim()
    const body = source.slice(open + 1, close - 1)
    const screen = byMedia.get(normalizeMedia(condition))
    if (!screen) {
      const known = screens.map(s => s.media).join(', ')
      errors.push(
        `Нет экрана с условием @media ${condition}. ` +
        (known ? `Доступные экраны: ${known}.` : 'У этого элемента нет экранных стилей.'),
      )
    } else if (body.includes('{')) {
      errors.push(`${screen.label}: внутри блока экрана допустимы только свойства`)
    } else {
      Object.assign(screenStyles[screen.id], parseDeclarations(body, screen.label, errors))
    }
    i = close
  }

  if (/[{}]/.test(baseText)) {
    errors.push('Основная версия: допустимы только свойства и блоки @media экранов (селекторы — в «Общий CSS»)')
  }
  const base = /[{}]/.test(baseText) ? {} : parseDeclarations(baseText, 'Основная версия', errors)

  return { base, screens: screenStyles, errors }
}

// ───────────────────────── запись в дерево ─────────────────────────

const sameDeclarations = (a: CssDeclarations, b: CssDeclarations): boolean => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key])
}

const isEmptyOverride = (override: ScreenOverride): boolean =>
  !override.hidden &&
  !(override.styles && Object.keys(override.styles).length > 0) &&
  !(override.attributes && Object.keys(override.attributes).length > 0) &&
  override.content === undefined

/**
 * Заменяет стили экранной правки узла целиком. Перед записью собирает «чужие»
 * записи узла к родителю (иначе более поздняя перебила бы новые стили).
 * Атрибуты/контент правки не трогает; опустевшая правка удаляется.
 * Скрытие узла (hidden) в тексте выглядит как `display: none`: пока строка на
 * месте — узел остаётся скрытым, убрали или изменили — скрытие снимается.
 */
function setNodeScreenStyles(root: BlockNode, nodeId: string, breakpointId: string, styles: CssDeclarations): BlockNode {
  const adopted = adoptStrayOverrides(root, nodeId, breakpointId)
  const owner = findBaseParent(adopted, nodeId)
  if (!owner) return adopted

  const existing = owner.variations?.[breakpointId]?.inheritedOverrides?.[nodeId]
  const next: ScreenOverride = { ...(existing || {}) }
  const nextStyles = { ...styles }
  if (existing?.hidden && nextStyles.display === 'none') delete nextStyles.display
  else delete next.hidden

  if (Object.keys(nextStyles).length > 0) next.styles = nextStyles as ScreenOverride['styles']
  else delete next.styles

  const unchanged =
    Boolean(existing?.hidden) === Boolean(next.hidden) &&
    sameDeclarations(toDeclarations(existing?.styles as Record<string, unknown> | undefined), nextStyles)
  if (unchanged) return adopted

  return mapNode(adopted, owner.id, current => {
    const variation = current.variations?.[breakpointId] || {}
    const overrides = { ...(variation.inheritedOverrides || {}) }
    if (isEmptyOverride(next)) delete overrides[nodeId]
    else overrides[nodeId] = next
    return {
      ...current,
      variations: { ...(current.variations || {}), [breakpointId]: { ...variation, inheritedOverrides: overrides } },
    }
  })
}

/**
 * Записывает разобранный CSS в дерево: стили основной версии заменяются целиком,
 * стили каждого экрана — целиком. Неизменённые части дерева сохраняют ссылки;
 * если не изменилось ничего — возвращается тот же корень.
 */
export function applyNodeCss(
  root: BlockNode,
  nodeId: string,
  css: { base: CssDeclarations; screens: Record<string, CssDeclarations> },
): BlockNode {
  const node = findRawNode(root, nodeId)
  if (!node) return root

  let next = root
  if (!sameDeclarations(toDeclarations(node.styles?.properties as Record<string, unknown> | undefined), css.base)) {
    next = mapNode(next, nodeId, current => ({
      ...current,
      styles: { ...current.styles, properties: { ...css.base } as BlockNode['styles']['properties'] },
    }))
  }
  for (const [breakpointId, styles] of Object.entries(css.screens || {})) {
    next = setNodeScreenStyles(next, nodeId, breakpointId, styles)
  }
  return next
}
