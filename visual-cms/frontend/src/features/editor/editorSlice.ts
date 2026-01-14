import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { BlockNode, LayoutMode, CSSProperties, CustomBreakpoint } from '@/shared/types'
import { generateId } from '@/shared/utils'
import type { RootState } from '@/app/store'
import { findNodeInTree } from '@/features/editor/utils/variationUtils'

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
  viewport: string
  breakpoints: CustomBreakpoint[]
  zoom: number
  activeLeftPanel: string | null
  activeRightPanel: string | null
  panOffset: { x: number; y: number }
  blockAlignment: 'left' | 'center' | 'right'
  // Режим редактирования
  editMode: 'base' | 'responsive'
  // При editMode = 'responsive', какой брейкпоинт редактируем
  activeEditBreakpoint: string | null
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
  viewport: 'base',
  breakpoints: [
    { id: 'desktop', name: 'Desktop', width: 1440, height: 900, icon: 'monitor', color: '#3b82f6' },
    { id: 'tablet', name: 'Tablet', width: 768, height: 1024, icon: 'tablet', color: '#8b5cf6' },
    { id: 'mobile', name: 'Mobile', width: 375, height: 667, icon: 'smartphone', color: '#10b981' },
  ],
  zoom: 100,
  activeLeftPanel: 'layers',
  activeRightPanel: 'properties',
  panOffset: { x: 0, y: 0 },
  blockAlignment: 'center',
  editMode: 'base',
  activeEditBreakpoint: null,
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
            width: 'fit-content',
            minWidth: '200px',
            minHeight: '100px',
            padding: '0px',
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
      
      // В режиме responsive добавляем в specificChildren вариации
      if (state.editMode === 'responsive' && state.activeEditBreakpoint) {
        const breakpointId = state.activeEditBreakpoint
        
        console.log('addNode in responsive mode:', { parentId, breakpointId, newNodeId: newNode.id })
        
        // Функция для добавления элемента в children (для элементов внутри specificChildren)
        const addToChildren = (node: BlockNode): BlockNode => {
          if (node.id === parentId) {
            console.log('addToChildren found parent:', parentId)
            const newChildren = [...(node.children || [])]
            if (position !== undefined) {
              newChildren.splice(position, 0, newNode)
            } else {
              newChildren.push(newNode)
            }
            return { ...node, children: newChildren }
          }
          return {
            ...node,
            children: (node.children || []).map(addToChildren)
          }
        }
        
        const addToVariation = (current: BlockNode): BlockNode => {
          // Проверяем, есть ли родитель в specificChildren этого узла
          if (current.variations?.[breakpointId]?.specificChildren) {
            const specificChildren = current.variations[breakpointId].specificChildren!
            
            // Проверяем, является ли один из specificChildren родителем
            const parentInSpecific = specificChildren.some(child => {
              const findParent = (node: BlockNode): boolean => {
                if (node.id === parentId) return true
                return (node.children || []).some(findParent)
              }
              return findParent(child)
            })
            
            if (parentInSpecific) {
              // Добавляем в children элемента внутри specificChildren
              const updatedSpecificChildren = specificChildren.map(child => addToChildren(child))
              
              return {
                ...current,
                variations: {
                  ...current.variations,
                  [breakpointId]: {
                    ...current.variations[breakpointId],
                    specificChildren: updatedSpecificChildren,
                  },
                },
                children: (current.children || []).map(addToVariation),
              }
            }
          }
          
          if (current.id === parentId) {
            // Родитель найден - добавляем в его specificChildren
            if (!current.variations) {
              current.variations = {}
            }
            if (!current.variations[breakpointId]) {
              current.variations[breakpointId] = {}
            }
            
            const variation = current.variations[breakpointId]
            const specificChildren = variation.specificChildren || []
            
            if (position !== undefined) {
              specificChildren.splice(position, 0, newNode)
            } else {
              specificChildren.push(newNode)
            }
            
            return {
              ...current,
              variations: {
                ...current.variations,
                [breakpointId]: {
                  ...variation,
                  specificChildren,
                },
              },
            }
          }
          
          return {
            ...current,
            children: (current.children || []).map(addToVariation),
          }
        }
        
        state.rootNode = addToVariation(state.rootNode)
      } else {
        // В base режиме добавляем в обычное дерево
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
      }
      
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
      nodeId: string
      properties?: Partial<CSSProperties>
      customCSS?: string
      breakpoint?: string
    }>) => {
      if (!state.rootNode) return
      
      const { nodeId, properties, customCSS, breakpoint } = action.payload
      
      // Определяем режим обновления
      const isResponsiveMode = state.editMode === 'responsive' && state.activeEditBreakpoint
      const targetBreakpoint = breakpoint || (isResponsiveMode ? state.activeEditBreakpoint : null)
      
      const updateInNode = (current: BlockNode): BlockNode => {
        if (current.id === nodeId) {
          // Фильтруем пустые значения из properties
          const filteredProperties = properties 
            ? Object.entries(properties)
                .reduce((acc, [key, value]) => {
                  // Удаляем свойства с пустыми значениями (пустая строка, null, undefined)
                  if (value !== '' && value !== null && value !== undefined) {
                    acc[key] = value
                  }
                  return acc
                }, {} as any)
            : {}
          
          // Режим responsive - добавляем в inheritedOverrides
          if (targetBreakpoint && isResponsiveMode) {
            const variations = current.variations || {}
            const variation = variations[targetBreakpoint] || {}
            const inheritedOverrides = variation.inheritedOverrides || {}
            const currentOverride = inheritedOverrides[nodeId] || {}
            
            return {
              ...current,
              variations: {
                ...variations,
                [targetBreakpoint]: {
                  ...variation,
                  inheritedOverrides: {
                    ...inheritedOverrides,
                    [nodeId]: {
                      ...currentOverride,
                      styles: {
                        ...currentOverride.styles,
                        ...filteredProperties,
                      },
                    },
                  },
                },
              },
            }
          }
          
          // Базовый режим - обновляем base стили
          return {
            ...current,
            styles: {
              ...current.styles,
              properties: {
                ...current.styles.properties,
                ...filteredProperties,
              },
              customCSS: customCSS !== undefined ? customCSS : current.styles.customCSS,
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
      console.log('=== deleteNode reducer START ===')
      if (!state.rootNode) {
        console.log('No rootNode, returning')
        return
      }
      
      const nodeId = action.payload
      console.log('Deleting nodeId:', nodeId)
      console.log('editMode:', state.editMode)
      console.log('activeEditBreakpoint:', state.activeEditBreakpoint)
      
      // В responsive режиме удаляем только из вариации
      if (state.editMode === 'responsive' && state.activeEditBreakpoint) {
        const breakpointId = state.activeEditBreakpoint
        console.log('Responsive mode, breakpointId:', breakpointId)
        
        // Флаг, был ли найден и удалён элемент
        let wasDeleted = false
        
        // Рекурсивная функция удаления из любого дерева
        const deleteFromTree = (node: BlockNode): BlockNode | null => {
          if (node.id === nodeId) {
            console.log('Found node to delete:', node.id)
            wasDeleted = true
            return null
          }
          
          const nodeChildren = node.children || []
          const newChildren = nodeChildren
            .map(ch => deleteFromTree(ch))
            .filter((ch): ch is BlockNode => ch !== null)
          
          return {
            ...node,
            children: newChildren
          }
        }
        
        // Рекурсивная функция для обработки всего дерева включая variations
        const processNode = (node: BlockNode): BlockNode => {
          let updatedNode = { ...node }
          
          // Обрабатываем specificChildren в variations для ВСЕХ breakpoint'ов
          // (элемент мог быть добавлен для этого breakpoint, но в другом месте дерева)
          if (node.variations?.[breakpointId]?.specificChildren) {
            const specificChildren = node.variations[breakpointId].specificChildren!
            
            const updatedSpecificChildren = specificChildren
              .map(child => deleteFromTree(child))
              .filter((ch): ch is BlockNode => ch !== null)
            
            updatedNode = {
              ...updatedNode,
              variations: {
                ...updatedNode.variations,
                [breakpointId]: {
                  ...updatedNode.variations![breakpointId],
                  specificChildren: updatedSpecificChildren
                }
              }
            }
          }
          
          // Рекурсивно обрабатываем обычных детей
          const nodeChildren = node.children || []
          if (nodeChildren.length > 0) {
            updatedNode = {
              ...updatedNode,
              children: nodeChildren.map(child => processNode(child))
            }
          }
          
          return updatedNode
        }
        
        // Обрабатываем всё дерево
        state.rootNode = processNode(state.rootNode)
        
        if (wasDeleted) {
          state.isDirty = true
          state.selectedNodeId = null
          return
        }
        
        // Элемент не найден в specificChildren - проверяем, может он в обычных children
        // (был добавлен неправильно или это унаследованный элемент)
        // Ищем элемент в базовом дереве
        const findInBaseTree = (node: BlockNode): boolean => {
          if (node.id === nodeId) return true
          return (node.children || []).some(findInBaseTree)
        }
        
        if (findInBaseTree(state.rootNode)) {
          // Элемент в базовом дереве - скрываем его через override
          if (!state.rootNode.variations) {
            state.rootNode.variations = {}
          }
          if (!state.rootNode.variations[breakpointId]) {
            state.rootNode.variations[breakpointId] = {}
          }
          if (!state.rootNode.variations[breakpointId].inheritedOverrides) {
            state.rootNode.variations[breakpointId].inheritedOverrides = {}
          }
          
          state.rootNode.variations[breakpointId].inheritedOverrides![nodeId] = {
            hidden: true
          }
          
          state.isDirty = true
          state.selectedNodeId = null
          return
        }
      }
      
      // В базовом режиме удаляем из дерева полностью
      // Сначала ищем в variations (specificChildren)
      let foundInVariations = false
      
      const deleteFromVariations = (node: BlockNode): BlockNode => {
        let updatedNode = { ...node }
        
        // Удаляем из specificChildren всех variations
        if (node.variations) {
          const updatedVariations = { ...node.variations }
          
          for (const [bpId, variation] of Object.entries(node.variations)) {
            if (variation.specificChildren) {
              const findAndDelete = (n: BlockNode): BlockNode | null => {
                if (n.id === nodeId) {
                  foundInVariations = true
                  return null
                }
                return {
                  ...n,
                  children: (n.children || [])
                    .map(ch => findAndDelete(ch))
                    .filter((ch): ch is BlockNode => ch !== null)
                }
              }
              
              const newSpecificChildren = variation.specificChildren
                .map(ch => findAndDelete(ch))
                .filter((ch): ch is BlockNode => ch !== null)
              
              updatedVariations[bpId] = {
                ...variation,
                specificChildren: newSpecificChildren
              }
            }
          }
          
          updatedNode.variations = updatedVariations
        }
        
        // Рекурсивно обрабатываем детей
        updatedNode.children = (node.children || []).map(deleteFromVariations)
        
        return updatedNode
      }
      
      state.rootNode = deleteFromVariations(state.rootNode)
      
      if (foundInVariations) {
        state.isDirty = true
        state.selectedNodeId = null
        return
      }
      
      // Если не нашли в variations, удаляем из базового дерева
      const deleteFromNode = (current: BlockNode): BlockNode => {
        return {
          ...current,
          children: (current.children || [])
            .filter(child => child.id !== nodeId)
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
      
      // Round to integers
      const x = Math.round(position.x)
      const y = Math.round(position.y)
      
      const updateInNode = (current: BlockNode): BlockNode => {
        if (current.id === nodeId) {
          return {
            ...current,
            styles: {
              ...current.styles,
              properties: {
                ...current.styles.properties,
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
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
    
    setViewport: (state, action: PayloadAction<string>) => {
      state.viewport = action.payload
    },
    
    addBreakpoint: (state, action: PayloadAction<CustomBreakpoint>) => {
      state.breakpoints.push(action.payload)
    },
    
    removeBreakpoint: (state, action: PayloadAction<string>) => {
      state.breakpoints = state.breakpoints.filter(bp => bp.id !== action.payload)
      // If removed breakpoint was active, switch to desktop
      if (state.viewport === action.payload) {
        state.viewport = 'desktop'
      }
    },
    
    updateBreakpoint: (state, action: PayloadAction<CustomBreakpoint>) => {
      const index = state.breakpoints.findIndex(bp => bp.id === action.payload.id)
      if (index !== -1) {
        state.breakpoints[index] = action.payload
      }
    },
    
    markAsSaved: (state) => {
      state.isDirty = false
    },
    
    // Загрузить структуру из импорта
    loadRootNode: (state, action: PayloadAction<BlockNode>) => {
      state.rootNode = action.payload
      state.isDirty = true
      state.selectedNodeId = null
    },
    
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = Math.max(25, Math.min(500, action.payload))
    },
    
    setActiveLeftPanel: (state, action: PayloadAction<string | null>) => {
      state.activeLeftPanel = action.payload
    },
    
    setActiveRightPanel: (state, action: PayloadAction<string | null>) => {
      state.activeRightPanel = action.payload
    },
    
    setPanOffset: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.panOffset = action.payload
    },
    
    setBlockAlignment: (state, action: PayloadAction<'left' | 'center' | 'right'>) => {
      state.blockAlignment = action.payload
    },
    
    setEditMode: (state, action: PayloadAction<'base' | 'responsive'>) => {
      state.editMode = action.payload
      // При переключении на base режим, сбрасываем activeEditBreakpoint
      if (action.payload === 'base') {
        state.activeEditBreakpoint = null
      } else {
        // При переключении на responsive, используем текущий viewport (если не 'base')
        state.activeEditBreakpoint = state.viewport !== 'base' ? state.viewport : 'desktop'
      }
    },
    
    setActiveEditBreakpoint: (state, action: PayloadAction<string | null>) => {
      state.activeEditBreakpoint = action.payload
    },
    
    // Перенести элемент в другой viewport
    moveNodeToViewport: (state, action: PayloadAction<{
      nodeId: string
      targetBreakpoint: string | null  // null = перенести в базовое дерево (все viewport'ы)
    }>) => {
      if (!state.rootNode) return
      
      const { nodeId, targetBreakpoint } = action.payload
      
      // Находим элемент и его текущее местоположение
      let foundNode: BlockNode | null = null
      let sourceBreakpoint: string | null = null
      
      // Ищем в базовом дереве
      const findInBaseTree = (node: BlockNode): BlockNode | null => {
        if (node.id === nodeId) return node
        for (const child of (node.children || [])) {
          const found = findInBaseTree(child)
          if (found) return found
        }
        return null
      }
      
      // Ищем в specificChildren всех variations
      const findInVariations = (node: BlockNode): { found: BlockNode | null; breakpoint: string | null } => {
        if (node.variations) {
          for (const [bpId, variation] of Object.entries(node.variations)) {
            if (variation.specificChildren) {
              for (const child of variation.specificChildren) {
                if (child.id === nodeId) {
                  return { found: child, breakpoint: bpId }
                }
                // Рекурсивно ищем в children
                const foundInChildren = findInBaseTree(child)
                if (foundInChildren) {
                  return { found: foundInChildren, breakpoint: bpId }
                }
              }
            }
          }
        }
        // Рекурсивно проверяем детей
        for (const child of (node.children || [])) {
          const result = findInVariations(child)
          if (result.found) return result
        }
        return { found: null, breakpoint: null }
      }
      
      // Сначала ищем в базовом дереве
      foundNode = findInBaseTree(state.rootNode)
      if (foundNode) {
        sourceBreakpoint = null // в базовом дереве
      } else {
        // Ищем в variations
        const result = findInVariations(state.rootNode)
        foundNode = result.found
        sourceBreakpoint = result.breakpoint
      }
      
      if (!foundNode) {
        console.warn('Node not found for moveNodeToViewport:', nodeId)
        return
      }
      
      // Если источник и цель одинаковы - ничего не делаем
      if (sourceBreakpoint === targetBreakpoint) {
        return
      }
      
      // Копируем элемент (глубокое копирование)
      const nodeCopy = JSON.parse(JSON.stringify(foundNode))
      
      // Удаляем из текущего местоположения
      if (sourceBreakpoint === null) {
        // Удаляем из базового дерева
        const removeFromBase = (node: BlockNode): BlockNode => ({
          ...node,
          children: (node.children || [])
            .filter(child => child.id !== nodeId)
            .map(removeFromBase)
        })
        state.rootNode = removeFromBase(state.rootNode)
      } else {
        // Удаляем из specificChildren
        const removeFromVariation = (node: BlockNode): BlockNode => {
          let updatedNode = { ...node }
          
          if (node.variations?.[sourceBreakpoint]?.specificChildren) {
            updatedNode = {
              ...updatedNode,
              variations: {
                ...updatedNode.variations,
                [sourceBreakpoint]: {
                  ...updatedNode.variations![sourceBreakpoint],
                  specificChildren: updatedNode.variations![sourceBreakpoint].specificChildren!
                    .filter(child => child.id !== nodeId)
                }
              }
            }
          }
          
          return {
            ...updatedNode,
            children: (updatedNode.children || []).map(removeFromVariation)
          }
        }
        state.rootNode = removeFromVariation(state.rootNode)
      }
      
      // Добавляем в новое местоположение
      if (targetBreakpoint === null) {
        // Добавляем в базовое дерево (в root children)
        state.rootNode.children = [...(state.rootNode.children || []), nodeCopy]
      } else {
        // Добавляем в specificChildren целевого breakpoint
        if (!state.rootNode.variations) {
          state.rootNode.variations = {}
        }
        if (!state.rootNode.variations[targetBreakpoint]) {
          state.rootNode.variations[targetBreakpoint] = {}
        }
        if (!state.rootNode.variations[targetBreakpoint].specificChildren) {
          state.rootNode.variations[targetBreakpoint].specificChildren = []
        }
        state.rootNode.variations[targetBreakpoint].specificChildren!.push(nodeCopy)
      }
      
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
  reorderNode,
  updateNodePosition,
  setDragState,
  startDrag,
  endDrag,
  setViewport,
  addBreakpoint,
  removeBreakpoint,
  updateBreakpoint,
  markAsSaved,
  loadRootNode,
  setZoom,
  setActiveLeftPanel,
  setActiveRightPanel,
  setPanOffset,
  setBlockAlignment,
  setEditMode,
  setActiveEditBreakpoint,
  moveNodeToViewport,
} = editorSlice.actions

// Selectors
export const selectRootNode = (state: RootState) => state.editor.rootNode
export const selectSelectedNodeId = (state: RootState) => state.editor.selectedNodeId
export const selectSelectedNode = (state: RootState) => {
  const { rootNode, selectedNodeId, viewport, editMode } = state.editor
  if (!rootNode || !selectedNodeId) return null
  
  // Ищем узел в эффективном дереве (с учётом вариаций)
  const breakpoint = viewport === 'base' ? null : viewport
  return findNodeInTree(rootNode, selectedNodeId, breakpoint, editMode)
}
export const selectIsDirty = (state: RootState) => state.editor.isDirty
export const selectDragState = (state: RootState) => state.editor.drag
export const selectViewport = (state: RootState) => state.editor.viewport
export const selectBreakpoints = (state: RootState) => state.editor.breakpoints
export const selectZoom = (state: RootState) => state.editor.zoom
export const selectActiveLeftPanel = (state: RootState) => state.editor.activeLeftPanel
export const selectActiveRightPanel = (state: RootState) => state.editor.activeRightPanel
export const selectPanOffset = (state: RootState) => state.editor.panOffset
export const selectBlockAlignment = (state: RootState) => state.editor.blockAlignment
export const selectEditMode = (state: RootState) => state.editor.editMode
export const selectActiveEditBreakpoint = (state: RootState) => state.editor.activeEditBreakpoint

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
