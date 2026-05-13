import type { BlockNode } from '@/shared/types'

/**
 * Хелперы для static-режима карусели (heterogeneous-слайды).
 *
 * Слайдом считается прямой child карусельного track-узла. Каждому слайду
 * выставляется атрибут data-carousel-slide="true" — это маркер для
 * CarouselRuntime на public-site, чтобы он правильно вычислял индексы.
 */

export const SLIDE_ATTR = 'data-carousel-slide'

/** Достать список слайдов (children трека) с null-guard'ом. */
export function getSlideChildren(track: BlockNode | null | undefined): BlockNode[] {
  if (!track || !Array.isArray(track.children)) return []
  return track.children
}

/**
 * Гарантировать наличие data-carousel-slide="true" на ноде. Возвращает копию.
 * Не мутирует вход.
 */
export function withSlideAttribute(node: BlockNode): BlockNode {
  if (node.attributes && node.attributes[SLIDE_ATTR] === 'true') {
    return node
  }
  return {
    ...node,
    attributes: { ...(node.attributes || {}), [SLIDE_ATTR]: 'true' },
  }
}

/**
 * Человекочитаемое имя слайда для UI:
 *   1) metadata.name (если строка),
 *   2) "🔗 <name>" если это linked-placeholder,
 *   3) "<TagName> <index+1>" как fallback.
 */
export function getSlideDisplayName(node: BlockNode, index: number): string {
  const meta = node.metadata || {}
  const linked = typeof meta.linkedBlockId === 'string' && meta.linkedBlockId.length > 0
  const name = typeof meta.name === 'string' && meta.name.trim().length > 0 ? meta.name.trim() : null

  if (name) return linked ? `🔗 ${name}` : name

  const tag = (node.tagName || node.tag || 'div').toLowerCase()
  return `${tag} ${index + 1}`
}

/** true, если слайд — лёгкий placeholder, привязанный к library-блоку. */
export function isLinkedSlide(node: BlockNode): boolean {
  return typeof node.metadata?.linkedBlockId === 'string' && node.metadata.linkedBlockId.length > 0
}
