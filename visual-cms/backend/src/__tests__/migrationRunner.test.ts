/**
 * Migration runner: empty-database bootstrap + .sql files on top.
 * The real .sql files of src/migrations are used (the runner finds them next to
 * itself); the database is a recording fake.
 */
jest.mock('../services/Logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import * as fs from 'fs'
import * as path from 'path'
import type { DataSource } from 'typeorm'
import { bootstrapEmptySchema, runSafeMigrations, SCHEMA_MARKER_TABLE } from '../migrations/runner'

const SQL_FILES = fs
  .readdirSync(path.join(__dirname, '..', 'migrations'))
  .filter(f => f.endsWith('.sql'))
  .sort()

interface FakeDbOptions {
  /** Does the schema marker table exist? */
  hasSchema: boolean
  /** Migration files already recorded in _applied_migrations. */
  applied?: string[]
  synchronizeError?: Error
}

/** Fake DataSource that records every statement in order, in one `events` list. */
function fakeDb(opts: FakeDbOptions) {
  const events: string[] = []
  const applied = new Set(opts.applied ?? [])
  const release = jest.fn(async () => undefined)

  const queryRunner = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (/CREATE TABLE IF NOT EXISTS _applied_migrations/.test(sql)) {
        events.push('create-tracking-table')
        return []
      }
      if (/SELECT name FROM _applied_migrations/.test(sql)) {
        return applied.has(String(params?.[0])) ? [{ name: params?.[0] }] : []
      }
      if (/INSERT INTO _applied_migrations/.test(sql)) {
        applied.add(String(params?.[0]))
        events.push(`recorded:${params?.[0]}`)
        return []
      }
      events.push('migration-sql')
      return []
    }),
    release,
  }

  const dataSource = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      events.push(`check:${params?.[0]}`)
      expect(sql).toMatch(/to_regclass\(\$1\) IS NOT NULL/)
      return [{ exists: opts.hasSchema }]
    }),
    synchronize: jest.fn(async () => {
      events.push('synchronize')
      if (opts.synchronizeError) throw opts.synchronizeError
    }),
    createQueryRunner: () => queryRunner,
  }

  return { dataSource: dataSource as unknown as DataSource, raw: dataSource, queryRunner, events, applied, release }
}

describe('bootstrapEmptySchema', () => {
  it('creates the schema from entities when the marker table is missing', async () => {
    const db = fakeDb({ hasSchema: false })
    await expect(bootstrapEmptySchema(db.dataSource)).resolves.toBe(true)
    expect(db.raw.synchronize).toHaveBeenCalledTimes(1)
    expect(db.events).toEqual([`check:public.${SCHEMA_MARKER_TABLE}`, 'synchronize'])
  })

  it('never synchronizes an existing database', async () => {
    const db = fakeDb({ hasSchema: true })
    await expect(bootstrapEmptySchema(db.dataSource)).resolves.toBe(false)
    expect(db.raw.synchronize).not.toHaveBeenCalled()
  })

  it('checks the core "sites" table in the public schema', async () => {
    expect(SCHEMA_MARKER_TABLE).toBe('sites')
    const db = fakeDb({ hasSchema: true })
    await bootstrapEmptySchema(db.dataSource)
    expect(db.raw.query).toHaveBeenCalledWith(expect.any(String), ['public.sites'])
  })

  it('propagates a synchronize failure (the backend must not start half-initialised)', async () => {
    const db = fakeDb({ hasSchema: false, synchronizeError: new Error('boom') })
    await expect(bootstrapEmptySchema(db.dataSource)).rejects.toThrow('boom')
  })
})

describe('runSafeMigrations', () => {
  it('has real migration files to run (guards the test itself)', () => {
    expect(SQL_FILES.length).toBeGreaterThan(0)
  })

  it('empty database: schema first, then every .sql file applied and recorded in order', async () => {
    const db = fakeDb({ hasSchema: false })
    await runSafeMigrations(db.dataSource)

    expect(db.events.indexOf('synchronize')).toBeGreaterThanOrEqual(0)
    expect(db.events.indexOf('synchronize')).toBeLessThan(db.events.indexOf('migration-sql'))
    const recorded = db.events.filter(e => e.startsWith('recorded:')).map(e => e.slice('recorded:'.length))
    expect(recorded).toEqual(SQL_FILES)
    expect(db.release).toHaveBeenCalledTimes(1)
  })

  it('existing database: no synchronize, only pending files run', async () => {
    const [first, ...rest] = SQL_FILES
    const db = fakeDb({ hasSchema: true, applied: rest })
    await runSafeMigrations(db.dataSource)

    expect(db.raw.synchronize).not.toHaveBeenCalled()
    expect(db.events.filter(e => e === 'migration-sql')).toHaveLength(1)
    expect(db.events).toContain(`recorded:${first}`)
  })

  it('up-to-date database: nothing executed besides the checks', async () => {
    const db = fakeDb({ hasSchema: true, applied: SQL_FILES })
    await runSafeMigrations(db.dataSource)

    expect(db.raw.synchronize).not.toHaveBeenCalled()
    expect(db.events).not.toContain('migration-sql')
  })

  it('bootstrap failure: no migration runs, the query runner is released, the error surfaces', async () => {
    const db = fakeDb({ hasSchema: false, synchronizeError: new Error('cannot create') })
    await expect(runSafeMigrations(db.dataSource)).rejects.toThrow('cannot create')

    expect(db.events).not.toContain('migration-sql')
    expect(db.release).toHaveBeenCalledTimes(1)
  })
})
