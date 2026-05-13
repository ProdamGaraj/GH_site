/**
 * Helper'ы для repeat-режима карусели — работа с template-узлом.
 *
 * Конвенция (используется и runtime'ом DataBindingGenerator на public-site):
 *   В repeat-режиме шаблоном слайда служит ПЕРВЫЙ child track-узла,
 *   игнорируя hybrid-static-children (с атрибутом data-carousel-static="true").
 *   Hybrid-MVP: трек может содержать одновременно template + статические слайды.
 *   Static-children рендерятся как есть, template клонируется по числу элементов
 *   источника данных. UI обязан гарантировать единственного НЕ-static ребёнка
 *   в track-е для repeat-режима.
 *
 * Используется RepeatTemplatePicker и (потенциально) E2E-проверками.
 */
import type { BlockNode } from '@/shared/types'
import { deepCloneNode, type InsertMode } from './carouselHelpers'

/** Является ли узел hybrid-static-слайдом (вставлен пользователем рядом с template). */
export function isHybridStaticSlide(node: BlockNode | null | undefined): boolean {
  if (!node) return false
  return node.attributes?.['data-carousel-static'] === 'true'
}

/** Достать template-узел из track-а (первый non-static child) или null. */
export function getRepeatTemplate(track: BlockNode | null | undefined): BlockNode | null {
  if (!track || !Array.isArray(track.children) || track.children.length === 0) return null
  for (const child of track.children) {
    if (!isHybridStaticSlide(child)) return child
  }
  return null
}

/**
 * Источник template'а для UI:
 *   - 'linked' — placeholder с metadata.linkedBlockId
 *   - 'inline' — собственная разметка (любой узел без linkedBlockId)
 *   - null    — template отсутствует
 */
export type RepeatTemplateKind = 'linked' | 'inline' | null

export function getRepeatTemplateKind(track: BlockNode | null | undefined): RepeatTemplateKind {
  const t = getRepeatTemplate(track)
  if (!t) return null
  const linkedId = t.metadata?.linkedBlockId
  return typeof linkedId === 'string' && linkedId.length > 0 ? 'linked' : 'inline'
}

/**
 * Человекочитаемое имя template-узла для секции «Шаблон слайда».
 * Не дублирует логику staticSlidesHelper.getSlideDisplayName, потому что
 * здесь нет index'а и форматирование другое (без 🔗 — иконка рядом в UI).
 */
export function getRepeatTemplateDisplayName(track: BlockNode | null | undefined): string {
  const t = getRepeatTemplate(track)
  if (!t) return ''
  const name = typeof t.metadata?.name === 'string' ? t.metadata.name.trim() : ''
  if (name) return name
  const tag = (t.tagName || t.tag || 'div').toLowerCase()
  return tag
}

/**
 * Превратить linked-template в inline-копию (detach).
 *
 * Стратегия копирования совпадает с createBlockReferenceNode(mode='copy'):
 *   - deep clone полной структуры library-блока с remap всех id;
 *   - удаляем metadata.linkedBlockId (иначе всё ещё считается linked);
 *   - сохраняем metadata.name (если был) — иначе берём имя блока;
 *   - переносим атрибуты, которые были на placeholder'е (data-carousel-slide,
 *     data-bind, любые другие — пользователь мог их явно проставить).
 *
 * @param placeholder  текущий linked-template (то, что в track.children[0])
 * @param fullStructure свежая structure из БД (blockApi.getById)
 * @param blockName    metadata.name из БД (fallback если placeholder.metadata.name пуст)
 */
export function detachLinkedTemplate(
  placeholder: BlockNode,
  fullStructure: BlockNode,
  blockName: string,
  generateId: () => string
): BlockNode {
  const copy = deepCloneNode(fullStructure, generateId)
  copy.metadata = {
    ...(copy.metadata || {}),
    name: copy.metadata?.name || placeholder.metadata?.name || blockName,
  }
  if (copy.metadata.linkedBlockId) delete copy.metadata.linkedBlockId
  // Атрибуты placeholder'а имеют приоритет — там пользователь мог явно
  // выставить data-carousel-slide и любые другие маркеры.
  copy.attributes = {
    ...(copy.attributes || {}),
    ...(placeholder.attributes || {}),
  }
  return copy
}

/**
 * Re-export для удобства caller'ов, которые работают только с этим helper'ом.
 */
export type { InsertMode }
