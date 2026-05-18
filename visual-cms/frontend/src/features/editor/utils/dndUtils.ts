import type { BlockNode, LayoutMode } from '@/shared/types'
import {
  buildSlots,
  distanceToSlot,
  pickBestSlot,
  type ChildRect,
  type Line,
  type LineOrientation,
  type RankedSlot,
  type Slot,
} from './slotProximity'

export interface DropIndicator {
  type: 'before' | 'after' | 'inside' | 'absolute-position'
  targetId: string
  targetParentId: string
  position?: number
  absoluteCoords?: { x: number; y: number }
  rect?: DOMRect
  // Line of the chosen slot in screen coords; rendered by DropIndicatorOverlay.
  // Absent for absolute-position indicators.
  slotLine?: Line
}

export interface DraggedElement {
  id: string
  node: BlockNode
  sourceParentId: string | null
  sourceIndex: number
}

// Must stay in sync with CanvasRenderer.tsx's `isContainer` check — the source
// of truth for what `useDroppable` is enabled on. Diverging here causes the
// algorithm to propose drop targets that dnd-kit refuses, producing visible
// indicators with no actual drop.
const CONTAINER_TAGS = new Set([
  'div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside',
])

// Containers whose rect is within this many screen-pixels from the cursor are
// considered candidates. Zoom-agnostic because the algorithm compares
// distance-to-slot vs distance-to-slot in the same coord system — this buffer
// only widens the candidate set, it doesn't bias which slot wins.
const CANDIDATE_BUFFER_PX = 24

export const getLayoutMode = (node: BlockNode): LayoutMode => {
  if (node.layoutMode) return node.layoutMode
  const props = node.styles?.properties || {}
  if (
    (props.position === 'relative' || props.position === 'absolute') &&
    props.display !== 'flex' &&
    props.display !== 'grid'
  ) {
    return 'absolute'
  }
  if (props.display === 'grid') return 'grid'
  return 'flex'
}

export const isFlowLayout = (node: BlockNode): boolean => {
  const mode = getLayoutMode(node)
  return mode === 'flex' || mode === 'grid'
}

export const isAbsoluteLayout = (node: BlockNode): boolean =>
  getLayoutMode(node) === 'absolute'

export const findNearestDroppableAncestor = (
  root: BlockNode,
  nodeId: string,
  layoutFilter?: LayoutMode[]
): BlockNode | null => {
  const path: BlockNode[] = []

  const findPath = (current: BlockNode, targetId: string): boolean => {
    path.push(current)
    if (current.id === targetId) return true
    for (const child of current.children) {
      if (findPath(child, targetId)) return true
    }
    path.pop()
    return false
  }

  findPath(root, nodeId)

  for (let i = path.length - 2; i >= 0; i--) {
    const ancestor = path[i]
    if (ancestor.elementType === 'container') {
      if (!layoutFilter || layoutFilter.includes(getLayoutMode(ancestor))) {
        return ancestor
      }
    }
  }
  return null
}

export const calculateAbsoluteDropPosition = (
  containerRect: DOMRect,
  mousePosition: { x: number; y: number },
  dragOffset?: { x: number; y: number }
): { x: number; y: number } => {
  const offset = dragOffset || { x: 0, y: 0 }
  return {
    x: Math.max(0, mousePosition.x - containerRect.left - offset.x),
    y: Math.max(0, mousePosition.y - containerRect.top - offset.y),
  }
}

// Legacy midpoint-based position calculation, kept for any external caller.
// New drop-target algorithm uses slot proximity instead.
export const calculateFlowDropPosition = (
  _containerRect: DOMRect,
  childRects: { id: string; rect: DOMRect }[],
  mousePosition: { x: number; y: number },
  flexDirection: string = 'row'
): { position: number; indicator: 'before' | 'after' } => {
  const isVertical = flexDirection === 'column' || flexDirection === 'column-reverse'
  if (childRects.length === 0) return { position: 0, indicator: 'before' }
  for (let i = 0; i < childRects.length; i++) {
    const { rect } = childRects[i]
    const mid = isVertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2
    const pos = isVertical ? mousePosition.y : mousePosition.x
    if (pos < mid) return { position: i, indicator: 'before' }
  }
  return { position: childRects.length, indicator: 'after' }
}

const isContainerNode = (node: BlockNode): boolean => {
  // html-code renders raw user HTML; its `children` are decorative and not
  // owned by the editor's children array — drops into it would mutate state
  // that isn't visible. Mirrors CanvasRenderer's same exclusion.
  if (node.elementType === 'html-code') return false
  return node.elementType === 'container' || CONTAINER_TAGS.has(node.tagName)
}

