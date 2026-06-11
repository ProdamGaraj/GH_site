import type { BlockNode } from '@/shared/types'

/**
 * Void-теги не могут стать <a> сменой тега: у них нет содержимого, смена тега
 * уничтожит элемент. Их редактор оборачивает в <a> (editorSlice.wrapNodeInLink).
 */
const VOID_TAGS = ['input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']

/** Атрибуты, относящиеся к ссылке; вычищаются при откате блока из ссылки. */
const LINK_ATTRIBUTES = ['href', 'target', 'rel', 'data-page-id']

/**
 * Блок уже превращён в ссылку через «Основные настройки».
 * Инлайн-элемент ссылки (elementType 'link') сюда не попадает — он ссылка по своей природе.
 */
export function isBlockLink(node: BlockNode): boolean {
  return node.tagName === 'a' && node.elementType !== 'link'
}

/**
 * Может ли блок стать ссылкой: исключаем только инлайн-ссылку (она уже ссылка).
 * Обычным блокам меняется тег, void-элементам создаётся обёртка.
 */
export function canBeLink(node: BlockNode): boolean {
  return node.elementType !== 'link'
}

/** Void-элемент: ссылкой делается через обёртку <a>, а не сменой тега. */
export function isVoidTag(node: BlockNode): boolean {
  return VOID_TAGS.includes((node.tagName || '').toLowerCase())
}

/** Обёртка <a>, созданная редактором вокруг void-элемента (editorSlice.wrapNodeInLink). */
export function isLinkWrapper(node: BlockNode | null | undefined): boolean {
  return !!node && node.tagName === 'a' && node.metadata?.isLinkWrapper === true
}

/**
 * Updates для updateNode: превращает блок в ссылку (tagName='a'),
 * запоминая исходный тег в metadata.originalTagName для отката.
 * Не применимо к void-элементам — для них wrapNodeInLink.
 */
export function makeNodeLink(node: BlockNode): Partial<BlockNode> {
  if (!canBeLink(node) || isVoidTag(node) || isBlockLink(node)) return {}
  return {
    tagName: 'a',
    metadata: { ...node.metadata, originalTagName: node.tagName || 'div' },
  }
}

/**
 * Updates для updateNode: откатывает блок-ссылку к исходному тегу
 * и вычищает ссылочные атрибуты (href, target, rel, data-page-id).
 */
export function unmakeNodeLink(node: BlockNode): Partial<BlockNode> {
  if (!isBlockLink(node)) return {}
  const { originalTagName, ...metadata } = node.metadata || {}
  const attributes = { ...node.attributes }
  for (const attr of LINK_ATTRIBUTES) {
    delete attributes[attr]
  }
  return {
    tagName: originalTagName || 'div',
    metadata,
    attributes,
  }
}

/** Есть ли среди потомков узла ссылка (<a>). Сам узел не учитывается. */
export function hasLinkDescendant(node: BlockNode): boolean {
  return (node.children || []).some(
    (child) => child.tagName === 'a' || hasLinkDescendant(child)
  )
}

/** Находится ли узел nodeId внутри ссылки (<a>) в дереве root. Сам узел не учитывается. */
export function hasLinkAncestor(root: BlockNode | null, nodeId: string): boolean {
  if (!root) return false
  const walk = (current: BlockNode, insideLink: boolean): boolean => {
    if (current.id === nodeId) return insideLink
    const nextInside = insideLink || current.tagName === 'a'
    return (current.children || []).some((child) => walk(child, nextInside))
  }
  return walk(root, false)
}
