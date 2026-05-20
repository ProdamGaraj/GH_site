/**
 * A3: Logger.redact() — маскирование чувствительных значений в контексте логов.
 */
import { redact } from '../services/Logger'

describe('Logger.redact', () => {
  it('маскирует значения по ключам token/secret/password/key/authorization/cookie/credential', () => {
    const input = {
      user: 'alice',
      password: 'p4ssw0rd',
      token: 'abc.def.ghi',
      apiKey: 'sk-12345',
      api_key: 'sk-67890',
      authorization: 'Bearer xyz',
      cookie: 'sessionId=...',
      credential: 'cred-value',
      nested: { secret: 'top-secret', kept: 42 },
    }
    const out = redact(input) as any
    expect(out.user).toBe('alice')
    expect(out.password).toBe('***')
    expect(out.token).toBe('***')
    expect(out.apiKey).toBe('***')
    expect(out.api_key).toBe('***')
    expect(out.authorization).toBe('***')
    expect(out.cookie).toBe('***')
    expect(out.credential).toBe('***')
    expect(out.nested.secret).toBe('***')
    expect(out.nested.kept).toBe(42)
  })

  it('не мутирует исходный объект', () => {
    const input = { token: 'x' }
    redact(input)
    expect(input.token).toBe('x')
  })

  it('рекурсивно проходит массивы и объекты', () => {
    const input = { items: [{ password: 'a' }, { password: 'b' }] }
    const out = redact(input) as any
    expect(out.items[0].password).toBe('***')
    expect(out.items[1].password).toBe('***')
  })

  it('обрабатывает циклические ссылки без бесконечной рекурсии', () => {
    const input: any = { name: 'root', password: 'secret' }
    input.self = input
    const out = redact(input) as any
    expect(out.password).toBe('***')
    expect(out.self).toBe('[Circular]')
  })

  it('примитивы и null/undefined возвращаются как есть', () => {
    expect(redact('hello')).toBe('hello')
    expect(redact(42)).toBe(42)
    expect(redact(true)).toBe(true)
    expect(redact(null)).toBeNull()
    expect(redact(undefined)).toBeUndefined()
  })

  it('обрезает слишком глубокую вложенность', () => {
    const deep: any = { password: 'x' }
    let cur = deep
    for (let i = 0; i < 10; i++) {
      cur.next = { password: 'x' }
      cur = cur.next
    }
    expect(() => redact(deep)).not.toThrow()
  })
})
