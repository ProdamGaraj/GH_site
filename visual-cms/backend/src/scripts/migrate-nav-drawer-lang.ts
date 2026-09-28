/**
 * Кнопки языка в мобильном меню шапки (см. navDrawerLang.ts).
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-nav-drawer-lang.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-nav-drawer-lang.ts
 *
 * Флаги:
 *   --dry-run      показать правки, ничего не писать
 *   --out=<dir>    куда положить резервную копию
 *
 * Шапка — на всех страницах: после записи нужен передеплой сайта и коллекций.
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { MigrationError, StructureNode } from './choiceToPlanTypes'
import { migrateNavDrawerLang } from './navDrawerLang'
import { flag, hasFlag, writeBackup } from './migrationIo'

/** Блок «Navigation» на .19. */
const NAV_BLOCK_ID = '3d23aed7-be04-4ed7-934f-f0281b9c4670'

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const repo = AppDataSource.getRepository(Block)
    const block = await repo.findOne({ where: { id: NAV_BLOCK_ID } })
    if (!block) throw new MigrationError(`Блок «Navigation» (${NAV_BLOCK_ID}) не найден`)
    const result = migrateNavDrawerLang(block.structure as unknown as StructureNode)
    console.log(`Блок «${block.name}»: ${result.alreadyMigrated ? 'уже применено' : ''}`)
    for (const change of result.changes) console.log(`  · ${change}`)
    if (result.alreadyMigrated) return
    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }
    const backup = writeBackup(outDir, 'nav-drawer-lang', { id: block.id, name: block.name, structure: block.structure })
    console.log(`\nКопия блока: ${backup}`)
    block.structure = result.structure as unknown as Block['structure']
    await repo.save(block)
    console.log('Записано. Теперь нужен передеплой сайта и коллекций.')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err instanceof MigrationError ? `Миграция не выполнена: ${err.message}` : err)
  process.exit(1)
})
