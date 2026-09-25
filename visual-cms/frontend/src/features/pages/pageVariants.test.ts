import { describe, it, expect } from 'vitest'
import { groupByAddress, occupantOf, type VariantPage } from './pageVariants'

const page = (id: string, status: VariantPage['status'], slug = 'harizma', siteId: string | null = 's1'): VariantPage =>
  ({ id, name: id, slug, status, siteId })

describe('groupByAddress', () => {
  it('варианты одного адреса — одна группа, опубликованный первым, остальные в исходном порядке', () => {
    const groups = groupByAddress([page('d1', 'draft'), page('about', 'published', 'about'), page('pub', 'published'), page('d2', 'draft')])
    expect(groups.map((g) => g.slug)).toEqual(['harizma', 'about'])
    expect(groups[0].pages.map((p) => p.id)).toEqual(['pub', 'd1', 'd2'])
    expect(groups[0].published?.id).toBe('pub')
  })

  it('одинаковый slug в разных сайтах и без сайта — разные адреса', () => {
    const groups = groupByAddress([page('a', 'published', 'x', 's1'), page('b', 'published', 'x', 's2'), page('c', 'draft', 'x', null)])
    expect(groups).toHaveLength(3)
  })

  it('адрес без опубликованного — группа черновиков без published', () => {
    const [group] = groupByAddress([page('d1', 'draft'), page('d2', 'archived')])
    expect(group.published).toBeUndefined()
    expect(group.pages.map((p) => p.id)).toEqual(['d1', 'd2'])
  })
})

describe('occupantOf', () => {
  const [group] = groupByAddress([page('pub', 'published'), page('d1', 'draft')])

  it('для черновика — опубликованный вариант того же адреса', () => {
    expect(occupantOf(group.pages[1], group)?.id).toBe('pub')
  })

  it('для самого опубликованного и для свободного адреса — никого', () => {
    expect(occupantOf(group.pages[0], group)).toBeUndefined()
    const [free] = groupByAddress([page('d1', 'draft')])
    expect(occupantOf(free.pages[0], free)).toBeUndefined()
  })
})
