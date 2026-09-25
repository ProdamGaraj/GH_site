/**
 * Варианты страницы: копия страницы с тем же адресом (сайт + slug).
 *
 * Вариант создаётся черновиком и сразу рабочий: вместе со страницей копируются
 * всё, что хранится по её id, — переводы (uz/en), привязки данных и переменные
 * страницы. Без этого вариант на узбекском выходил бы непереведённым, а
 * блоки с данными — пустыми. Id узлов структуры не меняются, поэтому переводы
 * и привязки копии совпадают с её узлами.
 *
 * Не копируются: формы (самостоятельные сущности, страница лишь ссылка) и
 * история — версии, логи деплоя, аналитика, заявки.
 *
 * Опубликовать вариант = заменить им опубликованный на том же адресе
 * (DeployService.replacePublishedVariant).
 */
import { EntityManager } from 'typeorm'
import { AppDataSource } from '../config/database'
import { DataBinding } from '../models/DataBinding'
import { Page } from '../models/Page'
import { PageVariable } from '../models/PageVariable'
import { Translation } from '../models/Translation'
import { sameAddress, variantName } from './pagePublication'

/** Служебные поля строки: у копии они свои. */
const ROW_IDENTITY = ['id', 'createdAt', 'updatedAt'] as const

/** Строка, привязанная к странице, — для новой страницы. */
export function copyRow<T extends { pageId?: string | null }>(row: T, pageId: string): Omit<T, (typeof ROW_IDENTITY)[number]> {
  const copy: Record<string, unknown> = { ...row, pageId }
  for (const key of ROW_IDENTITY) delete copy[key]
  return copy as Omit<T, (typeof ROW_IDENTITY)[number]>
}

/**
 * Поля новой страницы-варианта: всё содержимое оригинала, свой id, черновик,
 * первая версия. Связи-объекты (site, group) не копируются — хватает их id.
 */
export function variantPageFields(page: Page, pagesAtAddress: number): Partial<Page> {
  const { id: _id, createdAt: _c, updatedAt: _u, site: _s, group: _g, ...content } = page
  return {
    ...content,
    name: variantName(page.name, pagesAtAddress),
    status: 'draft',
    version: 1,
  }
}

/** Таблицы, строки которых живут по id страницы и нужны варианту. */
const PAGE_ROWS = [Translation, DataBinding, PageVariable] as const

export class PageVariantService {
  /** Создаёт вариант страницы одной транзакцией. `null` — страницы нет. */
  async createVariant(pageId: string): Promise<Page | null> {
    return AppDataSource.transaction((manager) => this.createVariantIn(manager, pageId))
  }

  async createVariantIn(manager: EntityManager, pageId: string): Promise<Page | null> {
    const pages = manager.getRepository(Page)
    const page = await pages.findOne({ where: { id: pageId } })
    if (!page) return null

    const sameSlug = await pages.find({ where: { slug: page.slug }, select: ['id', 'slug', 'siteId', 'status'] })
    const atAddress = sameSlug.filter((p) => sameAddress(p, page)).length

    const variant = await pages.save(pages.create(variantPageFields(page, atAddress)))

    for (const entity of PAGE_ROWS) {
      const repo = manager.getRepository<{ pageId?: string | null }>(entity)
      const rows = await repo.find({ where: { pageId: page.id } })
      if (rows.length > 0) await repo.save(rows.map((row) => repo.create(copyRow(row, variant.id))))
    }
    return variant
  }
}

export const pageVariantService = new PageVariantService()
