const mockRepo = { findOne: jest.fn() }
const mockCached = { fetchData: jest.fn() }

jest.mock('../config/database', () => ({ AppDataSource: { getRepository: () => mockRepo } }))
jest.mock('../services/CachedDataSourceService', () => ({ cachedDataSourceService: mockCached }))
jest.mock('../services/CredentialsManager', () => ({ CredentialsManager: { decryptAuthConfig: jest.fn() } }))

import {
  extractComputedArray,
  combineSources,
  computedDataSourceService,
} from '../services/ComputedDataSourceService'

describe('extractComputedArray', () => {
  it('массив возвращается как есть', () => {
    expect(extractComputedArray([1, 2, 3])).toEqual([1, 2, 3])
  })
  it('arrayPath извлекает вложенный массив', () => {
    expect(extractComputedArray({ data: { items: [1, 2] } }, 'data.items')).toEqual([1, 2])
  })
  it('обёртка { data: [...] }', () => {
    expect(extractComputedArray({ data: [{ a: 1 }] })).toEqual([{ a: 1 }])
  })
  it('обёртка { items: [...] }', () => {
    expect(extractComputedArray({ items: [{ a: 1 }] })).toEqual([{ a: 1 }])
  })
  it('одиночный объект → массив из одного', () => {
    expect(extractComputedArray({ a: 1 })).toEqual([{ a: 1 }])
  })
  it('null/undefined → пустой массив', () => {
    expect(extractComputedArray(null)).toEqual([])
    expect(extractComputedArray(undefined, 'x.y')).toEqual([])
  })
})

describe('combineSources', () => {
  it('concat объединяет все массивы', () => {
    expect(combineSources([[1, 2], [3], [4, 5]], 'concat')).toEqual([1, 2, 3, 4, 5])
  })

  it('merge обогащает базовый по ключу (база побеждает при конфликте)', () => {
    const base = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]
    const extra = [{ pid: 1, city: 'NY', name: 'IGNORED' }, { pid: 2, city: 'LA' }]
    const r = combineSources([base, extra], 'merge', { local: 'id', foreign: 'pid' })
    expect(r).toEqual([
      { id: 1, name: 'a', city: 'NY' },
      { id: 2, name: 'b', city: 'LA' },
    ])
  })

  it('merge без совпадения оставляет базовый элемент как есть', () => {
    const r = combineSources([[{ id: 1 }], [{ pid: 99, x: 1 }]], 'merge', { local: 'id', foreign: 'pid' })
    expect(r).toEqual([{ id: 1 }])
  })

  it('merge без joinKey падает в concat', () => {
    expect(combineSources([[1], [2]], 'merge')).toEqual([1, 2])
  })

  it('пустой ввод → пустой массив', () => {
    expect(combineSources([])).toEqual([])
  })
})

describe('computedDataSourceService.resolve', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('concat двух обычных источников', async () => {
    mockRepo.findOne.mockImplementation(({ where: { id } }: any) =>
      Promise.resolve({ id, type: 'rest-api', config: {}, authConfig: null })
    )
    mockCached.fetchData
      .mockResolvedValueOnce({ success: true, data: [{ a: 1 }] })
      .mockResolvedValueOnce({ success: true, data: [{ a: 2 }] })

    const res = await computedDataSourceService.resolve({
      sources: [{ sourceId: 's1' }, { sourceId: 's2' }],
      mode: 'concat',
    })
    expect(res.success).toBe(true)
    expect(res.data).toEqual([{ a: 1 }, { a: 2 }])
    expect(res.metadata?.headers['x-data-source-type']).toBe('computed')
  })

  it('merge двух источников по ключу', async () => {
    mockRepo.findOne.mockImplementation(({ where: { id } }: any) =>
      Promise.resolve({ id, type: 'rest-api', config: {}, authConfig: null })
    )
    mockCached.fetchData
      .mockResolvedValueOnce({ success: true, data: [{ id: 1, t: 'x' }] })
      .mockResolvedValueOnce({ success: true, data: [{ ref: 1, extra: 'y' }] })

    const res = await computedDataSourceService.resolve({
      sources: [{ sourceId: 'a' }, { sourceId: 'b' }],
      mode: 'merge',
      joinKey: { local: 'id', foreign: 'ref' },
    })
    expect(res.data).toEqual([{ id: 1, t: 'x', extra: 'y' }])
  })

  it('пустой sources → ошибка', async () => {
    const res = await computedDataSourceService.resolve({ sources: [] })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('COMPUTED_ERROR')
  })

  it('несуществующий источник → ошибка', async () => {
    mockRepo.findOne.mockResolvedValue(null)
    const res = await computedDataSourceService.resolve({ sources: [{ sourceId: 'missing' }] })
    expect(res.success).toBe(false)
    expect(res.error?.message).toMatch(/не найден/i)
  })

  it('проброс ошибки sub-источника', async () => {
    mockRepo.findOne.mockResolvedValue({ id: 's', type: 'rest-api', config: {}, authConfig: null })
    mockCached.fetchData.mockResolvedValue({ success: false, error: { code: 'HTTP_500', message: 'fail' } })
    const res = await computedDataSourceService.resolve({ sources: [{ sourceId: 's' }] })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('HTTP_500')
  })

  it('детект цикла: computed ссылается сам на себя', async () => {
    // s1 (computed) → s1
    mockRepo.findOne.mockResolvedValue({
      id: 's1', type: 'computed', authConfig: null,
      config: { sources: [{ sourceId: 's1' }] },
    })
    const res = await computedDataSourceService.resolve({ sources: [{ sourceId: 's1' }] })
    expect(res.success).toBe(false)
    expect(res.error?.message).toMatch(/цикл/i)
  })

  it('вложенный computed резолвится (concat)', async () => {
    mockRepo.findOne.mockImplementation(({ where: { id } }: any) => {
      if (id === 'nested') {
        return Promise.resolve({ id, type: 'computed', authConfig: null, config: { sources: [{ sourceId: 'leaf' }], mode: 'concat' } })
      }
      return Promise.resolve({ id, type: 'rest-api', config: {}, authConfig: null })
    })
    mockCached.fetchData.mockResolvedValue({ success: true, data: [{ v: 1 }] })

    const res = await computedDataSourceService.resolve({ sources: [{ sourceId: 'nested' }], mode: 'concat' })
    expect(res.success).toBe(true)
    expect(res.data).toEqual([{ v: 1 }])
  })
})
