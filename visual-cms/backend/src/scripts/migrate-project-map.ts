/**
 * Карта проекта в блоке «Complex location» (см. projectMapBlock.ts).
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-project-map.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-project-map.ts
 *
 * Флаги:
 *   --dry-run      показать правки, ничего не писать
 *   --out=<dir>    куда положить резервную копию
 *
 * Блок подключён к шаблону страниц проектов: после записи нужен передеплой
 * коллекции «Проекты (ЖК)». Сама карта появится у проектов, у которых в
 * админке estate заданы координаты дома.
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { MigrationError, StructureNode } from './choiceToPlanTypes'
import { migrateLocationBlock } from './projectMapBlock'
import { flag, hasFlag, writeBackup } from './migrationIo'

/** Блок «Complex location» на .19. */
const LOCATION_BLOCK_ID = '3cead26c-5980-4154-9084-5a2cbf239362'

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const repo = AppDataSource.getRepository(Block)
    const block = await repo.findOne({ where: { id: LOCATION_BLOCK_ID } })
    if (!block) throw new MigrationError(`Блок «Complex location» (${LOCATION_BLOCK_ID}) не найден`)
    const result = migrateLocationBlock(block.structure as unknown as StructureNode)
    console.log(`Блок «${block.name}»: ${result.alreadyMigrated ? 'уже применено' : ''}`)
    for (const change of result.changes) console.log(`  · ${change}`)
    if (result.alreadyMigrated) return
    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }
    const backup = writeBackup(outDir, 'project-map', { id: block.id, name: block.name, structure: block.structure })
    console.log(`\nКопия блока: ${backup}`)
    block.structure = result.structure as unknown as Block['structure']
    await repo.save(block)
    console.log('Записано. Теперь нужен передеплой коллекции «Проекты (ЖК)».')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err instanceof MigrationError ? `Миграция не выполнена: ${err.message}` : err)
  process.exit(1)
})
