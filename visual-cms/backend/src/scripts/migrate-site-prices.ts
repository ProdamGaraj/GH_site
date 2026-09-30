/**
 * Цен на сайте нет: вычистка цен из всех блоков и страниц CMS.
 *
 * Преобразование — в `sitePrices.ts` (чистое, под тестами). Здесь — обход
 * всех блоков и страниц (в том числе черновиков: опубликуют — цены не
 * вернутся), резервная копия и запись одной транзакцией. Переводы удалённых
 * узлов удаляются: у страницы — её собственные, у блока — на страницах, куда
 * он подключён.
 *
 * Запуск на сервере:
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/migrate-site-prices.ts --dry-run
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/migrate-site-prices.ts
 *
 * Флаги:
 *   --dry-run        показать правки, ничего не писать
 *   --out=<dir>      куда положить резервную копию
 *
 * После записи нужен передеплой сайта и коллекции «Проекты (ЖК)».
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { Page } from '../models/Page'
import { Translation } from '../models/Translation'
import type { StructureNode } from './choiceToPlanTypes'
import { flag, hasFlag, writeBackup } from './migrationIo'
import { SitePricesResult, stripPrices } from './sitePrices'

interface Target {
  kind: 'block' | 'page'
  id: string
  label: string
  before: unknown
  result: SitePricesResult
  /** Страницы, чьи переводы удалённых узлов чистятся. */
  pageIds: string[]
}

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const blocks = await AppDataSource.getRepository(Block).find()
    const pages = await AppDataSource.getRepository(Page).find()
    const pagesWith = (blockId: string) =>
      pages.filter((p) => JSON.stringify(p.structure ?? {}).includes(blockId)).map((p) => p.id)

    const targets: Target[] = []
    for (const block of blocks) {
      const result = stripPrices(block.structure as unknown as StructureNode)
      if (result.alreadyMigrated) continue
      targets.push({
        kind: 'block',
        id: block.id,
        label: `блок «${block.name}»`,
        before: block.structure,
        result,
        pageIds: pagesWith(block.id),
      })
    }
    for (const page of pages) {
      if (!page.structure) continue
      const result = stripPrices(page.structure as StructureNode)
      if (result.alreadyMigrated) continue
      targets.push({
        kind: 'page',
        id: page.id,
        label: `страница ${page.slug} (${page.status})`,
        before: page.structure,
        result,
        pageIds: [page.id],
      })
    }

    const translations = await AppDataSource.getRepository(Translation).find()
    const doomed = translations.filter((t) =>
      targets.some((target) => target.pageIds.includes(t.pageId) && target.result.removedIds.includes(t.nodeId))
    )

    if (targets.length === 0) {
      console.log('Цен в блоках и страницах нет — правок нет.')
      return
    }
    for (const target of targets) {
      console.log(`\n${target.label} (${target.id}):`)
      for (const change of target.result.changes) console.log(`  · ${change}`)
    }
    console.log(`\nПереводы удалённых узлов: ${doomed.length}`)
    for (const t of doomed) console.log(`  − ${t.locale} ${t.nodeId}.${t.field}: «${t.value.slice(0, 50)}»`)

    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    const backup = writeBackup(outDir, 'site-prices', {
      targets: targets.map(({ kind, id, before }) => ({ kind, id, structure: before })),
      translations: doomed,
    })
    console.log(`\nКопия: ${backup}`)

    await AppDataSource.transaction(async (m) => {
      for (const target of targets) {
        const repo = target.kind === 'block' ? m.getRepository(Block) : m.getRepository(Page)
        await repo.update(target.id, { structure: target.result.structure as never })
      }
      if (doomed.length) await m.getRepository(Translation).delete(doomed.map((t) => t.id))
    })
    console.log('Записано. Теперь нужен передеплой сайта и коллекции «Проекты (ЖК)».')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
