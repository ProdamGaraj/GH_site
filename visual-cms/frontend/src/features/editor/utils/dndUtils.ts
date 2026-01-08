import type { BlockNode, LayoutMode } from '@/shared/types'

// Drag and drop utilities for visual-cms

export interface DropIndicator {
  type: 'before' | 'after' | 'inside' | 'absolute-position'
  targetId: string
  targetParentId: string
  position?: number
  absoluteCoords?: { x: number; y: number }
  rect?: DOMRect
}

export interface DraggedElement {
  id: string
  node: BlockNode
  sourceParentId: string | null
  sourceIndex: number
}

/**
 * Determines the layout mode of a container
 */
export const getLayoutMode = (node: BlockNode): LayoutMode => {
  return node.layoutMode || 'flex'
}

/**
 * Checks if a container uses flow layout (flex or grid)
 */
export const isFlowLayout = (node: BlockNode): boolean => {
  const mode = getLayoutMode(node)
  return mode === 'flex' || mode === 'grid'
}

/**
 * Checks if a container uses absolute positioning
 */
export const isAbsoluteLayout = (node: BlockNode): boolean => {
  return getLayoutMode(node) === 'absolute'
}

/**
 * Finds the nearest droppable ancestor with a specific layout mode
 */
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
  
  // Go through ancestors from closest to farthest
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

/**
 * Calculate drop position for flow layouts (flex/grid)
 */
export const calculateFlowDropPosition = (
  _containerRect: DOMRect,
  childRects: { id: string; rect: DOMRect }[],
  mousePosition: { x: number; y: number },
  flexDirection: string = 'row'
): { position: number; indicator: 'before' | 'after' } => {
  const isVertical = flexDirection === 'column' || flexDirection === 'column-reverse'
  
  if (childRects.length === 0) {
    return { position: 0, indicator: 'before' }
  }
  
  for (let i = 0; i < childRects.length; i++) {
    const { rect } = childRects[i]
    const midPoint = isVertical
      ? rect.top + rect.height / 2
      : rect.left + rect.width / 2
    
    const mousePos = isVertical ? mousePosition.y : mousePosition.x
    
    if (mousePos < midPoint) {
      return { position: i, indicator: 'before' }
    }
  }
  
  return { position: childRects.length, indicator: 'after' }
}

/**
 * Calculate drop position for absolute layout
 */
export const calculateAbsoluteDropPosition = (
  containerRect: DOMRect,
  mousePosition: { x: number; y: number }
): { x: number; y: number } => {
  return {
    x: mousePosition.x - containerRect.left,
    y: mousePosition.y - containerRect.top,
  }
}

/**
 * Edge zone threshold in pixels - area near container edges where dropping
 * will target the parent container instead
 */
const EDGE_ZONE_SIZE = 20

/**
 * Check if mouse is in the edge zone of a rect (near the borders)
 */
const isInEdgeZone = (
  mousePosition: { x: number; y: number },
  rect: DOMRect,
  edgeSize: number = EDGE_ZONE_SIZE
): { inEdge: boolean; edge: 'top' | 'right' | 'bottom' | 'left' | null } => {
  const { x, y } = mousePosition
  
  // Check if inside rect at all
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    return { inEdge: false, edge: null }
  }
  
  // Check each edge
  if (y - rect.top < edgeSize) return { inEdge: true, edge: 'top' }
  if (rect.bottom - y < edgeSize) return { inEdge: true, edge: 'bottom' }
  if (x - rect.left < edgeSize) return { inEdge: true, edge: 'left' }
  if (rect.right - x < edgeSize) return { inEdge: true, edge: 'right' }
  
  return { inEdge: false, edge: null }
}

/**
 * Find parent node in the tree
 */
const findParentInTree = (root: BlockNode, childId: string): BlockNode | null => {
  for (const child of root.children) {
    if (child.id === childId) return root
    const found = findParentInTree(child, childId)
    if (found) return found
  }
  return null
}