const isPointInRect = (p: { x: number; y: number }, r: DOMRect): boolean =>
  p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom

const isPointInExpandedRect = (p: { x: number; y: number }, r: DOMRect, buf: number): boolean =>
  p.x >= r.left - buf && p.x <= r.right + buf &&
  p.y >= r.top - buf && p.y <= r.bottom + buf

const isDescendantOrSelf = (ancestor: BlockNode, id: string): boolean => {
  if (ancestor.id === id) return true
  for (const c of ancestor.children) {
    if (isDescendantOrSelf(c, id)) return true
  }
  return false
}

const findNodeInTree = (root: BlockNode, id: string): BlockNode | null => {
  if (root.id === id) return root
  for (const c of root.children) {
    const f = findNodeInTree(c, id)
    if (f) return f
  }
  return null
}

const getSlotOrientation = (node: BlockNode): LineOrientation => {
  const dir = node.styles?.properties?.flexDirection || 'row'
  return dir === 'column' || dir === 'column-reverse' ? 'horizontal' : 'vertical'
}

interface Candidate {
  node: BlockNode
  rect: DOMRect
  depth: number
}

const findCandidateContainers = (
  root: BlockNode,
  cursor: { x: number; y: number },
  draggedNodeId: string,
  elementRects: Map<string, DOMRect>
): Candidate[] => {
  const draggedNode = draggedNodeId ? findNodeInTree(root, draggedNodeId) : null
  const candidates: Candidate[] = []

  const visit = (node: BlockNode, depth: number): void => {
    // Can't drop into self or own subtree.
    if (draggedNode && isDescendantOrSelf(draggedNode, node.id)) return

    // Locked nodes can't accept drops (mirrors useDroppable({disabled: isLocked})
    // in CanvasRenderer). Skipping the whole subtree matches the renderer too —
    // locked blocks lock all their descendants, so none of them are valid targets.
    if (node.metadata?.locked) return

    if (isContainerNode(node)) {
      const rect = elementRects.get(node.id)
      if (rect && isPointInExpandedRect(cursor, rect, CANDIDATE_BUFFER_PX)) {
        candidates.push({ node, rect, depth })
      }
    }
    for (const child of node.children) {
      visit(child, depth + 1)
    }
  }

  visit(root, 0)
  return candidates
}

const absoluteFallback = (
  node: BlockNode,
  rect: DOMRect,
  mouse: { x: number; y: number },
  dragOffset?: { x: number; y: number }
): DropIndicator => ({
  type: 'absolute-position',
  targetId: node.id,
  targetParentId: node.id,
  absoluteCoords: calculateAbsoluteDropPosition(rect, mouse, dragOffset),
  rect,
})

