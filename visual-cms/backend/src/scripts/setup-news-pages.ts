/**
 * Страницы новостей на сайте: лента /news из news-service и шаблон-страница
 * «Новость» для коллекции новостей.
 *
 *  1. Источник данных «News — Лента» → news-service `/api/news?lang={{lang}}&limit=12`.
 *  2. Страница /news: данные при публикации `news` — первые карточки ленты.
 *  3. Библиотечный блок «News feed»: карточки из данных, образец для
 *     подгрузки, место под фильтры (scripts/newsFeedBlock.ts).
 *  4. Шаблон-страница «Новость» (slug news-template, черновик — сама на
 *     сайт не выкатывается): шапка и подвал как у страницы проекта, hero,
 *     шапка статьи, блоки (scripts/newsTemplate.ts). С переводами шапки и
 *     подвала со страницы-шаблона проекта и своей ссылки «← Все новости».
 *
 * Идемпотентно: что уже сделано — пропускается. Существующий шаблон не
 * перезаписывается (его дорабатывают в редакторе); пересоздать — флаг
 * --rebuild-template. Резервная копия всего, что меняется; одна транзакция.
 *
 * Запуск на сервере:
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/setup-news-pages.ts --dry-run
 *   docker exec -w /app visual-cms-backend-1 npx ts-node --transpile-only src/scripts/setup-news-pages.ts
 *
 * Флаги:
 *   --dry-run               показать правки, ничего не писать
 *   --news-page=<slug>      страница списка (по умолчанию news)
 *   --project-template=<id> страница-шаблон проекта: откуда взять шапку,
 *                           подвал и их переводы (по умолчанию — на .19)
 *   --rebuild-template      пересоздать структуру шаблона «Новость»
 *   --out=<dir>             куда положить резервную копию
 *
 * Потом: в админке «Новости» → «Страницы новостей» создать коллекцию на этот
 * шаблон, передеплоить страницу /news и коллекцию.
 */
import 'reflect-metadata'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { Page } from '../models/Page'
import { Translation } from '../models/Translation'
import { MigrationError, StructureNode, findAll } from './choiceToPlanTypes'
import { flag, hasFlag, writeBackup } from './migrationIo'
import { migrateNewsFeedBlock, stripFeedInstanceLayout } from './newsFeedBlock'
import {
  NEWS_FEED_DATASOURCE_NAME,
  NEWS_FEED_DATA_NAME,
  backLinkRows,
  newsFeedSourceUrl,
  nodeIds,
  rowsToCopy,
  upsertPublishData,
} from './newsPagesSetup'
import { NEWS_TEMPLATE_NAME, NEWS_TEMPLATE_SLUG, addBlockSectionVariant, buildNewsTemplate } from './newsTemplate'

const DEFAULT_PROJECT_TEMPLATE_ID = '35c718b5-6718-4d51-bffc-9c047dc830ff'

