/**
 * «Панорама 360°» в «Локации» страницы проекта: кнопка по ссылке проекта
 * (см. complexPanorama.ts). Резервная копия блока, запись одной транзакцией.
 *
 * Запуск на сервере:
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/migrate-complex-panorama.ts --dry-run
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/migrate-complex-panorama.ts
 *
 * Флаги:
 *   --dry-run        показать правки, ничего не писать
 *   --block=<uuid>   блок «Complex location» (по умолчанию — на .19)
 *   --out=<dir>      куда положить резервную копию
 *
 * После записи нужен передеплой коллекции «Проекты (ЖК)».
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { MigrationError, StructureNode } from './choiceToPlanTypes'
import { migrateComplexPanorama } from './complexPanorama'
import { flag, hasFlag, writeBackup } from './migrationIo'

const DEFAULT_BLOCK_ID = '3cead26c-5980-4154-9084-5a2cbf239362'

async function main(): Promise<void> {
  const blockId = flag('block') ?? DEFAULT_BLOCK_ID
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const block = await AppDataSource.getRepository(Block).findOne({ where: { id: blockId } })
    if (!block) throw new MigrationError(`Блок ${blockId} не найден`)
    console.log(`Блок: ${block.name} (${block.id})`)

    const result = migrateComplexPanorama(block.structure as unknown as StructureNode)
    if (result.alreadyMigrated) {
      console.log('Уже применено — правок нет.')
      return
    }
    for (const change of result.changes) console.log(`  · ${change}`)
    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }
    console.log(`\nКопия блока: ${writeBackup(outDir, `block-${block.id}`, block.structure)}`)
    await AppDataSource.transaction(async (m) => {
      await m.getRepository(Block).update(block.id, { structure: result.structure as never })
    })
    console.log('Записано. Теперь нужен передеплой коллекции «Проекты (ЖК)».')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err instanceof MigrationError ? `Миграция не выполнена: ${err.message}` : err)
  process.exit(1)
})
