import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { BlockNode, LayoutMode, CSSProperties } from '@/shared/types'
import { generateId } from '@/shared/utils'
import type { RootState } from '@/app/store'

interface DragState {
  isDragging: boolean
  draggedNodeId: string | null
  sourceParentId: string | null
  sourceIndex: number | null
}

interface EditorState {
  rootNode: BlockNode | null
  selectedNodeId: string | null
  hoveredNodeId: string | null
  history: BlockNode[]
  historyIndex: number
  isDirty: boolean
  drag: DragState
}

const initialState: EditorState = {
  rootNode: null,
  selectedNodeId: null,
  hoveredNodeId: null,
  history: [],
  historyIndex: -1,
  isDirty: false,
  drag: {
    isDragging: false,
    draggedNodeId: null,
    sourceParentId: null,
    sourceIndex: null,
  },
}

// Helper functions for tree operations
const findNodeById = (node: BlockNode, id: string): BlockNode | null => {
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNodeById(child, id)
    if (found) return found
  }
  return null
}

const findParentNode = (node: BlockNode, childId: string): BlockNode | null => {
  for (const child of node.children) {
    if (child.id === childId) return node
    const found = findParentNode(child, childId)
    if (found) return found
  }
  return null
}

const getNodePath = (node: BlockNode, targetId: string, path: string[] = []): string[] | null => {
  if (node.id === targetId) return [...path, node.id]
  for (const child of node.children) {
    const found = getNodePath(child, targetId, [...path, node.id])
    if (found) return found
  }
  return null
}

const isDescendantOf = (root: BlockNode, ancestorId: string, descendantId: string): boolean => {
  const ancestorPath = getNodePath(root, ancestorId)
  const descendantPath = getNodePath(root, descendantId)
  if (!ancestorPath || !descendantPath) return false
  return descendantPath.includes(ancestorId) && descendantPath.indexOf(ancestorId) < descendantPath.indexOf(descendantId)
}

