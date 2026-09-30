/**
 * Каталог ЖК на главной: рабочий фильтр по классу (см. catalogClassFilter.ts).
 *
 * Правит блок «Complexes» и заводит переводы подписей заголовка (data-title)
 * на страницах, куда блок подключён, — на тех языках, на которые страница уже
 * переводится. Резервная копия блока, запись одной транзакцией.
 *
 * Запуск на сервере:
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/migrate-catalog-class-filter.ts --dry-run
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/migrate-catalog-class-filter.ts
 *
 * Флаги:
 *   --dry-run        показать правки, ничего не писать
 *   --block=<uuid>   блок каталога (по умолчанию «Complexes» на .19)
 *   --out=<dir>      куда положить резервную копию
 *
 * После записи нужен передеплой главной.
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { Page } from '../models/Page'
import { Translation } from '../models/Translation'
import { MigrationError, StructureNode } from './choiceToPlanTypes'
import { catalogTitleTranslationPlan, migrateCatalogClassFilter } from './catalogClassFilter'
import { flag, hasFlag, writeBackup } from './migrationIo'

const DEFAULT_BLOCK_ID = 'c934851d-5fd5-4113-bf56-0bb440241cc9'

async function main(): Promise<void> {
  const blockId = flag('block') ?? DEFAULT_BLOCK_ID
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const block = await AppDataSource.getRepository(Block).findOne({ where: { id: blockId } })
    if (!block) throw new MigrationError(`Блок ${blockId} не найден`)
    console.log(`Блок: ${block.name} (${block.id})`)

    const result = migrateCatalogClassFilter(block.structure as unknown as StructureNode)
    console.log(result.alreadyMigrated ? '  · уже применено' : '')
    for (const change of result.changes) console.log(`  · ${change}`)

    const pages = (await AppDataSource.getRepository(Page).find()).filter((p) =>
      JSON.stringify(p.structure ?? {}).includes(block.id)
    )
    const plans = await Promise.all(
      pages.map(async (page) => {
        const rows = await AppDataSource.getRepository(Translation).find({ where: { pageId: page.id } })
        return { page, plan: catalogTitleTranslationPlan(result.titles, rows) }
      })
    )
    for (const { page, plan } of plans) {
      console.log(`Переводы подписей на странице ${page.slug}:${plan.add.length ? '' : ' без изменений'}`)
      for (const row of plan.add) console.log(`  + ${row.locale} ${row.nodeId}: «${row.value}»`)
      for (const ru of plan.missing) console.log(`  ! нет перевода для «${ru}» — на других языках останется ru`)
    }

    const toAdd = plans.flatMap(({ page, plan }) => plan.add.map((row) => ({ ...row, pageId: page.id })))
    if (result.alreadyMigrated && toAdd.length === 0) {
      console.log('\nВсё уже применено.')
      return
    }
    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    console.log(`\nКопия блока: ${writeBackup(outDir, `block-${block.id}`, block.structure)}`)
    await AppDataSource.transaction(async (m) => {
      if (!result.alreadyMigrated) {
        await m.getRepository(Block).update(block.id, { structure: result.structure as never })
      }
      const repo = m.getRepository(Translation)
      for (const row of toAdd) await repo.save(repo.create(row))
    })
    console.log('Записано. Теперь нужен передеплой главной.')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err instanceof MigrationError ? `Миграция не выполнена: ${err.message}` : err)
  process.exit(1)
})
