import { mapComplexStats } from '../services/ProjectStatsAggregator'
import type { ComplexStatsRaw } from '../services/MacroV2Client'

const make = (flatStats: any): ComplexStatsRaw => ({
  id: 1,
  title: 'Test',
  stats: { categories: { flat: flatStats } },
})

describe('mapComplexStats', () => {
  it('returns empty stats when stats are missing', () => {
    const r = mapComplexStats({ id: 1 } as ComplexStatsRaw)
    expect(r.count).toBe(0)
    expect(r.area_min).toBeNull()
    expect(r.price_min).toBeNull()
    expect(r.rooms_max).toBeNull()
    expect(r.hasStudios).toBe(false)
  })

  it('returns empty stats when flat category is missing', () => {
    const raw: ComplexStatsRaw = { id: 1, stats: { categories: { garage: { countOnSale: 5 } as any } } }
    const r = mapComplexStats(raw)
    expect(r.count).toBe(0)
  })

  it('maps flat aggregates and divides prices by 100 (minor units → main)', () => {
    const r = mapComplexStats(make({
      countOnSale: 34,
      minPrice: 750_000_000, // 7.5M в основной валюте
      maxPrice: 1_500_000_000,
      minArea: 32.5,
      maxArea: 95.2,
    }))
    expect(r.count).toBe(34)
    expect(r.price_min).toBe(7_500_000)
    expect(r.price_max).toBe(15_000_000)
    expect(r.area_min).toBe(32.5)
    expect(r.area_max).toBe(95.2)
  })

  it('computes rooms_max from rooms map (excluding studios "0")', () => {
    const r = mapComplexStats(make({
      countOnSale: 10,
      rooms: {
        '0': { countOnSale: 2, minArea: 25, maxArea: 28, minPrice: 1000, maxPrice: 1500 },
        '1': { countOnSale: 3, minArea: 32, maxArea: 40, minPrice: 2000, maxPrice: 3000 },
        '4': { countOnSale: 1, minArea: 95, maxArea: 95, minPrice: 9000, maxPrice: 9000 },
      },
    }))
    expect(r.rooms_max).toBe(4)
    expect(r.hasStudios).toBe(true)
  })

  it('hasStudios=false when "0" bucket has zero countOnSale', () => {
    const r = mapComplexStats(make({
      countOnSale: 5,
      rooms: {
        '0': { countOnSale: 0, minArea: 0, maxArea: 0, minPrice: 0, maxPrice: 0 },
        '2': { countOnSale: 5, minArea: 50, maxArea: 60, minPrice: 5000, maxPrice: 6000 },
      },
    }))
    expect(r.hasStudios).toBe(false)
    expect(r.rooms_max).toBe(2)
  })

  it('rooms_max is null when only studios are present', () => {
    const r = mapComplexStats(make({
      countOnSale: 3,
      rooms: { '0': { countOnSale: 3, minArea: 25, maxArea: 30, minPrice: 1000, maxPrice: 1500 } },
    }))
    expect(r.hasStudios).toBe(true)
    expect(r.rooms_max).toBeNull()
  })

  it('passes currency through from caller', () => {
    const r = mapComplexStats(make({ countOnSale: 1, minPrice: 100, maxPrice: 100, minArea: 30, maxArea: 30 }), 'UZS')
    expect(r.currency).toBe('UZS')
  })

  it('treats zero/negative areas and prices as null', () => {
    const r = mapComplexStats(make({
      countOnSale: 1,
      minArea: 0,
      maxArea: 0,
      minPrice: 0,
      maxPrice: 0,
    }))
    expect(r.area_min).toBeNull()
    expect(r.area_max).toBeNull()
    expect(r.price_min).toBeNull()
    expect(r.price_max).toBeNull()
  })

  it('exposes byRooms breakdown with mapped prices', () => {
    const r = mapComplexStats(make({
      countOnSale: 8,
      rooms: {
        '1': { countOnSale: 5, minArea: 32, maxArea: 40, minPrice: 200_000, maxPrice: 300_000 },
        '2': { countOnSale: 3, minArea: 50, maxArea: 60, minPrice: 500_000, maxPrice: 600_000 },
      },
    }))
    expect(r.byRooms).toBeDefined()
    expect(r.byRooms!['1'].count).toBe(5)
    expect(r.byRooms!['1'].price_min).toBe(2000)
    expect(r.byRooms!['2'].price_max).toBe(6000)
  })

  it('omits byRooms when no rooms map present', () => {
    const r = mapComplexStats(make({ countOnSale: 1, minArea: 30, maxArea: 30, minPrice: 100, maxPrice: 100 }))
    expect(r.byRooms).toBeUndefined()
  })

  it('returns count=0 explicitly when flat.countOnSale=0', () => {
    const r = mapComplexStats(make({ countOnSale: 0 }))
    expect(r.count).toBe(0)
  })
})
