/**
 * Раскладка шаблона страницы проекта на планшете и телефоне
 * (см. complexTemplateLayout.ts).
 *
 * Преобразование — в `complexTemplateLayout.ts` (чистое, под тестами). Здесь
 * только чтение блоков и страницы, резервная копия и запись одной транзакцией.
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-complex-template-layout.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-complex-template-layout.ts
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
import { InstanceLayout, layoutTemplatePage, restoreStatsGrid, stripRootColumns } from './complexTemplateLayout'
import { flag, hasFlag, writeBackup } from './migrationIo'

/** Страница-шаблон коллекции «Проекты (ЖК)» на .19. */
const TEMPLATE_PAGE_ID = '35c718b5-6718-4d51-bffc-9c047dc830ff'

const ABOUT = 'b9d39861-662c-455f-ba16-cf164abdf0b9'
const YARD = '84b308dd-0488-4d88-81f6-ac2f53cc6877'
const HALL = '49a74500-eee1-4f49-aa42-d256eb0377b5'
const LEAD = '5c244448-efae-4fbf-8ab2-3cc2b15849c8'
const STATS = '8838c366-4d00-4729-a285-4bbd6d05f202'

/** Библиотечные блоки: что убрать из встроенных стилей. */
const BLOCKS: Array<{ id: string; label: string; migrate: (s: StructureNode) => MigrationResult }> = [
  { id: ABOUT, label: 'О проекте', migrate: (s) => stripRootColumns(s, 'О проекте') },
  { id: YARD, label: 'Двор', migrate: (s) => stripRootColumns(s, 'Двор') },
  { id: HALL, label: 'Холлы', migrate: (s) => stripRootColumns(s, 'Холлы') },
  { id: LEAD, label: 'Заявка', migrate: (s) => stripRootColumns(s, 'Заявка') },
  { id: STATS, label: 'Параметры', migrate: (s) => restoreStatsGrid(s, 'Параметры') },
]

/** Одна колонка на планшете и телефоне — как в CSS дизайна (до 1180px). */
const STACKED = { tablet: { gridTemplateColumns: '1fr' }, mobile: { gridTemplateColumns: '1fr' } }

/** Раскладка на узких экранах — переопределения брейкпоинтов на странице шаблона. */
const PAGE_PLAN: InstanceLayout[] = [
  { blockId: ABOUT, label: 'О проекте', overrides: STACKED },
  { blockId: YARD, label: 'Двор', overrides: STACKED },
  { blockId: HALL, label: 'Холлы', overrides: STACKED },
  { blockId: LEAD, label: 'Заявка', overrides: STACKED },
  {
    blockId: STATS,
    label: 'Параметры',
    overrides: { tablet: { gridTemplateColumns: 'repeat(2, 1fr)' }, mobile: { gridTemplateColumns: '1fr' } },
  },
]

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const blockRepo = AppDataSource.getRepository(Block)
    const pageRepo = AppDataSource.getRepository(Page)

    const plannedBlocks: Array<{ block: Block; result: MigrationResult }> = []
    for (const target of BLOCKS) {
      const block = await blockRepo.findOne({ where: { id: target.id } })
      if (!block) throw new MigrationError(`Блок «${target.label}» (${target.id}) не найден`)
      const result = target.migrate(block.structure as unknown as StructureNode)
      console.log(`Блок «${block.name}»: ${result.alreadyMigrated ? 'уже применено' : ''}`)
      for (const change of result.changes) console.log(`  · ${change}`)
      if (!result.alreadyMigrated) plannedBlocks.push({ block, result })
    }

    const page = await pageRepo.findOne({ where: { id: TEMPLATE_PAGE_ID } })
    if (!page) throw new MigrationError(`Страница-шаблон ${TEMPLATE_PAGE_ID} не найдена`)
    const pageResult = layoutTemplatePage(page.structure as unknown as StructureNode, PAGE_PLAN)
    console.log(`Страница «${page.slug}»: ${pageResult.alreadyMigrated ? 'уже применено' : ''}`)
    for (const change of pageResult.changes) console.log(`  · ${change}`)

    if (plannedBlocks.length === 0 && pageResult.alreadyMigrated) {
      console.log('\nПравок нет.')
      return
    }
    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    const backup = writeBackup(outDir, 'complex-template-layout', {
      blocks: plannedBlocks.map(({ block }) => ({ id: block.id, name: block.name, structure: block.structure })),
      page: { id: page.id, slug: page.slug, structure: page.structure },
    })
    console.log(`\nКопия: ${backup}`)

    await AppDataSource.transaction(async (m) => {
      for (const { block, result } of plannedBlocks) {
        block.structure = result.structure as unknown as Block['structure']
        await m.getRepository(Block).save(block)
      }
      if (!pageResult.alreadyMigrated) {
        page.structure = pageResult.structure as unknown as Page['structure']
        await m.getRepository(Page).save(page)
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
