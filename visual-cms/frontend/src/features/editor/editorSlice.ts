import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { BlockNode, LayoutMode, CSSProperties } from '@/shared/types'
import { generateId } from '@/shared/utils'
import type { RootState } from '@/app/store'

interface EditorState {
  rootNode: BlockNode | null
  selectedNodeId: string | null
  hoveredNodeId: string | null
  history: BlockNode[]
  historyIndex: number
  isDirty: boolean
}

const initialState: EditorState = {
  rootNode: null,
  selectedNodeId: null,
  hoveredNodeId: null,
  history: [],
  historyIndex: -1,
  isDirty: false,
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
            minHeight: '100vh',
            padding: '20px',
            border: '2px solid #94a3b8',
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
      const defaultStyles: any = {}
      if (node.elementType === 'container') {
        defaultStyles.display = 'flex'
        defaultStyles.flexDirection = 'row'
        defaultStyles.padding = '20px'
        defaultStyles.minHeight = '100px'
        defaultStyles.height = 'auto'
        defaultStyles.border = '2px solid #94a3b8'
      }
      
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
        metadata: node.metadata || {},
        ...node,
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
    
    moveNode: (state, _action: PayloadAction<{
      nodeId: string
      targetId: string
      position?: number
    }>) => {
      // TODO: Implement node moving logic
      state.isDirty = true
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

export default editorSlice.reducer
