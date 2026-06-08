/**
 * DatabaseQueryService — безопасное выполнение SQL-запросов (read-only) к
 * PostgreSQL и MySQL для DataSource типа 'database'.
 *
 * Гарантии безопасности (defense-in-depth):
 *  1. Только SELECT/WITH — структурная проверка (validateReadOnlyQuery).
 *  2. Один statement — множественные запросы через ';' запрещены.
 *  3. Параметризация — значения подставляются драйвером, не конкатенацией
 *     (compileNamedParams: :name → $1 для pg / ? для mysql).
 *  4. READ ONLY транзакция — даже если фильтр ключевых слов что-то пропустит,
 *     СУБД отклонит запись.
 *  5. statement timeout и лимит строк.
 *  6. Секреты подключения (password/connectionString) дешифруются здесь, перед
 *     использованием; в БД они хранятся зашифрованными.
 *
 * Драйверы (pg, mysql2) грузятся лениво — pg-only окружение не тянет mysql2.
 */

import crypto from 'crypto'
import path from 'path'
import { CredentialsManager } from './CredentialsManager'
import { logger } from './Logger'
import type { FetchConfig, FetchResult } from './SecureDataSourceService'

export type DbDialect = 'postgresql' | 'mysql' | 'sqlite'

export class DatabaseQueryError extends Error {
  code: string
  constructor(message: string, code = 'DB_QUERY_ERROR') {
    super(message)
    this.name = 'DatabaseQueryError'
    this.code = code
  }
}

const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_MAX_ROWS = 1000
const POOL_MAX_CONNECTIONS = 5
const POOL_IDLE_TIMEOUT_MS = 30000

/**
 * Изменяющие/опасные ключевые слова. Запрос обязан начинаться с SELECT/WITH,
 * поэтому это вторичный фильтр (whole-word) от вложенных конструкций.
 * 'into' ловит SELECT INTO / REPLACE INTO.
 */
const FORBIDDEN_KEYWORDS = [
  'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
  'grant', 'revoke', 'into', 'attach', 'vacuum', 'call', 'exec', 'execute', 'merge',
]

/**
 * Удаляет комментарии и строковые литералы для структурного анализа запроса,
 * чтобы ключевые слова/';' внутри строк не влияли на проверки.
 */
