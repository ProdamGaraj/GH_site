import type { BlockNode } from '@/shared/types'
import type { BreakpointLike } from './breakpointRanges'
import { resolveScreenOverrides, type ScreenOverride } from './screenOverrides'

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
 * Накладывает итоговые экранные правки на дерево. Скрытые узлы выпадают из
 * дерева (как `display: none` на сайте); к узлу добавляются его
 * specificChildren выбранного экрана.
 */
function applyScreenOverrides(
  node: BlockNode,
  breakpointId: string,
  overrides: Map<string, ScreenOverride>,
): BlockNodeWithViewport {
  const visible = (child: BlockNode): boolean => !overrides.get(child.id)?.hidden

  const children = (node.children || [])
    .filter(visible)
    .map(child => applyScreenOverrides(child, breakpointId, overrides))
  const specificChildren = (node.variations?.[breakpointId]?.specificChildren || [])
    .filter(visible)
    .map(child => applyScreenOverrides(child, breakpointId, overrides))

  const result = {
    ...node,
    _viewportId: null,
    children: [...children, ...specificChildren],
  } as BlockNodeWithViewport

  const override = overrides.get(node.id)
  if (!override) return result

  return {
    ...result,
    styles: {
      ...result.styles,
      properties: {
        ...(result.styles?.properties || {}),
        ...override.styles,
      },
    },
    attributes: {
      ...result.attributes,
      ...override.attributes,
    },
    content: override.content !== undefined ? override.content : result.content,
  }
}

/**
 * Получить эффективное дерево для конкретного брейкпоинта
 * Объединяет базовое дерево с вариациями
 *
 * В адаптивном режиме экранные правки применяются так же, как на деплое
 * (см. screenOverrides.ts): по id узла из любого места дерева и с каскадом
 * экранов. `breakpoints` нужен для каскада; без него берётся только сам экран.
 */
export function getEffectiveTree(
  baseNode: BlockNode,
  breakpointId: string | null,
  editMode: 'base' | 'responsive',
  breakpoints?: BreakpointLike[],
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
    
    // Рекурсивно обрабатываем дочерние элементы (базовые, без пометки).
    // children может не быть у узла, созданного не редактором (импорт,
    // миграция данных): без запасного [] открытие страницы падало целиком.
    const processedChildren: BlockNodeWithViewport[] = (baseNode.children || []).map(child => ({
      ...getEffectiveTree(child, breakpointId, editMode),
      _viewportId: null
    }))
    
    return {
      ...baseNode,
      _viewportId: null,
      children: [...processedChildren, ...allSpecificChildren]
    } as BlockNodeWithViewport
  }

  return applyScreenOverrides(
    baseNode,
    breakpointId,
    resolveScreenOverrides(baseNode, breakpointId, breakpoints),
  )
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
 * элемента ВСЕГДА в variations корня, тогда как владелец записи — родитель
 * узла (туда пишут updateNodeStyles/setNodeMediaOverride/deleteNode).
 * Рендер теперь показывает и такие записи (см. screenOverrides.ts), но держим
 * их у законного владельца, чтобы у узла была одна запись на экран.
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
 *
 * Эффективное дерево считается ОДИН раз от корня: экранные правки адресуют узлы
 * по id из любого места дерева, поэтому пересчёт от поддерева потерял бы записи,
 * лежащие выше или сбоку.
 */
export function findNodeInTree(
  node: BlockNode,
  nodeId: string,
  breakpointId: string | null,
  editMode: 'base' | 'responsive',
  breakpoints?: BreakpointLike[],
): BlockNode | null {
  const find = (current: BlockNodeWithViewport): BlockNode | null => {
    if (current.id === nodeId) return current
    for (const child of current.children) {
      const found = find(child)
      if (found) return found
    }
    return null
  }
  return find(getEffectiveTree(node, breakpointId, editMode, breakpoints))
}
