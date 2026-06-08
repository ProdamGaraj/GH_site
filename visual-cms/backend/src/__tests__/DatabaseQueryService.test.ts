import {
  validateReadOnlyQuery,
  compileNamedParams,
  assertDbHostAllowed,
  DatabaseQueryError,
  databaseQueryService,
} from '../services/DatabaseQueryService'
import type { FetchConfig } from '../services/SecureDataSourceService'

describe('validateReadOnlyQuery (read-only enforcement)', () => {
  it('пропускает простой SELECT', () => {
    expect(() => validateReadOnlyQuery('SELECT id, name FROM projects')).not.toThrow()
  })

  it('пропускает WITH (CTE) → SELECT', () => {
    expect(() => validateReadOnlyQuery('WITH x AS (SELECT 1 AS n) SELECT * FROM x')).not.toThrow()
  })

  it('пропускает SELECT с завершающим ;', () => {
    expect(() => validateReadOnlyQuery('SELECT 1;')).not.toThrow()
  })

  it.each(['INSERT INTO t VALUES (1)', 'UPDATE t SET x=1', 'DELETE FROM t', 'DROP TABLE t', 'ALTER TABLE t ADD c int', 'TRUNCATE t', 'CREATE TABLE t (id int)'])(
    'отклоняет изменяющий запрос: %s',
    (sql) => {
      expect(() => validateReadOnlyQuery(sql)).toThrow(DatabaseQueryError)
    }
  )

  it('отклоняет несколько statements', () => {
    expect(() => validateReadOnlyQuery('SELECT 1; SELECT 2')).toThrow(/один SQL-запрос|statements/i)
  })

  it('отклоняет SELECT ... INTO (запись)', () => {
    expect(() => validateReadOnlyQuery('SELECT * INTO backup FROM users')).toThrow(/INTO/i)
  })

  it('отклоняет пустой запрос', () => {
    expect(() => validateReadOnlyQuery('')).toThrow(DatabaseQueryError)
    expect(() => validateReadOnlyQuery('   ')).toThrow(DatabaseQueryError)
  })

  it('НЕ ложно срабатывает на ключевые слова внутри строкового литерала', () => {
    // 'drop table' и ';' внутри строки не должны триггерить отказ
    expect(() => validateReadOnlyQuery("SELECT * FROM logs WHERE msg = 'drop table x; delete'")).not.toThrow()
  })

  it('НЕ ложно срабатывает на комментарии', () => {
    expect(() => validateReadOnlyQuery('SELECT 1 -- insert update delete\n')).not.toThrow()
    expect(() => validateReadOnlyQuery('SELECT 1 /* drop table */')).not.toThrow()
  })

  it('отклоняет подзапрос с DELETE, спрятанный через ; ', () => {
    expect(() => validateReadOnlyQuery("SELECT 1; DELETE FROM users")).toThrow()
  })
})

describe('compileNamedParams (параметризация против инъекций)', () => {
  it('postgresql: :name → $1, $2 по порядку', () => {
    const r = compileNamedParams('SELECT * FROM t WHERE a=:a AND b=:b', { a: 1, b: 'x' }, 'postgresql')
    expect(r.sql).toBe('SELECT * FROM t WHERE a=$1 AND b=$2')
    expect(r.values).toEqual([1, 'x'])
  })

  it('mysql: :name → ?', () => {
    const r = compileNamedParams('SELECT * FROM t WHERE a=:a AND b=:b', { a: 1, b: 'x' }, 'mysql')
    expect(r.sql).toBe('SELECT * FROM t WHERE a=? AND b=?')
    expect(r.values).toEqual([1, 'x'])
  })

  it('повторяющийся параметр подставляется на каждое вхождение', () => {
    const r = compileNamedParams('SELECT :a WHERE x=:a', { a: 5 }, 'postgresql')
    expect(r.sql).toBe('SELECT $1 WHERE x=$2')
    expect(r.values).toEqual([5, 5])
  })

  it('не задевает PostgreSQL ::cast', () => {
    const r = compileNamedParams('SELECT a::text FROM t WHERE id=:id', { id: 7 }, 'postgresql')
    expect(r.sql).toBe('SELECT a::text FROM t WHERE id=$1')
    expect(r.values).toEqual([7])
  })

  it('бросает на отсутствующий параметр', () => {
    expect(() => compileNamedParams('SELECT :missing', {}, 'postgresql')).toThrow(/Не передан параметр/)
  })

  it('инъекция в ЗНАЧЕНИИ остаётся значением, не попадает в SQL', () => {
    const evil = "1; DROP TABLE users; --"
    const r = compileNamedParams('SELECT * FROM t WHERE id=:id', { id: evil }, 'postgresql')
    expect(r.sql).toBe('SELECT * FROM t WHERE id=$1') // ровно один плейсхолдер, без текста инъекции
    expect(r.values).toEqual([evil])                  // вредоносная строка — отдельное значение
  })

  it('без параметров возвращает запрос как есть', () => {
    const r = compileNamedParams('SELECT 1', undefined, 'mysql')
    expect(r.sql).toBe('SELECT 1')
    expect(r.values).toEqual([])
  })
})

