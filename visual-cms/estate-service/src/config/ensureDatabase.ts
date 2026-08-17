import { Client } from 'pg'
import { logger } from '../services/Logger'

/**
 * Гарантирует существование целевой БД (`estate`) ДО инициализации TypeORM.
 *
 * Зачем: postgres-контейнер CMS уже инициализирован (external volume), поэтому
 * скрипты /docker-entrypoint-initdb.d не выполнятся — второй БД `estate` там нет.
 * Здесь подключаемся к обслуживающей БД `postgres` тем же пользователем и
 * идемпотентно создаём целевую БД, если её нет. CREATE DATABASE не поддерживает
 * IF NOT EXISTS, поэтому проверяем pg_database.
 *
 * Имя БД валидируется (только [a-z0-9_]) — оно приходит из DATABASE_URL (наш
 * конфиг), но идентификатор нельзя параметризовать, поэтому защищаемся от
 * инъекции в DDL явной проверкой.
 */
/**
 * Извлекает и валидирует имя целевой БД из connection string. Только
 * [a-z0-9_] (первый символ буква/подчёркивание) — идентификатор нельзя
 * параметризовать в DDL, поэтому защищаемся явной проверкой. Чистая функция.
 */
export function parseTargetDb(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }
  const url = new URL(databaseUrl)
  const targetDb = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!targetDb) {
    throw new Error('DATABASE_URL has no database name')
  }
  if (!/^[a-z_][a-z0-9_]*$/i.test(targetDb)) {
    throw new Error(`Unsafe database name in DATABASE_URL: ${targetDb}`)
  }
  return targetDb
}

export async function ensureDatabase(databaseUrl: string | undefined): Promise<void> {
  const targetDb = parseTargetDb(databaseUrl)

  // Подключение к обслуживающей БД `postgres` на том же сервере.
  // databaseUrl гарантированно определён — parseTargetDb бросил бы иначе.
  const adminUrl = new URL(databaseUrl as string)
  adminUrl.pathname = '/postgres'

  const client = new Client({ connectionString: adminUrl.toString() })
  try {
    await client.connect()
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb])
    if (exists.rowCount === 0) {
      // Идентификатор в кавычках; имя уже провалидировано выше.
      await client.query(`CREATE DATABASE "${targetDb}"`)
      logger.info(`Created database "${targetDb}"`)
    } else {
      logger.info(`Database "${targetDb}" already exists`)
    }
  } finally {
    await client.end()
  }
}
