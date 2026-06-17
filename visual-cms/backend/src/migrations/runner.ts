import { DataSource } from 'typeorm'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../services/Logger'

/**
 * Запускает идемпотентные SQL-миграции из папки migrations/.
 * Каждый .sql файл должен использовать IF NOT EXISTS / IF NOT EXISTS
 * для безопасного повторного запуска.
 * 
 * Отслеживает применённые миграции в таблице _applied_migrations.
 */
export async function runSafeMigrations(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner()

  try {
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
