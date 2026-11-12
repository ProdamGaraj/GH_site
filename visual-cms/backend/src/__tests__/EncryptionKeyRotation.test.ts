import CredentialsManager, {
  DEV_FALLBACK_KEY_SPEC,
  EncryptedData,
  deriveEncryptionKey,
  resolveEncryptionKey,
} from '../services/CredentialsManager'
import {
  planRotation,
  reencryptTree,
  UndecryptableSecretError,
} from '../services/EncryptionKeyRotation'

const OLD = resolveEncryptionKey('old-key-value')
const NEW = resolveEncryptionKey('new-key-value')
const OTHER = resolveEncryptionKey('some-unrelated-key')

const enc = (plain: string, key: Buffer): EncryptedData => CredentialsManager.encrypt(plain, key)
const dec = (data: unknown, key: Buffer): string => CredentialsManager.decrypt(data as EncryptedData, key)

describe('resolveEncryptionKey', () => {
  it('derives the same key as ENCRYPTION_KEY at runtime', () => {
    const origKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = 'runtime-key'
    try {
      const data = CredentialsManager.encrypt('secret') // ключ из env
      expect(CredentialsManager.decrypt(data, resolveEncryptionKey('runtime-key'))).toBe('secret')
      expect(resolveEncryptionKey('runtime-key').equals(deriveEncryptionKey('runtime-key'))).toBe(true)
    } finally {
      if (origKey === undefined) delete process.env.ENCRYPTION_KEY
      else process.env.ENCRYPTION_KEY = origKey
    }
  })

  it('dev-fallback opens data written by the legacy dev key (no ENCRYPTION_KEY, NODE_ENV=development)', () => {
    const origKey = process.env.ENCRYPTION_KEY
    const origEnv = process.env.NODE_ENV
    delete process.env.ENCRYPTION_KEY
    process.env.NODE_ENV = 'development'
    try {
      const legacy = CredentialsManager.encrypt('macro-token')
      expect(CredentialsManager.decrypt(legacy, resolveEncryptionKey(DEV_FALLBACK_KEY_SPEC))).toBe('macro-token')
    } finally {
      process.env.NODE_ENV = origEnv
      if (origKey !== undefined) process.env.ENCRYPTION_KEY = origKey
    }
  })

  it('dev-fallback differs from a key literally named "dev-fallback"', () => {
    expect(resolveEncryptionKey(DEV_FALLBACK_KEY_SPEC).equals(deriveEncryptionKey(DEV_FALLBACK_KEY_SPEC))).toBe(false)
  })

  it('rejects an empty spec', () => {
    expect(() => resolveEncryptionKey('')).toThrow('empty')
  })
})

describe('explicit key encrypt/decrypt', () => {
  it('round-trips with an explicit key', () => {
    expect(dec(enc('v', NEW), NEW)).toBe('v')
  })

  it('throws with the wrong key (GCM auth tag)', () => {
    expect(() => dec(enc('v', OLD), NEW)).toThrow()
  })
})

