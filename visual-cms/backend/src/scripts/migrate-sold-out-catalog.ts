/**
 * Каталог на главной из estate + распроданные проекты (см. soldOutCatalog.ts).
 *
 * Запуск на сервере:
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-sold-out-catalog.ts --dry-run
 *   docker compose exec -T backend npx ts-node src/scripts/migrate-sold-out-catalog.ts
 *
 * Флаги:
 *   --dry-run      показать правки, ничего не писать
 *   --out=<dir>    куда положить резервную копию
 *
 * Порядок записи:
 *   1. estate: теги, класс для фильтра и картинки ручных карточек — в пустые
 *      поля проектов (admin API, X-Estate-Token). Сначала estate: упади он —
 *      CMS не тронута, и повторный запуск начнёт сначала;
 *   2. CMS одной транзакцией: источник «Estate — Каталог», данные при
 *      публикации главной, блоки каталога, шапки и «Выбрать», коллекция без
 *      publish-whitelist.
 * Повторный запуск ничего не меняет. После записи нужен передеплой сайта и
 * коллекции проектов.
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { Collection } from '../models/Collection'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { Page, PagePublishDataDef } from '../models/Page'
import { Translation } from '../models/Translation'
import type { StructureNode } from './choiceToPlanTypes'
import { flag, hasFlag, writeBackup } from './migrationIo'
import {
  CATALOG_DATA_NAME,
  EstateAdminComplex,
  dropPublishWhitelist,
  estateCardPatch,
  migrateCatalogBlock,
  migrateChoiceBlock,
  migrateHeroBlock,
} from './soldOutCatalog'

const CATALOG_BLOCK_ID = 'c934851d-5fd5-4113-bf56-0bb440241cc9'
const HERO_BLOCK_ID = 'e0098d6c-c1bf-4db4-a893-78e49c6e48d3'
const CHOICE_BLOCK_ID = 'f719a298-ba6e-458c-b903-646d13f6bc1e'
const HOME_PAGE_ID = 'f547f635-b867-412a-81ec-92bbac9de57e'
const PROJECTS_COLLECTION_ID = '51eb75ed-ab0e-4791-917c-7c7663284a42'

const ESTATE_URL = process.env.ESTATE_SERVICE_URL || 'http://estate-service:5100'
const CATALOG_SOURCE_NAME = 'Estate — Каталог'
/** Каталог без полной выдачи проектов: карточкам хватает списка. */
const CATALOG_SOURCE_URL = `${ESTATE_URL}/api/complexes?lang={{lang}}`

