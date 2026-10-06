/**
 * Медиа на странице проекта: hero, «О проекте», холлы, двор (см. complexMedia.ts).
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
import { Page } from '../models/Page'
import { MigrationError, MigrationResult, StructureNode } from './choiceToPlanTypes'
import { migrateAboutBlock, migrateGalleryBlock, migrateHeroBlock, migrateHeroInstances } from './complexMedia'
import { flag, hasFlag, writeBackup } from './migrationIo'

/** Блок «complex hero» шаблона проекта на .19. */
const HERO_BLOCK_ID = 'e0098d6c-c1bf-4db4-a893-78e49c6e48d3'

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
  { id: HERO_BLOCK_ID, label: 'Hero', migrate: migrateHeroBlock },
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

    // Экземпляры hero на страницах: стили корня экземпляра ведёт страница.
    const pages = await AppDataSource.getRepository(Page)
      .createQueryBuilder('p')
      .where('p.structure::text LIKE :id', { id: `%${HERO_BLOCK_ID}%` })
      .getMany()
    const plannedPages: Array<{ page: Page; result: MigrationResult }> = []
    for (const page of pages) {
      if (!page.structure) continue
      const result = migrateHeroInstances(page.structure as unknown as StructureNode, HERO_BLOCK_ID)
      if (result.alreadyMigrated) continue
      console.log(`Страница «${page.name}»:`)
      for (const change of result.changes) console.log(`  · ${change}`)
      plannedPages.push({ page, result })
    }

    if (planned.length === 0 && plannedPages.length === 0) {
      console.log('\nПравок нет.')
      return
    }
    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    const backup = writeBackup(outDir, 'complex-media-blocks', {
      blocks: planned.map(({ block }) => ({ id: block.id, name: block.name, structure: block.structure })),
      pages: plannedPages.map(({ page }) => ({ id: page.id, name: page.name, structure: page.structure })),
    })
    console.log(`\nКопия блоков и страниц: ${backup}`)

    await AppDataSource.transaction(async (m) => {
      for (const { block, result } of planned) {
        block.structure = result.structure as unknown as Block['structure']
        await m.getRepository(Block).save(block)
      }
      for (const { page, result } of plannedPages) {
        await m.getRepository(Page).update(page.id, { structure: result.structure as never })
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