export const determineDropTarget = (
  root: BlockNode,
  mousePosition: { x: number; y: number },
  draggedNodeId: string,
  elementRects: Map<string, DOMRect>,
  dragOffset?: { x: number; y: number }
): DropIndicator | null => {
  const candidates = findCandidateContainers(root, mousePosition, draggedNodeId, elementRects)

  if (candidates.length === 0) {
    // Cursor isn't near any container (e.g. autoscroll dragged it off-canvas).
    // Return null so the caller can keep the previous indicator sticky —
    // returning a synthetic absolute-position-on-root indicator here breaks
    // the drop, since handleDragEnd can't insert into a flex root by absolute
    // coords and `position` is undefined.
    return null
  }

  // Absolute container under cursor → free positioning takes over.
  // Pick the deepest one strictly containing the cursor.
  const absUnder = candidates
    .filter(c => getLayoutMode(c.node) === 'absolute' && isPointInRect(mousePosition, c.rect))
    .sort((a, b) => b.depth - a.depth)

  if (absUnder.length > 0) {
    const a = absUnder[0]
    return absoluteFallback(a.node, a.rect, mousePosition, dragOffset)
  }

  // Build slots across all flow candidates; rank by distance.
  type CandidateRankedSlot = RankedSlot & { container: BlockNode }
  const ranked: CandidateRankedSlot[] = []

  for (const c of candidates) {
    if (getLayoutMode(c.node) === 'absolute') continue

    // Skip "leaf-wrapper" containers: non-empty containers whose children are
    // ALL non-containers (text/image/input labels etc.). The cursor is almost
    // always sitting inside one of these, so their internal slots have ~0
    // distance and would always win over the structurally-meaningful slots in
    // the parent row/grid — dropping a whole block *inside* a stat label
    // instead of beside it. Such a container still participates as a CHILD in
    // its parent's slot computation, so you can still drop around it. Empty
    // containers are kept (they're a valid "drop inside" target).
    if (
      c.node.children.length > 0 &&
      !c.node.children.some(ch => isContainerNode(ch))
    ) {
      continue
    }

    // Keep dragged in children when building slots — slot.position must be
    // an index into c.node.children (unfiltered), because that's what
    // editorSlice.reorderNode expects when source === target (it does its own
    // remove + adjustedIndex math). Slots adjacent to the dragged node map to
    // its current location and are skipped below.
    const childRects: ChildRect[] = []
    for (const ch of c.node.children) {
      const r = elementRects.get(ch.id)
      if (r) childRects.push({ id: ch.id, rect: r })
    }
    const draggedIdx = childRects.findIndex(cr => cr.id === draggedNodeId)

    const primary = getSlotOrientation(c.node)
    const slots = buildSlots(c.node.id, c.rect, childRects, primary)

    // Grid: also generate slots in the perpendicular orientation so corners
    // resolve by axis nearest to cursor.
    if (getLayoutMode(c.node) === 'grid' && childRects.length > 1) {
      const perp: LineOrientation = primary === 'vertical' ? 'horizontal' : 'vertical'
      slots.push(...buildSlots(c.node.id, c.rect, childRects, perp))
    }

    for (const s of slots) {
      // Slots adjacent to the dragged node sit at its current position — they'd
      // produce a no-op reorder. Skip them.
      if (draggedIdx !== -1 && (s.position === draggedIdx || s.position === draggedIdx + 1)) {
        continue
      }
      ranked.push({
        slot: s,
        distance: distanceToSlot(mousePosition, s),
        depth: c.depth,
        container: c.node,
      })
    }
  }

  if (ranked.length === 0) {
    // Every flow candidate was a leaf-wrapper (or absolute). Fall back to the
    // shallowest non-absolute container so the drop still lands somewhere
    // sensible (appended) instead of silently failing / sticking.
    const fallback = candidates
      .filter(c => getLayoutMode(c.node) !== 'absolute')
      .sort((a, b) => a.depth - b.depth)[0]
    if (!fallback) return null
    return {
      type: 'inside',
      targetId: fallback.node.id,
      targetParentId: fallback.node.id,
      position: fallback.node.children.length,
      rect: fallback.rect,
    }
  }

  const best = pickBestSlot(ranked) as CandidateRankedSlot | null
  if (!best) return null

  return slotToIndicator(best.slot, best.container, draggedNodeId, elementRects)
}

const slotToIndicator = (
  slot: Slot,
  container: BlockNode,
  _draggedNodeId: string,
  elementRects: Map<string, DOMRect>
): DropIndicator => {
  // slot.position is an UNFILTERED index into container.children (see the
  // build-slots loop in determineDropTarget for why) — index it directly.
  const children = container.children
  const isEmpty = children.length === 0
  const isAfterLast = slot.position >= children.length

  let indicatorType: DropIndicator['type']
  let targetId: string
  if (isEmpty) {
    indicatorType = 'inside'
    targetId = container.id
  } else if (isAfterLast) {
    indicatorType = 'after'
    targetId = children[children.length - 1].id
  } else {
    indicatorType = 'before'
    targetId = children[slot.position].id
  }

  return {
    type: indicatorType,
    targetId,
    targetParentId: container.id,
    position: slot.position,
    rect: elementRects.get(container.id),
    slotLine: slot.line,
  }
}

export const collectElementRects = (rootElement: HTMLElement): Map<string, DOMRect> => {
  const rects = new Map<string, DOMRect>()
  const elements = rootElement.querySelectorAll('[data-element-id]')
  elements.forEach(el => {
    const id = el.getAttribute('data-element-id')
    if (id) rects.set(id, el.getBoundingClientRect())
  })
  return rects
}

export const findClosestContainer = (
  root: BlockNode,
  mousePosition: { x: number; y: number },
  elementRects: Map<string, DOMRect>,
  excludeId?: string
): BlockNode | null => {
  let closest: BlockNode | null = null
  let minDist = Infinity

  const visit = (node: BlockNode): void => {
    if (node.id === excludeId) return
    const rect = elementRects.get(node.id)
    if (rect && isContainerNode(node)) {
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const d = Math.hypot(mousePosition.x - cx, mousePosition.y - cy)
      if (d < minDist) {
        minDist = d
        closest = node
      }
    }
    for (const c of node.children) visit(c)
  }

  visit(root)
  return closest
}
