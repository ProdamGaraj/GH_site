/**
 * Свайп в существующих каруселях: телефон и планшет.
 *
 * Раньше жест работал у каждой карусели на любом экране с касанием, без
 * настройки. Теперь экраны задаёт атрибут корня data-carousel-swipe (id
 * брейкпоинтов через запятую, см. CarouselRuntime), а без атрибута жеста нет.
 * Чтобы на телефонах ничего не пропало, существующим каруселям прописываются
 * экраны уже 1024 px — телефон и планшет. Решение владельца (2026-09-28).
 *
 * Атрибут, который уже стоит (в том числе пустой — «выключено»), не трогается:
 * это выбор, сделанный в редакторе.
 *
 * Чистое преобразование; запись — migrate-carousel-swipe.ts.
 */
import type { StructureNode, MigrationResult } from './choiceToPlanTypes'
import type { BreakpointDef } from '../types/blockNode'

export const SWIPE_ATTR = 'data-carousel-swipe'

/** Экраны уже этого — телефоны и планшеты: там свайп включён по умолчанию. */
export const DEFAULT_SWIPE_MAX_WIDTH = 1024

export function defaultSwipeScreens(breakpoints: BreakpointDef[]): string[] {
  return breakpoints.filter((bp) => typeof bp.width === 'number' && bp.width < DEFAULT_SWIPE_MAX_WIDTH).map((bp) => bp.id)
}

/** Все узлы дерева, включая экранные вставки (variations.specificChildren). */
function forEachNode(node: StructureNode, visit: (n: StructureNode) => void): void {
  visit(node)
  for (const child of node.children ?? []) forEachNode(child, visit)
  const variations = (node.variations ?? {}) as Record<string, { specificChildren?: StructureNode[] }>
  for (const variation of Object.values(variations)) {
    for (const child of variation?.specificChildren ?? []) forEachNode(child, visit)
  }
}

export function addDefaultSwipe(input: StructureNode, screens: string[]): MigrationResult {
  if (screens.length === 0) throw new Error('Нет экранов для свайпа по умолчанию')
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []
  const value = screens.join(',')

  forEachNode(structure, (node) => {
    const attrs = node.attributes
    if (attrs?.['data-carousel'] !== 'true' || SWIPE_ATTR in attrs) return
    node.attributes = { ...attrs, [SWIPE_ATTR]: value }
    const name = typeof node.metadata?.name === 'string' ? node.metadata.name : node.id
    changes.push(`карусель «${name}»: свайп на экранах ${value}`)
  })

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}
