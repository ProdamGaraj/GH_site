/**
 * Переводы узлов библиотечных блоков — из страниц в блоки (см. blockTranslations.ts).
 *
 * Порядок:
 *   1. читает все страницы (с развёрнутыми блоками), строки translations и
 *      block_translations;
 *   2. строит план и снимок «что видит каждая страница на каждом языке»;
 *   3. конфликты (копии одного перевода расходятся) — печатает и не трогает:
 *      эти копии остаются в страницах, страницы видят их, как раньше;
 *   4. без --dry-run: резервная копия обеих таблиц, затем в одной транзакции
 *      вставка в block_translations, удаление перенесённых копий и повторное
 *      чтение обеих таблиц ВНУТРИ транзакции — ни одна страница ни на одном
 *      языке не должна потерять перевод или получить другое значение, иначе
 *      откат и ничего не записано. Появиться перевод может (перевод блока
 *      становится общим для всех его страниц) — такие поля печатаются.
 *
 * Запуск на сервере:
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/migrate-block-translations.ts --dry-run
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/migrate-block-translations.ts
 *
 * Флаги:
 *   --dry-run        показать план и проверку, ничего не писать
 *   --out=<dir>      куда положить резервную копию (по умолчанию /app/backups)
 *
 * Передеплой после переноса не обязателен: сайт строится из того же набора
 * переводов. Перенос нужен, чтобы перевод блока правился в одном месте.
 */
import 'reflect-metadata'
import { In } from 'typeorm'
import { AppDataSource } from '../config/database'
import { BlockTranslation } from '../models/BlockTranslation'
import { Block } from '../models/Block'
import { Page } from '../models/Page'
import { Translation } from '../models/Translation'
import { linkedBlocksService } from '../services/LinkedBlocksService'
import { MigrationError } from './choiceToPlanTypes'
import { flag, hasFlag, writeBackup } from './migrationIo'
import { type BlockRow, type PageInput, type PageRow, type SnapshotDiff, diffSnapshots, planBlockTranslations, snapshot } from './blockTranslations'

/** Потеря или подмена перевода — перенос не выполняется. */
function assertNothingLost(diff: SnapshotDiff, stage: string): void {
  const bad = [...diff.lost.map((l) => `- ${l}`), ...diff.changed.map((l) => `≠ ${l}`)]
  if (bad.length > 0) throw new MigrationError(`${stage}: переводы теряются или меняются (${bad.length}):\n  ${bad.slice(0, 30).join('\n  ')}`)
}

/** В строке отчёта id страницы → её адрес. */
function slugged(line: string, slugOf: Map<string, string>): string {
  const [pageId, ...rest] = line.split(' ')
  return [slugOf.get(pageId) ?? pageId, ...rest].join(' ')
}

/**
 * Строки block_translations. Таблицу создаёт SQL-миграция при старте бэкенда
 * (add-block-translations.sql); до рестарта её нет — пробный прогон считает
 * её пустой, настоящий не начинается.
 */
