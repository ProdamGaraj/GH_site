import { DataSource } from 'typeorm'
import * as fs from 'fs'
import * as path from 'path'

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

    // Читаем SQL-файлы из папки миграций
    const migrationsDir = path.join(__dirname)
    if (!fs.existsSync(migrationsDir)) {
      console.log('📋 No migrations directory found, skipping')
      return
    }

    const sqlFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort() // Порядок по имени файла

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

      console.log(`📋 Applying migration: ${file}`)
      try {
        await queryRunner.query(sql)
        await queryRunner.query(
          `INSERT INTO _applied_migrations (name) VALUES ($1)`,
          [file]
        )
        console.log(`✅ Migration applied: ${file}`)
      } catch (err: any) {
        console.error(`❌ Migration failed: ${file}`, err.message)
        throw err
      }
    }

    console.log('📋 All migrations up to date')
  } finally {
    await queryRunner.release()
  }
}
