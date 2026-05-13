/**
 * Pure helpers for BlockPicker — выделены для прямого unit-тестирования
 * без подъёма jsdom/testing-library в vitest.
 */
import type { Block } from '@/shared/types'

/**
 * Фильтрует список блоков по строке поиска (name / tags / type)
 * и опциональному предикату.
 *
 * - Поиск нечувствителен к регистру.
 * - Пустой `search` означает "не фильтровать по строке".
 * - `filter` применяется первым (если задан).
 */
export function filterBlocks(
  blocks: Block[],
  search: string,
  filter?: (block: Block) => boolean
): Block[] {
  const q = search.trim().toLowerCase()
  return blocks
    .filter((b) => (filter ? filter(b) : true))
    .filter((b) => {
      if (!q) return true
      const tags = Array.isArray(b.tags) ? b.tags.join(' ') : ''
      const hay = `${b.name ?? ''} ${tags} ${b.type ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
}

/**
 * Форматирует ISO-дату в локальный короткий вид.
 * Возвращает '' для пустого/невалидного значения вместо падения.
 */
export function formatBlockDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
