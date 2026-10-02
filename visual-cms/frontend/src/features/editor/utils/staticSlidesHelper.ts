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

/**
 * Фон под шапкой сайта над этим слайдом — от него зависит цвет текста шапки
 * (скрипт блока «Navigation»). «Авто»: фото CMS оценит при публикации по
 * яркости верха картинки, видео — браузер по кадрам. Ручной выбор главнее.
 */
export const HEADER_THEME_ATTR = 'data-header-theme'
export type SlideHeaderTheme = 'auto' | 'dark' | 'light'

export const SLIDE_HEADER_THEMES: ReadonlyArray<{ value: SlideHeaderTheme; label: string }> = [
  { value: 'auto', label: 'Авто' },
  { value: 'dark', label: 'Тёмный (белая шапка)' },
  { value: 'light', label: 'Светлый (тёмная шапка)' },
]

export function getSlideHeaderTheme(node: BlockNode): SlideHeaderTheme {
  const value = node.attributes?.[HEADER_THEME_ATTR]
  return value === 'dark' || value === 'light' ? value : 'auto'
}

/**
 * Тема на языковой версии слайда — строка перевода data-header-theme.
 * Пусто — как в основном языке (строки нет); «auto» — по фото этого языка,
 * даже если в основном языке тема задана руками.
 */
export type LangHeaderTheme = '' | 'auto' | 'dark' | 'light'

export const LANG_HEADER_THEMES: ReadonlyArray<{ value: LangHeaderTheme; label: string }> = [
  { value: '', label: 'Как в основном языке' },
  { value: 'auto', label: 'Авто — по фото этого языка' },
  { value: 'dark', label: 'Тёмный (белая шапка)' },
  { value: 'light', label: 'Светлый (тёмная шапка)' },
]

export function toLangHeaderTheme(value: string | undefined): LangHeaderTheme {
  return value === 'auto' || value === 'dark' || value === 'light' ? value : ''
}

/** Атрибуты слайда с выбранной темой; «Авто» — без атрибута. Не мутирует вход. */
export function withSlideHeaderTheme(attributes: Record<string, string> | undefined, theme: SlideHeaderTheme): Record<string, string> {
  const next = { ...(attributes || {}) }
  if (theme === 'auto') delete next[HEADER_THEME_ATTR]
  else next[HEADER_THEME_ATTR] = theme
  return next
}

/** true, если слайд — лёгкий placeholder, привязанный к library-блоку. */
export function isLinkedSlide(node: BlockNode): boolean {
  return typeof node.metadata?.linkedBlockId === 'string' && node.metadata.linkedBlockId.length > 0
}
