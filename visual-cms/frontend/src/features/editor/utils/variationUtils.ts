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
 * Миграция легаси-данных: старый deleteNode писал hidden-override удаляемого
 * элемента ВСЕГДА в variations корня, а рендер (getEffectiveTree) читает
 * inheritedOverrides только из variations непосредственного родителя. Такие
 * записи для не-прямых детей корня — мёртвый груз: элемент оставался видимым
 * в редакторе, но скрывался на деплое (StyleGenerator читает всё дерево).
 *
 * Переносим каждый root-override к фактическому родителю узла. Если у родителя
 * уже есть свой override — родительский приоритетнее (мержим поверх).
 * Overrides для прямых детей корня и для неизвестных id не трогаем.
 * Возвращает новый корень (вход не мутируется); без легаси-записей — вход как есть.
 */
export function normalizeLegacyRootOverrides(root: BlockNode): BlockNode {
  const rootOverridesByBp = root.variations
  if (!rootOverridesByBp) return root

  // Индекс nodeId → id родителя (только базовое дерево — туда писал deleteNode).
  const parentIdOf = new Map<string, string>()
  const indexParents = (node: BlockNode): void => {
    for (const child of node.children || []) {
      parentIdOf.set(child.id, node.id)
      indexParents(child)
    }
  }
  indexParents(root)

  // Собираем записи на перенос: bpId → nodeId → override.
  const toMove: Array<{ bpId: string; nodeId: string; override: NonNullable<NonNullable<BlockNode['variations']>[string]['inheritedOverrides']>[string]; parentId: string }> = []
  for (const [bpId, variation] of Object.entries(rootOverridesByBp)) {
    for (const [nodeId, override] of Object.entries(variation.inheritedOverrides || {})) {
      const parentId = parentIdOf.get(nodeId)
      if (parentId && parentId !== root.id) {
        toMove.push({ bpId, nodeId, override, parentId })
      }
    }
  }
  if (toMove.length === 0) return root

  const cloned: BlockNode = JSON.parse(JSON.stringify(root))

  for (const { bpId, nodeId, override, parentId } of toMove) {
    // Удаляем с корня
    delete cloned.variations![bpId].inheritedOverrides![nodeId]

    // Пишем к родителю (его существующие значения приоритетнее)
    const findById = (node: BlockNode, id: string): BlockNode | null => {
      if (node.id === id) return node
      for (const child of node.children || []) {
        const found = findById(child, id)
        if (found) return found
      }
      return null
    }
    const parent = findById(cloned, parentId)
    if (!parent) continue
    if (!parent.variations) parent.variations = {}
    if (!parent.variations[bpId]) parent.variations[bpId] = {}
    if (!parent.variations[bpId].inheritedOverrides) parent.variations[bpId].inheritedOverrides = {}
    parent.variations[bpId].inheritedOverrides![nodeId] = {
      ...override,
      ...parent.variations[bpId].inheritedOverrides![nodeId],
    }
  }

  return cloned
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
  
  if (effectiveNode.id === nodeId) return effectiveNode
  
  for (const child of effectiveNode.children) {
    const found = findNodeInTree(child, nodeId, breakpointId, editMode)
    if (found) return found
  }
  
  return null
}
