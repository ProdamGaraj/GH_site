/**
 * Перешифровка секретов источников данных на новый ENCRYPTION_KEY.
 *
 * Запуск в проде (из каталога visual-cms):
 *   docker compose run --rm -e OLD_ENCRYPTION_KEY=<старый|dev-fallback> backend \
 *     node dist/scripts/rotate-encryption-key.js [--dry-run]
 * Обычно вызывается через deploy/scripts/secrets.sh — руками не нужно.
 *
 *  - ENCRYPTION_KEY       — НОВЫЙ ключ (берётся из окружения контейнера, т.е. из .env);
 *  - OLD_ENCRYPTION_KEY   — прежний ключ; «dev-fallback» = встроенный dev-ключ, которым
 *                           шифровали стенды без ENCRYPTION_KEY.
 *
 * Всё в одной транзакции: любой нерасшифровываемый секрет → откат, exit 1.
 * Повторный запуск безопасен (уже перешифрованное пропускается).
 */
import { AppDataSource } from '../config/database'
import { resolveEncryptionKey } from '../services/CredentialsManager'
import { planRotation, DataSourceSecretsRow } from '../services/EncryptionKeyRotation'

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const oldSpec = process.env.OLD_ENCRYPTION_KEY || ''
  const newSpec = process.env.ENCRYPTION_KEY || ''

  if (!oldSpec || !newSpec) {
    console.error('[rotate-encryption-key] OLD_ENCRYPTION_KEY and ENCRYPTION_KEY are required')
    process.exit(1)
  }
  if (oldSpec === newSpec) {
    console.log('[rotate-encryption-key] old and new keys are identical — nothing to do')
    return
  }

  const oldKey = resolveEncryptionKey(oldSpec)
  const newKey = resolveEncryptionKey(newSpec)

  await AppDataSource.initialize()
  const runner = AppDataSource.createQueryRunner()
  await runner.connect()
  await runner.startTransaction()
  try {
    const rows: DataSourceSecretsRow[] = await runner.query(
      'SELECT id, config, "authConfig" FROM data_sources FOR UPDATE'
    )
    const plan = planRotation(rows, oldKey, newKey)

    if (!dryRun) {
      for (const u of plan.updates) {
        await runner.query(
          'UPDATE data_sources SET config = $2::jsonb, "authConfig" = $3::jsonb WHERE id = $1',
          [u.id, JSON.stringify(u.config), u.authConfig === null || u.authConfig === undefined ? null : JSON.stringify(u.authConfig)]
        )
      }
      await runner.commitTransaction()
    } else {
      await runner.rollbackTransaction()
    }

    console.log(
      `[rotate-encryption-key] ${dryRun ? 'DRY RUN: ' : ''}rows=${rows.length} ` +
        `updated=${plan.updates.length} reencrypted=${plan.reencrypted} alreadyCurrent=${plan.alreadyCurrent}`
    )
  } catch (err) {
    if (runner.isTransactionActive) await runner.rollbackTransaction()
    throw err
  } finally {
    await runner.release()
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error('[rotate-encryption-key] Failed, nothing was written:', err instanceof Error ? err.message : err)
  process.exit(1)
})
