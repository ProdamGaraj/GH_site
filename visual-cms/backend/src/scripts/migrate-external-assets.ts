/**
 * Перевод графики сайта с внешнего демо-хоста дизайнера в медиатеку.
 *
 * Опубликованный сайт грузит часть картинок с `subkhonastanov-uzb.github.io` —
 * чужого GitHub Pages. Файлы с теми же именами уже лежат в медиатеке, поэтому
 * переносить ничего не нужно: переписываем адреса в структурах блоков и страниц.
 *
 * Преобразование — в `externalAssets.ts` (чистое, под тестами).
 *
 * Запуск:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-external-assets.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-external-assets.ts
 *
 * Флаги:
 *   --dry-run   показать замены, ничего не писать
 *   --host=…    другой внешний хост
 *   --allow-unmatched  переписать то, что сопоставилось, оставив остальное
 *
 * Отказ по умолчанию: если хоть одному адресу не нашлось файла в медиатеке,
 * скрипт не пишет ничего. Частичная замена оставила бы сайт в смешанном
 * состоянии, и забытая ссылка потерялась бы среди уже исправленных.
 *
 * Идемпотентно: переписанные адреса больше не находятся.
 * После записи нужен передеплой затронутых страниц.
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { Page } from '../models/Page'
import { MediaAsset } from '../models/MediaAsset'
import {
  EXTERNAL_HOST,
  collectExternalUrls,
  buildRewriteMap,
  rewriteValue,
  ExternalAssetsError,
} from './externalAssets'

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

interface Target {
  kind: 'block' | 'page'
  id: string
  name: string
  structure: unknown
}

async function main(): Promise<void> {
  const host = flag('host') ?? EXTERNAL_HOST
  const dryRun = process.argv.includes('--dry-run')
  const allowUnmatched = process.argv.includes('--allow-unmatched')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const blocks = await AppDataSource.getRepository(Block).find()
    const pages = await AppDataSource.getRepository(Page).find()

    const targets: Target[] = [
      ...blocks.map((b) => ({ kind: 'block' as const, id: b.id, name: b.name, structure: b.structure })),
      ...pages.map((p) => ({ kind: 'page' as const, id: p.id, name: p.name, structure: p.structure })),
    ].filter((t) => collectExternalUrls(t.structure, host).length > 0)

    if (targets.length === 0) {
      console.log(`Ссылок на ${host} не осталось.`)
      return
    }

    const urls = [...new Set(targets.flatMap((t) => collectExternalUrls(t.structure, host)))].sort()
    console.log(`Внешних адресов: ${urls.length}, затронуто объектов: ${targets.length}`)

    // Сортировка по имени делает выбор ассета воспроизводимым при тёзках.
    const assets = (await AppDataSource.getRepository(MediaAsset).find()).sort((a, b) =>
      a.fileName.localeCompare(b.fileName)
    )
    const { replacements, unmatched } = buildRewriteMap(urls, assets)

    for (const [from, to] of replacements) {
      console.log(`  ${from.split('/').pop()} → ${to}`)
    }
    if (unmatched.length) {
      console.log(`\nБез пары в медиатеке (${unmatched.length}):`)
      for (const u of unmatched) console.log(`  ! ${u}`)
      if (!allowUnmatched) {
        throw new ExternalAssetsError(
          'Часть адресов не сопоставлена. Загрузите файлы в медиатеку под теми же именами ' +
            'либо запустите с --allow-unmatched, чтобы переписать остальное.'
        )
      }
    }

    console.log('\nОбъекты:')
    const planned: Array<{ target: Target; structure: unknown; count: number }> = []
    for (const target of targets) {
      const { value, count } = rewriteValue(target.structure, replacements)
      if (count === 0) continue
      planned.push({ target, structure: value, count })
      console.log(`  · ${target.kind} «${target.name}»: ${count} ссылок`)
    }

    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    fs.mkdirSync(outDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backup = path.join(outDir, `external-assets-${stamp}.json`)
    fs.writeFileSync(
      backup,
      JSON.stringify(
        planned.map((p) => ({ kind: p.target.kind, id: p.target.id, structure: p.target.structure })),
        null,
        2
      ),
      'utf8'
    )
    console.log(`\nРезервная копия структур: ${backup}`)

    for (const { target, structure } of planned) {
      if (target.kind === 'block') {
        await AppDataSource.getRepository(Block).update({ id: target.id }, { structure: structure as never })
      } else {
        await AppDataSource.getRepository(Page).update({ id: target.id }, { structure: structure as never })
      }
    }
    console.log(`Записано объектов: ${planned.length}. Нужен передеплой затронутых страниц.`)
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  if (err instanceof ExternalAssetsError) console.error(`Не выполнено: ${err.message}`)
  else console.error(err)
  process.exit(1)
})
