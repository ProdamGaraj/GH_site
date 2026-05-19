import { describe, it, expect } from 'vitest'
import {
  buildSlots,
  distanceToSlot,
  pickBestSlot,
  type Slot,
  type ChildRect,
  type Point,
  type RankedSlot,
} from './slotProximity'

const rect = (left: number, top: number, w: number, h: number): DOMRect =>
  ({
    left,
    top,
    width: w,
    height: h,
    right: left + w,
    bottom: top + h,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect)

const child = (id: string, l: number, t: number, w: number, h: number): ChildRect => ({
  id,
  rect: rect(l, t, w, h),
})

const rankSlots = (slots: Slot[], cursor: Point, depth = 0): RankedSlot[] =>
  slots.map(s => ({ slot: s, distance: distanceToSlot(cursor, s), depth }))

describe('distanceToSlot', () => {
  const vSlot: Slot = {
    containerId: 'c',
    position: 0,
    orientation: 'vertical',
    line: { x1: 50, y1: 0, x2: 50, y2: 100 },
    beforeId: null,
    afterId: null,
  }
  const hSlot: Slot = {
    containerId: 'c',
    position: 0,
    orientation: 'horizontal',
    line: { x1: 0, y1: 50, x2: 100, y2: 50 },
    beforeId: null,
    afterId: null,
  }

  it('vertical slot: point on the line is distance 0', () => {
    expect(distanceToSlot({ x: 50, y: 50 }, vSlot)).toBe(0)
  })

  it('vertical slot: horizontal offset inside vertical span', () => {
    expect(distanceToSlot({ x: 60, y: 50 }, vSlot)).toBe(10)
    expect(distanceToSlot({ x: 40, y: 50 }, vSlot)).toBe(10)
  })

  it('vertical slot: above the line uses euclidean distance to endpoint', () => {
    expect(distanceToSlot({ x: 50, y: -10 }, vSlot)).toBe(10)
    expect(distanceToSlot({ x: 53, y: -4 }, vSlot)).toBeCloseTo(5)
  })

  it('horizontal slot: vertical offset inside horizontal span', () => {
    expect(distanceToSlot({ x: 50, y: 40 }, hSlot)).toBe(10)
  })

  it('horizontal slot: point past the right end uses euclidean distance', () => {
    expect(distanceToSlot({ x: 103, y: 54 }, hSlot)).toBeCloseTo(5)
  })
})

describe('buildSlots', () => {
  it('empty container produces a single inside slot', () => {
    const slots = buildSlots('c', rect(0, 0, 100, 100), [], 'vertical')
    expect(slots).toHaveLength(1)
    expect(slots[0].position).toBe(0)
    expect(slots[0].orientation).toBe('vertical')
  })

  it('N children in a row produce N+1 vertical slots', () => {
    const children = [
      child('a', 0, 0, 50, 50),
      child('b', 50, 0, 50, 50),
      child('c', 100, 0, 50, 50),
    ]
    const slots = buildSlots('p', rect(0, 0, 150, 50), children, 'vertical')
    expect(slots).toHaveLength(4)
    expect(slots.map(s => s.position)).toEqual([0, 1, 2, 3])
    expect(slots.every(s => s.orientation === 'vertical')).toBe(true)
  })

  it('touching children: between-slot lies exactly on the shared boundary', () => {
    const children = [child('a', 0, 0, 50, 50), child('b', 50, 0, 50, 50)]
    const slots = buildSlots('p', rect(0, 0, 100, 50), children, 'vertical')
    const between = slots.find(s => s.position === 1)!
    expect(between.line.x1).toBe(50)
    expect(between.line.x2).toBe(50)
  })

  it('children with a gap: between-slot lies in the middle of the gap', () => {
    const children = [child('a', 0, 0, 40, 50), child('b', 60, 0, 40, 50)]
    const slots = buildSlots('p', rect(0, 0, 100, 50), children, 'vertical')
    const between = slots.find(s => s.position === 1)!
    expect(between.line.x1).toBe(50)
  })

  it('column flow produces horizontal slots', () => {
    const children = [child('a', 0, 0, 100, 50), child('b', 0, 50, 100, 50)]
    const slots = buildSlots('p', rect(0, 0, 100, 100), children, 'horizontal')
    expect(slots).toHaveLength(3)
    expect(slots.every(s => s.orientation === 'horizontal')).toBe(true)
    const between = slots.find(s => s.position === 1)!
    expect(between.line.y1).toBe(50)
  })

  it('children in unsorted order are sorted before building slots', () => {
    const children = [
      child('c', 100, 0, 50, 50),
      child('a', 0, 0, 50, 50),
      child('b', 50, 0, 50, 50),
    ]
    const slots = buildSlots('p', rect(0, 0, 150, 50), children, 'vertical')
    // First (before) slot at x=0; last (after) slot at x=150
    expect(slots[0].line.x1).toBe(0)
    expect(slots[slots.length - 1].line.x1).toBe(150)
  })
})

describe('pickBestSlot', () => {
  const mk = (dist: number, depth: number): RankedSlot => ({
    slot: {
      containerId: 'x',
      position: 0,
      orientation: 'vertical',
      line: { x1: 0, y1: 0, x2: 0, y2: 0 },
      beforeId: null,
      afterId: null,
    },
    distance: dist,
    depth,
  })

  it('picks the slot with the minimum distance', () => {
    const best = pickBestSlot([mk(10, 1), mk(5, 0), mk(20, 2)])
    expect(best?.distance).toBe(5)
  })

  it('breaks ties in favor of the shallower container', () => {
    // Equal-distance ties happen at boundaries — cursor sits between siblings
    // rather than inside one. Picking the shallower container puts the new
    // node at the natural "between two sections" position instead of nesting
    // it as a last child of one of them.
    const best = pickBestSlot([mk(5, 1), mk(5, 3), mk(5, 2)])
    expect(best?.depth).toBe(1)
  })

  it('returns null for an empty array', () => {
    expect(pickBestSlot([])).toBeNull()
  })
})

describe('integration scenarios', () => {
  it('cursor exactly on a shared boundary picks the between-slot', () => {
    const children = [
      child('a', 0, 0, 100, 50),
      child('b', 100, 0, 100, 50),
      child('c', 200, 0, 100, 50),
    ]
    const slots = buildSlots('p', rect(0, 0, 300, 50), children, 'vertical')
    const best = pickBestSlot(rankSlots(slots, { x: 100, y: 25 }))
    expect(best?.slot.position).toBe(1)
  })

  it('cursor inside child A picks the nearest edge by proximity', () => {
    const children = [child('a', 0, 0, 100, 50), child('b', 100, 0, 100, 50)]
    const slots = buildSlots('p', rect(0, 0, 200, 50), children, 'vertical')

    // x=30 → closer to before-A (x=0) than to A|B (x=100)
    expect(pickBestSlot(rankSlots(slots, { x: 30, y: 25 }))?.slot.position).toBe(0)

    // x=80 → closer to A|B (x=100) than to before-A (x=0)
    expect(pickBestSlot(rankSlots(slots, { x: 80, y: 25 }))?.slot.position).toBe(1)
  })

  it('zoom-agnostic: scaled coords select the same slot index', () => {
    const a1 = [child('a', 0, 0, 100, 50), child('b', 100, 0, 100, 50)]
    const slots1 = buildSlots('p', rect(0, 0, 200, 50), a1, 'vertical')
    const best1 = pickBestSlot(rankSlots(slots1, { x: 100, y: 25 }))

    const a2 = [child('a', 0, 0, 50, 25), child('b', 50, 0, 50, 25)]
    const slots2 = buildSlots('p', rect(0, 0, 100, 25), a2, 'vertical')
    const best2 = pickBestSlot(rankSlots(slots2, { x: 50, y: 12.5 }))

    expect(best1?.slot.position).toBe(best2?.slot.position)
  })

  it('grid corner: closer axis wins (vertical slot when |dx|<|dy|)', () => {
    // 2×2 grid, all touching at (50,50)
    const children = [
      child('tl', 0, 0, 50, 50),
      child('tr', 50, 0, 50, 50),
      child('bl', 0, 50, 50, 50),
      child('br', 50, 50, 50, 50),
    ]
    const vertSlots = buildSlots('p', rect(0, 0, 100, 100), children, 'vertical')
    const horizSlots = buildSlots('p', rect(0, 0, 100, 100), children, 'horizontal')
    const all = [...vertSlots, ...horizSlots]

    // Cursor at (52, 60) — dx=2 from vertical boundary at x=50, dy=10 from horizontal at y=50
    const best = pickBestSlot(rankSlots(all, { x: 52, y: 60 }))
    expect(best?.slot.orientation).toBe('vertical')

    // Cursor at (60, 52) — dx=10, dy=2
    const best2 = pickBestSlot(rankSlots(all, { x: 60, y: 52 }))
    expect(best2?.slot.orientation).toBe('horizontal')
  })

  it('depth tie-break: same distance from two containers prefers shallower', () => {
    const slotA: Slot = {
      containerId: 'outer',
      position: 0,
      orientation: 'vertical',
      line: { x1: 50, y1: 0, x2: 50, y2: 100 },
      beforeId: null,
      afterId: null,
    }
    const slotB: Slot = {
      containerId: 'inner',
      position: 0,
      orientation: 'vertical',
      line: { x1: 50, y1: 0, x2: 50, y2: 100 },
      beforeId: null,
      afterId: null,
    }
    const cursor: Point = { x: 50, y: 50 }
    const ranked: RankedSlot[] = [
      { slot: slotA, distance: distanceToSlot(cursor, slotA), depth: 1 },
      { slot: slotB, distance: distanceToSlot(cursor, slotB), depth: 3 },
    ]
    expect(pickBestSlot(ranked)?.slot.containerId).toBe('outer')
  })

  it('cursor at boundary between two stacked sections picks the root between-slot', () => {
    // Page → root column with two sections S1, S2 touching at y=500.
    // Each section is a column with its own last child (R1, R2).
    // Cursor lands exactly on the gap.
    //
    // Without the shallower-wins tiebreak, S1.after-last / S2.before-first /
    // R1.after-last all have the same distance as root.between(S1, S2),
    // and "deeper wins" would nest the new node inside one of the sections
    // — visually identical position but wrong tree placement (cramped flex).
    const root = rect(0, 0, 1000, 1000)
    const s1 = rect(0, 0, 1000, 500)
    const s2 = rect(0, 500, 1000, 500)
    const r1 = rect(0, 400, 1000, 100) // last row of S1, sitting at S1's bottom
    const r2 = rect(0, 500, 1000, 100) // first row of S2

    const rootSlots = buildSlots('root', root, [
      { id: 's1', rect: s1 },
      { id: 's2', rect: s2 },
    ], 'horizontal')
    const s1Slots = buildSlots('s1', s1, [{ id: 'r1', rect: r1 }], 'horizontal')
    const s2Slots = buildSlots('s2', s2, [{ id: 'r2', rect: r2 }], 'horizontal')

    const cursor: Point = { x: 500, y: 500 }
    const ranked: RankedSlot[] = [
      ...rootSlots.map(s => ({ slot: s, distance: distanceToSlot(cursor, s), depth: 0 })),
      ...s1Slots.map(s => ({ slot: s, distance: distanceToSlot(cursor, s), depth: 1 })),
      ...s2Slots.map(s => ({ slot: s, distance: distanceToSlot(cursor, s), depth: 1 })),
    ]
    const best = pickBestSlot(ranked)
    expect(best?.slot.containerId).toBe('root')
    expect(best?.slot.position).toBe(1) // between S1 and S2
  })
})
