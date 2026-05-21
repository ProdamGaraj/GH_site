import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { BlockNode, LayoutMode, CSSProperties, CustomBreakpoint, Browser, StandardMonitor } from '@/shared/types'
import { generateId } from '@/shared/utils'
import type { RootState } from '@/app/store'
import { findNodeInTree } from '@/features/editor/utils/variationUtils'
import {
  findNodeById,
  findParentNode,
  isDescendantOf,
  removeNodeFromTree,
  insertNodeIntoTree,
} from '@/features/editor/utils/treeUtils'
import { getLayoutMode } from '@/features/editor/utils/dndUtils'

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
  browsers: Browser[]
  standardMonitors: StandardMonitor[]
  selectedBrowser: string | null  // ID выбранного браузера
  zoom: number
  activeLeftPanel: string | null
  activeRightPanel: string | null
  activeRightPanelTab: 'positioning' | 'colors' | 'content' | 'states' | 'animations' | 'scripts' | 'data' | 'css'
  panOffset: { x: number; y: number }
  blockAlignment: 'left' | 'center' | 'right'
  // Режим редактирования
  editMode: 'base' | 'responsive'
  // При editMode = 'responsive', какой брейкпоинт редактируем
  activeEditBreakpoint: string | null
  // Inline-редактирование блока на странице
  inlineBlockEdit: {
    active: boolean // Режим редактирования блоков активен
    originalStructures: Record<string, BlockNode> // Оригинальные структуры изменённых блоков для отмены
  }
  // Режим превью состояния элемента (hover, active, focus, disabled)
  statePreviewMode: 'none' | 'hover' | 'active' | 'focus' | 'disabled'
  // Цвет фона холста
  canvasColor: string
  // Буфер обмена (для Ctrl+C / Ctrl+V): хранит копию узла без перегенерации id.
  // id регенерируются при pasteFromClipboard, чтобы избежать коллизий.
  clipboard: BlockNode | null
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
    { id: 'desktop-hd', name: 'Desktop HD', width: 1440, height: 900, browserId: 'chrome', icon: 'monitor', color: '#3b82f6' },
    { id: 'desktop-fhd', name: 'Desktop FHD', width: 1920, height: 1080, browserId: 'chrome', icon: 'laptop', color: '#06b6d4' },
    { id: 'tablet', name: 'Tablet', width: 768, height: 1024, browserId: 'safari-mobile', icon: 'tablet', color: '#8b5cf6' },
    { id: 'mobile', name: 'Mobile', width: 375, height: 667, browserId: 'safari-mobile', icon: 'smartphone', color: '#10b981' },
  ],
  browsers: [
    { id: 'chrome', name: 'Google Chrome', viewportHeightOffset: 160, icon: '🌐', isDefault: true },
    { id: 'edge', name: 'Microsoft Edge', viewportHeightOffset: 165, icon: '🔷' },
    { id: 'firefox', name: 'Mozilla Firefox', viewportHeightOffset: 155, icon: '🦊' },
    { id: 'opera', name: 'Opera', viewportHeightOffset: 170, icon: '🎭' },
    { id: 'safari', name: 'Safari (macOS)', viewportHeightOffset: 145, icon: '🧭' },
    { id: 'safari-mobile', name: 'Safari (iOS)', viewportHeightOffset: 90, icon: '📱' },
    { id: 'chrome-mobile', name: 'Chrome (Android)', viewportHeightOffset: 100, icon: '📱' },
  ],
  standardMonitors: [
    { id: 'hd', name: 'HD (1366x768)', width: 1366, height: 768, icon: '🖥️' },
    { id: 'hd-plus', name: 'HD+ (1600x900)', width: 1600, height: 900, icon: '🖥️' },
    { id: 'fhd', name: 'FHD (1920x1080)', width: 1920, height: 1080, icon: '🖥️' },
    { id: 'qhd', name: 'QHD (2560x1440)', width: 2560, height: 1440, icon: '🖥️' },
    { id: '4k', name: '4K (3840x2160)', width: 3840, height: 2160, icon: '🖥️' },
    { id: 'macbook-air-13', name: 'MacBook Air 13"', width: 1440, height: 900, icon: '💻' },
    { id: 'macbook-pro-14', name: 'MacBook Pro 14"', width: 1512, height: 982, icon: '💻' },
    { id: 'macbook-pro-16', name: 'MacBook Pro 16"', width: 1728, height: 1117, icon: '💻' },
    { id: 'ipad-pro-12', name: 'iPad Pro 12.9"', width: 1024, height: 1366, icon: '📱' },
    { id: 'ipad-pro-11', name: 'iPad Pro 11"', width: 834, height: 1194, icon: '📱' },
    { id: 'ipad-air', name: 'iPad Air', width: 820, height: 1180, icon: '📱' },
    { id: 'iphone-15-pro-max', name: 'iPhone 15 Pro Max', width: 430, height: 932, icon: '📱' },
    { id: 'iphone-15-pro', name: 'iPhone 15 Pro', width: 393, height: 852, icon: '📱' },
    { id: 'iphone-se', name: 'iPhone SE', width: 375, height: 667, icon: '📱' },
  ],
  selectedBrowser: 'chrome',  // По умолчанию Chrome
  zoom: 100,
  activeLeftPanel: 'layers',
  activeRightPanel: 'basicSettings',
  activeRightPanelTab: 'positioning',
  panOffset: { x: 0, y: 0 },
  blockAlignment: 'center',
  editMode: 'base',
  activeEditBreakpoint: null,
  inlineBlockEdit: {
    active: false,
    originalStructures: {},
  },
  statePreviewMode: 'none',
  canvasColor: '#ffffff',
  clipboard: null,
}

