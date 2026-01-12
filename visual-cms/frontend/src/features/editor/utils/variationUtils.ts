import type { BlockNode } from '@/shared/types'

// Интерфейс для узла с информацией о viewport
export interface BlockNodeWithViewport extends BlockNode {
  _viewportId?: string | null  // null = базовый элемент, string = специфичный для viewport
  children: BlockNodeWithViewport[]
}

/**
 * Рекурсивно проставляет _viewportId всем потомкам
 */
function markChildrenWithViewport(node: BlockNodeWithViewport, viewportId: string): BlockNodeWithViewport {
  return {
    ...node,
    _viewportId: viewportId,
    children: (node.children || []).map(child => markChildrenWithViewport(child, viewportId))
  }
}

/**
 * Получить эффективное дерево для конкретного брейкпоинта
 * Объединяет базовое дерево с вариациями
 */
export function getEffectiveTree(
  baseNode: BlockNode,
  breakpointId: string | null,
  editMode: 'base' | 'responsive'
): BlockNodeWithViewport {
  // В base режиме показываем все элементы (базовые + специфичные для всех брейкпоинтов)
  if (editMode === 'base' || !breakpointId) {
    // Собираем все специфичные элементы из всех вариаций с пометкой viewport
    const allSpecificChildren: BlockNodeWithViewport[] = []
    if (baseNode.variations) {
      Object.entries(baseNode.variations).forEach(([vpId, variation]) => {
        if (variation.specificChildren) {
          variation.specificChildren.forEach(child => {
            // Сначала получаем эффективное дерево
            const processedChild = getEffectiveTree(child, breakpointId, editMode)
            // Затем помечаем всех потомков viewport'ом
            allSpecificChildren.push(markChildrenWithViewport(processedChild, vpId))
          })
        }
      })
    }
    
    // Рекурсивно обрабатываем дочерние элементы (базовые, без пометки)
    const processedChildren: BlockNodeWithViewport[] = baseNode.children.map(child => ({
      ...getEffectiveTree(child, breakpointId, editMode),
      _viewportId: null
    }))
    
    return {
      ...baseNode,
      _viewportId: null,
      children: [...processedChildren, ...allSpecificChildren]
    } as BlockNodeWithViewport
  }

  // Получаем вариацию для текущего брейкпоинта
  const variation = baseNode.variations?.[breakpointId]
  
  if (!variation) {
    // Нет вариации - но всё равно рекурсивно обрабатываем children
    // (у них могут быть свои вариации)
    const processedChildren = (baseNode.children || []).map(child => 
      getEffectiveTree(child, breakpointId, editMode)
    )
    return {
      ...baseNode,
      _viewportId: null,
      children: processedChildren
    } as BlockNodeWithViewport
  }

  // Применяем переопределения к базовым элементам
  const processedChildren = baseNode.children
    .map(child => {
      const override = variation.inheritedOverrides?.[child.id]
      
      // Если элемент скрыт в этой вариации
      if (override?.hidden) {
        return null
      }
      
      // Рекурсивно обрабатываем дочерние элементы
      const processedChild = getEffectiveTree(child, breakpointId, editMode)
      
      // Применяем переопределения стилей и атрибутов
      if (override) {
        return {
          ...processedChild,
          styles: {
            ...processedChild.styles,
            properties: {
              ...processedChild.styles.properties,
              ...override.styles,
            },
          },
          attributes: {
            ...processedChild.attributes,
            ...override.attributes,
          },
          content: override.content !== undefined ? override.content : processedChild.content,
        }
      }
      
      return processedChild
    })
    .filter((child): child is BlockNodeWithViewport => child !== null)

  // Добавляем специфичные для брейкпоинта элементы
  // Рекурсивно обрабатываем их тоже (у них могут быть свои children)
  const specificChildren = (variation.specificChildren || []).map(child => 
    getEffectiveTree(child, breakpointId, editMode)
  )

  return {
    ...baseNode,
    _viewportId: null,
    children: [...processedChildren, ...specificChildren],
  } as BlockNodeWithViewport
}

/**
 * Проверить, является ли элемент специфичным для брейкпоинта
 */
export function isSpecificNode(
  nodeId: string,
  rootNode: BlockNode,
  breakpointId: string
): boolean {
  const variation = rootNode.variations?.[breakpointId]
  if (!variation?.specificChildren) return false
  
  return variation.specificChildren.some(child => child.id === nodeId)
}

/**
 * Проверить, есть ли переопределения для элемента
 */
export function hasOverrides(
  nodeId: string,
  rootNode: BlockNode,
  breakpointId: string
): boolean {
  const variation = rootNode.variations?.[breakpointId]
  return !!variation?.inheritedOverrides?.[nodeId]
}

/**
 * Получить статус элемента (базовый, переопределенный, специфичный, скрытый)
 */
export function getNodeStatus(
  nodeId: string,
  rootNode: BlockNode,
  breakpointId: string
): 'base' | 'overridden' | 'specific' | 'hidden' {
  const variation = rootNode.variations?.[breakpointId]
  
  if (!variation) return 'base'
  
  // Проверяем, специфичный ли элемент
  if (variation.specificChildren?.some(child => child.id === nodeId)) {
    return 'specific'
  }
  
  // Проверяем переопределения
  const override = variation.inheritedOverrides?.[nodeId]
  if (override?.hidden) return 'hidden'
  if (override) return 'overridden'
  
  return 'base'
}

/**
 * Найти к какому брейкпоинту принадлежит специфичный элемент
 * Рекурсивно ищет во всех specificChildren и их потомках
 */
export function getNodeBreakpoint(
  nodeId: string,
  rootNode: BlockNode
): string | null {
  // Рекурсивный поиск в дереве узлов
  const findInTree = (node: BlockNode): boolean => {
    if (node.id === nodeId) return true
    return (node.children || []).some(child => findInTree(child))
  }
  
  // Рекурсивно обходим все узлы в дереве и проверяем их variations
  const searchInNode = (node: BlockNode): string | null => {
    // Проверяем variations текущего узла
    if (node.variations) {
      for (const [breakpointId, variation] of Object.entries(node.variations)) {
        if (variation.specificChildren) {
          // Ищем nodeId в specificChildren и их потомках
          for (const child of variation.specificChildren) {
            if (findInTree(child)) {
              return breakpointId
            }
          }
        }
      }
    }
    
    // Рекурсивно проверяем детей
    for (const child of (node.children || [])) {
      const found = searchInNode(child)
      if (found) return found
    }
    
    return null
  }
  
  return searchInNode(rootNode)
}

/**
 * Найти узел в дереве (включая вариации)
 */
export function findNodeInTree(
  node: BlockNode,
  nodeId: string,
  breakpointId: string | null,
  editMode: 'base' | 'responsive'
): BlockNode | null {
  // Получаем эффективное дерево
  const effectiveNode = getEffectiveTree(node, breakpointId, editMode)
  
  console.log('findNodeInTree:', { 
    searchingFor: nodeId, 
    currentNode: effectiveNode.id,
    breakpointId,
    editMode,
    childrenIds: effectiveNode.children.map(c => c.id)
  })
  
  if (effectiveNode.id === nodeId) return effectiveNode
  
  for (const child of effectiveNode.children) {
    const found = findNodeInTree(child, nodeId, breakpointId, editMode)
    if (found) return found
  }
  
  return null
}
