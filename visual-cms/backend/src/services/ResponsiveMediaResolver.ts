/**
 * Резолвер адаптивного медиа: разрешает матрицу «экран × язык» в план,
 * который потребляют HtmlGenerator (`<picture>` для `<img>`) и генератор
 * фоновых `@media` (background-image).
 *
 * Две ортогональные оси хранения:
 *  - ЯЗЫК   — таблица Translation (overlay), поля `src`/`bg:image` и их
 *             брейкпоинтные варианты `src@<bpId>`/`bg:image@<bpId>`;
 *  - ЭКРАН  — variations[bpId].inheritedOverrides[nodeId] (базовый язык):
 *             `.attributes.src` и `.styles.backgroundImage`.
 *
 * Приоритет при разрешении ячейки (язык L, экран B) — ЯЗЫК важнее ЭКРАНА:
 *   Translation(L, 'field@B')   // точная ячейка «язык L + экран B»
 *   ?? Translation(L, 'field')  // правильный язык (приоритет), любой экран
 *   ?? variation(B).field       // правильный экран, базовый язык
 *   ?? базовое значение узла     // финальный фолбэк
 *
 * ВАЖНО: на деплое резолвер получает УЖЕ локализованную структуру
 * (applyTranslations запёк языковую базу в node.attributes.src /
 * node.styles.backgroundImage), плюс translationMap этого языка. Поэтому
 * «языковая база» = текущее значение узла, а факт языкового переопределения
 * определяется наличием ключа в translationMap (это и включает подавление
 * экранного варианта — «язык побеждает экран»).
 *
 * Чистый модуль: без БД и окружения — всё для юнит-тестов.
 */
import type { BlockNode, BreakpointDef } from '../types/blockNode'
import { BG_IMAGE_FIELD } from './TranslationService'
import { composeBgStack } from './cssBackground'
import { breakpointRangeMap } from './breakpointRanges'

const SRC_FIELD = 'src'

/** Один брейкпоинтный источник медиа. */
export interface ResponsiveSource {
  bpId: string
  width: number
  /** Для img — URL (для srcset); для bg — готовая CSS-строка background-image. */
  value: string
  /** Условие @media диапазона breakpoint'а (границы — breakpointRanges). */
  media?: string
}

/** План адаптивного медиа для одного узла. */
export interface NodeMediaPlan {
  /**
   * Брейкпоинтные подмены src: для `<img>` — источники `<source>` в `<picture>`
   * (art-direction), для `<video>` — карта data-rmedia (свап JS-рантаймом:
   * media-атрибут у `<video><source>` браузеры игнорируют).
   */
  img?: ResponsiveSource[]
  /** Оверрайды background-image по брейкпоинтам (@media). */
  bg?: ResponsiveSource[]
}

export type MediaPlanMap = Map<string, NodeMediaPlan>

/** Плоская карта переводов: { [nodeId]: { [field]: value } }. */
export interface TranslationFieldMap {
  [nodeId: string]: { [field: string]: string }
}

/** Имя поля перевода с суффиксом брейкпоинта: `src@<bpId>`, `bg:image@<bpId>`. */
export function breakpointField(field: string, bpId: string): string {
  return `${field}@${bpId}`
}

// ── Индекс экранных оверрайдов (базовый язык) ──────────────────────────────
// variations.inheritedOverrides хранится на узле-владельце вариации, но ключи —
// id ЛЮБЫХ потомков. Поэтому строим глобальный индекс nodeId → bpId → { src, bg }.

interface BpOverride {
  /** Значение атрибута src (для <img>). */
  src?: string
  /** Сырое значение backgroundImage (CSS-строка, м.б. url() или градиент). */
  bg?: string
}

type OverrideIndex = Map<string, Map<string, BpOverride>>

function putOverride(index: OverrideIndex, nodeId: string, bpId: string, patch: BpOverride): void {
  let byBp = index.get(nodeId)
  if (!byBp) {
    byBp = new Map()
    index.set(nodeId, byBp)
  }
  const cur = byBp.get(bpId) || {}
  if (patch.src !== undefined) cur.src = patch.src
  if (patch.bg !== undefined) cur.bg = patch.bg
  byBp.set(bpId, cur)
}

