/**
 * Границы применения breakpoints — ЗЕРКАЛО backend/src/services/breakpointRanges.ts.
 *
 * Breakpoint хранит дизайн-ширину канваса, а деплой применяет его стили в
 * диапазоне: самый широкий — `(min-width: <ширина>px)`, остальные —
 * `(max-width: <ширина следующего более широкого − 1>px)`. Редактору нужны те же
 * диапазоны, чтобы показать на канвасе ровно то, что увидит посетитель
 * (см. screenOverrides.ts). Менять только вместе с бэкенд-версией.
 */

export interface BreakpointLike {
  id: string
  width: number
}

export interface BreakpointRange {
  id: string
  /** Дизайн-ширина breakpoint'а (ширина канваса в редакторе). */
  width: number
  /** Верхняя граница применения (max-width), null = не ограничена сверху. */
  maxWidth: number | null
  /** Нижняя граница применения (min-width), null = не ограничена снизу. */
  minWidth: number | null
}

/**
 * Диапазоны применения, отсортированные по убыванию ширины — в этом порядке
 * деплой эмитит @media-блоки (меньший экран позже и побеждает в каскаде).
 */
export function computeBreakpointRanges(breakpoints: BreakpointLike[]): BreakpointRange[] {
  const valid = (breakpoints || []).filter(bp => bp && typeof bp.width === 'number')
  const sorted = [...valid].sort((a, b) => b.width - a.width)

  // Единственный breakpoint: границ между экранами нет — легаси max-width.
  if (sorted.length === 1) {
    const bp = sorted[0]
    return [{ id: bp.id, width: bp.width, maxWidth: bp.width, minWidth: null }]
  }

  return sorted.map((bp, i) => {
    if (i === 0) {
      return { id: bp.id, width: bp.width, maxWidth: null, minWidth: bp.width }
    }
    return { id: bp.id, width: bp.width, maxWidth: sorted[i - 1].width - 1, minWidth: null }
  })
}

/** Попадает ли экран шириной `width` в диапазон применения breakpoint'а. */
export function rangeMatchesWidth(range: BreakpointRange, width: number): boolean {
  if (range.minWidth !== null && width < range.minWidth) return false
  if (range.maxWidth !== null && width > range.maxWidth) return false
  return true
}

/**
 * Id breakpoints, чьи стили действуют на экране выбранного breakpoint'а, в
 * порядке каскада деплоя (последний побеждает). Например, для mobile при
 * наборе 1920/1440/768/375 это [desktop-hd, tablet, mobile]: правки Desktop HD
 * выходят как `(max-width: 1919px)` и доходят до телефона.
 *
 * Неизвестный breakpoint (нет в списке) → только он сам: каскад вычислить не
 * из чего.
 */
export function applicableBreakpointIds(
  breakpoints: BreakpointLike[] | undefined,
  breakpointId: string,
): string[] {
  const ranges = computeBreakpointRanges(breakpoints || [])
  const current = ranges.find(r => r.id === breakpointId)
  if (!current) return [breakpointId]
  return ranges.filter(r => rangeMatchesWidth(r, current.width)).map(r => r.id)
}
