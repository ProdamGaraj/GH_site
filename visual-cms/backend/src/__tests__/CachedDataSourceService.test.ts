import CachedDataSourceService from '../services/CachedDataSourceService'
import { FetchResult, FetchConfig, AuthConfig } from '../services/SecureDataSourceService'

// Mock SecureDataSourceService
const mockFetchData = jest.fn()
jest.mock('../services/SecureDataSourceService', () => {
  return {
    __esModule: true,
    secureDataSourceService: {
      fetchData: (...args: any[]) => mockFetchData(...args),
    },
    default: class {},
  }
})

// Mock CacheService
const mockGet = jest.fn()
const mockSet = jest.fn()
const mockInvalidateByTag = jest.fn()

jest.mock('../services/CacheService', () => {
  return {
    __esModule: true,
    cacheService: {
      get: (...args: any[]) => mockGet(...args),
      set: (...args: any[]) => mockSet(...args),
      invalidateByTag: (...args: any[]) => mockInvalidateByTag(...args),
    },
    CacheService: class {},
  }
})

// Re-import after mocks
const { cachedDataSourceService } = require('../services/CachedDataSourceService')

const DS_ID = 'test-ds-id-1234'

const makeConfig = (overrides: Partial<FetchConfig & { cacheTTL?: number }> = {}): FetchConfig => ({
  type: 'rest-api',
  url: 'http://api.example.com/data',
  method: 'GET',
  ...overrides,
} as FetchConfig)

const successResult: FetchResult = {
  success: true,
  data: [{ id: 1, name: 'Test' }],
  metadata: {
    statusCode: 200,
    headers: {},
    responseTime: 500,
  },
}

const errorResult: FetchResult = {
  success: false,
  error: {
    code: 'FETCH_FAILED',
    message: 'Connection refused',
  },
  metadata: {
    statusCode: 0,
    headers: {},
    responseTime: 100,
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue(null) // cache miss by default
  mockSet.mockResolvedValue(undefined)
  mockInvalidateByTag.mockResolvedValue(0)
  mockFetchData.mockResolvedValue(successResult)
})

