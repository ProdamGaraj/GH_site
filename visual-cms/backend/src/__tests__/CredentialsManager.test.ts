import CredentialsManager, {
  EncryptedData,
  EnvReference,
  SecretsReference,
} from '../services/CredentialsManager'

// Use dev key for tests
beforeAll(() => {
  delete process.env.ENCRYPTION_KEY
  process.env.NODE_ENV = 'development'
})

describe('config secrets (database)', () => {
  it('шифрует password и connectionString, оставляя прочие поля', () => {
    const enc = CredentialsManager.encryptConfigSecrets({
      host: 'db.example.com',
      database: 'app',
      password: 'super-secret',
      connectionString: 'postgres://u:p@h/d',
    })
    expect(enc.host).toBe('db.example.com')
    expect(enc.database).toBe('app')
    expect((enc.password as any).storageType).toBe('inline')
    expect((enc.connectionString as any).storageType).toBe('inline')
  })

  it('round-trip: encrypt → decrypt восстанавливает значения', async () => {
    const enc = CredentialsManager.encryptConfigSecrets({ host: 'h', password: 'p@ss', connectionString: 'cs://x' })
    const dec = await CredentialsManager.decryptConfigSecrets(enc)
    expect(dec.password).toBe('p@ss')
    expect(dec.connectionString).toBe('cs://x')
  })

  it('decrypt оставляет plaintext-строки как есть (legacy)', async () => {
    const dec = await CredentialsManager.decryptConfigSecrets({ host: 'h', password: 'plain' })
    expect(dec.password).toBe('plain')
  })

  it('идемпотентность: пустые/отсутствующие секреты не ломают encrypt', () => {
    const enc = CredentialsManager.encryptConfigSecrets({ host: 'h' })
    expect(enc.password).toBeUndefined()
    expect(enc.host).toBe('h')
  })

  it('mask скрывает секреты, не раскрывая значения', () => {
    const masked = CredentialsManager.maskConfigSecrets({ host: 'h', password: 'secret', connectionString: 'cs' })
    expect(masked.host).toBe('h')
    expect(masked.password).toEqual({ _masked: true, hasValue: true })
    expect(masked.connectionString).toEqual({ _masked: true, hasValue: true })
  })
})

describe('encrypt / decrypt', () => {
  it('round-trips a simple string', () => {
    const encrypted = CredentialsManager.encrypt('my-secret-token')
    expect(encrypted.storageType).toBe('inline')
    expect(encrypted.encrypted).toBeDefined()
    expect(encrypted.iv).toBeDefined()
    expect(encrypted.authTag).toBeDefined()
    const decrypted = CredentialsManager.decrypt(encrypted)
    expect(decrypted).toBe('my-secret-token')
  })
  it('produces different ciphertext each time (random IV)', () => {
    const a = CredentialsManager.encrypt('same')
    const b = CredentialsManager.encrypt('same')
    expect(a.encrypted).not.toBe(b.encrypted)
    expect(a.iv).not.toBe(b.iv)
  })
  it('handles empty string', () => {
    const e = CredentialsManager.encrypt('')
    expect(CredentialsManager.decrypt(e)).toBe('')
  })
  it('handles long content', () => {
    const text = 'A'.repeat(10000)
    const e = CredentialsManager.encrypt(text)
    expect(CredentialsManager.decrypt(e)).toBe(text)
  })
  it('throws on tampered ciphertext', () => {
    const e = CredentialsManager.encrypt('test')
    e.encrypted = 'AAAA' + e.encrypted.slice(4)
    expect(() => CredentialsManager.decrypt(e)).toThrow()
  })
  it('throws on tampered authTag', () => {
    const e = CredentialsManager.encrypt('test')
    e.authTag = Buffer.alloc(16).toString('base64')
    expect(() => CredentialsManager.decrypt(e)).toThrow()
  })
})

describe('store', () => {
  it('stores inline', () => {
    const r = CredentialsManager.store('tok', 'inline')
    expect(r.storageType).toBe('inline')
    expect((r as EncryptedData).encrypted).toBeDefined()
  })
  it('stores env reference', () => {
    const r = CredentialsManager.store('', 'env', { envVar: 'API_KEY' })
    expect(r.storageType).toBe('env')
    expect((r as EnvReference).envVar).toBe('API_KEY')
  })
  it('throws if env without envVar', () => {
    expect(() => CredentialsManager.store('', 'env')).toThrow('envVar is required')
  })
  it('stores secrets', () => {
    const r = CredentialsManager.store('', 'secrets', { secretId: 's1', provider: 'aws' })
    expect(r.storageType).toBe('secrets')
  })
  it('throws if secrets without options', () => {
    expect(() => CredentialsManager.store('', 'secrets')).toThrow('secretId and provider are required')
  })
  it('throws on unknown type', () => {
    expect(() => CredentialsManager.store('', 'magic' as any)).toThrow('Unknown storage type')
  })
})