describe('reencryptTree', () => {
  it('re-encrypts a top-level secret from old to new key', () => {
    const r = reencryptTree(enc('tok', OLD), OLD, NEW)
    expect(r.reencrypted).toBe(1)
    expect(r.alreadyCurrent).toBe(0)
    expect(dec(r.value, NEW)).toBe('tok')
    expect(() => dec(r.value, OLD)).toThrow()
  })

  it('walks nested objects and arrays and keeps plain values intact', () => {
    const input = {
      type: 'bearer',
      token: enc('t1', OLD),
      headers: { 'X-Api-Key': enc('k1', OLD), Accept: 'application/json' },
      list: [enc('a', OLD), 'plain', 42, null, { deep: enc('d', OLD) }],
      enabled: true,
    }
    const r = reencryptTree(input, OLD, NEW)
    expect(r.reencrypted).toBe(4)
    const v = r.value as typeof input
    expect(v.type).toBe('bearer')
    expect(v.enabled).toBe(true)
    expect(v.headers.Accept).toBe('application/json')
    expect(dec(v.token, NEW)).toBe('t1')
    expect(dec(v.headers['X-Api-Key'], NEW)).toBe('k1')
    expect(dec(v.list[0], NEW)).toBe('a')
    expect(v.list.slice(1, 4)).toEqual(['plain', 42, null])
    expect(dec((v.list[4] as { deep: unknown }).deep, NEW)).toBe('d')
  })

  it('does not mutate the input', () => {
    const secret = enc('s', OLD)
    const input = { a: secret, b: [secret] }
    const snapshot = JSON.parse(JSON.stringify(input))
    reencryptTree(input, OLD, NEW)
    expect(input).toEqual(snapshot)
  })

  it('is idempotent: values already under the new key are left byte-identical', () => {
    const current = enc('c', NEW)
    const r = reencryptTree({ x: current }, OLD, NEW)
    expect(r.reencrypted).toBe(0)
    expect(r.alreadyCurrent).toBe(1)
    expect((r.value as { x: unknown }).x).toBe(current)

    const second = reencryptTree(reencryptTree({ y: enc('o', OLD) }, OLD, NEW).value, OLD, NEW)
    expect(second.reencrypted).toBe(0)
    expect(second.alreadyCurrent).toBe(1)
  })

  it('throws UndecryptableSecretError with the JSON path when neither key opens a secret', () => {
    const input = { headers: { auth: enc('z', OTHER) } }
    expect(() => reencryptTree(input, OLD, NEW, 'authConfig')).toThrow(UndecryptableSecretError)
    expect(() => reencryptTree(input, OLD, NEW, 'authConfig')).toThrow('authConfig.headers.auth')
  })

  it('handles null, undefined, primitives and objects that only look like secrets', () => {
    expect(reencryptTree(null, OLD, NEW)).toEqual({ value: null, reencrypted: 0, alreadyCurrent: 0 })
    expect(reencryptTree(undefined, OLD, NEW)).toEqual({ value: undefined, reencrypted: 0, alreadyCurrent: 0 })
    expect(reencryptTree('s', OLD, NEW).value).toBe('s')
    const envRef = { storageType: 'env', envVar: 'MACRO_TOKEN' }
    expect(reencryptTree(envRef, OLD, NEW)).toEqual({ value: envRef, reencrypted: 0, alreadyCurrent: 0 })
    const partial = { storageType: 'inline', encrypted: 'x' } // нет iv/authTag — не секрет
    expect(reencryptTree(partial, OLD, NEW).reencrypted).toBe(0)
  })
})

describe('planRotation', () => {
  it('plans updates only for rows that changed and sums counters', () => {
    const rows = [
      { id: 'a', config: { url: 'https://x', password: enc('p', OLD) }, authConfig: { token: enc('t', OLD) } },
      { id: 'b', config: { url: 'https://y' }, authConfig: null },
      { id: 'c', config: {}, authConfig: { token: enc('t2', NEW) } },
    ]
    const plan = planRotation(rows, OLD, NEW)
    expect(plan.updates.map((u) => u.id)).toEqual(['a'])
    expect(plan.reencrypted).toBe(2)
    expect(plan.alreadyCurrent).toBe(1)
    const a = plan.updates[0]
    expect(dec((a.config as { password: unknown }).password, NEW)).toBe('p')
    expect(dec((a.authConfig as { token: unknown }).token, NEW)).toBe('t')
  })

  it('fails the whole plan with the data source id when any secret is undecryptable', () => {
    const rows = [
      { id: 'ok', config: { password: enc('p', OLD) }, authConfig: null },
      { id: 'broken', config: {}, authConfig: { token: enc('t', OTHER) } },
    ]
    expect(() => planRotation(rows, OLD, NEW)).toThrow('data_sources broken: Secret at "authConfig.token"')
  })

  it('returns an empty plan for an empty table', () => {
    expect(planRotation([], OLD, NEW)).toEqual({ updates: [], reencrypted: 0, alreadyCurrent: 0 })
  })
})
