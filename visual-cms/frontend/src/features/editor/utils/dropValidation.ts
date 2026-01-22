/**
 * Drop Validation System
 * 
 * Валидация перетаскивания элементов на canvas
 * - Проверка циклических ссылок
 * - Проверка совместимости layout
 * - Проверка допустимых контейнеров для элементов
 */

import type { BlockNode } from '@/shared/types'

export interface DropValidationResult {
  isValid: boolean
  reason?: string
  warning?: string
  suggestion?: string
}

export interface DropContext {
  /** Элемент, который перетаскивают */
  draggedNode: BlockNode | null
  /** Элемент библиотеки (при drag из LibraryPanel) */
  libraryItem?: {
    tagName: string
    elementType: string
    label: string
  }
  /** Контейнер, куда пытаются бросить */
  targetNode: BlockNode
  /** Корень дерева для проверки циклов */
  rootNode: BlockNode
}

/**
 * Проверка на циклическую ссылку
 * Нельзя перемещать элемент в его собственных потомков
 */
export const checkCyclicReference = (
  draggedId: string,
  targetNode: BlockNode
): boolean => {
  // Проверяем, является ли target потомком dragged
  const checkChildren = (node: BlockNode): boolean => {
    if (node.id === draggedId) return true
    for (const child of node.children) {
      if (checkChildren(child)) return true
    }
    return false
  }
  
  // Начинаем с target и проверяем его детей
  return checkChildren(targetNode)
}

/**
 * Найти родителя элемента
 */
export const findParentNode = (
  root: BlockNode,
  nodeId: string
): BlockNode | null => {
  const findParent = (current: BlockNode): BlockNode | null => {
    for (const child of current.children) {
      if (child.id === nodeId) return current
      const found = findParent(child)
      if (found) return found
    }
    return null
  }
  return findParent(root)
}

/**
 * Карта совместимости тегов
 * Определяет, какие элементы могут быть детьми каких контейнеров
 */
const CONTAINER_COMPATIBILITY: Record<string, {
  allowedChildren: string[]
  forbiddenChildren: string[]
  preferredChildren?: string[]
}> = {
  // Семантические контейнеры
  'ul': {
    allowedChildren: ['li'],
    forbiddenChildren: [],
    preferredChildren: ['li'],
  },
  'ol': {
    allowedChildren: ['li'],
    forbiddenChildren: [],
    preferredChildren: ['li'],
  },
  'table': {
    allowedChildren: ['thead', 'tbody', 'tfoot', 'tr', 'caption', 'colgroup'],
    forbiddenChildren: ['div', 'p', 'span', 'section'],
  },
  'thead': {
    allowedChildren: ['tr'],
    forbiddenChildren: [],
  },
  'tbody': {
    allowedChildren: ['tr'],
    forbiddenChildren: [],
  },
  'tr': {
    allowedChildren: ['td', 'th'],
    forbiddenChildren: [],
  },
  'select': {
    allowedChildren: ['option', 'optgroup'],
    forbiddenChildren: [],
  },
  'optgroup': {
    allowedChildren: ['option'],
    forbiddenChildren: [],
  },
  // Form elements
  'form': {
    allowedChildren: ['*'],
    forbiddenChildren: ['form'], // Нельзя вкладывать формы
  },
  // Inline elements - не должны содержать блочные
  'a': {
    allowedChildren: ['span', 'img', 'strong', 'em', 'b', 'i', 'br'],
    forbiddenChildren: ['div', 'section', 'article', 'header', 'footer', 'a'],
  },
  'p': {
    allowedChildren: ['span', 'a', 'strong', 'em', 'b', 'i', 'br', 'img'],
    forbiddenChildren: ['div', 'section', 'article', 'p', 'header', 'footer', 'ul', 'ol'],
  },
  'span': {
    allowedChildren: ['span', 'a', 'strong', 'em', 'b', 'i', 'br'],
    forbiddenChildren: ['div', 'section', 'article', 'p', 'header', 'footer'],
  },
  // Button - ограниченный набор
  'button': {
    allowedChildren: ['span', 'img', 'strong', 'em', 'b', 'i'],
    forbiddenChildren: ['button', 'a', 'input', 'select', 'textarea', 'form'],
  },
  // Void elements - не могут содержать детей
  'input': { allowedChildren: [], forbiddenChildren: ['*'] },
  'img': { allowedChildren: [], forbiddenChildren: ['*'] },
  'br': { allowedChildren: [], forbiddenChildren: ['*'] },
  'hr': { allowedChildren: [], forbiddenChildren: ['*'] },
  'area': { allowedChildren: [], forbiddenChildren: ['*'] },
}

