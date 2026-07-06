/**
 * Единый расчёт границ @media для breakpoints.
 *
 * Проблема, которую решает модуль: breakpoint хранит ДИЗАЙН-ширину канваса
 * (mobile = 375), а не границу применения стилей. Старый генератор эмитил
 * `@media (max-width: 375px)` — реальные телефоны (390–430px) в диапазон не
 * попадали и получали tablet-стили. Правильная граница breakpoint'а — до
 * следующего (более широкого) breakpoint'а: mobile действует до tablet−1px.
 *
 * Семантика (как в Webflow):
 *  - самый широкий breakpoint → `(min-width: <его ширина>px)`;
 *  - остальные → `(max-width: <ширина следующего более широкого − 1>px)`;
 *  - единственный breakpoint → `(max-width: <ширина>px)` (легаси-поведение,
 *    менять нечего — границ между breakpoint'ами нет).
 *
 * Потребители: StyleGenerator (responsive CSS из variations),
 * ResponsiveMediaResolver (<picture> и фоновые @media),
 * ResponsiveMediaRuntime (свап медиа динамических слайдов, через boundary
 * в window.__ghBreakpoints).
 */
import type { BreakpointDef } from '../types/blockNode'

export interface BreakpointRange {
  id: string
  /** Дизайн-ширина breakpoint'а (ширина канваса в редакторе). */
  width: number
  /** Верхняя граница применения (max-width), null = не ограничена сверху. */
  maxWidth: number | null
  /** Нижняя граница применения (min-width), null = не ограничена снизу. */
  minWidth: number | null
  /** Готовое условие для @media / <source media>. */
  media: string
}

/**
 * Считает диапазоны применения для набора breakpoints.
 * Возвращает список, отсортированный по убыванию ширины — в этом порядке
 * следует эмитить @media-блоки (меньший экран позже и побеждает в каскаде).
 */
export function computeBreakpointRanges(breakpoints: BreakpointDef[]): BreakpointRange[] {
  const valid = (breakpoints || []).filter(bp => bp && typeof bp.width === 'number')
  const sorted = [...valid].sort((a, b) => b.width - a.width)

  // Единственный breakpoint: границы вычислить не из чего — легаси max-width.
  if (sorted.length === 1) {
    const bp = sorted[0]
    return [{
      id: bp.id,
      width: bp.width,
      maxWidth: bp.width,
      minWidth: null,
      media: `(max-width: ${bp.width}px)`,
    }]
  }

  return sorted.map((bp, i) => {
    if (i === 0) {
      // Самый широкий: действует от своей ширины и выше.
      return {
        id: bp.id,
        width: bp.width,
        maxWidth: null,
        minWidth: bp.width,
        media: `(min-width: ${bp.width}px)`,
      }
    }
    const nextWider = sorted[i - 1]
    const maxWidth = nextWider.width - 1
    return {
      id: bp.id,
      width: bp.width,
      maxWidth,
      minWidth: null,
      media: `(max-width: ${maxWidth}px)`,
    }
  })
}

/** Диапазоны в виде карты bpId → range. */
export function breakpointRangeMap(breakpoints: BreakpointDef[]): Map<string, BreakpointRange> {
  const map = new Map<string, BreakpointRange>()
  for (const range of computeBreakpointRanges(breakpoints)) {
    map.set(range.id, range)
  }
  return map
}
