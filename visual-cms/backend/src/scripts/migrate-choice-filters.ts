/**
 * Фильтры секции «Выбрать», версия 2: блок «Complex choice» + переводы кнопок.
 *
 * Преобразование — в `choiceFilters.ts` (чистое, под тестами). Здесь только
 * чтение, резервные копии и запись одной транзакцией.
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-choice-filters.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-choice-filters.ts
 *
 * Флаги:
 *   --dry-run        показать правки, ничего не писать
 *   --block=<uuid>   блок (по умолчанию «Complex choice» на .19)
 *   --page=<uuid>    страница-шаблон, чьи переводы чистятся (по умолчанию adostlik)
 *   --out=<dir>      куда положить резервные копии
 *
 * После записи нужен передеплой коллекции «Проекты (ЖК)».
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { Translation } from '../models/Translation'
import { MigrationError, StructureNode } from './choiceToPlanTypes'
import { chevronTranslationFixes, migrateChoiceFilters } from './choiceFilters'
import { flag, hasFlag, writeBackup } from './migrationIo'

const DEFAULT_BLOCK_ID = 'f719a298-ba6e-458c-b903-646d13f6bc1e'
const DEFAULT_TEMPLATE_PAGE_ID = '35c718b5-6718-4d51-bffc-9c047dc830ff'

async function main(): Promise<void> {
  const blockId = flag('block') ?? DEFAULT_BLOCK_ID
  const pageId = flag('page') ?? DEFAULT_TEMPLATE_PAGE_ID
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const block = await AppDataSource.getRepository(Block).findOne({ where: { id: blockId } })
    if (!block) throw new MigrationError(`Блок ${blockId} не найден`)
    console.log(`Блок: ${block.name} (${block.id})`)

    const result = migrateChoiceFilters(block.structure as unknown as StructureNode)
    const rows = await AppDataSource.getRepository(Translation).find({ where: { pageId } })
    const fixes = chevronTranslationFixes(result.structure, rows)

    if (result.alreadyMigrated && fixes.length === 0) {
      console.log('Уже применено — правок нет.')
      return
    }

    console.log('Правки блока:')
    for (const change of result.changes) console.log(`  · ${change}`)
    console.log(`Переводы страницы ${pageId}:`)
    for (const fix of fixes) console.log(`  · «${fix.before}» → «${fix.after}»`)
    if (fixes.length === 0) console.log('  · нечего чистить')

    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    const fixedIds = new Set(fixes.map((f) => f.id))
    console.log(`\nКопия блока: ${writeBackup(outDir, `block-${blockId}`, block.structure)}`)
    console.log(
      `Копия переводов: ${writeBackup(outDir, `translations-${pageId}`, rows.filter((r) => fixedIds.has(r.id)))}`
    )

    await AppDataSource.transaction(async (m) => {
      if (!result.alreadyMigrated) {
        block.structure = result.structure as unknown as Block['structure']
        await m.getRepository(Block).save(block)
      }
      for (const fix of fixes) {
        await m.getRepository(Translation).update({ id: fix.id }, { value: fix.after })
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
