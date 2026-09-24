/**
 * Медиа на странице проекта: «О проекте», холлы, двор (см. complexMedia.ts).
 *
 * Преобразование — в `complexMedia.ts` (чистое, под тестами). Здесь только
 * чтение блоков, резервная копия и запись одной транзакцией.
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-complex-media.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-complex-media.ts
 *
 * Флаги:
 *   --dry-run        показать правки, ничего не писать
 *   --out=<dir>      куда положить резервную копию
 *
 * После записи нужен передеплой коллекции «Проекты (ЖК)».
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { MigrationError, MigrationResult, StructureNode } from './choiceToPlanTypes'
import { migrateAboutBlock, migrateGalleryBlock } from './complexMedia'
import { flag, hasFlag, writeBackup } from './migrationIo'

/** Блоки шаблона проекта на .19. */
const TARGETS: Array<{ id: string; label: string; migrate: (s: StructureNode) => MigrationResult }> = [
  { id: 'b9d39861-662c-455f-ba16-cf164abdf0b9', label: 'О проекте', migrate: migrateAboutBlock },
  {
    id: '49a74500-eee1-4f49-aa42-d256eb0377b5',
    label: 'Холлы',
    migrate: (s) => migrateGalleryBlock(s, 'Холлы', { from: 'item.hallGallery', to: 'item.hallSlides' }),
  },
  {
    id: '84b308dd-0488-4d88-81f6-ac2f53cc6877',
    label: 'Двор',
    migrate: (s) => migrateGalleryBlock(s, 'Двор', { from: 'item.yard.gallery', to: 'item.yard.slides' }),
  },
]

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const repo = AppDataSource.getRepository(Block)
    const planned: Array<{ block: Block; result: MigrationResult }> = []
    for (const target of TARGETS) {
      const block = await repo.findOne({ where: { id: target.id } })
      if (!block) throw new MigrationError(`Блок «${target.label}» (${target.id}) не найден`)
      const result = target.migrate(block.structure as unknown as StructureNode)
      console.log(`Блок «${block.name}»: ${result.alreadyMigrated ? 'уже применено' : ''}`)
      for (const change of result.changes) console.log(`  · ${change}`)
      if (!result.alreadyMigrated) planned.push({ block, result })
    }

    if (planned.length === 0) {
      console.log('\nПравок нет.')
      return
    }
    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    const backup = writeBackup(
      outDir,
      'complex-media-blocks',
      planned.map(({ block }) => ({ id: block.id, name: block.name, structure: block.structure }))
    )
    console.log(`\nКопия блоков: ${backup}`)

    await AppDataSource.transaction(async (m) => {
      for (const { block, result } of planned) {
        block.structure = result.structure as unknown as Block['structure']
        await m.getRepository(Block).save(block)
      }
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
