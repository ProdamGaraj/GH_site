import React, { useState, useCallback } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectNode, selectSelectedNodeId, selectDragState, selectEditMode, selectRootNode, selectStatePreviewMode, updateNode } from '@/features/editor/editorSlice'
import { useComputedStyles } from '../../hooks/useComputedStyles'
import { cn } from '@/shared/utils'
import type { BlockNode } from '@/shared/types'
import { CSS } from '@dnd-kit/utilities'
import { BlockNodeWithViewport } from '../../utils/variationUtils'
import { DataBindingIndicator, useBlockDataPreview } from '@/features/dataBindings'
import { RepeaterRenderer } from './RepeaterRenderer'

// Text elements that support inline editing
const TEXT_ELEMENTS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'label', 'li']

interface CanvasRendererProps {
  node: BlockNodeWithViewport
  isRoot?: boolean
  editorType?: 'page' | 'block'
  blockAlignment?: 'left' | 'center' | 'right'
  rootNode?: BlockNode  // РџРµСЂРµРґР°РµРј root РґР»СЏ РїСЂРѕРІРµСЂРєРё РІР°СЂРёР°С†РёР№
}

const CanvasRendererComponent: React.FC<CanvasRendererProps> = ({ 
  node, 
  isRoot = false, 
  editorType = 'block', 
  blockAlignment = 'center',
  rootNode,
  libraryBlockId
}) => {
  const dispatch = useAppDispatch()
  const selectedNodeId = useAppSelector(selectSelectedNodeId)
  const dragState = useAppSelector(selectDragState)
  const editMode = useAppSelector(selectEditMode)
  const storeRootNode = useAppSelector(selectRootNode)
  const statePreviewMode = useAppSelector(selectStatePreviewMode)
  const actualRootNode = rootNode || storeRootNode
  const isSelected = selectedNodeId === node.id
  const isDragged = dragState.draggedNodeId === node.id
  const isLocked = node.metadata?.locked || false
  
  // Получаем linkedBlockId для поиска привязок по ID библиотечного блока
  // Для root-элемента в редакторе блоков используем libraryBlockId
  const linkedBlockId = isRoot && libraryBlockId ? libraryBlockId : node.metadata?.linkedBlockId
  
  // Check for repeater binding
  const { isRepeater, hasBinding, bindingType } = useBlockDataPreview(node.id, undefined, linkedBlockId)
  
  // Debug log for containers with potential bindings
  if (node.elementType === 'container' && node.id.includes('1769591959232')) {
    console.log('[CanvasRenderer] Checking container:', { 
      nodeId: node.id, 
      nodeName: node.metadata?.name,
      linkedBlockId, 
      hasBinding, 
      bindingType, 
      isRepeater,
      isRoot
    })
  }
  
  // Inline text editing state - MUST be before any conditional returns
  const [isInlineEditing, setIsInlineEditing] = useState(false)
  const [editText, setEditText] = useState(node.content || '')
  
  // Check if element supports inline editing
  const canEditInline = TEXT_ELEMENTS.includes(node.tagName || '') && node.children.length === 0

  const computedStyles = useComputedStyles(node)
  
  // Применяем стили состояния если режим превью активен
  const getStateStyles = (): React.CSSProperties => {
    if (statePreviewMode === 'none') return {}
    
    const stateStyles = node.styles?.states?.[statePreviewMode]
    if (!stateStyles) return {}
    
    // Конвертируем стили состояния в React.CSSProperties
    return stateStyles as React.CSSProperties
  }
  
  const stateStyles = getStateStyles()

  // Only root and container elements should be droppable
  const isContainer = node.elementType === 'container' || 
    node.tagName === 'div' || 
    node.tagName === 'section' ||
    node.tagName === 'article' ||
    node.tagName === 'header' ||
    node.tagName === 'footer' ||
    node.tagName === 'main' ||
    node.tagName === 'nav' ||
    node.tagName === 'aside'

  // Droppable setup - disable drop into locked blocks
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${node.id}`,
    disabled: !isContainer || isLocked,
    data: {
      type: 'drop-zone',
      node,
      accepts: ['library-item', 'canvas-element'],
    },
  })

  // Draggable setup - don't allow dragging root node or children of locked blocks
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `drag-${node.id}`,
    disabled: isRoot || isLocked,
    data: {
      type: 'canvas-element',
      id: node.id,
      node,
      elementType: node.elementType,
      tagName: node.tagName,
      label: node.metadata.name || node.tagName,
    },
  })

  // Double click to start inline editing - MUST be before conditional return
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (canEditInline && !isLocked) {
      setEditText(node.content || '')
      setIsInlineEditing(true)
    }
  }, [canEditInline, isLocked, node.content])

  // Handle inline edit input - MUST be before conditional return
  const handleInlineInput = useCallback((e: React.FormEvent<HTMLElement>) => {
    setEditText(e.currentTarget.textContent || '')
  }, [])

  // Save inline edit - MUST be before conditional return
  const saveInlineEdit = useCallback(() => {
    if (editText !== node.content) {
      dispatch(updateNode({
        id: node.id,
        updates: { content: editText },
      }))
    }
    setIsInlineEditing(false)
  }, [dispatch, editText, node.content, node.id])

  // Handle inline edit keyboard events - MUST be before conditional return
  const handleInlineKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveInlineEdit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsInlineEditing(false)
    }
  }, [saveInlineEdit])

  // If this block has repeater binding, use RepeaterRenderer
  // This check MUST be after all hooks
  if (isRepeater && !isRoot) {
    return (
      <RepeaterRenderer 
        node={node}
        editorType={editorType}
        blockAlignment={blockAlignment}
        rootNode={actualRootNode || undefined}
        libraryBlockId={libraryBlockId}
      />
    )
  }

  // Combine refs
  const combinedRef = (el: HTMLElement | null) => {
    setDropRef(el)
    setDragRef(el)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isDragging && !isInlineEditing) {
      dispatch(selectNode(node.id))
    }
  }

  // Void elements that cannot have children
  const voidElements = ['input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']
  const isVoidElement = voidElements.includes(node.tagName?.toLowerCase() || '')

  // Style for dragging
  const dragStyle: React.CSSProperties = transform ? {
    transform: CSS.Translate.toString(transform),
  } : {}

  // Build element props
  const elementProps: any = {
    ref: combinedRef,
    style: {
      ...computedStyles,
      ...dragStyle,
      ...stateStyles, // РџСЂРёРјРµРЅСЏРµРј СЃС‚РёР»Рё СЃРѕСЃС‚РѕСЏРЅРёСЏ РїРѕРІРµСЂС… Р±Р°Р·РѕРІС‹С…
      opacity: isDragging ? 0.5 : (stateStyles.opacity ?? computedStyles.opacity),
      // Р”Р»СЏ root СЌР»РµРјРµРЅС‚Р° РІ responsive СЂРµР¶РёРјРµ РґРѕР±Р°РІР»СЏРµРј min-height: 100%
      ...(isRoot && editMode === 'responsive' ? {
        minHeight: '100%',
      } : {}),
      // РќРµ РїРµСЂРµРѕРїСЂРµРґРµР»СЏРµРј СЃС‚РёР»Рё РІ page СЂРµРґР°РєС‚РѕСЂРµ РґР»СЏ С‚РѕС‡РЅРѕРіРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ
      // РўРѕР»СЊРєРѕ РґР»СЏ block СЂРµРґР°РєС‚РѕСЂР° РІ responsive СЂРµР¶РёРјРµ РїСЂРёРјРµРЅСЏРµРј РІС‹СЂР°РІРЅРёРІР°РЅРёРµ
      ...(isRoot && editorType === 'block' && editMode === 'responsive' ? {
        marginLeft: blockAlignment === 'center' ? 'auto' : blockAlignment === 'right' ? 'auto' : '0',
        marginRight: blockAlignment === 'center' ? 'auto' : blockAlignment === 'left' ? 'auto' : '0'
      } : {}),
      // Р”РѕР±Р°РІР»СЏРµРј transition РґР»СЏ РїР»Р°РІРЅРѕСЃС‚Рё
      ...(statePreviewMode !== 'none' && node.styles?.stateTransition ? {
        transition: `${node.styles.stateTransition.properties.join(', ')} ${node.styles.stateTransition.duration}ms ${node.styles.stateTransition.easing}`,
      } : {}),
    },
    className: cn(
      'canvas-element',
      isSelected && 'canvas-element--selected',
      isOver && !isDragged && 'canvas-element--drop-target',
      isDragging && 'canvas-element--dragging',
      isRoot && 'canvas-element--root',
      isInlineEditing && 'canvas-element--inline-editing'
    ),
    'data-element-id': node.id,
    'data-element-name': node.metadata.name || node.tagName,
    'data-layout-mode': node.layoutMode || 'flex',
    onClick: handleClick,
    onDoubleClick: canEditInline ? handleDoubleClick : undefined,
    // Only apply drag attributes/listeners if not root and not locked and not inline editing
    ...(!isRoot && !isLocked && !isInlineEditing ? { ...attributes, ...listeners } : {}),
    // Inline editing props
    ...(isInlineEditing ? {
      contentEditable: true,
      suppressContentEditableWarning: true,
      onInput: handleInlineInput,
      onKeyDown: handleInlineKeyDown,
      onBlur: saveInlineEdit,
    } : {}),
  }

  // Add attributes for specific elements
  if (node.tagName === 'input') {
    elementProps.type = node.attributes?.type || 'text'
    elementProps.placeholder = node.attributes?.placeholder || ''
    elementProps.value = node.content || ''
    elementProps.readOnly = true
  }

  if (node.tagName === 'textarea') {
    elementProps.placeholder = node.attributes?.placeholder || ''
    elementProps.value = node.content || ''
    elementProps.readOnly = true
  }

  if (node.tagName === 'img') {
    elementProps.src = node.attributes?.src || 'https://via.placeholder.com/150'
    elementProps.alt = node.attributes?.alt || ''
  }

  // Handle select elements
  if (node.tagName === 'select') {
    elementProps.value = node.attributes?.value || ''
    elementProps.onChange = () => {} // Read-only in editor
  }

  // Handle option elements - must have value prop
  if (node.tagName === 'option') {
    elementProps.value = node.attributes?.value || node.content || ''
  }

  // Void elements don't have children
  if (isVoidElement) {
    return React.createElement(node.tagName || 'div', elementProps)
  }

  // Textarea should not have children content
  if (node.tagName === 'textarea') {
    return React.createElement(node.tagName, elementProps)
  }

  // Regular elements with children
  return React.createElement(
    node.tagName || 'div',
    elementProps,
    <>
      {/* РўРµРєСЃС‚РѕРІС‹Р№ РєРѕРЅС‚РµРЅС‚ Р±РµР· РѕР±С‘СЂС‚РєРё span РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕРіРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ */}
      {/* Data Binding Indicator */}
      {!isRoot && <DataBindingIndicator blockId={node.id} />}
      {node.content}
      {node.children.map((child) => (
        <CanvasRenderer 
          key={child.id} 
          node={child} 
          editorType={editorType} 
          blockAlignment={blockAlignment}
          rootNode={actualRootNode || undefined}
          libraryBlockId={libraryBlockId}
        />
      ))}
      {/* Empty state indicator for containers - РїРѕРєР°Р·С‹РІР°РµРј С‚РѕР»СЊРєРѕ РїСЂРё СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРё */}
      {isContainer && node.children.length === 0 && !node.content && !isRoot && (
        <div className={cn(
          "flex items-center justify-center min-h-[40px] text-xs text-gray-400 border border-dashed border-gray-300 rounded m-1",
          isOver && "border-blue-400 bg-blue-50 text-blue-500"
        )}>
          {isOver ? 'РћС‚РїСѓСЃС‚РёС‚Рµ' : 'РџСѓСЃС‚Рѕ'}
        </div>
      )}
    </>
  )
}

// Memoize component - re-render only if node.id or selectedNodeId changed
export const CanvasRenderer = React.memo(CanvasRendererComponent, (prevProps, nextProps) => {
  // Re-render only if node itself or its id changed
  return prevProps.node === nextProps.node && 
         prevProps.isRoot === nextProps.isRoot &&
         prevProps.editorType === nextProps.editorType &&
         prevProps.blockAlignment === nextProps.blockAlignment
})