// Helper to push to history (call after modifying rootNode)
const MAX_HISTORY_SIZE = 50

const pushToHistory = (state: EditorState) => {
  if (!state.rootNode) return
  
  // Deep clone rootNode to avoid reference issues
  const snapshot = JSON.parse(JSON.stringify(state.rootNode))
  
  // If we're not at the end of history, truncate future states
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1)
  }
  
  // Add new state
  state.history.push(snapshot)
  state.historyIndex = state.history.length - 1
  
  // Limit history size
  if (state.history.length > MAX_HISTORY_SIZE) {
    state.history = state.history.slice(state.history.length - MAX_HISTORY_SIZE)
    state.historyIndex = state.history.length - 1
  }
}

/**
 * Глубокое клонирование узла с регенерацией всех id (для duplicate/paste).
 * Корректно переименовывает id во вложенных children и variations.specificChildren;
 * для variations.inheritedOverrides ключи мапятся со старых id на новые
 * (если override ссылался на узел внутри клонированного поддерева).
 */
const cloneWithNewIds = (node: BlockNode): BlockNode => {
  const idMap = new Map<string, string>()

  const clone = (n: BlockNode): BlockNode => {
    const newId = generateId()
    idMap.set(n.id, newId)
    const cloned: BlockNode = {
      ...n,
      id: newId,
      children: (n.children || []).map(clone),
    }
    if (n.variations) {
      const nv: typeof n.variations = {}
      for (const [bpId, variation] of Object.entries(n.variations)) {
        nv[bpId] = {
          ...variation,
          specificChildren: (variation.specificChildren || []).map(clone),
        }
      }
      cloned.variations = nv
    }
    return cloned
  }

  const cloned = clone(node)

  // Второй проход — переписываем inheritedOverrides по idMap.
  const remap = (n: BlockNode): BlockNode => {
    if (n.variations) {
      for (const [bpId, variation] of Object.entries(n.variations)) {
        if (variation.inheritedOverrides) {
          const remapped: typeof variation.inheritedOverrides = {}
          for (const [oldId, override] of Object.entries(variation.inheritedOverrides)) {
            remapped[idMap.get(oldId) || oldId] = override
          }
          n.variations[bpId] = { ...variation, inheritedOverrides: remapped }
        }
      }
    }
    n.children.forEach(remap)
    return n
  }
  return remap(cloned)
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
      
      // При выборе узла открыть basicSettings если панель не выбрана или это elementProperties
      if (action.payload !== null && (!state.activeRightPanel || state.activeRightPanel === 'elementProperties')) {
        state.activeRightPanel = 'basicSettings'
      }
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
      if (node.elementType === 'html-code') {
        defaultStyles.display = 'block'
        defaultStyles.padding = '0px'
        defaultStyles.minHeight = '50px'
        defaultStyles.height = 'auto'
        defaultStyles.width = '100%'
        defaultStyles.border = '1px dashed #8b5cf6'
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
      
      pushToHistory(state)
      state.isDirty = true
      state.selectedNodeId = newNode.id
    },
    
    /**
     * Вставить уже подготовленный BlockNode (id, styles, children — всё своё)
     * в children указанного родителя без применения каких-либо defaults.
     *
     * Используется когда нода создаётся внешним хелпером (напр. createBlockReferenceNode
     * из библиотеки) и её структура не должна модифицироваться editor-defaults.
     *
     * Не поддерживает responsive-вставку (specificChildren вариаций) — для этого
     * используйте addNode.
     */
    insertPreparedNode: (
      state,
      action: PayloadAction<{ parentId: string; node: BlockNode; position?: number; select?: boolean }>
    ) => {
      if (!state.rootNode) return
      const { parentId, node, position, select = true } = action.payload
      if (state.editMode === 'responsive') {
        console.warn('insertPreparedNode не поддерживает responsive-режим, переключитесь в base')
        return
      }

      const insertInto = (current: BlockNode): BlockNode => {
        if (current.id === parentId) {
          const newChildren = [...(current.children || [])]
          if (position !== undefined && position >= 0 && position <= newChildren.length) {
            newChildren.splice(position, 0, node)
          } else {
            newChildren.push(node)
          }
          return { ...current, children: newChildren }
        }
        return { ...current, children: (current.children || []).map(insertInto) }
      }

      state.rootNode = insertInto(state.rootNode)
      pushToHistory(state)
      state.isDirty = true
      if (select) state.selectedNodeId = node.id
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
      
      // Для responsive режима - ищем родительский узел для сохранения override
      const isRootNode = state.rootNode.id === nodeId
      const parentNode = !isRootNode ? findParentNode(state.rootNode, nodeId) : null
      
      // В responsive режиме для не-root узлов сохраняем override в родителе
      if (targetBreakpoint && isResponsiveMode && parentNode && !isRootNode) {
        // Обрабатываем свойства: формируем обновлённые стили
        const updateOverrideInParent = (current: BlockNode): BlockNode => {
          if (current.id === parentNode.id) {
            const variations = current.variations || {}
            const variation = variations[targetBreakpoint] || {}
            const inheritedOverrides = variation.inheritedOverrides || {}
            const currentOverride = inheritedOverrides[nodeId] || {}
            const currentOverrideStyles = currentOverride.styles || {}
            
            // Обрабатываем удаление пустых значений
            const updatedOverrideStyles = { ...currentOverrideStyles }
            if (properties) {
              Object.entries(properties).forEach(([key, value]) => {
                if (value === '' || value === null || value === undefined) {
                  delete updatedOverrideStyles[key]
                } else {
                  updatedOverrideStyles[key] = value
                }
              })
            }
            
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
                      styles: updatedOverrideStyles,
                    },
                  },
                },
              },
              children: current.children.map(updateOverrideInParent),
            }
          }
          return {
            ...current,
            children: current.children.map(updateOverrideInParent),
          }
        }
        
        state.rootNode = updateOverrideInParent(state.rootNode)
        state.isDirty = true
        return
      }
      
      // Базовый режим или root узел - обновляем base стили напрямую в узле
      const updateInNode = (current: BlockNode): BlockNode => {
        if (current.id === nodeId) {
          // Обрабатываем properties: удаляем свойства с пустыми значениями
          const updatedProperties = properties ? { ...(current.styles.properties || {}) } : undefined
          
          if (properties && updatedProperties) {
            Object.entries(properties).forEach(([key, value]) => {
              if (value === '' || value === null || value === undefined) {
                // Удаляем свойство, если значение пустое
                delete updatedProperties[key]
              } else {
                // Обновляем свойство новым значением
                updatedProperties[key] = value
              }
            })
          }
          
          // Базовый режим - обновляем base стили
          return {
            ...current,
            styles: {
              ...current.styles,
              properties: updatedProperties || current.styles.properties,
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
          pushToHistory(state)
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
        const updatedNode = { ...node }
        
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
        pushToHistory(state)
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
      pushToHistory(state)
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
      
      // If target is absolute positioned, update the node's position styles.
      // Use the inferred layout mode rather than the raw `layoutMode` field —
      // legacy data often leaves the field undefined while still rendering as
      // flex via `display: flex`. Without inference, absolute styles wouldn't
      // be stripped on move-into-flex and the block would float in the corner.
      const targetLayoutMode = getLayoutMode(targetParent)
      let nodeToInsert = removed
      if (targetLayoutMode === 'absolute' && absolutePosition) {
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
      } else if (targetLayoutMode === 'flex' || targetLayoutMode === 'grid') {
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
      pushToHistory(state)
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
      pushToHistory(state)
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
    
    // Browser management
    addBrowser: (state, action: PayloadAction<Browser>) => {
      state.browsers.push(action.payload)
    },
    
    removeBrowser: (state, action: PayloadAction<string>) => {
      state.browsers = state.browsers.filter(b => b.id !== action.payload)
    },
    
    updateBrowser: (state, action: PayloadAction<Browser>) => {
      const index = state.browsers.findIndex(b => b.id === action.payload.id)
      if (index !== -1) {
        state.browsers[index] = action.payload
      }
    },
    
    // Standard monitors management
    addStandardMonitor: (state, action: PayloadAction<StandardMonitor>) => {
      state.standardMonitors.push(action.payload)
    },
    
    removeStandardMonitor: (state, action: PayloadAction<string>) => {
      state.standardMonitors = state.standardMonitors.filter(m => m.id !== action.payload)
    },
    
    updateStandardMonitor: (state, action: PayloadAction<StandardMonitor>) => {
      const index = state.standardMonitors.findIndex(m => m.id === action.payload.id)
      if (index !== -1) {
        state.standardMonitors[index] = action.payload
      }
    },
    
    markAsSaved: (state) => {
      state.isDirty = false
    },
    
    markAsDirty: (state) => {
      state.isDirty = true
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
    
    setSelectedBrowser: (state, action: PayloadAction<string | null>) => {
      state.selectedBrowser = action.payload
    },
    
    setActiveLeftPanel: (state, action: PayloadAction<string | null>) => {
      state.activeLeftPanel = action.payload
    },
    
    setActiveRightPanel: (state, action: PayloadAction<string | null>) => {
      state.activeRightPanel = action.payload
    },
    
    setActiveRightPanelTab: (state, action: PayloadAction<'positioning' | 'colors' | 'content' | 'states' | 'animations' | 'scripts' | 'data' | 'css'>) => {
      state.activeRightPanelTab = action.payload
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
    
    // Включить/выключить режим редактирования блоков
    startInlineBlockEdit: (state, action: PayloadAction<string | undefined>) => {
      state.inlineBlockEdit.active = true
      // Если передан nodeId, выбираем этот блок
      if (action.payload) {
        state.selectedNodeId = action.payload
      }
      state.activeRightPanel = 'basicSettings'
    },
    
    // Сохранить оригинальную структуру блока перед изменением (для возможности отмены)
    saveOriginalBlockStructure: (state, action: PayloadAction<string>) => {
      const nodeId = action.payload
      // Сохраняем только если ещё не сохраняли
      if (!state.inlineBlockEdit.originalStructures[nodeId]) {
        const node = findNodeById(state.rootNode!, nodeId)
        if (node) {
          state.inlineBlockEdit.originalStructures[nodeId] = JSON.parse(JSON.stringify(node))
        }
      }
    },
    
    // Отменить inline-редактирование - восстановить все оригинальные структуры
    cancelInlineBlockEdit: (state) => {
      // Восстанавливаем все изменённые блоки
      for (const [nodeId, originalStructure] of Object.entries(state.inlineBlockEdit.originalStructures)) {
        const replaceNode = (node: BlockNode): BlockNode => {
          if (node.id === nodeId) {
            return originalStructure
          }
          return {
            ...node,
            children: node.children.map(replaceNode)
          }
        }
        
        if (state.rootNode) {
          state.rootNode = replaceNode(state.rootNode)
        }
      }
      
      state.inlineBlockEdit = {
        active: false,
        originalStructures: {},
      }
      
      // Возвращаем панель на настройки страницы при выходе из режима редактирования блока
      state.activeRightPanel = 'pageSettings'
    },
    
    // Завершить inline-редактирование (принять изменения)
    finishInlineBlockEdit: (state) => {
      state.inlineBlockEdit = {
        active: false,
        originalStructures: {},
      }
      // Возвращаем панель на настройки страницы при выходе из режима редактирования блока
      state.activeRightPanel = 'pageSettings'
    },
    
    // Установить режим превью состояния
    setStatePreviewMode: (state, action: PayloadAction<'none' | 'hover' | 'active' | 'focus' | 'disabled'>) => {
      state.statePreviewMode = action.payload
    },
    
    // Undo - вернуться к предыдущему состоянию
    undo: (state) => {
      if (state.historyIndex > 0) {
        state.historyIndex -= 1
        state.rootNode = JSON.parse(JSON.stringify(state.history[state.historyIndex]))
        state.isDirty = true
      }
    },
    
    // Redo - вернуться к следующему состоянию
    redo: (state) => {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex += 1
        state.rootNode = JSON.parse(JSON.stringify(state.history[state.historyIndex]))
        state.isDirty = true
      }
    },
    
    // Сохранить текущее состояние в историю (вызывать после значимых изменений)
    saveToHistory: (state) => {
      pushToHistory(state)
    },
    
    // Установить цвет фона холста
    setCanvasColor: (state, action: PayloadAction<string>) => {
      state.canvasColor = action.payload
    },

    /**
     * Атомарно заменить ВЕСЬ массив children указанного родителя.
     *
     * Используется когда нужно заменить дочерние ноды одним history-step'ом —
     * напр. swap template'а карусели в repeat-режиме (один child — единый шаблон).
     *
     * NB: пушит history ОДИН раз. Не выполняет валидацию children — caller
     * сам отвечает за уникальность id (используйте deepCloneNode/remapIds).
     * В responsive-режиме игнорируется (warning), как и insertPreparedNode.
     */
    replaceChildren: (
      state,
      action: PayloadAction<{ parentId: string; children: BlockNode[]; selectFirst?: boolean }>
    ) => {
      if (!state.rootNode) return
      const { parentId, children, selectFirst = false } = action.payload
      if (state.editMode === 'responsive') {
        console.warn('replaceChildren не поддерживает responsive-режим, переключитесь в base')
        return
      }

      let found = false
      const apply = (current: BlockNode): BlockNode => {
        if (current.id === parentId) {
          found = true
          return { ...current, children: [...children] }
        }
        return { ...current, children: (current.children || []).map(apply) }
      }
      state.rootNode = apply(state.rootNode)
      if (!found) return

      pushToHistory(state)
      state.isDirty = true
      if (selectFirst && children.length > 0) {
        state.selectedNodeId = children[0].id
      }
    },

    // ─── C1: clipboard / duplicate / copy / paste ───────────────────
    /**
     * Дублирует узел: создаёт клон с новыми id и вставляет следующим siblingом
     * после оригинала. Нельзя дублировать root.
     */
    duplicateNode: (state, action: PayloadAction<string>) => {
      if (!state.rootNode) return
      const nodeId = action.payload
      if (nodeId === state.rootNode.id) return
      const parent = findParentNode(state.rootNode, nodeId)
      if (!parent) return
      const index = parent.children.findIndex(c => c.id === nodeId)
      if (index < 0) return
      const duplicate = cloneWithNewIds(parent.children[index])
      state.rootNode = insertNodeIntoTree(state.rootNode, parent.id, duplicate, index + 1)
      state.selectedNodeId = duplicate.id
      state.isDirty = true
      pushToHistory(state)
    },

    /**
     * Копирует узел в буфер обмена (id сохраняются; перегенерация — при вставке).
     */
    copyNode: (state, action: PayloadAction<string>) => {
      if (!state.rootNode) return
      const node = findNodeById(state.rootNode, action.payload)
      if (!node) return
      state.clipboard = JSON.parse(JSON.stringify(node))
    },

    /**
     * Вставляет содержимое буфера обмена с регенерацией id. Если выбран root —
     * добавляется последним ребёнком; иначе — siblingом после выбранного.
     */
    pasteFromClipboard: (state) => {
      if (!state.rootNode || !state.clipboard) return
      const selectedId = state.selectedNodeId
      if (!selectedId) return

      let parentId: string
      let insertIndex: number | undefined
      if (selectedId === state.rootNode.id) {
        parentId = state.rootNode.id
        insertIndex = undefined
      } else {
        const parent = findParentNode(state.rootNode, selectedId)
        if (!parent) return
        const idx = parent.children.findIndex(c => c.id === selectedId)
        if (idx < 0) return
        parentId = parent.id
        insertIndex = idx + 1
      }

      const duplicate = cloneWithNewIds(state.clipboard)
      state.rootNode = insertNodeIntoTree(state.rootNode, parentId, duplicate, insertIndex)
      state.selectedNodeId = duplicate.id
      state.isDirty = true
      pushToHistory(state)
    },
  },
})

export const {
  loadEditor,
  createNewEditor,
  selectNode,
  hoverNode,
  addNode,
  insertPreparedNode,
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
  addBrowser,
  removeBrowser,
  updateBrowser,
  addStandardMonitor,
  removeStandardMonitor,
  updateStandardMonitor,
  markAsSaved,
  markAsDirty,
  loadRootNode,
  setZoom,
  setSelectedBrowser,
  setActiveLeftPanel,
  setActiveRightPanel,
  setActiveRightPanelTab,
  setPanOffset,
  setBlockAlignment,
  setEditMode,
  setActiveEditBreakpoint,
  moveNodeToViewport,
  startInlineBlockEdit,
  saveOriginalBlockStructure,
  cancelInlineBlockEdit,
  finishInlineBlockEdit,
  setStatePreviewMode,
  undo,
  redo,
  saveToHistory,
  setCanvasColor,
  replaceChildren,
  duplicateNode,
  copyNode,
  pasteFromClipboard,
} = editorSlice.actions

export const selectClipboard = (state: RootState) => state.editor.clipboard

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
export const selectCanUndo = (state: RootState) => state.editor.historyIndex > 0
export const selectCanRedo = (state: RootState) => state.editor.historyIndex < state.editor.history.length - 1
export const selectDragState = (state: RootState) => state.editor.drag
export const selectViewport = (state: RootState) => state.editor.viewport
export const selectBreakpoints = (state: RootState) => state.editor.breakpoints
export const selectBrowsers = (state: RootState) => state.editor.browsers
export const selectStandardMonitors = (state: RootState) => state.editor.standardMonitors
export const selectSelectedBrowser = (state: RootState) => state.editor.selectedBrowser
export const selectZoom = (state: RootState) => state.editor.zoom
export const selectActiveLeftPanel = (state: RootState) => state.editor.activeLeftPanel
export const selectActiveRightPanel = (state: RootState) => state.editor.activeRightPanel
export const selectActiveRightPanelTab = (state: RootState) => state.editor.activeRightPanelTab
export const selectPanOffset = (state: RootState) => state.editor.panOffset
export const selectBlockAlignment = (state: RootState) => state.editor.blockAlignment
export const selectEditMode = (state: RootState) => state.editor.editMode
export const selectCanvasColor = (state: RootState) => state.editor.canvasColor
export const selectActiveEditBreakpoint = (state: RootState) => state.editor.activeEditBreakpoint
export const selectInlineBlockEdit = (state: RootState) => state.editor.inlineBlockEdit
export const selectStatePreviewMode = (state: RootState) => state.editor.statePreviewMode

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
