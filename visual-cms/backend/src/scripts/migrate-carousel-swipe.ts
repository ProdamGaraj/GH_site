/**
 * Свайп в существующих каруселях — телефон и планшет (см. carouselSwipe.ts).
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-carousel-swipe.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-carousel-swipe.ts
 *
 * Флаги:
 *   --dry-run      показать правки, ничего не писать
 *   --out=<dir>    куда положить резервную копию
 *
 * Проходит все блоки и страницы. Экраны берутся из брейкпоинтов структуры
 * (свои у страницы или стандартные). После записи нужен передеплой сайта и
 * коллекций: атрибут читает рантайм опубликованной страницы.
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { Page } from '../models/Page'
import { styleGenerator } from '../services/StyleGenerator'
import type { BlockNode } from '../types/blockNode'
import type { StructureNode } from './choiceToPlanTypes'
import { addDefaultSwipe, defaultSwipeScreens } from './carouselSwipe'
import { flag, hasFlag, writeBackup } from './migrationIo'

interface Row {
  kind: 'блок' | 'страница'
  id: string
  name: string
  structure: unknown
}

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const blocks = AppDataSource.getRepository(Block)
    const pages = AppDataSource.getRepository(Page)
    const rows: Row[] = [
      ...(await blocks.find()).map((b): Row => ({ kind: 'блок', id: b.id, name: b.name, structure: b.structure })),
      ...(await pages.find()).map((p): Row => ({ kind: 'страница', id: p.id, name: p.slug, structure: p.structure })),
    ]

    const changed: Array<Row & { next: StructureNode }> = []
    for (const row of rows) {
      if (!row.structure || typeof row.structure !== 'object') continue
      const structure = row.structure as StructureNode
      const screens = defaultSwipeScreens(styleGenerator.getBreakpoints(structure as unknown as BlockNode))
      const result = addDefaultSwipe(structure, screens)
      if (result.alreadyMigrated) continue
      console.log(`${row.kind} «${row.name}»:`)
      for (const change of result.changes) console.log(`  · ${change}`)
      changed.push({ ...row, next: result.structure })
    }

    if (changed.length === 0) {
      console.log('Каруселей без настройки свайпа нет — всё уже применено.')
      return
    }
    console.log(`\nВсего: ${changed.length} (блоков ${changed.filter((r) => r.kind === 'блок').length}, страниц ${changed.filter((r) => r.kind === 'страница').length}).`)
    if (dryRun) {
      console.log('--dry-run: в базу ничего не записано.')
      return
    }

    const backup = writeBackup(
      outDir,
      'carousel-swipe',
      changed.map(({ kind, id, name, structure }) => ({ kind, id, name, structure }))
    )
    console.log(`Копия: ${backup}`)
    await AppDataSource.transaction(async (manager) => {
      for (const row of changed) {
        const repo = row.kind === 'блок' ? manager.getRepository(Block) : manager.getRepository(Page)
        await repo.update(row.id, { structure: row.next as never })
      }
    })
    console.log('Записано. Теперь нужен передеплой сайта и коллекций.')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