describe('getValue', () => {
  it('resolves inline', async () => {
    const stored = CredentialsManager.encrypt('hello')
    expect(await CredentialsManager.getValue(stored)).toBe('hello')
  })
  it('resolves env', async () => {
    process.env.MY_TEST_KEY = 'env-val'
    expect(await CredentialsManager.getValue({ envVar: 'MY_TEST_KEY', storageType: 'env' })).toBe('env-val')
    delete process.env.MY_TEST_KEY
  })
  it('returns undefined for missing env', async () => {
    expect(await CredentialsManager.getValue({ envVar: 'NONEXISTENT_VAR', storageType: 'env' })).toBeUndefined()
  })
  it('returns undefined for secrets stub', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await CredentialsManager.getValue({ secretId: 's1', provider: 'aws', storageType: 'secrets' })).toBeUndefined()
    jest.restoreAllMocks()
  })
  it('throws on unknown type', async () => {
    await expect(CredentialsManager.getValue({ storageType: 'x' } as any)).rejects.toThrow('Unknown storage type')
  })
})

describe('encryptAuthConfig / decryptAuthConfig', () => {
  it('encrypts sensitive fields only', async () => {
    const config = { token: 'my-tok', baseUrl: 'https://api.com' }
    const enc = CredentialsManager.encryptAuthConfig(config)
    expect(typeof enc.token).toBe('object')
    expect(enc.baseUrl).toBe('https://api.com')
    const dec = await CredentialsManager.decryptAuthConfig(enc)
    expect(dec.token).toBe('my-tok')
  })
  it('encrypts multiple sensitive fields', () => {
    const enc = CredentialsManager.encryptAuthConfig({ password: 'p', clientSecret: 'cs', safe: 'ok' })
    expect(typeof enc.password).toBe('object')
    expect(typeof enc.clientSecret).toBe('object')
    expect(enc.safe).toBe('ok')
  })
  it('encrypts sensitive headers', () => {
    const enc = CredentialsManager.encryptAuthConfig({
      headers: { Authorization: 'Bearer x', Accept: 'json' }
    })
    const h = enc.headers as Record<string, any>
    expect(typeof h.Authorization).toBe('object')
    expect(h.Accept).toBe('json')
  })
})

describe('maskAuthConfig', () => {
  it('masks plain string', () => {
    const m = CredentialsManager.maskAuthConfig({ token: 'super-secret' })
    expect((m.token as any)._masked).toBe(true)
    expect((m.token as any).preview).toBe('supe****')
  })
  it('masks encrypted data', () => {
    const e = CredentialsManager.encrypt('x')
    const m = CredentialsManager.maskAuthConfig({ token: e })
    expect((m.token as any)._masked).toBe(true)
    expect((m.token as any).storageType).toBe('inline')
  })
  it('ignores non-sensitive', () => {
    const m = CredentialsManager.maskAuthConfig({ baseUrl: 'u' })
    expect(m.baseUrl).toBe('u')
  })
})

describe('isEncrypted', () => {
  it('true for EncryptedData', () => {
    expect(CredentialsManager.isEncrypted(CredentialsManager.encrypt('x'))).toBe(true)
  })
  it('false for env ref', () => {
    expect(CredentialsManager.isEncrypted({ envVar: 'X', storageType: 'env' })).toBe(false)
  })
  it('false for primitives', () => {
    expect(CredentialsManager.isEncrypted(null)).toBe(false)
    expect(CredentialsManager.isEncrypted('x')).toBe(false)
    expect(CredentialsManager.isEncrypted(42)).toBe(false)
  })
})

describe('Webhook helpers', () => {
  it('generateWebhookSecret returns 64-char hex', () => {
    expect(CredentialsManager.generateWebhookSecret()).toMatch(/^[0-9a-f]{64}$/)
  })
  it('hashWebhookSecret is deterministic', () => {
    const h1 = CredentialsManager.hashWebhookSecret('test')
    const h2 = CredentialsManager.hashWebhookSecret('test')
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })
  it('verifyWebhookSignature accepts valid', () => {
    const secret = 'secret'
    const payload = 'test-payload'
    const crypto = require('crypto')
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    expect(CredentialsManager.verifyWebhookSignature(payload, sig, secret)).toBe(true)
  })
  it('verifyWebhookSignature rejects invalid', () => {
    // timingSafeEqual throws on different lengths, so we use a valid-length hex
    const secret = 'secret'
    const payload = 'data'
    const crypto = require('crypto')
    const validSig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    // Flip one char
    const badSig = '0' + validSig.slice(1)
    expect(CredentialsManager.verifyWebhookSignature(payload, badSig, secret)).toBe(false)
  })
})

describe('ENCRYPTION_KEY enforcement', () => {
  it('throws when key missing in production', () => {
    const origEnv = process.env.NODE_ENV
    const origKey = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY
    process.env.NODE_ENV = 'production'
    expect(() => CredentialsManager.encrypt('x')).toThrow('ENCRYPTION_KEY environment variable is required')
    process.env.NODE_ENV = origEnv
    if (origKey) process.env.ENCRYPTION_KEY = origKey
  })
})