function stripSqlNoise(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:""|[^"])*"/g, '""')
    .replace(/`(?:``|[^`])*`/g, '``')
}

/**
 * Проверяет, что запрос — одиночный read-only SELECT. Бросает DatabaseQueryError.
 */
export function validateReadOnlyQuery(rawSql: string): void {
  if (typeof rawSql !== 'string' || !rawSql.trim()) {
    throw new DatabaseQueryError('SQL-запрос пуст', 'EMPTY_QUERY')
  }

  const stripped = stripSqlNoise(rawSql)
  const normalized = stripped.trim().replace(/;\s*$/, '') // отрезаем завершающий ';'

  if (!normalized) {
    throw new DatabaseQueryError('SQL-запрос пуст', 'EMPTY_QUERY')
  }

  // Единственный statement: после удаления литералов/комментариев ';' быть не должно
  if (normalized.includes(';')) {
    throw new DatabaseQueryError(
      'Разрешён только один SQL-запрос (множественные statements запрещены)',
      'MULTIPLE_STATEMENTS'
    )
  }

  // Должен начинаться с SELECT или WITH (CTE)
  if (!/^\s*(select|with)\b/i.test(normalized)) {
    throw new DatabaseQueryError('Разрешены только SELECT-запросы (read-only)', 'NOT_READONLY')
  }

  const lower = normalized.toLowerCase()
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (new RegExp('\\b' + kw + '\\b').test(lower)) {
      throw new DatabaseQueryError(
        `Запрещённая SQL-команда: ${kw.toUpperCase()} (разрешён только SELECT)`,
        'FORBIDDEN_KEYWORD'
      )
    }
  }
}

export interface CompiledQuery {
  sql: string
  values: unknown[]
}

/**
 * Компилирует именованные параметры (:name) в плейсхолдеры драйвера.
 *  - postgresql → $1, $2, ... (значение на каждое вхождение)
 *  - mysql / sqlite → ?
 *
 * Полноценный сканер (не regex): пропускает строковые литералы ('...', "...",
 * `...`), комментарии (-- и /* *\/), PostgreSQL-касты (::), срезы массивов
 * (arr[1:3]) и имена, которым предшествует словесный символ. Это исправляет
 * ложную замену ':name' внутри строкового литерала.
 */
export function compileNamedParams(
  sql: string,
  params: Record<string, unknown> | undefined,
  dialect: DbDialect
): CompiledQuery {
  const p = params || {}
  const values: unknown[] = []
  const placeholder = () => (dialect === 'postgresql' ? `$${values.length}` : '?')
  const n = sql.length
  let out = ''
  let i = 0

  const isWord = (ch: string | undefined) => !!ch && /[A-Za-z0-9_]/.test(ch)

  while (i < n) {
    const c = sql[i]
    const next = sql[i + 1]

    // Линейный комментарий -- … \n
    if (c === '-' && next === '-') {
      const nl = sql.indexOf('\n', i)
      const stop = nl === -1 ? n : nl + 1
      out += sql.slice(i, stop)
      i = stop
      continue
    }
    // Блочный комментарий /* … */
    if (c === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      out += sql.slice(i, stop)
      i = stop
      continue
    }
    // Строковые литералы и backtick-идентификаторы (с поддержкой '' / "" / `` экранирования)
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      out += c
      i++
      while (i < n) {
        out += sql[i]
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { out += sql[i + 1]; i += 2; continue }
          i++
          break
        }
        i++
      }
      continue
    }
    // PostgreSQL cast '::' — копируем как есть
    if (c === ':' && next === ':') {
      out += '::'
      i += 2
      continue
    }
    // Именованный параметр :ident — только если перед ':' не словесный символ
    // (исключает срезы массивов и склейки), а после — буква/подчёркивание.
    if (c === ':' && next && /[A-Za-z_]/.test(next) && !isWord(out[out.length - 1])) {
      let j = i + 1
      let name = ''
      while (j < n && isWord(sql[j])) { name += sql[j]; j++ }
      if (!Object.prototype.hasOwnProperty.call(p, name)) {
        throw new DatabaseQueryError(`Не передан параметр запроса: :${name}`, 'MISSING_PARAM')
      }
      values.push(p[name])
      out += placeholder()
      i = j
      continue
    }

    out += c
    i++
  }

  return { sql: out, values }
}

/**
 * Лёгкая SSRF-проверка хоста БД. В отличие от HTTP-источников, БД часто живут во
 * внутренней сети, поэтому приватные адреса НЕ блокируются по умолчанию —
 * блокируется лишь cloud-metadata. Жёсткий allowlist задаётся
 * DATABASE_HOST_ALLOWLIST (через запятую, точное совпадение hostname).
 */
export function assertDbHostAllowed(host: string | undefined): void {
  if (!host) return // connectionString-режим: хост внутри строки, проверка пропускается
  const h = host.trim().toLowerCase()
  const allow = (process.env.DATABASE_HOST_ALLOWLIST || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)

  if (allow.length > 0) {
    if (!allow.includes(h)) {
      throw new DatabaseQueryError(`Хост БД не в списке разрешённых: ${h}`, 'HOST_NOT_ALLOWED')
    }
    return
  }

  // Всегда блокируем cloud-metadata, даже без allowlist
  if (h === '169.254.169.254' || h === 'metadata.google.internal' || h.startsWith('fd00:ec2')) {
    throw new DatabaseQueryError(`Хост БД заблокирован (cloud metadata): ${h}`, 'HOST_BLOCKED')
  }
}

/**
 * Path-guard для sqlite: файл должен лежать внутри SQLITE_ALLOWED_DIR (fail-closed,
 * без переменной sqlite запрещён) — защита от чтения произвольных файлов сервера.
 */
export function assertSqlitePathAllowed(file: string): void {
  const allowedDir = process.env.SQLITE_ALLOWED_DIR
  if (!allowedDir) {
    throw new DatabaseQueryError(
      'SQLite не сконфигурирован на сервере: задайте SQLITE_ALLOWED_DIR',
      'SQLITE_NOT_CONFIGURED'
    )
  }
  const base = path.resolve(allowedDir)
  const resolved = path.resolve(file)
  const rel = path.relative(base, resolved)
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new DatabaseQueryError(`Путь к sqlite вне разрешённой директории: ${file}`, 'SQLITE_PATH_BLOCKED')
  }
}

interface ResolvedConnection {
  dialect: DbDialect
  connectionString?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  sqliteFile?: string
}

interface CachedPool {
  pool: any
  dialect: DbDialect
}

// Ленивая загрузка драйверов
let pgLib: any
let mysqlLib: any
let sqliteLib: any
function getPg(): any {
  if (!pgLib) pgLib = require('pg')
  return pgLib
}
function getMysql(): any {
  if (!mysqlLib) {
    try {
      mysqlLib = require('mysql2/promise')
    } catch {
      throw new DatabaseQueryError('Драйвер MySQL (mysql2) не установлен на сервере', 'DRIVER_MISSING')
    }
  }
  return mysqlLib
}
function getSqlite(): any {
  if (!sqliteLib) {
    try {
      sqliteLib = require('better-sqlite3')
    } catch {
      throw new DatabaseQueryError('Драйвер SQLite (better-sqlite3) не установлен на сервере', 'DRIVER_MISSING')
    }
  }
  return sqliteLib
}

class DatabaseQueryService {
  private pools: Map<string, CachedPool> = new Map()

  /**
   * Выполняет read-only SELECT и возвращает массив строк в FetchResult.
   */
  async fetch(config: FetchConfig): Promise<FetchResult> {
    const startTime = Date.now()
    try {
      const dialect = this.resolveDialect((config as any).databaseType)
      const sql = (config as any).query as string
      if (!sql) {
        throw new DatabaseQueryError('Не задан SQL-запрос (config.query)', 'EMPTY_QUERY')
      }

      // 1. Структурная проверка read-only
      validateReadOnlyQuery(sql)

      // 2. Дешифруем секреты подключения
      const decrypted = await CredentialsManager.decryptConfigSecrets(config as any)
      const conn = this.resolveConnection(dialect, decrypted)

      // 3. Защита хоста/пути
      if (dialect === 'sqlite') {
        assertSqlitePathAllowed(conn.sqliteFile!)
      } else {
        assertDbHostAllowed(conn.host)
      }

      // 4. Параметризация
      const compiled = compileNamedParams(sql, (config as any).queryParams, dialect)

      const timeoutMs = (config.timeout as number) || DEFAULT_TIMEOUT_MS
      const maxRows = ((config as any).maxRows as number) || DEFAULT_MAX_ROWS

      const rows = dialect === 'postgresql'
        ? await this.runPostgres(conn, compiled, timeoutMs)
        : dialect === 'mysql'
          ? await this.runMysql(conn, compiled, timeoutMs)
          : this.runSqlite(conn, compiled)

      const truncated = rows.length > maxRows
      const data = truncated ? rows.slice(0, maxRows) : rows

      return {
        success: true,
        data,
        metadata: {
          statusCode: 200,
          headers: {
            'x-data-source-type': 'database',
            'x-db-dialect': dialect,
            'x-row-count': String(rows.length),
            ...(truncated ? { 'x-rows-truncated': String(maxRows) } : {}),
          },
          responseTime: Date.now() - startTime,
        },
      }
    } catch (error: any) {
      const code = error instanceof DatabaseQueryError ? error.code : 'DB_FETCH_ERROR'
      logger.warn('DatabaseQueryService fetch failed', { code, message: error?.message })
      return {
        success: false,
        error: {
          code,
          message: error?.message || 'Database query failed',
          details: error?.stack,
        },
        metadata: { statusCode: 0, headers: {}, responseTime: Date.now() - startTime },
      }
    }
  }

  private resolveDialect(databaseType: unknown): DbDialect {
    const t = String(databaseType || 'postgresql').toLowerCase()
    if (t === 'postgresql' || t === 'postgres' || t === 'pg') return 'postgresql'
    if (t === 'mysql' || t === 'mariadb') return 'mysql'
    if (t === 'sqlite' || t === 'sqlite3') return 'sqlite'
    throw new DatabaseQueryError(
      `Тип БД "${databaseType}" не поддержан (доступны PostgreSQL, MySQL, SQLite)`,
      'UNSUPPORTED_DIALECT'
    )
  }

  private resolveConnection(
    dialect: DbDialect,
    config: Record<string, unknown>
  ): ResolvedConnection {
    if (dialect === 'sqlite') {
      const file = (config.connectionString || config.database) as string | undefined
      if (!file) {
        throw new DatabaseQueryError('Не задан путь к файлу SQLite (database)', 'INVALID_CONNECTION')
      }
      return { dialect, sqliteFile: file }
    }
    const connectionString = config.connectionString as string | undefined
    if (connectionString) {
      return { dialect, connectionString }
    }
    const host = config.host as string | undefined
    if (!host || !config.database) {
      throw new DatabaseQueryError(
        'Не задано подключение: укажите connectionString или host + database',
        'INVALID_CONNECTION'
      )
    }
    return {
      dialect,
      host,
      port: (config.port as number) || (dialect === 'postgresql' ? 5432 : 3306),
      database: config.database as string,
      username: config.username as string | undefined,
      password: config.password as string | undefined,
    }
  }

  /**
   * Ключ кэша пула — по нормализованной идентичности подключения.
   */
  private poolKey(conn: ResolvedConnection): string {
    const sig = JSON.stringify({
      d: conn.dialect,
      cs: conn.connectionString,
      h: conn.host,
      p: conn.port,
      db: conn.database,
      u: conn.username,
      pw: conn.password,
    })
    return crypto.createHash('md5').update(sig).digest('hex')
  }

  private getPostgresPool(conn: ResolvedConnection): any {
    const key = this.poolKey(conn)
    const cached = this.pools.get(key)
    if (cached) return cached.pool

    const { Pool } = getPg()
    const pool = conn.connectionString
      ? new Pool({
          connectionString: conn.connectionString,
          max: POOL_MAX_CONNECTIONS,
          idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
          connectionTimeoutMillis: 10000,
        })
      : new Pool({
          host: conn.host,
          port: conn.port,
          database: conn.database,
          user: conn.username,
          password: conn.password,
          max: POOL_MAX_CONNECTIONS,
          idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
          connectionTimeoutMillis: 10000,
        })
    // Пул не должен валить процесс на фоновых ошибках соединения
    pool.on('error', (err: any) => logger.warn('pg pool error', { message: err?.message }))
    this.pools.set(key, { pool, dialect: 'postgresql' })
    return pool
  }

  private getMysqlPool(conn: ResolvedConnection): any {
    const key = this.poolKey(conn)
    const cached = this.pools.get(key)
    if (cached) return cached.pool

    const mysql = getMysql()
    const pool = conn.connectionString
      ? mysql.createPool(conn.connectionString)
      : mysql.createPool({
          host: conn.host,
          port: conn.port,
          database: conn.database,
          user: conn.username,
          password: conn.password,
          connectionLimit: POOL_MAX_CONNECTIONS,
          connectTimeout: 10000,
          waitForConnections: true,
        })
    this.pools.set(key, { pool, dialect: 'mysql' })
    return pool
  }

  private async runPostgres(conn: ResolvedConnection, compiled: CompiledQuery, timeoutMs: number): Promise<any[]> {
    const pool = this.getPostgresPool(conn)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET TRANSACTION READ ONLY')
      await client.query(`SET LOCAL statement_timeout = ${Math.max(1, Math.floor(timeoutMs))}`)
      const res = await client.query(compiled.sql, compiled.values)
      await client.query('COMMIT')
      return Array.isArray(res.rows) ? res.rows : []
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }
  }

  private getSqliteDb(conn: ResolvedConnection): any {
    const key = this.poolKey(conn)
    const cached = this.pools.get(key)
    if (cached) return cached.pool

    const Database = getSqlite()
    // readonly:true — соединение физически не может писать (сильнейшая гарантия).
    const db = new Database(conn.sqliteFile, { readonly: true, fileMustExist: true })
    this.pools.set(key, { pool: db, dialect: 'sqlite' })
    return db
  }

  private runSqlite(conn: ResolvedConnection, compiled: CompiledQuery): any[] {
    // better-sqlite3 синхронный; readonly-соединение уже исключает запись.
    const db = this.getSqliteDb(conn)
    const stmt = db.prepare(compiled.sql)
    const rows = stmt.all(...compiled.values)
    return Array.isArray(rows) ? rows : []
  }

  private async runMysql(conn: ResolvedConnection, compiled: CompiledQuery, timeoutMs: number): Promise<any[]> {
    const pool = this.getMysqlPool(conn)
    const connection = await pool.getConnection()
    try {
      // READ ONLY транзакция гарантирует отказ на любой записи (defense-in-depth).
      await connection.query('START TRANSACTION READ ONLY')
      const [rows] = await connection.query({ sql: compiled.sql, values: compiled.values, timeout: timeoutMs })
      await connection.query('COMMIT')
      return Array.isArray(rows) ? rows : []
    } catch (e) {
      await connection.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      connection.release()
    }
  }

  /**
   * Закрывает все пулы (для тестов/graceful shutdown).
   */
  async closeAll(): Promise<void> {
    for (const { pool, dialect } of this.pools.values()) {
      try {
        if (dialect === 'sqlite') pool.close()
        else await pool.end()
      } catch (e: any) {
        logger.warn('Failed to close db pool', { message: e?.message })
      }
    }
    this.pools.clear()
  }
}

export const databaseQueryService = new DatabaseQueryService()
export default DatabaseQueryService