function buildOverrideIndex(root: BlockNode): OverrideIndex {
  const index: OverrideIndex = new Map()

  const walk = (node: BlockNode): void => {
    if (node.variations) {
      for (const [bpId, variation] of Object.entries(node.variations)) {
        const io = variation.inheritedOverrides
        if (io) {
          for (const [descId, ov] of Object.entries(io)) {
            const src = ov.attributes?.src
            const bg = ov.styles?.backgroundImage
            if (src !== undefined || bg !== undefined) {
              putOverride(index, descId, bpId, { src, bg })
            }
          }
        }
        // specificChildren — отдельные узлы, у них тоже могут быть variations.
        for (const sc of variation.specificChildren || []) walk(sc)
      }
    }
    for (const child of node.children || []) walk(child)
  }

  walk(root)
  return index
}

/**
 * Разрешает один слот медиа для узла в список брейкпоинтных источников.
 *
 * @param base           локализованная база (текущее значение узла) — для img это
 *                       URL, для bg это финальная CSS-строка от `cellToCss`.
 * @param localeField    поле перевода без суффикса ('src' | 'bg:image').
 * @param localeOverridden была ли языковая база задана переводом (включает подавление экрана).
 * @param screenOf       (bpId) → экранный оверрайд базового языка (уже нормализованный).
 * @param cellToCss      преобразование значения ячейки перевода (`field@B`) в финальное значение.
 */
function resolveSlot(
  base: string | undefined,
  localeField: string,
  nodeFields: Record<string, string> | undefined,
  localeOverridden: boolean,
  breakpoints: BreakpointDef[],
  screenOf: (bpId: string) => string | undefined,
  cellToCss: (raw: string) => string,
  mediaOf?: (bpId: string) => string | undefined,
): ResponsiveSource[] {
  const sources: ResponsiveSource[] = []

  for (const bp of breakpoints) {
    if (typeof bp.width !== 'number') continue
    const cell = nodeFields?.[breakpointField(localeField, bp.id)]

    let value: string | undefined
    if (cell !== undefined && cell !== '') {
      value = cellToCss(cell)
    } else if (localeOverridden) {
      // Приоритет языка: языковая база задана, экранный вариант базового языка подавляется.
      value = undefined
    } else {
      const screen = screenOf(bp.id)
      value = screen !== undefined && screen !== '' ? screen : undefined
    }

    // Эмитим источник только если он реально отличается от локализованной базы.
    if (value !== undefined && value !== base) {
      sources.push({ bpId: bp.id, width: bp.width, value, media: mediaOf?.(bp.id) })
    }
  }

  return sources
}

/**
 * Строит план адаптивного медиа для всего дерева.
 *
 * @param root           локализованная структура (после applyTranslations).
 * @param translationMap плоская карта переводов активного языка (для дефолтного — {}).
 * @param breakpoints    брейкпоинты страницы (с width).
 */