/**
 * Get index of child in parent
 */
const getChildIndex = (parent: BlockNode, childId: string): number => {
  return parent.children.findIndex(c => c.id === childId)
}

/**
 * Determines the best drop target based on mouse position
 * Supports edge zones for escaping to parent containers
 */
export const determineDropTarget = (
  root: BlockNode,
  mousePosition: { x: number; y: number },
  draggedNodeId: string,
  elementRects: Map<string, DOMRect>
): DropIndicator | null => {
  // Build hierarchy of elements under mouse (from root to deepest)
  const elementsUnderMouse: { node: BlockNode; rect: DOMRect; depth: number }[] = []
  
  const collectElements = (node: BlockNode, depth: number = 0) => {
    const rect = elementRects.get(node.id)
    if (rect && isPointInRect(mousePosition, rect)) {
      // Don't consider the dragged node itself as a drop target
      // Don't consider descendants of dragged node (can't drop into itself)
      // BUT DO consider ancestors of dragged node (can drop to parent)
      if (node.id !== draggedNodeId && !isAncestorOf(node, draggedNodeId, root)) {
        elementsUnderMouse.push({ node, rect, depth })
      }
    }
    for (const child of node.children) {
      collectElements(child, depth + 1)
    }
  }
  
  collectElements(root)
  
  console.log('📍 Elements under mouse:', elementsUnderMouse.map(e => ({ 
    name: e.node.metadata.name || e.node.tagName, 
    depth: e.depth,
    id: e.node.id.substring(0, 8)
  })))
  
  if (elementsUnderMouse.length === 0) {
    // Fallback to root if nothing under mouse
    const rootRect = elementRects.get(root.id)
    if (!rootRect) return null
    return createDropIndicator(root, root.id, rootRect, mousePosition, elementRects, root)
  }
  
  // Sort by depth (deepest first)
  elementsUnderMouse.sort((a, b) => b.depth - a.depth)
  
  // Filter to only containers
  const containers = elementsUnderMouse.filter(e => 
    e.node.elementType === 'container' || 
    e.node.children.length > 0 ||
    ['div', 'section', 'article', 'header', 'footer', 'main', 'nav', 'aside'].includes(e.node.tagName)
  )
  
  console.log('📦 Containers (sorted by depth):', containers.map(e => ({ 
    name: e.node.metadata.name || e.node.tagName, 
    depth: e.depth 
  })))
  
  if (containers.length === 0) {
    const rootRect = elementRects.get(root.id)
    if (!rootRect) return null
    return createDropIndicator(root, root.id, rootRect, mousePosition, elementRects, root)
  }
  
  // Find the appropriate target based on edge zones
  // Logic: start with deepest container, if cursor is in edge zone - go to parent (one level up only)
  const deepest = containers[0]
  const edgeInfo = isInEdgeZone(mousePosition, deepest.rect)
  
  console.log('🎯 Deepest:', deepest.node.metadata.name || deepest.node.tagName, 'inEdge:', edgeInfo.inEdge)
  
  let targetContainer = deepest
  
  if (edgeInfo.inEdge && containers.length > 1) {
    // Cursor is in edge zone of deepest container - use its parent
    targetContainer = containers[1]
    console.log('⬆️ Using parent:', targetContainer.node.metadata.name || targetContainer.node.tagName)
  }
  
  const { node: targetNode, rect: targetRect } = targetContainer
  
  return createDropIndicator(targetNode, targetNode.id, targetRect, mousePosition, elementRects, root)
}

/**
 * Creates a drop indicator based on target layout
 */
