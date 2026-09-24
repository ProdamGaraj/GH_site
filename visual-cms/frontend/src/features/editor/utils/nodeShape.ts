import type { BlockNode } from '@/shared/types'

/**
 * Приводит дерево к полной форме BlockNode перед загрузкой в редактор.
 *
 * Редактор везде рассчитывает на children-массив, styles.properties,
 * attributes и metadata (десятки мест вида node.children.map). Узлы,
 * созданные не редактором — импорт, миграции данных, ручные правки в базе, —
 * могут прийти без них, и тогда страница не открывалась вовсе («Cannot read
 * properties of undefined (reading 'map')»). Нормализация в одной точке —
 * при загрузке — дешевле, чем защищать каждое место. После сохранения
 * страница уходит в базу уже в полной форме.
 *
 * Исходное дерево не мутируется.
 */
export function ensureNodeShape(node: BlockNode): BlockNode {
  const raw = node as Partial<BlockNode> & Record<string, unknown>
  const styles = (raw.styles && typeof raw.styles === 'object' ? raw.styles : {}) as BlockNode['styles']
  const variations = raw.variations
    ? Object.fromEntries(
        Object.entries(raw.variations).map(([id, variation]) => [
          id,
          variation && Array.isArray(variation.specificChildren)
            ? { ...variation, specificChildren: variation.specificChildren.map(ensureNodeShape) }
            : variation,
        ])
      )
    : raw.variations
  return {
    ...(raw as BlockNode),
    styles: { ...styles, properties: styles.properties && typeof styles.properties === 'object' ? styles.properties : {} },
    attributes: raw.attributes && typeof raw.attributes === 'object' ? raw.attributes : {},
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    children: Array.isArray(raw.children) ? raw.children.map(ensureNodeShape) : [],
    ...(variations !== undefined ? { variations } : {}),
  } as BlockNode
}
