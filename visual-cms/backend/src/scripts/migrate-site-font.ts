/**
 * Единый шрифт сайта (Inter): CSS сайта + блоки и страницы со своим `--sans`
 * или записью `font:` с неподключённым семейством.
 *
 * Преобразование — в `siteFont.ts` (чистое, под тестами). Здесь только
 * чтение, резервные копии и запись одной транзакцией.
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-site-font.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-site-font.ts
 *
 * Флаги:
 *   --dry-run        показать правки, ничего не писать
 *   --site=<uuid>    сайт (по умолчанию Golden House на .19)
 *   --out=<dir>      куда положить резервные копии
 *
 * CSS встраивается в страницы при деплое: после записи нужен передеплой
 * опубликованных страниц и коллекции.
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { Page } from '../models/Page'
import { Site } from '../models/Site'
import { migrateSiteCss, needsFontFix, unifyFonts } from './siteFont'
import { flag, hasFlag, writeBackup } from './migrationIo'

const DEFAULT_SITE_ID = '1d8d75f8-f85f-4324-9741-0e67fbf90bcc'

function cssOf(structure: unknown): string {
  const css = (structure as { metadata?: { globalCss?: unknown } } | null)?.metadata?.globalCss
  return typeof css === 'string' ? css : ''
}

function withCss<T>(structure: T, css: string): T {
  const copy = JSON.parse(JSON.stringify(structure))
  copy.metadata = { ...(copy.metadata ?? {}), globalCss: css }
  return copy
}

async function main(): Promise<void> {
  const siteId = flag('site') ?? DEFAULT_SITE_ID
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const site = await AppDataSource.getRepository(Site).findOne({ where: { id: siteId } })
    if (!site) throw new Error(`Сайт ${siteId} не найден`)

    const changes: string[] = []
    const siteCss = migrateSiteCss(site.settings?.globalCss ?? '', changes)

    const blocks = (await AppDataSource.getRepository(Block).find()).filter((b) =>
      needsFontFix(cssOf(b.structure))
    )
    const pages = (await AppDataSource.getRepository(Page).find({ where: { siteId } })).filter((p) =>
      needsFontFix(cssOf(p.structure))
    )
    const blockCss = blocks.map((b) => unifyFonts(cssOf(b.structure), changes, `блок «${b.name}»`))
    const pageCss = pages.map((p) => unifyFonts(cssOf(p.structure), changes, `страница ${p.slug}`))

    if (changes.length === 0) {
      console.log('Уже применено — правок нет.')
      return
    }
    console.log(`Сайт: ${site.name} (${site.id})\nПравки:`)
    for (const change of changes) console.log(`  · ${change}`)

    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    console.log(
      `\nКопия: ${writeBackup(outDir, `site-font-${siteId}`, {
        siteSettings: site.settings,
        blocks: blocks.map((b) => ({ id: b.id, structure: b.structure })),
        pages: pages.map((p) => ({ id: p.id, structure: p.structure })),
      })}`
    )

    await AppDataSource.transaction(async (m) => {
      site.settings = { ...site.settings, globalCss: siteCss }
      await m.getRepository(Site).save(site)
      for (const [i, block] of blocks.entries()) {
        block.structure = withCss(block.structure, blockCss[i])
        await m.getRepository(Block).save(block)
      }
      for (const [i, page] of pages.entries()) {
        page.structure = withCss(page.structure, pageCss[i])
        await m.getRepository(Page).save(page)
      }
    })
    console.log('Записано. Нужен передеплой опубликованных страниц и коллекции.')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
