/**
 * Бейджи групп планировок на карточках «Выбрать» (см. choicePlanBadges.ts).
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-choice-plan-badges.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-choice-plan-badges.ts
 *
 * Флаги:
 *   --dry-run      показать правки, ничего не писать
 *   --out=<dir>    куда положить резервную копию
 *
 * После записи нужен передеплой коллекции проектов.
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import type { StructureNode } from './choiceToPlanTypes'
import { migrateChoicePlanBadges } from './choicePlanBadges'
import { flag, hasFlag, writeBackup } from './migrationIo'

const CHOICE_BLOCK_ID = 'f719a298-ba6e-458c-b903-646d13f6bc1e'

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const blocks = AppDataSource.getRepository(Block)
    const block = await blocks.findOne({ where: { id: CHOICE_BLOCK_ID } })
    if (!block) throw new Error(`Блок ${CHOICE_BLOCK_ID} не найден`)

    const result = migrateChoicePlanBadges(block.structure as StructureNode)
    console.log(`Блок «${block.name}»:${result.changes.length ? '' : ' без изменений'}`)
    for (const change of result.changes) console.log(`  · ${change}`)
    if (result.alreadyMigrated) return
    if (dryRun) {
      console.log('--dry-run: ничего не записано.')
      return
    }

    const backup = writeBackup(outDir, 'choice-plan-badges', { id: block.id, name: block.name, structure: block.structure })
    console.log(`Копия: ${backup}`)
    await blocks.update(block.id, { structure: result.structure as never })
    console.log('Записано. Теперь нужен передеплой коллекции проектов.')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
