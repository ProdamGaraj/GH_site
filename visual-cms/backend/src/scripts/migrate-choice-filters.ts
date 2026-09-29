/**
 * Фильтры секции «Выбрать»: блок «Complex choice» + переводы его кнопок.
 *
 * Преобразование — в `choiceFilters.ts` и `choiceRanges.ts` (чистые, под
 * тестами). Здесь только чтение, резервные копии и запись одной транзакцией.
 *
 * v5 (2026-09-29): цены на сайте нет — фильтр цены заменён фильтрами площади и
 * этажа, цена убрана из карточки. Новые узлы получают переводы: клоны — от
 * узлов цены («Tozalash», «dan»), новые подписи — «Maydon, m²», «Qavat».
 * Переводы удалённых узлов цены удаляются.
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-choice-filters.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-choice-filters.ts
 *
 * Флаги:
 *   --dry-run        показать правки, ничего не писать
 *   --block=<uuid>   блок (по умолчанию «Complex choice» на .19)
 *   --page=<uuid>    страница-шаблон, чьи переводы правятся (по умолчанию adostlik)
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
import { PageTranslation, rangeTranslationPlan } from './choiceRanges'
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
    const plan = rangeTranslationPlan(result.ranges, rows as unknown as PageTranslation[])

    if (result.alreadyMigrated && fixes.length === 0 && plan.add.length === 0 && plan.remove.length === 0) {
      console.log('Уже применено — правок нет.')
      return
    }

    console.log('Правки блока:')
    for (const change of result.changes) console.log(`  · ${change}`)
    console.log(`Переводы страницы ${pageId}:`)
    for (const fix of fixes) console.log(`  · «${fix.before}» → «${fix.after}»`)
    for (const row of plan.add) console.log(`  + ${row.locale} ${row.nodeId}.${row.field}: «${row.value}»`)
    if (plan.remove.length) console.log(`  − строк удалённых узлов цены: ${plan.remove.length}`)
    if (fixes.length === 0 && plan.add.length === 0 && plan.remove.length === 0) console.log('  · без изменений')

    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    const touched = new Set([...fixes.map((f) => f.id), ...plan.remove])
    console.log(`\nКопия блока: ${writeBackup(outDir, `block-${blockId}`, block.structure)}`)
    console.log(
      `Копия переводов: ${writeBackup(outDir, `translations-${pageId}`, rows.filter((r) => touched.has(r.id)))}`
    )

    await AppDataSource.transaction(async (m) => {
      const repo = m.getRepository(Translation)
      if (!result.alreadyMigrated) {
        block.structure = result.structure as unknown as Block['structure']
        await m.getRepository(Block).save(block)
      }
      for (const fix of fixes) {
        await repo.update({ id: fix.id }, { value: fix.after })
      }
      if (plan.remove.length) await repo.delete(plan.remove)
      for (const row of plan.add) {
        await repo.save(repo.create({ ...row, pageId }))
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
