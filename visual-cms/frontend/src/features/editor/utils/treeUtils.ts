import type { BlockNode } from '@/shared/types'

/**
 * Tree utility functions for BlockNode operations.
 * Pure functions - no side effects, easy to test.
 */

/**
 * Find a node by ID in the tree (DFS)
 */
export const findNodeById = (node: BlockNode, id: string): BlockNode | null => {
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNodeById(child, id)
    if (found) return found
  }
  return null
}

/**
 * Find the parent of a node by the child's ID
 */
export const findParentNode = (node: BlockNode, childId: string): BlockNode | null => {
  for (const child of node.children) {
    if (child.id === childId) return node
    const found = findParentNode(child, childId)
    if (found) return found
  }
  return null
}

/**
 * Get the path (array of node IDs) from root to target node
 */
export const getNodePath = (node: BlockNode, targetId: string, path: string[] = []): string[] | null => {
  if (node.id === targetId) return [...path, node.id]
  for (const child of node.children) {
    const found = getNodePath(child, targetId, [...path, node.id])
    if (found) return found
  }
  return null
}

/**
 * Check if descendantId is a descendant of ancestorId in the tree
 */
export const isDescendantOf = (root: BlockNode, ancestorId: string, descendantId: string): boolean => {
  const ancestorPath = getNodePath(root, ancestorId)
  const descendantPath = getNodePath(root, descendantId)
  if (!ancestorPath || !descendantPath) return false
  return descendantPath.includes(ancestorId) && descendantPath.indexOf(ancestorId) < descendantPath.indexOf(descendantId)
}

/**
 * Remove a node from the tree, returning the updated tree and the removed node
 */
export const removeNodeFromTree = (
  node: BlockNode,
  nodeIdToRemove: string
): { tree: BlockNode; removed: BlockNode | null } => {
  let removed: BlockNode | null = null

  const traverse = (current: BlockNode): BlockNode => {
    const newChildren: BlockNode[] = []
    for (const child of current.children) {
      if (child.id === nodeIdToRemove) {
        removed = child
      } else {
        newChildren.push(traverse(child))
      }
    }
    return { ...current, children: newChildren }
  }

  return { tree: traverse(node), removed }
}

/**
 * Insert a node into the tree under a given parent at an optional position
 */
export const insertNodeIntoTree = (
  node: BlockNode,
  parentId: string,
  nodeToInsert: BlockNode,
  position?: number
): BlockNode => {
  const traverse = (current: BlockNode): BlockNode => {
    if (current.id === parentId) {
      const newChildren = [...current.children]
      if (position !== undefined && position >= 0) {
        newChildren.splice(position, 0, nodeToInsert)
      } else {
        newChildren.push(nodeToInsert)
      }
      return { ...current, children: newChildren }
    }
    return { ...current, children: current.children.map(traverse) }
  }
  return traverse(node)
}
