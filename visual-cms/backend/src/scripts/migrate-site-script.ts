/**
 * Сведение общего скрипта сайта в один Site JS (см. siteScript.ts).
 *
 * Преобразование — в `siteScript.ts` (чистое, под тестами), сам скрипт —
 * `assets/site-runtime.js`. Здесь только чтение, резервная копия и запись
 * одной транзакцией.
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-site-script.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-site-script.ts
 *
 * Флаги:
 *   --dry-run        показать правки, ничего не писать
 *   --site=<uuid>    сайт (по умолчанию Golden House на .19)
 *   --out=<dir>      куда положить резервную копию
 *
 * JS встраивается в страницы при деплое: после записи нужен передеплой сайта.
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { Page } from '../models/Page'
import { Site } from '../models/Site'
import { MigrationError } from './choiceToPlanTypes'
import { hasHeaderScript, planSiteScript, ScriptOwner } from './siteScript'
import { flag, hasFlag, writeBackup } from './migrationIo'

const DEFAULT_SITE_ID = '1d8d75f8-f85f-4324-9741-0e67fbf90bcc'
const RUNTIME_PATH = path.join(__dirname, 'assets', 'site-runtime.js')

function jsOf(structure: unknown): string {
  const js = (structure as { metadata?: { globalJs?: unknown } } | null)?.metadata?.globalJs
  return typeof js === 'string' ? js : ''
}

function withJs<T>(structure: T, js: string): T {
  const copy = JSON.parse(JSON.stringify(structure))
  copy.metadata = { ...(copy.metadata ?? {}), globalJs: js }
  return copy
}

async function main(): Promise<void> {
  const siteId = flag('site') ?? DEFAULT_SITE_ID
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'
  const runtime = fs.readFileSync(RUNTIME_PATH, 'utf8')

  await AppDataSource.initialize()
  try {
    const site = await AppDataSource.getRepository(Site).findOne({ where: { id: siteId } })
    if (!site) throw new MigrationError(`Сайт ${siteId} не найден`)

    const blocks = (await AppDataSource.getRepository(Block).find()).filter((b) => hasHeaderScript(jsOf(b.structure)))
    const pages = (await AppDataSource.getRepository(Page).find({ where: { siteId } })).filter((p) =>
      hasHeaderScript(jsOf(p.structure))
    )
    const owners: ScriptOwner[] = [
      ...blocks.map((b) => ({ id: `block:${b.id}`, label: `блок «${b.name}»`, js: jsOf(b.structure) })),
      ...pages.map((p) => ({ id: `page:${p.id}`, label: `страница ${p.slug}`, js: jsOf(p.structure) })),
    ]

    const plan = planSiteScript(site.settings?.globalJs ?? '', runtime, owners)
    if (plan.changes.length === 0) {
      console.log('Уже применено — правок нет.')
      return
    }
    console.log(`Сайт: ${site.name}\nПравки:`)
    for (const change of plan.changes) console.log(`  · ${change}`)

    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    console.log(
      `\nКопия: ${writeBackup(outDir, `site-script-${siteId}`, {
        siteGlobalJs: site.settings?.globalJs ?? '',
        blocks: blocks.map((b) => ({ id: b.id, name: b.name, globalJs: jsOf(b.structure) })),
        pages: pages.map((p) => ({ id: p.id, slug: p.slug, globalJs: jsOf(p.structure) })),
      })}`
    )

    const byId = new Map(plan.updates.map((u) => [u.id, u.js]))
    await AppDataSource.transaction(async (m) => {
      site.settings = { ...site.settings, globalJs: plan.siteJs }
      await m.getRepository(Site).save(site)
      for (const block of blocks) {
        const js = byId.get(`block:${block.id}`)
        if (js === undefined) continue
        block.structure = withJs(block.structure, js)
        await m.getRepository(Block).save(block)
      }
      for (const page of pages) {
        const js = byId.get(`page:${page.id}`)
        if (js === undefined) continue
        page.structure = withJs(page.structure, js)
        await m.getRepository(Page).save(page)
      }
    })
    console.log('Записано. Нужен передеплой сайта.')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err instanceof MigrationError ? `Миграция не выполнена: ${err.message}` : err)
  process.exit(1)
})
