import { DataSourceController } from '../controllers/DataSourceController'
import { secureDataSourceService } from '../services/SecureDataSourceService'

// Mock SecureDataSourceService
jest.mock('../services/SecureDataSourceService', () => {
  const actual = jest.requireActual('../services/SecureDataSourceService')
  return {
    ...actual,
    secureDataSourceService: {
      fetchData: jest.fn(),
    },
  }
})

// Mock database dependencies so controller can be instantiated
jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    }),
  },
}))

jest.mock('../services/CacheService', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
    invalidatePattern: jest.fn(),
  },
}))

describe('DataSourceController', () => {
  const controller = new DataSourceController()

  // Access private methods for unit testing
  const testRestApi = (controller as any).testRestApi.bind(controller)
  const testGraphQL = (controller as any).testGraphQL.bind(controller)
  const isErrorInResponseBody = (controller as any).isErrorInResponseBody.bind(controller)
  const extractErrorMessage = (controller as any).extractErrorMessage.bind(controller)
  const isMaskedAuthConfig = (controller as any).isMaskedAuthConfig.bind(controller)

  const mockFetchData = secureDataSourceService.fetchData as jest.Mock

  beforeEach(() => {
    mockFetchData.mockReset()
  })

  // ─── isErrorInResponseBody ──────────────────────────────────

  describe('isErrorInResponseBody', () => {
    it('detects { error: true }', () => {
      expect(isErrorInResponseBody({ error: true, message: 'fail' })).toBe(true)
    })

    it('detects { success: false }', () => {
      expect(isErrorInResponseBody({ success: false })).toBe(true)
    })

    it('passes normal data through', () => {
      expect(isErrorInResponseBody({ data: [1, 2, 3] })).toBe(false)
    })

    it('passes { error: false } through', () => {
      expect(isErrorInResponseBody({ error: false })).toBe(false)
    })

    it('passes { success: true } through', () => {
      expect(isErrorInResponseBody({ success: true })).toBe(false)
    })

    it('handles null/undefined gracefully', () => {
      expect(isErrorInResponseBody(null)).toBe(false)
      expect(isErrorInResponseBody(undefined)).toBe(false)
    })

    it('handles primitives gracefully', () => {
      expect(isErrorInResponseBody('string')).toBe(false)
      expect(isErrorInResponseBody(42)).toBe(false)
    })
  })

  // ─── extractErrorMessage ────────────────────────────────────

  describe('extractErrorMessage', () => {
    it('extracts message field', () => {
      expect(extractErrorMessage({ error: true, message: 'Request not authenticated' }))
        .toBe('Request not authenticated')
    })

    it('extracts error string field', () => {
      expect(extractErrorMessage({ error: 'Something went wrong' }))
        .toBe('Something went wrong')
    })

    it('extracts error_message field', () => {
      expect(extractErrorMessage({ error_message: 'Bad request' }))
        .toBe('Bad request')
    })

    it('returns default when no message found', () => {
      expect(extractErrorMessage({ error: true }))
        .toBe('API returned an error response')
    })

    it('handles null', () => {
      expect(extractErrorMessage(null)).toBe('Unknown error')
    })
  })

  // ─── isMaskedAuthConfig ─────────────────────────────────────

  describe('isMaskedAuthConfig', () => {
    it('detects masked appSecret', () => {
      expect(isMaskedAuthConfig({ type: 'macro-hmac', appSecret: { _masked: true } })).toBe(true)
    })

    it('detects masked token', () => {
      expect(isMaskedAuthConfig({ type: 'bearer', token: { _masked: true } })).toBe(true)
    })

    it('detects masked key', () => {
      expect(isMaskedAuthConfig({ type: 'api-key', key: { _masked: true, preview: '***abc' } })).toBe(true)
    })

    it('passes real credentials through', () => {
      expect(isMaskedAuthConfig({ type: 'macro-hmac', appSecret: 'realSecret123', domain: 'test.gh.uz' })).toBe(false)
    })

    it('passes none auth through', () => {
      expect(isMaskedAuthConfig({ type: 'none' })).toBe(false)
    })
  })

  // ─── testRestApi → delegates to SecureDataSourceService ─────

  describe('testRestApi (DRY delegation)', () => {
    it('calls secureDataSourceService.fetchData with correct config', async () => {
      mockFetchData.mockResolvedValue({
        success: true,
        data: { items: [1, 2, 3] },
      })

      const result = await testRestApi(
        { url: 'https://api.example.com/data', method: 'GET', timeout: 5000 },
        { type: 'bearer', token: 'abc123' }
      )

      expect(mockFetchData).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rest-api',
          url: 'https://api.example.com/data',
          method: 'GET',
          timeout: 5000,
        }),
        { type: 'bearer', token: 'abc123' }
      )
      expect(result.success).toBe(true)
      expect(result.sampleData).toBeDefined()
    })

    it('passes macro-hmac auth to SecureDataSourceService', async () => {
      mockFetchData.mockResolvedValue({
        success: true,
        data: { complexes: [] },
      })

      await testRestApi(
        { url: 'https://api.macroserver.ru/estate/complexes' },
        { type: 'macro-hmac', domain: 'test.gh.uz', appSecret: 'secret123' }
      )

      expect(mockFetchData).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://api.macroserver.ru/estate/complexes' }),
        { type: 'macro-hmac', domain: 'test.gh.uz', appSecret: 'secret123' }
      )
    })

    it('detects false positive (error in 200 response body)', async () => {
      mockFetchData.mockResolvedValue({
        success: true,
        data: { error: true, message: 'Request not authenticated' },
      })

      const result = await testRestApi(
        { url: 'https://api.macroserver.ru/estate/complexes' },
        { type: 'macro-hmac', domain: 'test.gh.uz', appSecret: 'wrongSecret' }
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Request not authenticated')
      expect(result.error?.code).toBe('API_ERROR')
    })

    it('returns error when fetchData fails', async () => {
      mockFetchData.mockResolvedValue({
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'Connection refused' },
      })

      const result = await testRestApi(
        { url: 'https://unreachable.example.com' }
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Connection refused')
    })
  })

  // ─── testGraphQL → delegates to SecureDataSourceService ─────

  describe('testGraphQL (DRY delegation)', () => {
    it('calls secureDataSourceService.fetchData with graphql type', async () => {
      mockFetchData.mockResolvedValue({
        success: true,
        data: { users: [{ id: 1, name: 'Test' }] },
      })

      const result = await testGraphQL(
        { url: 'https://api.example.com/graphql', query: '{ users { id name } }' },
        { type: 'bearer', token: 'tok' }
      )

      expect(mockFetchData).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'graphql',
          url: 'https://api.example.com/graphql',
          query: '{ users { id name } }',
        }),
        { type: 'bearer', token: 'tok' }
      )
      expect(result.success).toBe(true)
    })

    it('returns error on GraphQL failure', async () => {
      mockFetchData.mockResolvedValue({
        success: false,
        error: { code: 'GRAPHQL_ERROR', message: 'Syntax error' },
      })

      const result = await testGraphQL(
        { url: 'https://api.example.com/graphql', query: 'invalid' }
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Syntax error')
    })
  })
})
