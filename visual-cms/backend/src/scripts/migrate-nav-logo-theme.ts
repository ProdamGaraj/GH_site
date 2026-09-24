/**
 * Логотип шапки под цвет её текста (см. navLogoTheme.ts).
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-nav-logo-theme.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-nav-logo-theme.ts
 *
 * Флаги:
 *   --dry-run        показать правки, ничего не писать
 *   --light=<url>    логотип при белом тексте (по умолчанию «GH logo белый желтый в две строки»)
 *   --dark=<url>     логотип при тёмном тексте (по умолчанию «GH logo черный в две строки (без полей)»)
 *   --out=<dir>      куда положить резервную копию
 *
 * Шапка — на всех страницах: после записи нужен передеплой сайта и коллекций.
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { MigrationError, StructureNode } from './choiceToPlanTypes'
import { migrateNavLogoTheme } from './navLogoTheme'
import { flag, hasFlag, writeBackup } from './migrationIo'

/** Блок «Navigation» на .19. */
const NAV_BLOCK_ID = '3d23aed7-be04-4ed7-934f-f0281b9c4670'
/** Медиатека .19, папка «Логотипы»: белый текст с жёлтым знаком. */
const DEFAULT_LIGHT_LOGO = '/media/762e0b48-40f3-4a61-aa9c-b7dde371b1a4.png'
/**
 * Там же: чёрный текст с жёлтым знаком — копия исходника без прозрачной каймы
 * (у исходника поля, и в общей рамке он выходил мельче светлого).
 */
const DEFAULT_DARK_LOGO = '/media/d3505e4a-f939-4941-8416-ef6069df4f29.png'

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'
  const lightSrc = flag('light') ?? DEFAULT_LIGHT_LOGO
  const darkSrc = flag('dark') ?? DEFAULT_DARK_LOGO

  await AppDataSource.initialize()
  try {
    const repo = AppDataSource.getRepository(Block)
    const block = await repo.findOne({ where: { id: NAV_BLOCK_ID } })
    if (!block) throw new MigrationError(`Блок «Navigation» (${NAV_BLOCK_ID}) не найден`)
    const result = migrateNavLogoTheme(block.structure as unknown as StructureNode, { lightSrc, darkSrc })
    console.log(`Блок «${block.name}»: ${result.alreadyMigrated ? 'уже применено' : ''}`)
    for (const change of result.changes) console.log(`  · ${change}`)
    if (result.alreadyMigrated) return
    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }
    const backup = writeBackup(outDir, 'nav-logo-theme', { id: block.id, name: block.name, structure: block.structure })
    console.log(`\nКопия блока: ${backup}`)
    block.structure = result.structure as unknown as Block['structure']
    await repo.save(block)
    console.log('Записано. Теперь нужен передеплой сайта и коллекций.')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err instanceof MigrationError ? `Миграция не выполнена: ${err.message}` : err)
  process.exit(1)
})
