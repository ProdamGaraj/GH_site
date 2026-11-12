import type { BlockNode } from '@/shared/types'

/**
 * Общий CSS/JS библиотечного блока, редактируемый из редактора СТРАНИЦЫ.
 *
 * На странице linked-блок развёрнут: его корень несёт `metadata.linkedBlockId` и
 * `metadata.globalCss/globalJs` из библиотеки. Правка пишется в этот корень, на
 * сохранении бэкенд видит расхождение с библиотекой (linkedBlockDiff) и спрашивает
 * «в библиотеку / статический / откатить».
 *
 * CSS/JS принадлежит БЛОКУ, а не вставке: если блок вставлен на страницу несколько
 * раз, правка применяется ко всем вставкам сразу — иначе в канвасе одновременно
 * действовали бы старые и новые правила (дедуп на деплое только по точному тексту).
 *
 * Модуль чистый (без Redux/DOM) — покрыт unit-тестами.
 */

export type BlockAssetField = 'globalCss' | 'globalJs'

/** Дети узла, которые попадают в HTML: children + specificChildren вариаций. */
function childrenOf(node: BlockNode): BlockNode[] {
  const out: BlockNode[] = [...(node.children || [])]
  if (node.variations) {
    for (const variation of Object.values(node.variations)) {
      if (variation?.specificChildren) out.push(...variation.specificChildren)
    }
  }
  return out
}

/**
 * Ближайший linked-инстанс, которому принадлежит узел: сам узел, если он корень
 * linked-блока, иначе ближайший предок с `linkedBlockId`. Корень дерева не
 * учитывается — это страница (или сам блок в редакторе блока), а не вставка.
 * Для вложенного блока возвращается ВНУТРЕННИЙ (ближайший) инстанс.
 */
export function findOwningLinkedInstance(root: BlockNode | null, nodeId: string | null): BlockNode | null {
  if (!root || !nodeId) return null

  const visit = (node: BlockNode, owner: BlockNode | null, isRoot: boolean): BlockNode | null | undefined => {
    const current = !isRoot && node.metadata?.linkedBlockId ? node : owner
    if (node.id === nodeId) return current
    for (const child of childrenOf(node)) {
      const found = visit(child, current, false)
      if (found !== undefined) return found
    }
    return undefined // узел не найден в этом поддереве
  }

  return visit(root, null, true) ?? null
}

/** Сколько вставок блока `linkedBlockId` в дереве (корень дерева не считается). */
export function countLinkedInstances(root: BlockNode | null, linkedBlockId: string): number {
  if (!root || !linkedBlockId) return 0
  let count = 0
  const visit = (node: BlockNode, isRoot: boolean) => {
    if (!isRoot && node.metadata?.linkedBlockId === linkedBlockId) count++
    childrenOf(node).forEach((child) => visit(child, false))
  }
  visit(root, true)
  return count
}

/**
 * Возвращает новое дерево, где у ВСЕХ вставок блока `linkedBlockId` поле
 * `metadata[field]` = value. Пустая строка удаляет поле (как редактор корня).
 * Неизменённые поддеревья сохраняют ссылки (дешёвый ре-рендер).
 */
export function setLinkedBlockAsset(
  root: BlockNode,
  linkedBlockId: string,
  field: BlockAssetField,
  value: string,
): BlockNode {
  const visit = (node: BlockNode, isRoot: boolean): BlockNode => {
    let next = node

    if (!isRoot && node.metadata?.linkedBlockId === linkedBlockId) {
      const metadata = { ...node.metadata }
      if (value) metadata[field] = value
      else delete metadata[field]
      next = { ...next, metadata }
    }

    const children = node.children || []
    const newChildren = children.map((child) => visit(child, false))
    if (newChildren.some((c, i) => c !== children[i])) next = { ...next, children: newChildren }

    if (node.variations) {
      let variationsChanged = false
      const variations = Object.fromEntries(
        Object.entries(node.variations).map(([bpId, variation]) => {
          const specific = variation?.specificChildren
          if (!specific) return [bpId, variation]
          const newSpecific = specific.map((child) => visit(child, false))
          if (newSpecific.every((c, i) => c === specific[i])) return [bpId, variation]
          variationsChanged = true
          return [bpId, { ...variation, specificChildren: newSpecific }]
        }),
      )
      if (variationsChanged) next = { ...next, variations }
    }

    return next
  }

  return visit(root, true)
}
