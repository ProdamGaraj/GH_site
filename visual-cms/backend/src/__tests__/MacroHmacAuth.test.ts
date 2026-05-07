import crypto from 'crypto'
import SecureDataSourceService, { AuthConfig } from '../services/SecureDataSourceService'
import CredentialsManager from '../services/CredentialsManager'

// Use dev key for tests
beforeAll(() => {
  delete process.env.ENCRYPTION_KEY
  process.env.NODE_ENV = 'development'
})

describe('macro-hmac auth: token generation', () => {
  const service = new SecureDataSourceService()

  it('generates correct md5 token from domain + time + appSecret', () => {
    const domain = 'example.com'
    const time = 1700000000
    const appSecret = 'my-secret-key'

    const expected = crypto
      .createHash('md5')
      .update(domain + time + appSecret)
      .digest('hex')

    // Access private method via any cast for unit testing
    const result = (service as any).generateMacroHmacToken(domain, time, appSecret)
    expect(result).toBe(expected)
  })

  it('produces different tokens for different times', () => {
    const domain = 'example.com'
    const appSecret = 'secret'

    const token1 = (service as any).generateMacroHmacToken(domain, 1000, appSecret)
    const token2 = (service as any).generateMacroHmacToken(domain, 2000, appSecret)
    expect(token1).not.toBe(token2)
  })

  it('produces different tokens for different domains', () => {
    const appSecret = 'secret'
    const time = 1000

    const token1 = (service as any).generateMacroHmacToken('a.com', time, appSecret)
    const token2 = (service as any).generateMacroHmacToken('b.com', time, appSecret)
    expect(token1).not.toBe(token2)
  })

  it('produces different tokens for different secrets', () => {
    const domain = 'example.com'
    const time = 1000

    const token1 = (service as any).generateMacroHmacToken(domain, time, 'secret1')
    const token2 = (service as any).generateMacroHmacToken(domain, time, 'secret2')
    expect(token1).not.toBe(token2)
  })

  it('token is 32-char lowercase hex (md5)', () => {
    const token = (service as any).generateMacroHmacToken('x.com', 123, 'sec')
    expect(token).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('macro-hmac auth: buildUrl', () => {
  const service = new SecureDataSourceService()

  it('adds domain, time, and token as query params', () => {
    const authConfig: AuthConfig = {
      type: 'macro-hmac',
      domain: 'golden-house.com',
      appSecret: 'test-secret',
    }

    // Mock Date.now for deterministic time
    const now = 1700000000000
    jest.spyOn(Date, 'now').mockReturnValue(now)

    const url = (service as any).buildUrl(
      'https://api.macroserver.ru/estate/get/',
      undefined,
      authConfig
    )

    const parsed = new URL(url)
    expect(parsed.searchParams.get('domain')).toBe('golden-house.com')
    expect(parsed.searchParams.get('time')).toBe('1700000000')

    const expectedToken = crypto
      .createHash('md5')
      .update('golden-house.com' + '1700000000' + 'test-secret')
      .digest('hex')
    expect(parsed.searchParams.get('token')).toBe(expectedToken)

    jest.restoreAllMocks()
  })

  it('preserves existing query params alongside macro-hmac params', () => {
    const authConfig: AuthConfig = {
      type: 'macro-hmac',
      domain: 'test.com',
      appSecret: 'sec',
    }

    jest.spyOn(Date, 'now').mockReturnValue(1700000000000)

    const url = (service as any).buildUrl(
      'https://api.macroserver.ru/estate/get/',
      { is_active: '1', limit: '50' },
      authConfig
    )

    const parsed = new URL(url)
    expect(parsed.searchParams.get('is_active')).toBe('1')
    expect(parsed.searchParams.get('limit')).toBe('50')
    expect(parsed.searchParams.get('domain')).toBe('test.com')
    expect(parsed.searchParams.get('time')).toBeTruthy()
    expect(parsed.searchParams.get('token')).toBeTruthy()

    jest.restoreAllMocks()
  })

  it('does not add auth params for non-macro-hmac types', () => {
    const authConfig: AuthConfig = {
      type: 'bearer',
      token: 'tok123',
    }

    const url = (service as any).buildUrl(
      'https://api.example.com/data',
      undefined,
      authConfig
    )

    const parsed = new URL(url)
    expect(parsed.searchParams.get('domain')).toBeNull()
    expect(parsed.searchParams.get('time')).toBeNull()
    expect(parsed.searchParams.get('token')).toBeNull()
  })
})

describe('macro-hmac auth: buildHeaders', () => {
  const service = new SecureDataSourceService()

  it('does NOT add any Authorization header for macro-hmac', () => {
    const authConfig: AuthConfig = {
      type: 'macro-hmac',
      domain: 'test.com',
      appSecret: 'sec',
    }

    const headers = (service as any).buildHeaders({}, authConfig)
    expect(headers['Authorization']).toBeUndefined()
  })
})

describe('macro-hmac auth: CredentialsManager integration', () => {
  it('encrypts appSecret field', () => {
    const config = {
      type: 'macro-hmac',
      domain: 'golden-house.com',
      appSecret: 'super-secret-123',
    }

    const encrypted = CredentialsManager.encryptAuthConfig(config)
    expect(typeof encrypted.appSecret).toBe('object')
    expect((encrypted.appSecret as any).storageType).toBe('inline')
    // domain should NOT be encrypted
    expect(encrypted.domain).toBe('golden-house.com')
    expect(encrypted.type).toBe('macro-hmac')
  })

  it('decrypts appSecret field', async () => {
    const config = {
      type: 'macro-hmac',
      domain: 'golden-house.com',
      appSecret: 'super-secret-123',
    }

    const encrypted = CredentialsManager.encryptAuthConfig(config)
    const decrypted = await CredentialsManager.decryptAuthConfig(encrypted)
    expect(decrypted.appSecret).toBe('super-secret-123')
    expect(decrypted.domain).toBe('golden-house.com')
  })

  it('masks appSecret field', () => {
    const config = {
      type: 'macro-hmac',
      domain: 'golden-house.com',
      appSecret: 'super-secret-123',
    }

    const masked = CredentialsManager.maskAuthConfig(config)
    expect((masked.appSecret as any)._masked).toBe(true)
    expect((masked.appSecret as any).preview).toBe('supe****')
    // domain should NOT be masked
    expect(masked.domain).toBe('golden-house.com')
  })

  it('masks encrypted appSecret', () => {
    const config = {
      type: 'macro-hmac',
      domain: 'golden-house.com',
      appSecret: 'super-secret-123',
    }

    const encrypted = CredentialsManager.encryptAuthConfig(config)
    const masked = CredentialsManager.maskAuthConfig(encrypted)
    expect((masked.appSecret as any)._masked).toBe(true)
    expect((masked.appSecret as any).storageType).toBe('inline')
  })
})