const removeNodeFromTree = (node: BlockNode, nodeIdToRemove: string): { tree: BlockNode; removed: BlockNode | null } => {
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

const insertNodeIntoTree = (
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

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    loadEditor: (state, action: PayloadAction<BlockNode>) => {
      state.rootNode = action.payload
      state.history = [action.payload]
      state.historyIndex = 0
      state.isDirty = false
    },
    
    createNewEditor: (state) => {
      const newRoot: BlockNode = {
        id: generateId(),
        elementType: 'container',
        tagName: 'div',
        styles: {
          properties: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            minWidth: '50px',
            minHeight: '100vh',
            padding: '20px',
            border: '2px solid #94a3b8',
            color: '#000000',
          },
        },
        layoutMode: 'flex',
        children: [],
        attributes: {},
        metadata: {
          name: 'Root Container',
        },
      }
      state.rootNode = newRoot
      state.history = [newRoot]
      state.historyIndex = 0
      state.isDirty = false
    },
    
    selectNode: (state, action: PayloadAction<string | null>) => {
      console.log('selectNode reducer called with:', action.payload)
      console.log('Previous selectedNodeId:', state.selectedNodeId)
      state.selectedNodeId = action.payload
      console.log('New selectedNodeId:', state.selectedNodeId)
    },
    
    hoverNode: (state, action: PayloadAction<string | null>) => {
      state.hoveredNodeId = action.payload
    },
    
    addNode: (state, action: PayloadAction<{ 
      parentId: string
      node: Partial<BlockNode>
      position?: number
    }>) => {
      if (!state.rootNode) return
      
      const { parentId, node, position } = action.payload
      
      // Prepare default styles based on element type
      const defaultStyles: any = {
        color: '#000000', // Default text color for all elements
        minWidth: '50px',
        minHeight: '50px',
        backgroundColor: 'transparent', // Transparent background by default
      }
      if (node.elementType === 'container') {
        defaultStyles.display = 'flex'
        defaultStyles.flexDirection = 'row'
        defaultStyles.padding = '20px'
        defaultStyles.minHeight = '100px'
        defaultStyles.height = 'auto'
        defaultStyles.border = '2px solid #94a3b8'
      }
      
      // Prepare default content for text elements
      let defaultContent = node.content
      if (!defaultContent) {
        const textElements = ['text', 'button', 'link', 'input']
        const textTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'label', 'textarea']
        const tagName = node.tagName || 'div'
        
        if (textElements.includes(node.elementType || '') || textTags.includes(tagName.toLowerCase())) {
          // Format: "button text", "heading text", etc.
          const elementName = typeof node.metadata?.name === 'string' ? node.metadata.name : tagName
          defaultContent = `${elementName.toLowerCase()} text`
        }
      }
      
      // Create a copy of node without content and metadata to avoid overriding defaults
      const { content: _content, metadata: _metadata, ...restNode } = node
      
      const newNode: BlockNode = {
        id: generateId(),
        elementType: node.elementType || 'container',
        tagName: node.tagName || 'div',
        styles: {
          properties: {
            ...defaultStyles,
            ...(node.styles?.properties || {}),
          },
        },
        children: [],
        attributes: node.attributes || {},
        content: defaultContent,
        metadata: node.metadata || {},
        ...restNode,
      }
      
      const addToNode = (current: BlockNode): BlockNode => {
        if (current.id === parentId) {
          const newChildren = [...current.children]
          if (position !== undefined) {
            newChildren.splice(position, 0, newNode)
          } else {
            newChildren.push(newNode)
          }
          return { ...current, children: newChildren }
        }
        return {
          ...current,
          children: current.children.map(addToNode),
        }
      }
      
      state.rootNode = addToNode(state.rootNode)
      state.isDirty = true
      state.selectedNodeId = newNode.id
    },
    
    updateNode: (state, action: PayloadAction<{
      id: string
      updates: Partial<BlockNode>
    }>) => {
      if (!state.rootNode) return
      
      const { id, updates } = action.payload
      
      const updateInNode = (current: BlockNode): BlockNode => {
        if (current.id === id) {
          return { ...current, ...updates }
        }
        return {
          ...current,
          children: current.children.map(updateInNode),
        }
      }
      
      state.rootNode = updateInNode(state.rootNode)
      state.isDirty = true
    },
    
    updateNodeStyles: (state, action: PayloadAction<{
      id: string
      properties?: Partial<CSSProperties>
      customCSS?: string
    }>) => {
      if (!state.rootNode) return
      
      const { id, properties, customCSS } = action.payload
      
      const updateInNode = (current: BlockNode): BlockNode => {
        if (current.id === id) {
          // Фильтруем пустые значения из properties
          const filteredProperties = properties 
            ? Object.entries({ ...current.styles.properties, ...properties })
                .reduce((acc, [key, value]) => {
                  // Удаляем свойства с пустыми значениями (пустая строка, null, undefined)
                  if (value !== '' && value !== null && value !== undefined) {
                    acc[key] = value
                  }
                  return acc
                }, {} as any)
            : current.styles.properties
          
          return {
            ...current,
            styles: {
              properties: filteredProperties,
              customCSS: customCSS !== undefined 
                ? customCSS 
                : current.styles.customCSS,
            },
          }
        }
        return {
          ...current,
          children: current.children.map(updateInNode),
        }
      }
      
      state.rootNode = updateInNode(state.rootNode)
      state.isDirty = true
    },
    
    updateLayoutMode: (state, action: PayloadAction<{
      id: string
      mode: LayoutMode
    }>) => {
      if (!state.rootNode) return
      
      const { id, mode } = action.payload
      
      const updateInNode = (current: BlockNode): BlockNode => {
        if (current.id === id) {
          return { ...current, layoutMode: mode }
        }
        return {
          ...current,
          children: current.children.map(updateInNode),
        }
      }
      
      state.rootNode = updateInNode(state.rootNode)
      state.isDirty = true
    },
    
    deleteNode: (state, action: PayloadAction<string>) => {
      if (!state.rootNode) return
      
      const deleteFromNode = (current: BlockNode): BlockNode => {
        return {
          ...current,
          children: current.children
            .filter(child => child.id !== action.payload)
            .map(deleteFromNode),
        }
      }
      
      state.rootNode = deleteFromNode(state.rootNode)
      state.isDirty = true
      state.selectedNodeId = null
    },
    
    moveNode: (state, action: PayloadAction<{
      nodeId: string
      targetParentId: string
      position?: number
      absolutePosition?: { x: number; y: number }
    }>) => {
      if (!state.rootNode) return
      
      const { nodeId, targetParentId, position, absolutePosition } = action.payload
      
      // Cannot move root node
      if (state.rootNode.id === nodeId) return
      
      // Cannot move node into itself or its descendants
      if (isDescendantOf(state.rootNode, nodeId, targetParentId) || nodeId === targetParentId) {
        console.warn('Cannot move node into itself or its descendants')
        return
      }
      
      // Find target parent to check its layout mode
      const targetParent = findNodeById(state.rootNode, targetParentId)
      if (!targetParent) return
      
      // Remove node from current location
      const { tree: treeWithoutNode, removed } = removeNodeFromTree(state.rootNode, nodeId)
      if (!removed) return
      
      // If target is absolute positioned, update the node's position styles
      let nodeToInsert = removed
      if (targetParent.layoutMode === 'absolute' && absolutePosition) {
        nodeToInsert = {
          ...removed,
          styles: {
            ...removed.styles,
            properties: {
              ...removed.styles.properties,
              position: 'absolute',
              left: `${absolutePosition.x}px`,
              top: `${absolutePosition.y}px`,
            },
          },
        }
      } else if (targetParent.layoutMode === 'flex' || targetParent.layoutMode === 'grid') {
        // Remove absolute positioning when moving to flex/grid container
        const { position: _pos, left: _l, top: _t, right: _r, bottom: _b, ...restProperties } = removed.styles.properties
        nodeToInsert = {
          ...removed,
          styles: {
            ...removed.styles,
            properties: restProperties,
          },
        }
      }
      
      // Insert node at new location
      state.rootNode = insertNodeIntoTree(treeWithoutNode, targetParentId, nodeToInsert, position)
      state.isDirty = true
    },
    
    reorderNode: (state, action: PayloadAction<{
      nodeId: string
      parentId: string
      newIndex: number
    }>) => {
      if (!state.rootNode) return
      
      const { nodeId, parentId, newIndex } = action.payload
      
      const updateParent = (current: BlockNode): BlockNode => {
        if (current.id === parentId) {
          const children = [...current.children]
          const currentIndex = children.findIndex(c => c.id === nodeId)
          if (currentIndex === -1) return current
          
          const [movedNode] = children.splice(currentIndex, 1)
          const adjustedIndex = currentIndex < newIndex ? newIndex - 1 : newIndex
          children.splice(adjustedIndex, 0, movedNode)
          
          return { ...current, children }
        }
        return { ...current, children: current.children.map(updateParent) }
      }
      
      state.rootNode = updateParent(state.rootNode)
      state.isDirty = true
    },
    
    updateNodePosition: (state, action: PayloadAction<{
      nodeId: string
      position: { x: number; y: number }
    }>) => {
      if (!state.rootNode) return
      
      const { nodeId, position } = action.payload
      
      const updateInNode = (current: BlockNode): BlockNode => {
        if (current.id === nodeId) {
          return {
            ...current,
            styles: {
              ...current.styles,
              properties: {
                ...current.styles.properties,
                position: 'absolute',
                left: `${position.x}px`,
                top: `${position.y}px`,
              },
            },
          }
        }
        return { ...current, children: current.children.map(updateInNode) }
      }
      
      state.rootNode = updateInNode(state.rootNode)
      state.isDirty = true
    },
    
    setDragState: (state, action: PayloadAction<Partial<DragState>>) => {
      state.drag = { ...state.drag, ...action.payload }
    },
    
    startDrag: (state, action: PayloadAction<{ nodeId: string }>) => {
      if (!state.rootNode) return
      
      const { nodeId } = action.payload
      const parent = findParentNode(state.rootNode, nodeId)
      const sourceIndex = parent?.children.findIndex(c => c.id === nodeId) ?? null
      
      state.drag = {
        isDragging: true,
        draggedNodeId: nodeId,
        sourceParentId: parent?.id ?? null,
        sourceIndex,
      }
    },
    
    endDrag: (state) => {
      state.drag = {
        isDragging: false,
        draggedNodeId: null,
        sourceParentId: null,
        sourceIndex: null,
      }
    },
  },
})