const createDropIndicator = (
  targetNode: BlockNode,
  parentId: string,
  containerRect: DOMRect,
  mousePosition: { x: number; y: number },
  elementRects: Map<string, DOMRect>,
  root: BlockNode
): DropIndicator => {
  const layoutMode = getLayoutMode(targetNode)
  
  if (layoutMode === 'absolute') {
    const absoluteCoords = calculateAbsoluteDropPosition(containerRect, mousePosition)
    return {
      type: 'absolute-position',
      targetId: targetNode.id,
      targetParentId: parentId,
      absoluteCoords,
      rect: containerRect,
    }
  }
  
  // Flow layout (flex/grid)
  const childRects = targetNode.children
    .map(child => {
      const rect = elementRects.get(child.id)
      return rect ? { id: child.id, rect } : null
    })
    .filter((item): item is { id: string; rect: DOMRect } => item !== null)
  
  const flexDirection = targetNode.styles.properties.flexDirection || 'row'
  const { position, indicator } = calculateFlowDropPosition(
    containerRect,
    childRects,
    mousePosition,
    flexDirection
  )
  
  // Calculate indicator rect
  let indicatorRect: DOMRect
  if (childRects.length === 0) {
    indicatorRect = containerRect
  } else if (indicator === 'before' && position < childRects.length) {
    indicatorRect = childRects[position].rect
  } else if (position > 0) {
    indicatorRect = childRects[position - 1].rect
  } else {
    indicatorRect = containerRect
  }
  
  return {
    type: position === 0 && childRects.length > 0 ? 'before' : indicator,
    targetId: childRects[position]?.id || targetNode.id,
    targetParentId: targetNode.id,
    position,
    rect: indicatorRect,
  }
}

/**
 * Helper to check if point is inside rect
 */
const isPointInRect = (point: { x: number; y: number }, rect: DOMRect): boolean => {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  )
}

/**
 * Check if node contains a descendant with given id
 */
const isDescendant = (node: BlockNode, descendantId: string): boolean => {
  for (const child of node.children) {
    if (child.id === descendantId) return true
    if (isDescendant(child, descendantId)) return true
  }
  return false
}

/**
 * Check if targetNode is inside (descendant of) the dragged node
 * This means we can't drop the dragged node into its own children
 */
const isAncestorOf = (targetNode: BlockNode, draggedNodeId: string, root: BlockNode): boolean => {
  // Find the dragged node first
  const findNode = (node: BlockNode, id: string): BlockNode | null => {
    if (node.id === id) return node
    for (const child of node.children) {
      const found = findNode(child, id)
      if (found) return found
    }
    return null
  }
  
  const draggedNode = findNode(root, draggedNodeId)
  if (!draggedNode) return false
  
  // Check if targetNode is a descendant of draggedNode
  return isDescendant(draggedNode, targetNode.id)
}

/**
 * Get all element rects from DOM
 */
export const collectElementRects = (rootElement: HTMLElement): Map<string, DOMRect> => {
  const rects = new Map<string, DOMRect>()
  
  const elements = rootElement.querySelectorAll('[data-element-id]')
  elements.forEach(el => {
    const id = el.getAttribute('data-element-id')
    if (id) {
      rects.set(id, el.getBoundingClientRect())
    }
  })
  
  return rects
}

/**
 * Find the closest container element to a given point
 */
export const findClosestContainer = (
  root: BlockNode,
  mousePosition: { x: number; y: number },
  elementRects: Map<string, DOMRect>,
  excludeId?: string
): BlockNode | null => {
  let closestContainer: BlockNode | null = null
  let minDistance = Infinity
  
  const findClosest = (node: BlockNode) => {
    if (node.id === excludeId) return
    
    const rect = elementRects.get(node.id)
    if (!rect) return
    
    const isContainer = node.elementType === 'container' || node.children.length > 0
    if (!isContainer) return
    
    const distance = getDistanceToRect(mousePosition, rect)
    if (distance < minDistance) {
      minDistance = distance
      closestContainer = node
    }
    
    for (const child of node.children) {
      findClosest(child)
    }
  }
  
  findClosest(root)
  return closestContainer
}

const getDistanceToRect = (point: { x: number; y: number }, rect: DOMRect): number => {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  return Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2))
}
