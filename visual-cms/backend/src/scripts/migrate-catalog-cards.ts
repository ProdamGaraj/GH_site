/**
 * Добавление карточек проектов в каталог на главной.
 *
 * Имя, класс и описание берутся из estate-service (`/api/complexes`) — там
 * источник правды по копирайту. Изображение и маркетинговые плашки задаются
 * здесь: в модели `Complex` их нет (`badges` есть только у квартиры, а
 * `cardImage` в DTO — это широкое фото секции «О проекте», не карточный кроп).
 *
 * Преобразование дерева — в `catalogCards.ts` (чистое, под тестами).
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-catalog-cards.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-catalog-cards.ts
 *
 * Флаги:
 *   --dry-run        показать правки, ничего не писать
 *   --slugs=a,b      только эти проекты (по умолчанию — все из таблицы ниже)
 *   --block=<uuid>   другой блок каталога
 *
 * Идемпотентно: проект, уже представленный в гриде, пропускается.
 * После записи нужен деплой страницы — правка блока опубликованную не трогает.
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { addCatalogCards, CatalogCard, CatalogError, StructureNode } from './catalogCards'

/** Блок «Complexes» — каталог на странице Main page. */
const DEFAULT_BLOCK_ID = 'c934851d-5fd5-4113-bf56-0bb440241cc9'

/**
 * То, чего нет в estate-service: карточный кроп и плашки.
 *
 * Изображения — из медиатеки CMS (существующие карточки тянут фото с внешнего
 * демо-хоста дизайнера; новые на него не завязываем).
 */
const CARD_EXTRAS: Record<string, { image: string; tags: string[]; dataClass: string }> = {
  harizma: {
    image: '/media/e271d545-b5d1-49fe-ab4d-5bf090b2d98e.jpg',
    tags: ['Рассрочка', 'Ипотека'],
    dataClass: 'business',
  },
  ozmahal: {
    image: '/media/40e7e690-b2a6-454b-bfaf-fffa29050612.jpg',
    tags: ['Рассрочка', 'Ипотека'],
    dataClass: 'business',
  },
}

const ESTATE_URL = process.env.ESTATE_SERVICE_URL || 'http://estate-service:5100'

interface ComplexListItem {
  slug: string
  name: string
  className: string
  intro: string
}

function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

async function fetchComplexes(): Promise<ComplexListItem[]> {
  const res = await fetch(`${ESTATE_URL}/api/complexes?lang=ru`)
  if (!res.ok) throw new CatalogError(`estate-service ответил ${res.status}`)
  const body = (await res.json()) as { items?: ComplexListItem[] }
  if (!Array.isArray(body.items)) throw new CatalogError('Ответ estate-service без массива items')
  return body.items
}

async function main(): Promise<void> {
  const blockId = flag('block') ?? DEFAULT_BLOCK_ID
  const dryRun = process.argv.includes('--dry-run')
  const only = flag('slugs')?.split(',').map((s) => s.trim()).filter(Boolean)
  const outDir = flag('out') ?? '/app/backups'

  const slugs = Object.keys(CARD_EXTRAS).filter((s) => !only || only.includes(s))
  if (only) {
    const unknown = only.filter((s) => !CARD_EXTRAS[s])
    if (unknown.length) {
      throw new CatalogError(
        `Нет изображения и плашек для: ${unknown.join(', ')}. Допишите их в CARD_EXTRAS.`
      )
    }
  }

  const items = await fetchComplexes()
  const bySlug = new Map(items.map((i) => [i.slug, i]))

  const cards: CatalogCard[] = []
  for (const slug of slugs) {
    const item = bySlug.get(slug)
    if (!item) {
      console.warn(`  ! ${slug}: нет в estate-service — пропущен`)
      continue
    }
    const extras = CARD_EXTRAS[slug]
    cards.push({
      slug,
      name: item.name,
      className: item.className,
      intro: item.intro,
      image: extras.image,
      tags: extras.tags,
      dataClass: extras.dataClass,
    })
  }

  await AppDataSource.initialize()
  try {
    const repo = AppDataSource.getRepository(Block)
    const block = await repo.findOne({ where: { id: blockId } })
    if (!block) throw new CatalogError(`Блок ${blockId} не найден`)

    console.log(`Блок: ${block.name} (${block.id})`)
    const result = addCatalogCards(block.structure as unknown as StructureNode, cards)

    for (const slug of result.added) {
      const c = cards.find((x) => x.slug === slug)!
      console.log(`  + ${slug}: «${c.name}», ${c.className}, плашки ${c.tags.join(' / ') || '—'}`)
    }
    for (const slug of result.skipped) console.log(`  · ${slug}: уже в каталоге`)

    if (result.added.length === 0) {
      console.log('\nНовых карточек нет — правок не требуется.')
      return
    }
    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    fs.mkdirSync(outDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backup = path.join(outDir, `block-${blockId}-${stamp}.json`)
    fs.writeFileSync(backup, JSON.stringify(block.structure, null, 2), 'utf8')
    console.log(`\nРезервная копия структуры: ${backup}`)

    block.structure = result.structure as unknown as typeof block.structure
    await repo.save(block)
    console.log('Записано. Теперь нужен деплой страницы «Main page».')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  if (err instanceof CatalogError) console.error(`Не выполнено: ${err.message}`)
  else console.error(err)
  process.exit(1)
})