export const {
  loadEditor,
  createNewEditor,
  selectNode,
  hoverNode,
  addNode,
  updateNode,
  updateNodeStyles,
  updateLayoutMode,
  deleteNode,
  moveNode,
  reorderNode,
  updateNodePosition,
  setDragState,
  startDrag,
  endDrag,
} = editorSlice.actions

// Selectors
export const selectRootNode = (state: RootState) => state.editor.rootNode
export const selectSelectedNodeId = (state: RootState) => state.editor.selectedNodeId
export const selectSelectedNode = (state: RootState) => {
  const { rootNode, selectedNodeId } = state.editor
  if (!rootNode || !selectedNodeId) return null
  
  const findNode = (node: BlockNode): BlockNode | null => {
    if (node.id === selectedNodeId) return node
    for (const child of node.children) {
      const found = findNode(child)
      if (found) return found
    }
    return null
  }
  
  return findNode(rootNode)
}
export const selectIsDirty = (state: RootState) => state.editor.isDirty
export const selectDragState = (state: RootState) => state.editor.drag

// Helper selector to find a node by id
export const selectNodeById = (state: RootState, nodeId: string): BlockNode | null => {
  const { rootNode } = state.editor
  if (!rootNode) return null
  return findNodeById(rootNode, nodeId)
}

// Selector to get parent of a node
export const selectParentNode = (state: RootState, nodeId: string): BlockNode | null => {
  const { rootNode } = state.editor
  if (!rootNode) return null
  return findParentNode(rootNode, nodeId)
}

// Selector to get layout mode of a container
export const selectNodeLayoutMode = (state: RootState, nodeId: string): LayoutMode | undefined => {
  const node = selectNodeById(state, nodeId)
  return node?.layoutMode
}

export default editorSlice.reducer
