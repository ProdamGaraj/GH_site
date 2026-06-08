/**
 * Тесты оркестрации драйверов (pg / mysql2) через моки — проверяют, что
 * read-only транзакция выдаётся в правильной последовательности и что строки
 * возвращаются/откатываются. Реального соединения с БД не требуется.
 */

jest.mock('pg', () => {
  const client = { query: jest.fn(), release: jest.fn() }
  const pool = {
    connect: jest.fn(() => Promise.resolve(client)),
    on: jest.fn(),
    end: jest.fn(() => Promise.resolve()),
  }
  const Pool = jest.fn(() => pool)
  return { Pool, __client: client, __pool: pool }
})

jest.mock('mysql2/promise', () => {
  const connection = { query: jest.fn(), release: jest.fn() }
  const pool = {
    getConnection: jest.fn(() => Promise.resolve(connection)),
    end: jest.fn(() => Promise.resolve()),
  }
  const createPool = jest.fn(() => pool)
  return { createPool, __conn: connection, __pool: pool }
})

import { databaseQueryService } from '../services/DatabaseQueryService'
import type { FetchConfig } from '../services/SecureDataSourceService'

/* eslint-disable @typescript-eslint/no-var-requires */
const pg = require('pg')
const mysql = require('mysql2/promise')

afterEach(async () => {
  await databaseQueryService.closeAll()
  jest.clearAllMocks()
})

describe('runPostgres — read-only транзакция', () => {
  beforeEach(() => {
    // Запрос с values (реальный SELECT) → строки; служебные (BEGIN/SET/COMMIT) → {}
    pg.__client.query.mockImplementation((_sql: string, values?: unknown[]) =>
      Promise.resolve(values !== undefined ? { rows: [{ id: 1 }, { id: 2 }] } : {})
    )
  })

  const baseConfig = {
    type: 'database',
    databaseType: 'postgresql',
    host: 'db.internal',
    database: 'app',
    query: 'SELECT id FROM t',
  } as unknown as FetchConfig

  it('выдаёт BEGIN → SET TRANSACTION READ ONLY → statement_timeout → SELECT → COMMIT', async () => {
    const res = await databaseQueryService.fetch(baseConfig)

    expect(res.success).toBe(true)
    expect(res.data).toEqual([{ id: 1 }, { id: 2 }])

    const calls = pg.__client.query.mock.calls.map((c: any[]) => c[0])
    expect(calls[0]).toBe('BEGIN')
    expect(calls[1]).toBe('SET TRANSACTION READ ONLY')
    expect(calls[2]).toMatch(/^SET LOCAL statement_timeout = \d+$/)
    expect(pg.__client.query).toHaveBeenCalledWith('SELECT id FROM t', [])
    expect(calls[calls.length - 1]).toBe('COMMIT')
    expect(pg.__client.release).toHaveBeenCalledTimes(1)
  })

  it('параметры передаются драйверу отдельным массивом (не в SQL)', async () => {
    const cfg = {
      ...baseConfig,
      query: 'SELECT id FROM t WHERE status = :status',
      queryParams: { status: 'active' },
    } as unknown as FetchConfig

    await databaseQueryService.fetch(cfg)

    expect(pg.__client.query).toHaveBeenCalledWith('SELECT id FROM t WHERE status = $1', ['active'])
  })

  it('при ошибке запроса делает ROLLBACK, освобождает клиент и возвращает success:false', async () => {
    pg.__client.query.mockImplementation((_sql: string, values?: unknown[]) =>
      values !== undefined ? Promise.reject(new Error('boom')) : Promise.resolve({})
    )

    const res = await databaseQueryService.fetch(baseConfig)

    expect(res.success).toBe(false)
    expect(res.error?.message).toContain('boom')
    const calls = pg.__client.query.mock.calls.map((c: any[]) => c[0])
    expect(calls).toContain('ROLLBACK')
    expect(pg.__client.release).toHaveBeenCalledTimes(1)
  })

  it('применяет лимит строк (maxRows)', async () => {
    pg.__client.query.mockImplementation((_sql: string, values?: unknown[]) =>
      Promise.resolve(values !== undefined ? { rows: [{ id: 1 }, { id: 2 }, { id: 3 }] } : {})
    )
    const res = await databaseQueryService.fetch({ ...baseConfig, maxRows: 2 } as unknown as FetchConfig)
    expect((res.data as any[]).length).toBe(2)
    expect(res.metadata?.headers['x-rows-truncated']).toBe('2')
  })

  it('переиспользует пул для одинакового подключения', async () => {
    await databaseQueryService.fetch(baseConfig)
    await databaseQueryService.fetch(baseConfig)
    expect(pg.Pool).toHaveBeenCalledTimes(1)
  })
})

describe('runMysql — read-only транзакция', () => {
  beforeEach(() => {
    // Объект-запрос (реальный SELECT) → строки; строковые служебные → пусто
    mysql.__conn.query.mockImplementation((arg: any) =>
      Promise.resolve(typeof arg === 'object' ? [[{ x: 1 }], []] : [[], []])
    )
  })

  it('выдаёт START TRANSACTION READ ONLY → SELECT(timeout) → COMMIT и возвращает строки', async () => {
    const cfg = {
      type: 'database',
      databaseType: 'mysql',
      host: 'db.internal',
      database: 'app',
      query: 'SELECT x FROM t',
    } as unknown as FetchConfig

    const res = await databaseQueryService.fetch(cfg)

    expect(res.success).toBe(true)
    expect(res.data).toEqual([{ x: 1 }])

    const stringCalls = mysql.__conn.query.mock.calls
      .map((c: any[]) => c[0])
      .filter((a: any) => typeof a === 'string')
    expect(stringCalls).toContain('START TRANSACTION READ ONLY')
    expect(stringCalls).toContain('COMMIT')

    const objCall = mysql.__conn.query.mock.calls.map((c: any[]) => c[0]).find((a: any) => typeof a === 'object')
    expect(objCall).toMatchObject({ sql: 'SELECT x FROM t', values: [], timeout: expect.any(Number) })
    expect(mysql.__conn.release).toHaveBeenCalledTimes(1)
  })
})
