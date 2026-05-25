import { describe, it, expect } from 'vitest'
import {
  applyDecisionToSelected,
  partitionInstances,
  isAllResolved,
  pluralChanges,
  pluralBlocks,
} from './linkedDecisions'
import type { ChangedLinkedInstance } from '@/shared/api'

const inst = (id: string): ChangedLinkedInstance => ({
  instanceId: id,
  linkedBlockId: `lib-${id}`,
  blockName: `Блок ${id}`,
  changes: [{ kind: 'content', path: id, label: 'изменён текст' }],
})

describe('applyDecisionToSelected', () => {
  it('применяет действие ко всем выбранным, сохраняя прежние решения', () => {
    const next = applyDecisionToSelected({ a: 'revert' }, ['b', 'c'], 'push')
    expect(next).toEqual({ a: 'revert', b: 'push', c: 'push' })
  })

  it('перезаписывает решение для уже решённого инстанса', () => {
    const next = applyDecisionToSelected({ a: 'revert' }, ['a'], 'static')
    expect(next.a).toBe('static')
  })

  it('не мутирует исходную карту', () => {
    const orig = { a: 'push' as const }
    applyDecisionToSelected(orig, ['b'], 'revert')
    expect(orig).toEqual({ a: 'push' })
  })

  it('пустой выбор → карта без изменений (копия)', () => {
    const orig = { a: 'push' as const }
    expect(applyDecisionToSelected(orig, [], 'revert')).toEqual({ a: 'push' })
  })
})

describe('partitionInstances', () => {
  it('делит на pending и decided', () => {
    const instances = [inst('a'), inst('b'), inst('c')]
    const { pending, decided } = partitionInstances(instances, { b: 'push' })
    expect(pending.map((i) => i.instanceId)).toEqual(['a', 'c'])
    expect(decided.map((i) => i.instanceId)).toEqual(['b'])
  })

  it('все решены → pending пуст', () => {
    const instances = [inst('a'), inst('b')]
    const { pending } = partitionInstances(instances, { a: 'push', b: 'revert' })
    expect(pending).toEqual([])
  })
})

describe('isAllResolved', () => {
  it('false, если есть нерешённые', () => {
    expect(isAllResolved([inst('a'), inst('b')], { a: 'push' })).toBe(false)
  })
  it('true, когда решены все', () => {
    expect(isAllResolved([inst('a'), inst('b')], { a: 'push', b: 'static' })).toBe(true)
  })
  it('false для пустого списка (нечего сохранять как «всё решено»)', () => {
    expect(isAllResolved([], {})).toBe(false)
  })
})

describe('русские склонения', () => {
  it('pluralChanges', () => {
    expect(pluralChanges(1)).toBe('изменение')
    expect(pluralChanges(2)).toBe('изменения')
    expect(pluralChanges(5)).toBe('изменений')
    expect(pluralChanges(11)).toBe('изменений')
    expect(pluralChanges(21)).toBe('изменение')
    expect(pluralChanges(112)).toBe('изменений') // mod100=12 → диапазон 11–14
    expect(pluralChanges(122)).toBe('изменения') // mod100=22, mod10=2
  })
  it('pluralBlocks', () => {
    expect(pluralBlocks(1)).toBe('блок')
    expect(pluralBlocks(3)).toBe('блока')
    expect(pluralBlocks(5)).toBe('блоков')
    expect(pluralBlocks(11)).toBe('блоков')
    expect(pluralBlocks(22)).toBe('блока')
  })
})