async function estate<T>(method: 'GET' | 'PUT', path: string, body?: unknown): Promise<T> {
  const token = process.env.ESTATE_WRITE_TOKEN
  if (!token) throw new Error('Нет ESTATE_WRITE_TOKEN: admin API estate без него закрыт')
  const res = await fetch(`${ESTATE_URL}/api/admin${path}`, {
    method,
    headers: { 'X-Estate-Token': token, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`estate ${method} ${path}: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

interface BlockChange {
  block: Block
  next: StructureNode
}

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'

  await AppDataSource.initialize()
  try {
    const blocks = AppDataSource.getRepository(Block)
    const load = async (id: string): Promise<Block> => {
      const block = await blocks.findOne({ where: { id } })
      if (!block) throw new Error(`Блок ${id} не найден`)
      return block
    }

    // --- Блоки ---
    const blockChanges: BlockChange[] = []
    const catalogBlock = await load(CATALOG_BLOCK_ID)
    const catalog = migrateCatalogBlock(catalogBlock.structure as StructureNode)
    const report = (name: string, changes: string[]) => {
      console.log(`Блок «${name}»:${changes.length ? '' : ' без изменений'}`)
      for (const change of changes) console.log(`  · ${change}`)
    }
    report(catalogBlock.name, catalog.changes)
    if (!catalog.alreadyMigrated) blockChanges.push({ block: catalogBlock, next: catalog.structure })
    for (const [id, migrate] of [
      [HERO_BLOCK_ID, migrateHeroBlock],
      [CHOICE_BLOCK_ID, migrateChoiceBlock],
    ] as const) {
      const block = await load(id)
      const result = migrate(block.structure as StructureNode)
      report(block.name, result.changes)
      if (!result.alreadyMigrated) blockChanges.push({ block, next: result.structure })
    }

    // --- estate: данные ручных карточек ---
    const translations = await AppDataSource.getRepository(Translation).find({ where: { pageId: HOME_PAGE_ID } })
    const translatedTag = (nodeId: string, locale: string) =>
      translations.find((t) => t.nodeId === nodeId && t.locale === locale && t.field === 'content')?.value
    const estatePatches: Array<{ complex: EstateAdminComplex; body: Record<string, unknown> }> = []
    if (catalog.cards.length) {
      const list = await estate<Array<{ id: string; slug: string }>>('GET', '/complexes')
      for (const card of catalog.cards) {
        const row = list.find((c) => c.slug === card.slug)
        if (!row) {
          console.log(`estate: проекта «${card.slug}» нет — его теги и картинку перенести некуда`)
          continue
        }
        const complex = await estate<EstateAdminComplex>('GET', `/complexes/${row.id}`)
        const patch = estateCardPatch(complex, card, translatedTag)
        console.log(`estate «${card.slug}»:${patch ? '' : ' поля уже заполнены'}`)
        for (const change of patch?.changes ?? []) console.log(`  · ${change}`)
        if (patch) estatePatches.push({ complex, body: patch.body })
      }
    }

    // --- Источник и данные главной ---
    const sources = AppDataSource.getRepository(DataSourceEntity)
    const existingSource = (await sources.find()).find((ds) => (ds.config as { url?: string })?.url === CATALOG_SOURCE_URL)
    console.log(existingSource ? `Источник «${existingSource.name}» уже есть` : `Источник «${CATALOG_SOURCE_NAME}»: будет создан (${CATALOG_SOURCE_URL})`)

    const pages = AppDataSource.getRepository(Page)
    const home = await pages.findOne({ where: { id: HOME_PAGE_ID } })
    if (!home) throw new Error(`Главная ${HOME_PAGE_ID} не найдена`)
    const homeHasData = (home.publishData ?? []).some((d) => d.name === CATALOG_DATA_NAME)
    console.log(homeHasData ? 'Главная: данные при публикации уже заданы' : `Главная: данные при публикации item.${CATALOG_DATA_NAME} ← каталог estate`)

    // --- Коллекция ---
    const collections = AppDataSource.getRepository(Collection)
    const collection = await collections.findOne({ where: { id: PROJECTS_COLLECTION_ID } })
    if (!collection) throw new Error(`Коллекция ${PROJECTS_COLLECTION_ID} не найдена`)
    const transforms = dropPublishWhitelist(collection.transforms)
    console.log(transforms ? 'Коллекция: убран фильтр publish-whitelist — на сайт выставляет галочка estate' : 'Коллекция: publish-whitelist уже убран')

    const nothing = !blockChanges.length && !estatePatches.length && existingSource && homeHasData && !transforms
    if (nothing) {
      console.log('\nВсё уже применено.')
      return
    }
    if (dryRun) {
      console.log('\n--dry-run: ничего не записано.')
      return
    }

    const backup = writeBackup(outDir, 'sold-out-catalog', {
      blocks: blockChanges.map(({ block }) => ({ id: block.id, name: block.name, structure: block.structure })),
      home: { id: home.id, publishData: home.publishData ?? null },
      collection: { id: collection.id, transforms: collection.transforms ?? null },
      estate: estatePatches.map(({ complex }) => complex),
    })
    console.log(`\nКопия: ${backup}`)

    for (const { complex, body } of estatePatches) {
      await estate('PUT', `/complexes/${complex.id}`, body)
      console.log(`estate «${complex.slug}»: записано`)
    }

    await AppDataSource.transaction(async (manager) => {
      let source = existingSource
      if (!source) {
        const repo = manager.getRepository(DataSourceEntity)
        source = await repo.save(
          repo.create({
            name: CATALOG_SOURCE_NAME,
            description: 'Проекты, выставленные на сайт (галочка в estate), — для каталога на главной',
            type: 'rest-api' as DataSourceEntity['type'],
            config: { url: CATALOG_SOURCE_URL, method: 'GET' },
          })
        )
        console.log(`Источник «${CATALOG_SOURCE_NAME}» создан: ${source.id}`)
      }
      if (!homeHasData) {
        const def: PagePublishDataDef = { name: CATALOG_DATA_NAME, dataSourceId: source.id, arrayPath: 'items' }
        await manager.getRepository(Page).update(home.id, { publishData: [...(home.publishData ?? []), def] as never })
      }
      for (const { block, next } of blockChanges) {
        await manager.getRepository(Block).update(block.id, { structure: next as never })
      }
      if (transforms) await manager.getRepository(Collection).update(collection.id, { transforms: transforms as never })
    })
    console.log('Записано. Теперь нужен передеплой сайта и коллекции проектов.')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