export function resolveResponsiveMedia(
  root: BlockNode,
  translationMap: TranslationFieldMap,
  breakpoints: BreakpointDef[],
): MediaPlanMap {
  const plan: MediaPlanMap = new Map()
  if (!root || !breakpoints || breakpoints.length === 0) return plan

  const overrideIndex = buildOverrideIndex(root)
  const ranges = breakpointRangeMap(breakpoints)
  const mediaOf = (bpId: string) => ranges.get(bpId)?.media

  const walk = (node: BlockNode): void => {
    if (node && node.id) {
      const fields = translationMap[node.id]
      const byBp = overrideIndex.get(node.id)
      const nodePlan: NodeMediaPlan = {}

      // ── src-слот: <img> → <picture>, <video> → data-rmedia (JS-свап) ──
      const tag = (node.tagName || '').toLowerCase()
      if (tag === 'img' || tag === 'video') {
        const base = node.attributes?.src
        const localeOverridden = fields?.[SRC_FIELD] !== undefined
        const img = resolveSlot(
          base,
          SRC_FIELD,
          fields,
          localeOverridden,
          breakpoints,
          (bpId) => byBp?.get(bpId)?.src,
          (raw) => raw, // ячейка img — это просто URL
          mediaOf,
        )
        if (img.length > 0) nodePlan.img = img
      }

      // ── background-image → @media ──
      {
        const base = node.styles?.properties?.backgroundImage
        const localeOverridden = fields?.[BG_IMAGE_FIELD] !== undefined
        const bg = resolveSlot(
          base,
          BG_IMAGE_FIELD,
          fields,
          localeOverridden,
          breakpoints,
          (bpId) => byBp?.get(bpId)?.bg,
          // Перевод bg:image хранит голый URL → полный стек с градиентами базы
          // (фон в background shorthand у импорта: затемнение сохраняем).
          (raw) => composeBgStack(node.styles?.properties, raw),
          mediaOf,
        )
        if (bg.length > 0) nodePlan.bg = bg
      }

      if (nodePlan.img || nodePlan.bg) plan.set(node.id, nodePlan)
    }

    for (const child of node?.children || []) walk(child)
    if (node?.variations) {
      for (const variation of Object.values(node.variations)) {
        for (const sc of variation.specificChildren || []) walk(sc)
      }
    }
  }

  walk(root)
  return plan
}

/**
 * Генерирует фоновые `@media`-правила из плана. Порядок брейкпоинтов —
 * по убыванию ширины (как в StyleGenerator: меньший max-width идёт позже и
 * побеждает в каскаде). `!important` — чтобы перебить inline background узла.
 */
export function generateBackgroundMediaCss(
  plan: MediaPlanMap,
  breakpoints: BreakpointDef[],
): string {
  if (plan.size === 0) return ''

  // bpId → массив CSS-правил.
  const byBp = new Map<string, string[]>()
  for (const [nodeId, nodePlan] of plan) {
    for (const src of nodePlan.bg || []) {
      const list = byBp.get(src.bpId) || []
      list.push(
        `[data-element-id="${nodeId}"] { background-image: ${src.value} !important; }`,
      )
      byBp.set(src.bpId, list)
    }
  }
  if (byBp.size === 0) return ''

  // Границы диапазонов — как в StyleGenerator.generateResponsiveCSS.
  const ranges = computeSortedRanges(breakpoints)

  let css = '\n    /* Responsive media (background) */\n'
  for (const range of ranges) {
    const rules = byBp.get(range.id)
    if (!rules || rules.length === 0) continue
    css += `    @media ${range.media} {\n`
    css += rules.map((r) => `      ${r}`).join('\n')
    css += '\n    }\n'
  }
  return css
}

// Локальный шорткат: диапазоны в порядке эмиссии (по убыванию ширины).
function computeSortedRanges(breakpoints: BreakpointDef[]) {
  const map = breakpointRangeMap(breakpoints)
  return [...map.values()]
}

/**
 * Собирает `<picture>` для `<img>`, у которого есть art-direction источники.
 * `imgTag` — уже собранный тег `<img …/>` (с data-element-id и атрибутами).
 * Источники сортируются по возрастанию ширины: при данном вьюпорте срабатывает
 * первый подходящий `<source>` (наименьший max-width ≥ вьюпорта = самый точный экран),
 * а вьюпорт больше всех брейкпоинтов падает на базовый `<img>`.
 */
export function buildPictureTag(
  imgTag: string,
  sources: ResponsiveSource[],
  escapeAttr: (s: string) => string,
): string {
  const sorted = [...sources].sort((a, b) => a.width - b.width)
  const sourceTags = sorted
    .map((s) => `<source media="${s.media || `(max-width: ${s.width}px)`}" srcset="${escapeAttr(s.value)}" />`)
    .join('')
  return `<picture>${sourceTags}${imgTag}</picture>`
}
