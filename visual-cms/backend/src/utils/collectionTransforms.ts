/**
 * Серверные трансформации элементов коллекции — тот же механизм, что и у
 * дата-биндингов (include/exclude по условию, sort, limit, unique, prepend, append).
 *
 * Переиспользует DataTransformService.applyDataTransform (и фронтовый TransformsEditor
 * сериализует ровно в этот же DataTransformConfig), поэтому маппинг не нужен.
 *
 * Полуготовые трансформации пропускаются, чтобы случайно не обнулить выборку:
 *  - include/exclude без filter.field;
 *  - sort/unique без field;
 *  - limit без положительного limit;
 *  - prepend/append без staticItems.
 */
import { dataTransformService, type DataTransformConfig } from '../services/DataTransformService'

function isApplicable(t: DataTransformConfig): boolean {
  if (!t || t.enabled === false) return false
  switch (t.type) {
    case 'include':
    case 'exclude':
      return !!t.filter && !!t.filter.field && String(t.filter.field).trim() !== ''
    case 'sort':
    case 'unique':
      return !!t.field && String(t.field).trim() !== ''
    case 'limit':
      return typeof t.limit === 'number' && t.limit > 0
    case 'prepend':
    case 'append':
      return Array.isArray(t.staticItems) && t.staticItems.length > 0
    default:
      return false
  }
}

/**
 * Последовательно применяет трансформации к элементам коллекции.
 * Пустой/отсутствующий список — массив без изменений.
 */
export function applyCollectionTransforms<T = unknown>(items: T[], transforms?: DataTransformConfig[] | null): T[] {
  if (!Array.isArray(items) || items.length === 0) return items
  if (!Array.isArray(transforms) || transforms.length === 0) return items

  let result: unknown[] = items
  for (const t of transforms) {
    if (!isApplicable(t)) continue
    result = dataTransformService.applyDataTransform(result, t)
  }
  return result as T[]
}
