// Slot-proximity drop-target algorithm.
//
// Pure geometry: a "slot" is an insertion position between two siblings (or at
// container edges), described by a line in screen coordinates. The best slot
// is the one whose line is closest to the cursor — this makes touching
// siblings work naturally (the slot sits exactly on their shared boundary)
// and is zoom-agnostic (all distances are in the same coord system).

export type LineOrientation = 'horizontal' | 'vertical'

export interface Point {
  x: number
  y: number
}

export interface Line {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface ChildRect {
  id: string
  rect: DOMRect
}

export interface Slot {
  containerId: string
  position: number
  orientation: LineOrientation
  line: Line
}

export interface RankedSlot {
  slot: Slot
  distance: number
  depth: number
}

export function distanceToSlot(p: Point, slot: Slot): number {
  const { x1, y1, x2, y2 } = slot.line
  if (slot.orientation === 'vertical') {
    const yMin = Math.min(y1, y2)
    const yMax = Math.max(y1, y2)
    const dx = p.x - x1
    if (p.y >= yMin && p.y <= yMax) return Math.abs(dx)
    const dy = p.y < yMin ? yMin - p.y : p.y - yMax
    return Math.hypot(dx, dy)
  }
  const xMin = Math.min(x1, x2)
  const xMax = Math.max(x1, x2)
  const dy = p.y - y1
  if (p.x >= xMin && p.x <= xMax) return Math.abs(dy)
  const dx = p.x < xMin ? xMin - p.x : p.x - xMax
  return Math.hypot(dx, dy)
}

export function buildSlots(
  containerId: string,
  containerRect: DOMRect,
  children: ChildRect[],
  orientation: LineOrientation
): Slot[] {
  if (children.length === 0) {
    return [emptySlot(containerId, containerRect, orientation)]
  }

  const isVert = orientation === 'vertical'

  // Sort children along the flow axis.
  // vertical lines → children flow horizontally → sort by left
  // horizontal lines → children flow vertically → sort by top
  const sorted = [...children].sort((a, b) =>
    isVert ? a.rect.left - b.rect.left : a.rect.top - b.rect.top
  )

  const slots: Slot[] = []

  slots.push({
    containerId,
    position: 0,
    orientation,
    line: edgeLine(sorted[0].rect, isVert ? 'left' : 'top'),
  })

  for (let i = 0; i < sorted.length - 1; i++) {
    slots.push({
      containerId,
      position: i + 1,
      orientation,
      line: betweenLine(sorted[i].rect, sorted[i + 1].rect, isVert),
    })
  }

  slots.push({
    containerId,
    position: sorted.length,
    orientation,
    line: edgeLine(sorted[sorted.length - 1].rect, isVert ? 'right' : 'bottom'),
  })

  return slots
}

function emptySlot(
  containerId: string,
  rect: DOMRect,
  orientation: LineOrientation
): Slot {
  const pad = 4
  if (orientation === 'vertical') {
    const cx = rect.left + rect.width / 2
    return {
      containerId,
      position: 0,
      orientation,
      line: { x1: cx, y1: rect.top + pad, x2: cx, y2: rect.bottom - pad },
    }
  }
  const cy = rect.top + rect.height / 2
  return {
    containerId,
    position: 0,
    orientation,
    line: { x1: rect.left + pad, y1: cy, x2: rect.right - pad, y2: cy },
  }
}

function edgeLine(rect: DOMRect, side: 'left' | 'right' | 'top' | 'bottom'): Line {
  switch (side) {
    case 'left':
      return { x1: rect.left, y1: rect.top, x2: rect.left, y2: rect.bottom }
    case 'right':
      return { x1: rect.right, y1: rect.top, x2: rect.right, y2: rect.bottom }
    case 'top':
      return { x1: rect.left, y1: rect.top, x2: rect.right, y2: rect.top }
    case 'bottom':
      return { x1: rect.left, y1: rect.bottom, x2: rect.right, y2: rect.bottom }
  }
}

function betweenLine(a: DOMRect, b: DOMRect, vertical: boolean): Line {
  if (vertical) {
    const x = (a.right + b.left) / 2
    const yTop = Math.min(a.top, b.top)
    const yBot = Math.max(a.bottom, b.bottom)
    return { x1: x, y1: yTop, x2: x, y2: yBot }
  }
  const y = (a.bottom + b.top) / 2
  const xLeft = Math.min(a.left, b.left)
  const xRight = Math.max(a.right, b.right)
  return { x1: xLeft, y1: y, x2: xRight, y2: y }
}

export function pickBestSlot(ranked: RankedSlot[]): RankedSlot | null {
  if (ranked.length === 0) return null
  let best = ranked[0]
  for (let i = 1; i < ranked.length; i++) {
    const r = ranked[i]
    // Min distance wins. Ties are mostly boundary cases — e.g. the gap between
    // two sections is simultaneously root.between-S1-S2, S1.after-last and
    // S2.before-first, all at distance 0. Prefer the SHALLOWER container there:
    // the cursor is "between" siblings, not inside one of them. Cursor strictly
    // inside a deep container hits its slots at a smaller distance than the
    // parent's slots anyway, so depth tiebreak only fires at literal boundaries.
    if (r.distance < best.distance ||
        (r.distance === best.distance && r.depth < best.depth)) {
      best = r
    }
  }
  return best
}