describe('assertDbHostAllowed (SSRF-guard для БД)', () => {
  const ORIG = process.env.DATABASE_HOST_ALLOWLIST
  afterEach(() => {
    if (ORIG === undefined) delete process.env.DATABASE_HOST_ALLOWLIST
    else process.env.DATABASE_HOST_ALLOWLIST = ORIG
  })

  it('по умолчанию разрешает приватные хосты (БД во внутренней сети)', () => {
    delete process.env.DATABASE_HOST_ALLOWLIST
    expect(() => assertDbHostAllowed('10.0.0.5')).not.toThrow()
    expect(() => assertDbHostAllowed('db.internal')).not.toThrow()
  })

  it('всегда блокирует cloud-metadata', () => {
    delete process.env.DATABASE_HOST_ALLOWLIST
    expect(() => assertDbHostAllowed('169.254.169.254')).toThrow(/metadata/i)
    expect(() => assertDbHostAllowed('metadata.google.internal')).toThrow()
  })

  it('при заданном allowlist пропускает только из списка', () => {
    process.env.DATABASE_HOST_ALLOWLIST = 'db.allowed.com, replica.allowed.com'
    expect(() => assertDbHostAllowed('db.allowed.com')).not.toThrow()
    expect(() => assertDbHostAllowed('evil.com')).toThrow(/не в списке/i)
  })

  it('undefined host (connectionString-режим) не проверяется', () => {
    expect(() => assertDbHostAllowed(undefined)).not.toThrow()
  })
})

describe('DatabaseQueryService.fetch — ранний отказ без подключения', () => {
  afterAll(async () => { await databaseQueryService.closeAll() })

  it('запрещённый запрос → success:false, без обращения к БД', async () => {
    const config = { type: 'database', databaseType: 'postgresql', host: 'x', database: 'y', query: 'DELETE FROM t' } as unknown as FetchConfig
    const res = await databaseQueryService.fetch(config)
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('NOT_READONLY')
  })

  it('пустой query → success:false EMPTY_QUERY', async () => {
    const config = { type: 'database', databaseType: 'postgresql', host: 'x', database: 'y', query: '' } as unknown as FetchConfig
    const res = await databaseQueryService.fetch(config)
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('EMPTY_QUERY')
  })

  it('неподдержанный диалект → success:false', async () => {
    const config = { type: 'database', databaseType: 'sqlite', host: 'x', database: 'y', query: 'SELECT 1' } as unknown as FetchConfig
    const res = await databaseQueryService.fetch(config)
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('UNSUPPORTED_DIALECT')
  })

  it('нет связи подключения (ни host, ни connectionString) → INVALID_CONNECTION', async () => {
    const config = { type: 'database', databaseType: 'postgresql', query: 'SELECT 1' } as unknown as FetchConfig
    const res = await databaseQueryService.fetch(config)
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('INVALID_CONNECTION')
  })
})