/**
 * Проверка совместимости дочернего элемента с контейнером
 */
export const checkContainerCompatibility = (
  containerTagName: string,
  childTagName: string
): DropValidationResult => {
  const containerRules = CONTAINER_COMPATIBILITY[containerTagName.toLowerCase()]
  
  if (!containerRules) {
    // Для контейнеров без правил разрешаем все
    return { isValid: true }
  }
  
  const childTag = childTagName.toLowerCase()
  
  // Проверка на void element
  if (containerRules.forbiddenChildren.includes('*')) {
    return {
      isValid: false,
      reason: `<${containerTagName}> не может содержать дочерние элементы`,
    }
  }
  
  // Проверка на запрещенные
  if (containerRules.forbiddenChildren.includes(childTag)) {
    return {
      isValid: false,
      reason: `<${childTagName}> не может быть внутри <${containerTagName}>`,
    }
  }
  
  // Проверка на разрешенные (если список не пустой и не '*')
  if (
    containerRules.allowedChildren.length > 0 &&
    !containerRules.allowedChildren.includes('*') &&
    !containerRules.allowedChildren.includes(childTag)
  ) {
    return {
      isValid: false,
      reason: `<${containerTagName}> может содержать только: ${containerRules.allowedChildren.join(', ')}`,
      suggestion: containerRules.preferredChildren 
        ? `Рекомендуется использовать: ${containerRules.preferredChildren.join(', ')}`
        : undefined,
    }
  }
  
  // Предупреждение о предпочтительных элементах
  if (containerRules.preferredChildren && !containerRules.preferredChildren.includes(childTag)) {
    return {
      isValid: true,
      warning: `Для <${containerTagName}> рекомендуется использовать: ${containerRules.preferredChildren.join(', ')}`,
    }
  }
  
  return { isValid: true }
}

/**
 * Проверка совместимости layout
 * Предупреждения о потенциальных проблемах с layout
 */
export const checkLayoutCompatibility = (
  targetNode: BlockNode,
  childTagName: string
): DropValidationResult => {
  const display = targetNode.styles?.properties?.display
  
  // Предупреждения для grid/flex контейнеров
  if (display === 'flex' || display === 'grid') {
    const inlineElements = ['span', 'a', 'strong', 'em', 'b', 'i', 'br']
    if (inlineElements.includes(childTagName.toLowerCase())) {
      return {
        isValid: true,
        warning: `Inline элемент <${childTagName}> в ${display} контейнере может вести себя неожиданно`,
      }
    }
  }
  
  // Предупреждение для absolute элементов
  const position = targetNode.styles?.properties?.position
  if (position === 'static' && childTagName === 'div') {
    // Можем позже добавить проверку на absolute позиционирование ребенка
  }
  
  return { isValid: true }
}

/**
 * Главная функция валидации drop
 */
export const validateDrop = (context: DropContext): DropValidationResult => {
  const { draggedNode, libraryItem, targetNode } = context
  
  // Получаем tagName перетаскиваемого элемента
  const draggedTagName = draggedNode?.tagName || libraryItem?.tagName || 'div'
  
  // 1. Проверка на циклическую ссылку (только для canvas elements)
  if (draggedNode) {
    if (checkCyclicReference(draggedNode.id, targetNode)) {
      return {
        isValid: false,
        reason: 'Нельзя переместить элемент внутрь его собственных потомков',
      }
    }
    
    // Проверка на перемещение в себя
    if (draggedNode.id === targetNode.id) {
      return {
        isValid: false,
        reason: 'Элемент не может быть перемещен в самого себя',
      }
    }
  }
  
  // 2. Проверка совместимости контейнера
  const containerResult = checkContainerCompatibility(targetNode.tagName, draggedTagName)
  if (!containerResult.isValid) {
    return containerResult
  }
  
  // 3. Проверка совместимости layout
  const layoutResult = checkLayoutCompatibility(targetNode, draggedTagName)
  
  // Объединяем warnings
  const warnings = [containerResult.warning, layoutResult.warning].filter(Boolean).join('. ')
  
  return {
    isValid: true,
    warning: warnings || undefined,
    suggestion: containerResult.suggestion,
  }
}

/**
 * Хук для использования валидации в компонентах
 */
export const useDropValidation = () => {
  return {
    validateDrop,
    checkCyclicReference,
    checkContainerCompatibility,
    checkLayoutCompatibility,
  }
}

export default validateDrop