describe('CachedDataSourceService', () => {

  // ─── Caching enabled (cacheTTL > 0) ───────────────────

  describe('with cacheTTL > 0', () => {
    const config = makeConfig({ cacheTTL: 600 } as any)

    it('fetches from API on cache miss and stores in cache', async () => {
      const result = await cachedDataSourceService.fetchData(DS_ID, config)

      expect(mockFetchData).toHaveBeenCalledWith(config, undefined, undefined)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(successResult.data)

      // Should store in cache
      expect(mockSet).toHaveBeenCalledTimes(1)
      expect(mockSet).toHaveBeenCalledWith(
        expect.stringContaining('ds-fetch:'),
        successResult,
        expect.objectContaining({
          ttl: 600,
          tags: expect.arrayContaining(['ds-fetch', `ds-fetch:${DS_ID}`]),
        })
      )
    })

    it('returns cached data on cache hit without calling API', async () => {
      mockGet.mockResolvedValue(successResult)

      const result = await cachedDataSourceService.fetchData(DS_ID, config)

      expect(mockFetchData).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.data).toEqual(successResult.data)
      expect(result.metadata!.responseTime).toBe(0)
      expect(result.metadata!.headers['x-cache']).toBe('HIT')
    })

    it('does NOT cache error responses', async () => {
      mockFetchData.mockResolvedValue(errorResult)

      const result = await cachedDataSourceService.fetchData(DS_ID, config)

      expect(result.success).toBe(false)
      expect(mockSet).not.toHaveBeenCalled()
    })

    it('passes authConfig and retryConfig to underlying service', async () => {
      const authConfig: AuthConfig = { type: 'bearer', token: 'test-token' }
      const retryConfig = { maxAttempts: 5 }

      await cachedDataSourceService.fetchData(DS_ID, config, authConfig, retryConfig)

      expect(mockFetchData).toHaveBeenCalledWith(config, authConfig, retryConfig)
    })
  })

  // ─── Caching disabled (cacheTTL = 0 or undefined) ────

  describe('with cacheTTL = 0 or undefined', () => {
    it('delegates directly to SecureDataSourceService when cacheTTL is 0', async () => {
      const config = makeConfig({ cacheTTL: 0 } as any)

      const result = await cachedDataSourceService.fetchData(DS_ID, config)

      expect(mockFetchData).toHaveBeenCalledTimes(1)
      expect(mockGet).not.toHaveBeenCalled()
      expect(mockSet).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('delegates directly when cacheTTL is undefined', async () => {
      const config = makeConfig() // no cacheTTL

      const result = await cachedDataSourceService.fetchData(DS_ID, config)

      expect(mockFetchData).toHaveBeenCalledTimes(1)
      expect(mockGet).not.toHaveBeenCalled()
      expect(mockSet).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
    })
  })

  // ─── Cache key generation ─────────────────────────────

  describe('cache key generation', () => {
    const config1 = makeConfig({ cacheTTL: 60, url: 'http://api.example.com/endpoint1' } as any)
    const config2 = makeConfig({ cacheTTL: 60, url: 'http://api.example.com/endpoint2' } as any)

    it('produces different cache keys for different URLs', async () => {
      await cachedDataSourceService.fetchData(DS_ID, config1)
      await cachedDataSourceService.fetchData(DS_ID, config2)

      const key1 = mockGet.mock.calls[0][0]
      const key2 = mockGet.mock.calls[1][0]
      expect(key1).not.toBe(key2)
    })

    it('produces different cache keys for different DataSource IDs', async () => {
      await cachedDataSourceService.fetchData('ds-1', config1)
      await cachedDataSourceService.fetchData('ds-2', config1)

      const key1 = mockGet.mock.calls[0][0]
      const key2 = mockGet.mock.calls[1][0]
      expect(key1).not.toBe(key2)
    })

    it('produces same cache key for same DS + config', async () => {
      await cachedDataSourceService.fetchData(DS_ID, config1)
      await cachedDataSourceService.fetchData(DS_ID, config1)

      const key1 = mockGet.mock.calls[0][0]
      const key2 = mockGet.mock.calls[1][0]
      expect(key1).toBe(key2)
    })

    it('produces different keys for different query params', async () => {
      const configA = makeConfig({ cacheTTL: 60, queryParams: { page: '1' } } as any)
      const configB = makeConfig({ cacheTTL: 60, queryParams: { page: '2' } } as any)

      await cachedDataSourceService.fetchData(DS_ID, configA)
      await cachedDataSourceService.fetchData(DS_ID, configB)

      const key1 = mockGet.mock.calls[0][0]
      const key2 = mockGet.mock.calls[1][0]
      expect(key1).not.toBe(key2)
    })
  })

  // ─── Thundering herd protection ───────────────────────

  describe('thundering herd protection', () => {
    it('deduplicates parallel requests to the same key', async () => {
      const config = makeConfig({ cacheTTL: 300 } as any)

      // Slow fetch that takes some time
      let resolveSlowFetch!: (value: FetchResult) => void
      mockFetchData.mockImplementation(
        () => new Promise<FetchResult>((resolve) => {
          resolveSlowFetch = resolve
        })
      )

      // Fire 5 parallel requests
      const promises = Array.from({ length: 5 }, () =>
        cachedDataSourceService.fetchData(DS_ID, config)
      )

      // Flush microtask queue so all fetchData calls reach their first await
      await new Promise(r => setTimeout(r, 0))

      // Only 1 actual fetch should have been triggered
      expect(mockFetchData).toHaveBeenCalledTimes(1)

      // Resolve the fetch
      resolveSlowFetch(successResult)

      // All 5 should get the same result
      const results = await Promise.all(promises)
      results.forEach((r: FetchResult) => {
        expect(r.success).toBe(true)
        expect(r.data).toEqual(successResult.data)
      })

      // Cache should be set only once
      expect(mockSet).toHaveBeenCalledTimes(1)
    })

    it('does not deduplicate requests with different keys', async () => {
      const config1 = makeConfig({ cacheTTL: 300, url: 'http://a.com/1' } as any)
      const config2 = makeConfig({ cacheTTL: 300, url: 'http://a.com/2' } as any)

      let resolve1!: (v: FetchResult) => void
      let resolve2!: (v: FetchResult) => void
      mockFetchData
        .mockImplementationOnce(() => new Promise<FetchResult>(r => { resolve1 = r }))
        .mockImplementationOnce(() => new Promise<FetchResult>(r => { resolve2 = r }))

      const p1 = cachedDataSourceService.fetchData(DS_ID, config1)
      const p2 = cachedDataSourceService.fetchData(DS_ID, config2)

      await new Promise(r => setTimeout(r, 0))

      expect(mockFetchData).toHaveBeenCalledTimes(2)

      resolve1(successResult)
      resolve2(successResult)
      await Promise.all([p1, p2])
    })

    it('cleans up inflight map after request completes', async () => {
      const config = makeConfig({ cacheTTL: 300 } as any)

      await cachedDataSourceService.fetchData(DS_ID, config)

      // Second call should trigger a new fetch (not deduplicated)
      await cachedDataSourceService.fetchData(DS_ID, config)

      expect(mockFetchData).toHaveBeenCalledTimes(2)
    })

    it('cleans up inflight map even on error', async () => {
      const config = makeConfig({ cacheTTL: 300 } as any)
      mockFetchData.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        cachedDataSourceService.fetchData(DS_ID, config)
      ).rejects.toThrow('Network error')

      // Inflight should be cleaned up — next call creates new request
      mockFetchData.mockResolvedValue(successResult)
      const result = await cachedDataSourceService.fetchData(DS_ID, config)
      expect(result.success).toBe(true)
      expect(mockFetchData).toHaveBeenCalledTimes(2)
    })
  })

  // ─── Cache invalidation ───────────────────────────────

  describe('invalidateCache', () => {
    it('invalidates by DataSource-specific tag', async () => {
      mockInvalidateByTag.mockResolvedValue(3)

      const count = await cachedDataSourceService.invalidateCache(DS_ID)

      expect(mockInvalidateByTag).toHaveBeenCalledWith(`ds-fetch:${DS_ID}`)
      expect(count).toBe(3)
    })
  })

  describe('invalidateAll', () => {
    it('invalidates all ds-fetch entries', async () => {
      mockInvalidateByTag.mockResolvedValue(10)

      const count = await cachedDataSourceService.invalidateAll()

      expect(mockInvalidateByTag).toHaveBeenCalledWith('ds-fetch')
      expect(count).toBe(10)
    })
  })
})
