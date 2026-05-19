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

// TEMPORARY drop-target diagnostic. Logs only when the (tag, payload) changes,
// so dragMove firing every frame doesn't spam the console. Remove once the
// drop-position investigation is closed.
let __ddtLast = ''
const ddtDiag = (tag: string, payload: Record<string, unknown>) => {
  const sig = tag + '|' + JSON.stringify(payload)
  if (sig === __ddtLast) return
  __ddtLast = sig
  // eslint-disable-next-line no-console
  console.log(`[DDT ${tag}]`, payload)
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

// Per-nesting-level penalty (screen px) added to a slot's distance. The cursor
// is almost always sitting inside some deeply-nested element, so its internal
// slots have near-zero raw distance and would always beat the structurally
// meaningful slots between higher-level blocks — visually bisecting a cohesive
// block (e.g. a timeline entry) instead of snapping above/below it. The bias
// makes a deeper slot win only when the cursor is decisively on its edge, so
// shallow "between blocks" placement is the default while intentional
// drop-inside still works when you aim precisely. Same-level siblings share the
// same bias, so the touching-siblings behaviour is unaffected.
const DEPTH_BIAS_PX = 28

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

// Direct parent of `childId`. Mirrors editorSlice/treeUtils.findParentNode so
// the drop-time source parent matches the one startDrag stored.
const findParentOf = (root: BlockNode, childId: string): BlockNode | null => {
  for (const c of root.children) {
    if (c.id === childId) return root
    const f = findParentOf(c, childId)
    if (f) return f
  }
  return null
}

// Orientation of the slot LINES for a container:
//   'vertical'   = vertical lines  → children flow horizontally (row)
//   'horizontal' = horizontal lines → children flow vertically (column)
//
// Prefer GEOMETRY over the CSS property: flexDirection is frequently absent
// from styles.properties (set via layoutMode / a class / left at the CSS
// default), which made the old property-only check fall back to 'row' and draw
// a vertical line through a visually-vertical stack. With ≥2 child rects we
// measure how their centres spread: a larger vertical spread than horizontal
// means a column. Falls back to the property only when geometry is unavailable.
const getSlotOrientation = (
  node: BlockNode,
  childRects?: ChildRect[]
): LineOrientation => {
  if (childRects && childRects.length >= 2) {
    let minCx = Infinity, maxCx = -Infinity, minCy = Infinity, maxCy = -Infinity
    for (const { rect } of childRects) {
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      if (cx < minCx) minCx = cx
      if (cx > maxCx) maxCx = cx
      if (cy < minCy) minCy = cy
      if (cy > maxCy) maxCy = cy
    }
    const spreadX = maxCx - minCx
    const spreadY = maxCy - minCy
    // Clear winner by geometry.
    if (Math.abs(spreadX - spreadY) > 4) {
      return spreadY > spreadX ? 'horizontal' : 'vertical'
    }
  }
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

type CandidateRankedSlot = RankedSlot & { container: BlockNode }

// Build the candidate slots for ONE container with RAW (un-biased) distance.
// Shared by the main ranking loop and the empty-ranking fallback so the two
// can't drift apart. Caller is responsible for any depth bias / heuristic
// container filtering — this just turns a container into its child-gap slots.
const buildContainerRankedSlots = (
  c: Candidate,
  mousePosition: { x: number; y: number },
  draggedNodeId: string,
  elementRects: Map<string, DOMRect>
): CandidateRankedSlot[] => {
  // EXCLUDE the dragged element from slot geometry. dnd-kit applies a
  // transform to the still-mounted source element during the drag, so its
  // rect follows the cursor — feeding that moving rect into buildSlots (which
  // sorts children by rect) scrambles slot order and produces wrong lines.
  // The dragged element is re-introduced purely as a tree index later, via
  // slot.beforeId/afterId in slotToIndicator. Dropping next to its origin
  // still resolves to a clean no-op there.
  const childRects: ChildRect[] = []
  for (const ch of c.node.children) {
    if (ch.id === draggedNodeId) continue
    const r = elementRects.get(ch.id)
    if (r) childRects.push({ id: ch.id, rect: r })
  }

  // childRects is built from c.node.children in tree/DOM order — the true
  // sibling order and exactly what reorderNode expects. Pass keepOrder so
  // buildSlots does NOT re-sort by (possibly degenerate) rects, which was
  // scrambling beforeId/afterId and flinging the drop to position 0 / last.
  const primary = getSlotOrientation(c.node, childRects)
  const slots = buildSlots(c.node.id, c.rect, childRects, primary, true)

  // Grid: also generate slots in the perpendicular orientation so corners
  // resolve by the axis nearest the cursor.
  if (getLayoutMode(c.node) === 'grid' && childRects.length > 1) {
    const perp: LineOrientation = primary === 'vertical' ? 'horizontal' : 'vertical'
    slots.push(...buildSlots(c.node.id, c.rect, childRects, perp, true))
  }

  return slots.map(s => ({
    slot: s,
    distance: distanceToSlot(mousePosition, s),
    depth: c.depth,
    container: c.node,
  }))
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
  // === Source-parent anchor (canvas-element reorder) ===
  // Page-level drag moves whole blocks among their peers; a block's internals
  // are edited via the block editor, not by hovering on the page. So when an
  // EXISTING element is dragged, the ONLY valid target is its own source
  // parent — slots are the gaps between its direct children, and we snap to
  // the one nearest the cursor (hover the upper half of a sibling → line above
  // it, lower half → below it). Deterministic; removes the entire "cursor is
  // deep inside a huge section so a deep slot wins" failure class.
  //
  // Runs BEFORE the candidates / off-canvas checks and with NO cursor-in-rect
  // gate: a wide block's grab point often sits left of the page content (or in
  // the centered page's side margin), and distanceToSlot already degrades
  // gracefully when the cursor is outside a slot's x-span — the nearest gap
  // still tracks cursor Y. Absolute source parents fall through (handled by the
  // absolute logic / handleDragMove clamping). Library items (no
  // draggedNodeId) and unresolved parents fall through to the heuristic path.
  const draggedNode = draggedNodeId ? findNodeInTree(root, draggedNodeId) : null
  if (draggedNode) {
    const sourceParent = findParentOf(root, draggedNodeId)
    const sourceParentRect = sourceParent ? elementRects.get(sourceParent.id) : undefined
    ddtDiag('anchor-eval', {
      draggedNodeId,
      draggedFound: !!draggedNode,
      sourceParent: sourceParent
        ? `${sourceParent.metadata?.name || sourceParent.tagName}#${sourceParent.id.slice(0, 6)}`
        : null,
      sourceParentLayout: sourceParent ? getLayoutMode(sourceParent) : null,
      sourceParentRect: !!sourceParentRect,
    })
    if (sourceParent && getLayoutMode(sourceParent) !== 'absolute') {
      if (sourceParentRect) {
        const anchor: Candidate = { node: sourceParent, rect: sourceParentRect, depth: 0 }
        const anchorBest = pickBestSlot(
          buildContainerRankedSlots(anchor, mousePosition, draggedNodeId, elementRects)
        ) as CandidateRankedSlot | null
        if (anchorBest) {
          const ind = slotToIndicator(
            anchorBest.slot,
            anchorBest.container,
            draggedNodeId,
            elementRects
          )
          const childById = (id: string | null) =>
            id == null
              ? null
              : (() => {
                  const ch = sourceParent.children.find(x => x.id === id)
                  return ch ? ch.metadata?.name || ch.tagName : id.slice(0, 6)
                })()
          const rectsSummary = sourceParent.children.map(ch => {
            const rr = elementRects.get(ch.id)
            return `${ch.metadata?.name || ch.tagName}:${rr ? Math.round(rr.top) + '/' + Math.round(rr.height) : 'NO_RECT'}`
          })
          ddtDiag('anchor-hit', {
            beforeId: childById(anchorBest.slot.beforeId),
            afterId: childById(anchorBest.slot.afterId),
            indType: ind.type,
            indTarget: childById(ind.targetId) || ind.targetId.slice(0, 6),
            indPos: ind.position,
            slotOrient: anchorBest.slot.orientation,
            slotLineY: Math.round(anchorBest.slot.line.y1),
            childCount: sourceParent.children.length,
            rects: rectsSummary,
          })
          return ind
        }
        ddtDiag('anchor-no-slot', { childCount: sourceParent.children.length })
        // No usable slot (e.g. dragged is the only child) → fall through.
      }
    }
  } else if (draggedNodeId) {
    ddtDiag('anchor-dragged-not-found', { draggedNodeId })
  }

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

  // Build slots across all flow candidates; rank by depth-biased distance.
  const ranked: CandidateRankedSlot[] = []

  // Size of the dragged element (canvas-element drags only — library items have
  // no rect yet). Used to reject containers that are too small to sensibly hold
  // a block this big: you don't drop a 150px section *inside* a 120px timeline
  // entry, you drop it *beside* the entry.
  const draggedRect = draggedNodeId ? elementRects.get(draggedNodeId) : undefined
  const SIZE_FACTOR = 0.9

  for (const c of candidates) {
    if (getLayoutMode(c.node) === 'absolute') continue

    // Skip "leaf-wrapper" containers: non-empty containers whose children are
    // ALL non-containers (text/image/input labels etc.). The cursor almost
    // always sits inside one, so its internal slots (raw distance ~0) would
    // beat the structurally meaningful slots in the parent — dropping a whole
    // block *inside* a stat label instead of beside it. It still participates
    // as a CHILD of its parent's slots. Empty containers are kept.
    if (
      c.node.children.length > 0 &&
      !c.node.children.some(ch => isContainerNode(ch))
    ) {
      continue
    }

    // Skip containers smaller (along the flow axis) than the dragged block.
    // column flow → compare heights; row flow → compare widths.
    if (draggedRect && c.node.children.length > 0) {
      const primary = getSlotOrientation(c.node)
      const containerExtent = primary === 'horizontal' ? c.rect.height : c.rect.width
      const draggedExtent =
        primary === 'horizontal' ? draggedRect.height : draggedRect.width
      if (containerExtent < draggedExtent * SIZE_FACTOR) continue
    }

    for (const r of buildContainerRankedSlots(c, mousePosition, draggedNodeId, elementRects)) {
      // Depth-biased distance: deeper slots are penalised so shallow
      // "between blocks" placement wins unless the cursor is right on a deep
      // slot's edge. See DEPTH_BIAS_PX.
      ranked.push({ ...r, distance: r.distance + c.depth * DEPTH_BIAS_PX })
    }
  }

  let best = pickBestSlot(ranked) as CandidateRankedSlot | null

  if (!best) {
    // Heuristic filters removed every slot source. DON'T emit a static
    // 'inside' indicator — the overlay renders that as a bar at the
    // container's vertical center, which looks frozen mid-block and ignores
    // the cursor. Instead build real child-gap slots (no filters) for the
    // shallowest flow container that strictly contains the cursor, so the
    // indicator still follows the cursor and sits on a real child boundary.
    const containing = candidates
      .filter(c => getLayoutMode(c.node) !== 'absolute' && isPointInRect(mousePosition, c.rect))
      .sort((a, b) => a.depth - b.depth)
    for (const c of containing) {
      const fb = buildContainerRankedSlots(c, mousePosition, draggedNodeId, elementRects)
      const pick = pickBestSlot(fb) as CandidateRankedSlot | null
      if (pick) {
        best = pick
        break
      }
    }
  }

  if (!best) return null

  return slotToIndicator(best.slot, best.container, draggedNodeId, elementRects)
}

const slotToIndicator = (
  slot: Slot,
  container: BlockNode,
  _draggedNodeId: string,
  elementRects: Map<string, DOMRect>
): DropIndicator => {
  // Derive the tree-insertion index from the slot's neighbour IDs, NOT from
  // slot.position. buildSlots sorts children by rect, and the dragged element
  // is excluded from that geometry, so slot.position is a sorted/filtered
  // index that does not line up with container.children. Mapping by id is
  // robust to sorting, filtering and mid-drag rect transforms.
  const children = container.children
  const idx = (id: string | null) =>
    id == null ? -1 : children.findIndex(ch => ch.id === id)

  let indicatorType: DropIndicator['type']
  let targetId: string
  let position: number

  if (children.length === 0 || (slot.beforeId == null && slot.afterId == null)) {
    // Empty container (or geometry produced no neighbours) → drop inside.
    indicatorType = 'inside'
    targetId = container.id
    position = children.length
  } else if (slot.afterId != null) {
    // Insert BEFORE the child that visually follows the slot.
    const after = idx(slot.afterId)
    indicatorType = 'before'
    targetId = slot.afterId
    position = after === -1 ? children.length : after
  } else {
    // After-last slot: insert AFTER the child that precedes it.
    const before = idx(slot.beforeId)
    indicatorType = 'after'
    targetId = slot.beforeId as string
    position = before === -1 ? children.length : before + 1
  }

  return {
    type: indicatorType,
    targetId,
    targetParentId: container.id,
    position,
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