async function readBlockRows(dryRun: boolean): Promise<BlockRow[]> {
  try {
    return (await AppDataSource.getRepository(BlockTranslation).find()) as unknown as BlockRow[]
  } catch (err: any) {
    if (err?.code !== '42P01') throw err
    if (!dryRun) throw new MigrationError('таблицы block_translations нет — перезапустите бэкенд (SQL-миграция add-block-translations.sql)')
    console.log('Таблицы block_translations ещё нет (бэкенд не перезапускали) — для пробного прогона она пустая.')
    return []
  }
}

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const pages = await AppDataSource.getRepository(Page).find()
    const inputs: PageInput[] = []
    for (const page of pages) {
      inputs.push({ id: page.id, expanded: page.structure ? await linkedBlocksService.updateLinkedBlocks(page.structure) : null })
    }
    const pageRows = (await AppDataSource.getRepository(Translation).find()) as unknown as PageRow[]
    const blockRows = await readBlockRows(dryRun)

    const plan = planBlockTranslations(inputs, pageRows, blockRows)
    const before = snapshot(inputs, pageRows, blockRows)

    // Проверка плана в памяти — до любой записи.
    const deleted = new Set(plan.deletePageRowIds)
    const simulated = diffSnapshots(before, snapshot(inputs, pageRows.filter((r) => !deleted.has(r.id)), [...blockRows, ...plan.inserts]))
    assertNothingLost(simulated, 'план')

    const slugOf = new Map(pages.map((p) => [p.id, p.slug]))
    console.log(`Строк переводов страниц: ${pageRows.length}; строк блоков уже есть: ${blockRows.length}`)
    console.log(`Переносится в блоки: ${plan.inserts.length} (из ${plan.deletePageRowIds.length} копий в страницах)`)
    const blockNames = new Map((await AppDataSource.getRepository(Block).find({ select: { id: true, name: true } })).map((b) => [b.id, b.name]))
    for (const [blockId, n] of Object.entries(plan.perBlock).sort((x, y) => y[1] - x[1])) {
      console.log(`  · «${blockNames.get(blockId) ?? blockId}»: ${n}`)
    }
    console.log(`Остаётся в страницах (свои узлы, мета, без узла, конфликты): ${plan.untouched}`)
    if (plan.conflicts.length) {
      console.log(`\nКонфликты — копии расходятся, оставлены в страницах (${plan.conflicts.length}):`)
      for (const c of plan.conflicts.slice(0, 50)) {
        console.log(`  · блок ${c.blockId} ${c.nodeId}/${c.field} [${c.locale}]: ${c.values.map((v) => `${slugOf.get(v.pageId)}=${JSON.stringify(v.value)}`).join(', ')}`)
      }
    }
    console.log('Проверка в памяти: ни одна страница ни на одном языке не теряет перевод и не получает другое значение.')
    if (simulated.gained.length) {
      console.log(`\nПеревод блока станет виден там, где его не было (${simulated.gained.length}):`)
      for (const line of simulated.gained.slice(0, 100)) console.log(`  + ${slugged(line, slugOf)}`)
      if (simulated.gained.length > 100) console.log(`  … и ещё ${simulated.gained.length - 100}`)
    }

    if (plan.inserts.length === 0 && plan.deletePageRowIds.length === 0) {
      console.log('\nПереносить нечего.')
      return
    }
    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    console.log(`\nКопия: ${writeBackup(outDir, 'block-translations', { translations: pageRows, block_translations: blockRows })}`)

    await AppDataSource.transaction(async (m) => {
      const blocksRepo = m.getRepository(BlockTranslation)
      for (let i = 0; i < plan.inserts.length; i += 200) {
        await blocksRepo.insert(plan.inserts.slice(i, i + 200) as never)
      }
      for (let i = 0; i < plan.deletePageRowIds.length; i += 500) {
        await m.getRepository(Translation).delete({ id: In(plan.deletePageRowIds.slice(i, i + 500)) })
      }
      // Повторное чтение внутри транзакции: снимок обязан совпасть.
      const afterPageRows = (await m.getRepository(Translation).find()) as unknown as PageRow[]
      const afterBlockRows = (await blocksRepo.find()) as unknown as BlockRow[]
      const after = diffSnapshots(before, snapshot(inputs, afterPageRows, afterBlockRows))
      assertNothingLost(after, 'после записи (откат)')
      if (after.gained.length !== simulated.gained.length) {
        throw new MigrationError(`после записи появилось ${after.gained.length} переводов, ожидалось ${simulated.gained.length} — откат`)
      }
    })
    console.log('Записано. Проверка в транзакции пройдена: переводы на всех страницах и языках те же.')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err instanceof MigrationError ? `Перенос не выполнен: ${err.message}` : err)
  process.exit(1)
})
