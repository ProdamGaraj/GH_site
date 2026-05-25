import { applyCollectionTransforms } from '../utils/collectionTransforms'
import type { DataTransformConfig } from '../services/DataTransformService'

const items = [
  { id: 1, name: 'Alpha', city: 'Tashkent', price: 100 },
  { id: 2, name: 'Beta', city: 'Samarkand', price: 300 },
  { id: 3, name: 'Gamma', city: 'Tashkent', price: 500 },
  { id: 4, name: 'Delta', city: 'Tashkent', price: 300 },
]

const t = (over: Partial<DataTransformConfig>): DataTransformConfig =>
  ({ type: 'include', ...over } as DataTransformConfig)

describe('applyCollectionTransforms', () => {
  it('пустой/отсутствующий список → без изменений', () => {
    expect(applyCollectionTransforms(items, undefined)).toBe(items)
    expect(applyCollectionTransforms(items, [])).toBe(items)
    expect(applyCollectionTransforms(items, null)).toBe(items)
  })

  it('include — оставляет совпавшие по условию', () => {
    const out = applyCollectionTransforms(items, [t({ type: 'include', filter: { field: 'city', operator: 'eq', value: 'Tashkent' } })])
    expect((out as any[]).map(i => i.id)).toEqual([1, 3, 4])
  })

  it('exclude — исключает совпавшие', () => {
    const out = applyCollectionTransforms(items, [t({ type: 'exclude', filter: { field: 'city', operator: 'eq', value: 'Tashkent' } })])
    expect((out as any[]).map(i => i.id)).toEqual([2])
  })

  it('sort — сортирует по полю', () => {
    const out = applyCollectionTransforms(items, [t({ type: 'sort', field: 'price', order: 'desc' })])
    expect((out as any[]).map(i => i.price)).toEqual([500, 300, 300, 100])
  })

  it('limit — ограничивает количество (с offset)', () => {
    expect((applyCollectionTransforms(items, [t({ type: 'limit', limit: 2 })]) as any[]).map(i => i.id)).toEqual([1, 2])
    expect((applyCollectionTransforms(items, [t({ type: 'limit', limit: 2, offset: 1 })]) as any[]).map(i => i.id)).toEqual([2, 3])
  })

  it('unique — убирает дубликаты по полю', () => {
    const out = applyCollectionTransforms(items, [t({ type: 'unique', field: 'city' })])
    expect((out as any[]).map(i => i.city)).toEqual(['Tashkent', 'Samarkand'])
  })

  it('prepend / append — добавляют статические элементы', () => {
    const head = { id: 0, name: 'Head' }
    const tail = { id: 9, name: 'Tail' }
    expect((applyCollectionTransforms(items, [t({ type: 'prepend', staticItems: [head] })]) as any[])[0].id).toBe(0)
    const appended = applyCollectionTransforms(items, [t({ type: 'append', staticItems: [tail] })]) as any[]
    expect(appended[appended.length - 1].id).toBe(9)
  })

  it('цепочка: exclude → sort → limit', () => {
    const out = applyCollectionTransforms(items, [
      t({ type: 'exclude', filter: { field: 'city', operator: 'eq', value: 'Samarkand' } }),
      t({ type: 'sort', field: 'price', order: 'asc' }),
      t({ type: 'limit', limit: 2 }),
    ])
    // Остаются Tashkent: id1=100, id3=500, id4=300 → asc → 100(1),300(4),500(3) → limit 2
    expect((out as any[]).map(i => i.id)).toEqual([1, 4])
  })

  it('пропускает выключенные (enabled:false)', () => {
    const out = applyCollectionTransforms(items, [t({ type: 'exclude', enabled: false, filter: { field: 'city', operator: 'eq', value: 'Tashkent' } })])
    expect(out).toBe(items)
  })

  it('пропускает полуготовые (include без filter.field, sort без field, limit без числа, prepend без items)', () => {
    expect(applyCollectionTransforms(items, [t({ type: 'include' })])).toBe(items)
    expect(applyCollectionTransforms(items, [t({ type: 'sort' })])).toBe(items)
    expect(applyCollectionTransforms(items, [t({ type: 'limit' })])).toBe(items)
    expect(applyCollectionTransforms(items, [t({ type: 'prepend' })])).toBe(items)
  })
})
