/**
 * Перевод блока «Complex choice» на карточки типов планировок.
 *
 * Преобразование — в `choiceToPlanTypes.ts` (чистое, под тестами). Здесь
 * только чтение блока, резервная копия и запись.
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-choice-to-plantypes.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-choice-to-plantypes.ts
 *
 * Флаги:
 *   --dry-run        показать правки, ничего не писать
 *   --block=<uuid>   другой блок (по умолчанию «Complex choice» на .19)
 *   --out=<dir>      куда положить резервную копию структуры
 *
 * Идемпотентно: повторный запуск на переведённом блоке ничего не меняет.
 * После записи нужен передеплой коллекции — сама по себе правка блока
 * опубликованные страницы не трогает.
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { migrateChoiceStructure, MigrationError, StructureNode } from './choiceToPlanTypes'

const DEFAULT_BLOCK_ID = 'f719a298-ba6e-458c-b903-646d13f6bc1e'

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

async function main(): Promise<void> {
  const blockId = flag('block') ?? DEFAULT_BLOCK_ID
  const dryRun = process.argv.includes('--dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const repo = AppDataSource.getRepository(Block)
    const block = await repo.findOne({ where: { id: blockId } })
    if (!block) throw new MigrationError(`Блок ${blockId} не найден`)

    console.log(`Блок: ${block.name} (${block.id})`)

    const result = migrateChoiceStructure(block.structure as unknown as StructureNode)
    if (result.alreadyMigrated) {
      console.log('Уже переведён на item.planTypes — правок нет.')
      return
    }

    console.log('Правки:')
    for (const change of result.changes) console.log(`  · ${change}`)

    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    // Копия ДО записи: дамп базы делается отдельно, но точечный откат одного
    // блока из файла быстрее и не трогает остальные таблицы.
    fs.mkdirSync(outDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backup = path.join(outDir, `block-${blockId}-${stamp}.json`)
    fs.writeFileSync(backup, JSON.stringify(block.structure, null, 2), 'utf8')
    console.log(`\nРезервная копия структуры: ${backup}`)

    block.structure = result.structure as unknown as typeof block.structure
    await repo.save(block)
    console.log('Записано. Теперь нужен передеплой коллекции «Проекты (ЖК)».')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  if (err instanceof MigrationError) {
    console.error(`Миграция не выполнена: ${err.message}`)
  } else {
    console.error(err)
  }
  process.exit(1)
})