function linkedChild(structure: StructureNode, name: string): StructureNode {
  const [hit] = findAll(structure, (n) => Boolean(n.metadata?.linkedBlockId) && n.metadata?.name === name)
  if (!hit) throw new MigrationError(`На странице нет экземпляра блока «${name}»`)
  return hit
}

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const outDir = flag('out') ?? '/app/backups'
  const newsSlug = flag('news-page') ?? 'news'
  const projectTemplateId = flag('project-template') ?? DEFAULT_PROJECT_TEMPLATE_ID
  const rebuild = hasFlag('rebuild-template')
  const baseUrl = process.env.NEWS_SERVICE_URL || 'http://news-service:5200'

  await AppDataSource.initialize()
  try {
    const pages = AppDataSource.getRepository(Page)
    const blocks = AppDataSource.getRepository(Block)
    const sources = AppDataSource.getRepository(DataSourceEntity)
    const translations = AppDataSource.getRepository(Translation)

    const newsPage = await pages.findOne({ where: { slug: newsSlug } })
    if (!newsPage?.structure) throw new MigrationError(`Страница «${newsSlug}» не найдена или пуста`)
    const projectTemplate = await pages.findOne({ where: { id: projectTemplateId } })
    if (!projectTemplate?.structure) throw new MigrationError(`Страница-шаблон проекта ${projectTemplateId} не найдена`)

    const plan: string[] = []
    const backup: Record<string, unknown> = {}

    // 1. Источник данных ленты
    const url = newsFeedSourceUrl(baseUrl)
    let source = await sources.findOne({ where: { name: NEWS_FEED_DATASOURCE_NAME } })
    const sourceIsNew = !source
    if (!source) plan.push(`источник «${NEWS_FEED_DATASOURCE_NAME}» → ${url}`)
    else if ((source.config as Record<string, unknown>)?.url !== url) plan.push(`источник «${NEWS_FEED_DATASOURCE_NAME}»: адрес → ${url}`)

    // 3. Блок «News feed»
    const feedInstance = linkedChild(newsPage.structure, 'News feed')
    const feedBlock = await blocks.findOne({ where: { id: String(feedInstance.metadata!.linkedBlockId) } })
    if (!feedBlock) throw new MigrationError('Библиотечный блок «News feed» не найден')
    const feed = migrateNewsFeedBlock(feedBlock.structure as StructureNode)
    if (!feed.alreadyMigrated) {
      backup.feedBlock = feedBlock.structure
      plan.push(...feed.changes.map((c) => `блок «${feedBlock.name}»: ${c}`))
    }
    const instanceLayout = stripFeedInstanceLayout(newsPage.structure, feedBlock.id)
    if (!instanceLayout.alreadyMigrated) {
      backup.newsPageStructure = newsPage.structure
      plan.push(...instanceLayout.changes.map((c) => `страница /${newsSlug}: ${c}`))
    }

    // 4. Шаблон «Новость»
    const existingTemplate = await pages.findOne({ where: { slug: NEWS_TEMPLATE_SLUG } })
    const navigation = linkedChild(projectTemplate.structure, 'Navigation')
    const footer = linkedChild(projectTemplate.structure, 'Footer')
    const templateStructure = buildNewsTemplate({
      navigation,
      footer,
      breakpoints: (projectTemplate.structure.metadata?.breakpoints as unknown[]) ?? [],
    })
    const writeTemplate = !existingTemplate || rebuild
    // Шаблон, созданный до секций-блоков, получает заготовку блока — без пересоздания.
    const blockVariant = existingTemplate && !rebuild && existingTemplate.structure ? addBlockSectionVariant(existingTemplate.structure as StructureNode) : null
    if (!existingTemplate) plan.push(`шаблон-страница «${NEWS_TEMPLATE_NAME}» (/${NEWS_TEMPLATE_SLUG}, черновик)`)
    else if (rebuild) {
      backup.template = existingTemplate.structure
      plan.push(`шаблон-страница «${NEWS_TEMPLATE_NAME}»: структура пересоздана`)
    } else if (blockVariant?.changed) {
      backup.template = existingTemplate.structure
      plan.push(`шаблон-страница «${NEWS_TEMPLATE_NAME}»: добавлена заготовка секции «Блок из библиотеки»`)
    } else plan.push(`шаблон-страница «${NEWS_TEMPLATE_NAME}» уже есть — не трогаю (пересоздать: --rebuild-template)`)

    // Переводы шапки и подвала — с шаблона проекта, для узлов этих блоков.
    const [navBlock, footerBlock] = await Promise.all([
      blocks.findOne({ where: { id: String(navigation.metadata!.linkedBlockId) } }),
      blocks.findOne({ where: { id: String(footer.metadata!.linkedBlockId) } }),
    ])
    const ids = new Set<string>([
      ...(navBlock ? nodeIds(navBlock.structure as StructureNode) : []),
      ...(footerBlock ? nodeIds(footerBlock.structure as StructureNode) : []),
      String(navigation.id),
      String(footer.id),
    ])
    const projectRows = await translations.find({ where: { pageId: projectTemplate.id } })
    const copied = rowsToCopy(projectRows, ids)
    const locales = [...new Set(copied.map((r) => r.locale))]
    const templateRows = [...copied, ...backLinkRows(locales)]
    if (writeTemplate) plan.push(`переводы шаблона: ${templateRows.length} (${locales.join(', ') || 'нет языков'})`)

    for (const line of plan) console.log(`  · ${line}`)
    if (dryRun) {
      console.log('\n--dry-run: в базу ничего не записано.')
      return
    }

    backup.newsPagePublishData = newsPage.publishData ?? null
    console.log(`\nКопия: ${writeBackup(outDir, 'setup-news-pages', backup)}`)

    const templateId = await AppDataSource.transaction(async (m) => {
      // 1
      if (!source) {
        source = await m.getRepository(DataSourceEntity).save(
          m.getRepository(DataSourceEntity).create({ name: NEWS_FEED_DATASOURCE_NAME, type: 'rest-api', status: 'active', config: { url, method: 'GET' } } as Partial<DataSourceEntity>)
        )
      } else if ((source.config as Record<string, unknown>)?.url !== url) {
        await m.getRepository(DataSourceEntity).update(source.id, { config: { ...(source.config as object), url, method: 'GET' } })
      }
      // 2
      const publish = upsertPublishData(newsPage.publishData as never, { name: NEWS_FEED_DATA_NAME, dataSourceId: source!.id, arrayPath: 'items' })
      if (publish.changed) await m.getRepository(Page).update(newsPage.id, { publishData: publish.defs as never })
      if (!instanceLayout.alreadyMigrated) await m.getRepository(Page).update(newsPage.id, { structure: instanceLayout.structure as never })
      // 3
      if (!feed.alreadyMigrated) await m.getRepository(Block).update(feedBlock.id, { structure: feed.structure as never })
      // 4
      if (blockVariant?.changed) await m.getRepository(Page).update(existingTemplate!.id, { structure: blockVariant.structure as never })
      if (!writeTemplate) return existingTemplate!.id
      const repo = m.getRepository(Page)
      const page = existingTemplate ?? repo.create({ name: NEWS_TEMPLATE_NAME, slug: NEWS_TEMPLATE_SLUG, siteId: newsPage.siteId, status: 'draft' })
      page.structure = templateStructure
      page.isTemplate = true
      page.metadata = { ...(page.metadata ?? {}), title: '{{item.title}} — Golden House', description: '{{item.lead}}', keywords: [] } as Page['metadata']
      const saved = await repo.save(page)
      const tr = m.getRepository(Translation)
      await tr.delete({ pageId: saved.id })
      if (templateRows.length > 0) {
        await tr.insert(templateRows.map((r) => ({ ...r, pageId: saved.id, status: (r.status as Translation['status']) ?? 'draft' })))
      }
      return saved.id
    })
    if (sourceIsNew) console.log(`Источник «${NEWS_FEED_DATASOURCE_NAME}»: ${source!.id}`)
    console.log(`Шаблон «${NEWS_TEMPLATE_NAME}»: ${templateId}`)
    console.log('Готово. Дальше: «Новости» → «Страницы новостей» (коллекция на этот шаблон), передеплой /news и коллекции.')
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((err) => {
  console.error(err instanceof MigrationError ? `Не выполнено: ${err.message}` : err)
  process.exit(1)
})
