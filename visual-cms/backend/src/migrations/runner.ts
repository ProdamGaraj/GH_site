import { DataSource } from 'typeorm'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../services/Logger'

/**
 * Запускает идемпотентные SQL-миграции из папки migrations/.
 * Каждый .sql файл должен использовать IF NOT EXISTS / IF NOT EXISTS
 * для безопасного повторного запуска.
 * 
 * Отслеживает применённые миграции в таблице _applied_migrations — ПО ИМЕНИ
 * ФАЙЛА. Отсюда правило: применённый файл больше не редактируется. Дописанный
 * в него ALTER не выполнится никогда, а колонка в сущности появится — и первый
 * же SELECT упадёт с «column does not exist». Новое изменение — новый файл.
 *
 * Пустая БД (новый сервер): сначала bootstrapEmptySchema, затем .sql поверх.
 */
export async function runSafeMigrations(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner()

  try {
    await bootstrapEmptySchema(dataSource)

    // Создаём таблицу учёта миграций (если нет)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS _applied_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `)

    // Ищем .sql-миграции в нескольких кандидатах:
    //   1) рядом с раннером (__dirname): src/migrations (ts-node) или dist/migrations (prod, если .sql скопированы);
    //   2) фоллбэк на исходники src/migrations — на случай запуска из dist без копирования .sql.
    const candidateDirs = [
      __dirname,
      path.join(__dirname, '..', '..', 'src', 'migrations'),
    ]
    const listSql = (dir: string) =>
      fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort() : []

    let migrationsDir = candidateDirs[0]
    let sqlFiles = listSql(migrationsDir)
    if (sqlFiles.length === 0) {
      for (const dir of candidateDirs.slice(1)) {
        const found = listSql(dir)
        if (found.length > 0) {
          migrationsDir = dir
          sqlFiles = found
          break
        }
      }
    }

    if (sqlFiles.length === 0) {
      logger.warn(`No .sql migrations found (looked in: ${candidateDirs.join(', ')})`)
      return
    }
    logger.info(`Found ${sqlFiles.length} migration file(s) in ${migrationsDir}`)

    for (const file of sqlFiles) {
      // Проверяем, применена ли миграция
      const result = await queryRunner.query(
        `SELECT name FROM _applied_migrations WHERE name = $1`,
        [file]
      )

      if (result.length > 0) {
        continue // Уже применена
      }

      // Читаем и выполняем SQL
      const sqlPath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(sqlPath, 'utf-8')

      logger.info(`Applying migration: ${file}`)
      try {
        await queryRunner.query(sql)
        await queryRunner.query(
          `INSERT INTO _applied_migrations (name) VALUES ($1)`,
          [file]
        )
        logger.info(`Migration applied: ${file}`)
      } catch (err: any) {
        logger.error(`Migration failed: ${file}`, err instanceof Error ? err : undefined)
        throw err
      }
    }

    logger.info('All migrations up to date')
  } finally {
    await queryRunner.release()
  }
}

/** Таблица-признак «схема уже есть»: базовая, есть в любой рабочей БД CMS. */
export const SCHEMA_MARKER_TABLE = 'sites'

/**
 * Пустая БД → схема из сущностей TypeORM (synchronize), один раз.
 *
 * Базовые таблицы (sites, pages, blocks, data_sources, …) исторически создал
 * synchronize, ни одна .sql-миграция их не создаёт — на чистом сервере первая же
 * миграция падала с «relation … does not exist». Поэтому: нет SCHEMA_MARKER_TABLE →
 * synchronize, затем все .sql поверх (они идемпотентны). Сверено со схемой
 * тестового стенда 2026-11-09: те же таблицы и колонки, разница лишь в именах
 * ограничений и нескольких индексах из сущностей.
 *
 * Существующую БД НЕ трогает никогда: там изменения схемы — только .sql-файлы
 * (synchronize на живой БД может удалить колонки, которых нет в сущностях).
 * Возвращает true, если схема была создана.
 */
export async function bootstrapEmptySchema(dataSource: DataSource): Promise<boolean> {
  const rows: Array<{ exists: boolean }> = await dataSource.query(
    `SELECT to_regclass($1) IS NOT NULL AS "exists"`,
    [`public.${SCHEMA_MARKER_TABLE}`]
  )
  if (rows[0]?.exists) return false

  logger.warn(`Empty database (no "${SCHEMA_MARKER_TABLE}" table): creating the schema from entities`)
  await dataSource.synchronize()
  logger.info('Schema created from entities')
  return true
}
