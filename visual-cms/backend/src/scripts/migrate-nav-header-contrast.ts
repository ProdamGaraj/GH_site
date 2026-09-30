/**
 * Шапка: цвет текста — по тому, что лежит за ней (см. navHeaderContrast.ts).
 *
 * Правит скрипт блока «Navigation» и его кэш-копии в страницах. Резервная
 * копия всех затронутых структур, запись одной транзакцией.
 *
 * Запуск на сервере:
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/migrate-nav-header-contrast.ts --dry-run
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/migrate-nav-header-contrast.ts
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
import type { StructureNode } from './choiceToPlanTypes'
import { flag, hasFlag, writeBackup } from './migrationIo'
import { NavContrastResult, migrateNavHeaderContrast } from './navHeaderContrast'

interface Target {
  kind: 'block' | 'page'
  id: string
  label: string
  before: unknown
  result: NavContrastResult
}

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const targets: Target[] = []
    for (const block of await AppDataSource.getRepository(Block).find()) {
      const result = migrateNavHeaderContrast(block.structure as unknown as StructureNode)
      if (!result.alreadyMigrated) {
        targets.push({ kind: 'block', id: block.id, label: `блок «${block.name}»`, before: block.structure, result })
      }
    }
    for (const page of await AppDataSource.getRepository(Page).find()) {
      if (!page.structure) continue
      const result = migrateNavHeaderContrast(page.structure as StructureNode)
      if (!result.alreadyMigrated) {
        targets.push({ kind: 'page', id: page.id, label: `страница ${page.slug} (кэш шапки)`, before: page.structure, result })
      }
    }

    if (targets.length === 0) {
      console.log('Скрипт шапки уже смотрит за шапку — правок нет.')
      return
    }
    for (const t of targets) console.log(`  · ${t.label}: узлы ${t.result.patched.join(', ')}`)
    if (!targets.some((t) => t.kind === 'block')) {
      console.log('Внимание: библиотечный блок «Navigation» не найден среди правок — проверьте, не поправлен ли он уже.')
    }

    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    const backup = writeBackup(outDir, 'nav-header-contrast', targets.map(({ kind, id, before }) => ({ kind, id, structure: before })))
    console.log(`\nКопия: ${backup}`)
    await AppDataSource.transaction(async (m) => {
      for (const t of targets) {
        const repo = t.kind === 'block' ? m.getRepository(Block) : m.getRepository(Page)
        await repo.update(t.id, { structure: t.result.structure as never })
      }
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
