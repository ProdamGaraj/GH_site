/**
 * Подготовка узлов к записи в библиотеку блоков.
 *
 * Инвариант библиотеки: блок хранит эталонную структуру и сам не является
 * linked-инстансом. linkedBlockId/styleOverrides на корне — артефакты инстанса
 * со страницы: если записать их как есть, блок в библиотеке получает ссылку сам
 * на себя и «ломается» на всех страницах. Вложенные linkedBlockId не трогаем —
 * это легальные ссылки на другие блоки.
 *
 * Зеркалит серверную защиту (BlockController.stripInstanceArtifacts,
 * LinkedBlocksService._cleanForLibrary): фронт чистит сам, а сервер страхует.
 */
import type { BlockNode } from '@/shared/types'

/**
 * Узел является схлопнутым placeholder'ом linked-блока: ссылка есть, контента нет.
 * Такой узел означает «подставь структуру из библиотеки при чтении», а не
 * «вот моя структура» — пушить его в библиотеку нельзя (затрёт блок пустышкой).
 */
export function isLinkedPlaceholder(node: BlockNode): boolean {
  return Boolean(node.metadata?.linkedBlockId) && (!Array.isArray(node.children) || node.children.length === 0)
}

/**
 * Возвращает копию узла, готовую к записи в библиотеку:
 * - рекурсивно убирает служебный _viewportId;
 * - с корня срезает metadata.linkedBlockId и metadata.styleOverrides.
 * Исходный узел (Redux-state) не мутируется.
 */
export function cleanForLibrary(node: BlockNode): BlockNode {
  const cleaned = stripViewportIds(node)
  if (cleaned.metadata) {
    const metadata: Record<string, unknown> = { ...cleaned.metadata }
    delete metadata.linkedBlockId
    delete metadata.styleOverrides
    cleaned.metadata = metadata as BlockNode['metadata']
  }
  return cleaned
}

/**
 * Рекурсивно убирает служебное поле _viewportId (артефакт responsive-рендера).
 * Каждый узел копируется, поэтому результат можно безопасно дорабатывать на корне.
 */
export function stripViewportIds(node: BlockNode): BlockNode {
  const { _viewportId, ...rest } = node as BlockNode & { _viewportId?: string }
  return {
    ...rest,
    children: (node.children || []).map(stripViewportIds),
  }
}
