import { describe, it, expect } from 'vitest'
import type { Block } from '@/shared/types'
import { filterBlocks, formatBlockDate } from './blockPickerHelpers'

const mk = (overrides: Partial<Block>): Block =>
  ({
    id: overrides.id ?? 'id',
    name: overrides.name ?? 'Block',
    type: overrides.type ?? 'container',
    structure: overrides.structure ?? ({} as any),
    isReusable: true,
    isTemplate: false,
    tags: overrides.tags,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  } as Block)

describe('filterBlocks', () => {
  const blocks: Block[] = [
    mk({ id: 'a', name: 'Hero Banner', type: 'container', tags: ['hero', 'top'] }),
    mk({ id: 'b', name: 'Footer', type: 'container', tags: ['site', 'bottom'] }),
    mk({ id: 'c', name: 'Pricing card', type: 'composite', tags: [] }),
    mk({ id: 'd', name: 'CTA Button', type: 'input' }),
  ]

  it('возвращает все блоки для пустого запроса', () => {
    expect(filterBlocks(blocks, '').map((b) => b.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('обрезает пробелы в запросе', () => {
    expect(filterBlocks(blocks, '   ').length).toBe(4)
  })

  it('фильтрует по имени, без учёта регистра', () => {
    expect(filterBlocks(blocks, 'HERO').map((b) => b.id)).toEqual(['a'])
  })

  it('фильтрует по тегу', () => {
    expect(filterBlocks(blocks, 'bottom').map((b) => b.id)).toEqual(['b'])
  })

  it('фильтрует по type', () => {
    expect(filterBlocks(blocks, 'composite').map((b) => b.id)).toEqual(['c'])
  })

  it('возвращает пустой массив, если ничего не нашли', () => {
    expect(filterBlocks(blocks, 'zzz')).toEqual([])
  })

  it('применяет внешний predicate ДО строкового поиска', () => {
    const result = filterBlocks(
      blocks,
      'container',
      (b) => b.id !== 'a'
    )
    // 'a' отрезан predicate'ом, остаётся только 'b' с type=container
    expect(result.map((b) => b.id)).toEqual(['b'])
  })

  it('переживает блок без tags / type', () => {
    const sparse: Block[] = [
      mk({ id: 'x', name: 'Sparse', tags: undefined, type: undefined as any }),
    ]
    expect(filterBlocks(sparse, 'sparse').map((b) => b.id)).toEqual(['x'])
    expect(filterBlocks(sparse, 'nope')).toEqual([])
  })
})

describe('formatBlockDate', () => {
  it('возвращает пустую строку для undefined', () => {
    expect(formatBlockDate(undefined)).toBe('')
  })

  it('возвращает пустую строку для пустой строки', () => {
    expect(formatBlockDate('')).toBe('')
  })

  it('возвращает пустую строку для невалидной даты', () => {
    expect(formatBlockDate('not-a-date')).toBe('')
  })

  it('форматирует валидную ISO-дату', () => {
    const out = formatBlockDate('2026-05-08T10:00:00.000Z')
    // Локаль ru-RU: dd.mm.yyyy. Не проверяем точное число дня (может зависеть от tz),
    // но проверяем формат: 2 цифры . 2 цифры . 4 цифры
    expect(out).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
  })
})
