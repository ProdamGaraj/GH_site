/**
 * Best-effort миграция legacy `page.metadata.scripts` (PageScript[]) → единый
 * `page.structure.metadata.globalJs` (общий JS страницы). Старое поле PageScript[]
 * до деплоя не доходило и хранилось неконсистентно — переносим включённые скрипты
 * в новый канонический globalJs и удаляем legacy-поле.
 *
 * Идемпотентно: перенесённые блоки помечаются маркером; повторный прогон их не
 * дублирует, а удалённый `metadata.scripts` второй раз переносить нечего.
 *
 * Run: docker exec -it visual-cms-backend-1 npx ts-node src/scripts/migrate-page-scripts-to-globaljs.ts
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'

const MIGRATION_MARKER = '(migrated from page scripts)'

export interface LegacyPageScript {
  id?: string
  name?: string
  code?: string
  enabled?: boolean
}

/**
 * Складывает включённые legacy-скрипты в globalJs.
 * @returns новую строку globalJs, либо null если переносить нечего
 *          (нет включённых скриптов с кодом) или перенос уже выполнен.
 */
export function foldLegacyScriptsIntoGlobalJs(
  legacy: LegacyPageScript[] | undefined,
  existingGlobalJs: string | undefined,
): string | null {
  if (!Array.isArray(legacy) || legacy.length === 0) return null

  const blocks = legacy
    .filter((s) => s && s.enabled !== false && (s.code || '').trim())
    .map((s) => {
      const name = (s.name || 'script').trim()
      return `/* ${name} ${MIGRATION_MARKER} */\n${(s.code || '').trim()}`
    })
  if (blocks.length === 0) return null

  const existing = (existingGlobalJs || '').trim()
  // Идемпотентность: если перенос уже делали — не дублируем.
  if (existing.includes(MIGRATION_MARKER)) return null

  const addition = blocks.join('\n\n')
  return existing ? `${existing}\n\n${addition}` : addition
}

async function main(): Promise<void> {
  await AppDataSource.initialize()
  console.log('[migrate-page-scripts] DB connected')

  const repo = AppDataSource.getRepository(Page)
  const pages = await repo.find()

  let migrated = 0
  let skipped = 0
  let noStructure = 0

  for (const page of pages) {
    const legacy = (page.metadata as any)?.scripts as LegacyPageScript[] | undefined
    if (!legacy || legacy.length === 0) {
      skipped++
      continue
    }

    if (!page.structure) {
      // Переносить некуда — корень структуры отсутствует. Чистим legacy-поле всё равно.
      noStructure++
      const { scripts: _drop, ...restMeta } = page.metadata as any
      page.metadata = restMeta
      await repo.save(page)
      console.warn(`  ! "${page.name}": нет structure, legacy-скрипты отброшены`)
      continue
    }

    const currentGlobalJs = page.structure?.metadata?.globalJs as string | undefined
    const nextGlobalJs = foldLegacyScriptsIntoGlobalJs(legacy, currentGlobalJs)

    // Удаляем legacy-поле в любом случае (оно мёртвое); globalJs обновляем при наличии.
    const { scripts: _drop, ...restMeta } = page.metadata as any
    page.metadata = restMeta

    if (nextGlobalJs !== null) {
      page.structure = {
        ...page.structure,
        metadata: { ...(page.structure.metadata || {}), globalJs: nextGlobalJs },
      }
      migrated++
      console.log(`  + "${page.name}": перенесено в globalJs`)
    } else {
      skipped++
    }

    await repo.save(page)
  }

  console.log(
    `[migrate-page-scripts] done: migrated=${migrated} skipped=${skipped} noStructure=${noStructure} total=${pages.length}`,
  )
  await AppDataSource.destroy()
}

// Запуск только как CLI (не при импорте в тестах).
if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
