/**
 * Где используется библиотечный блок — чтобы решить, можно ли переписать его
 * якорями данных (dataAnchors.ts) или нужна копия.
 *
 * Переписать блок с текстом — значит заменить его текст плейсхолдерами:
 * везде, где он стоит не как блок данных, вместо текста появятся `{{$.…}}`.
 * Поэтому считаем все места, где блок показывается со своим содержимым:
 *   - страницы и шаблоны страниц (linked-экземпляры, в т.ч. в вариантах экранов);
 *   - другие библиотечные блоки, внутри которых он подключён;
 *   - слайды-блоки в данных ЖК (`block:<id>` в галереях estate-service).
 * Новости, где блок стоит секцией данных, — отдельно: там он и так с якорями.
 *
 * Сервис не ответил — это «не удалось проверить», а не «не используется»:
 * переписать блок вслепую нельзя.
 */
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { linkedBlocksService } from './LinkedBlocksService'
import { logger } from './Logger'

export interface BlockDataUsage {
  pages: Array<{ id: string; name: string; slug: string }>
  blocks: Array<{ id: string; name: string }>
  /** Проекты (slug ЖК), где блок стоит слайдом. */
  projects: string[]
  /** Новости, где блок стоит секцией данных. */
  news: Array<{ id: string; title: string }>
  /** Источники, которые не удалось проверить (estate-service, news-service). */
  unchecked: string[]
}

export type AnchorAction = 'use' | 'copy' | 'rewrite'

/**
 * Что можно сделать с блоком, чтобы поставить его в новость:
 *  - якоря уже есть — use (и по желанию copy);
 *  - якорей нет, блок показывается где-то со своим текстом (или проверить не
 *    удалось) — только copy;
 *  - якорей нет и нигде, кроме новостей, не используется — rewrite или copy.
 */
export function anchorActions(hasAnchors: boolean, usage: BlockDataUsage): AnchorAction[] {
  if (hasAnchors) return ['use', 'copy']
  const shownElsewhere = usage.pages.length + usage.blocks.length + usage.projects.length > 0 || usage.unchecked.length > 0
  return shownElsewhere ? ['copy'] : ['rewrite', 'copy']
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function findBlockDataUsage(blockId: string): Promise<BlockDataUsage> {
  const usage: BlockDataUsage = { pages: [], blocks: [], projects: [], news: [], unchecked: [] }

  usage.pages = (await linkedBlocksService.findBlockUsages(blockId)).map((p) => ({ id: p.pageId, name: p.pageName, slug: p.pageSlug }))
  usage.blocks = await linkedBlocksService.findBlocksContaining(blockId)

  const estate = process.env.ESTATE_SERVICE_URL || 'http://estate-service:5100'
  try {
    const data = await fetchJson(`${estate.replace(/\/+$/, '')}/api/complexes?full=1&lang=ru`)
    const needle = `"block:${blockId}"`
    usage.projects = (data?.items ?? []).filter((c: unknown) => JSON.stringify(c).includes(needle)).map((c: any) => String(c.slug))
  } catch (err: any) {
    logger.warn(`Использование блока ${blockId} в ЖК не проверено: ${err.message}`)
    usage.unchecked.push('estate-service (слайды проектов)')
  }

  const news = process.env.NEWS_SERVICE_URL
  const token = process.env.NEWS_WRITE_TOKEN
  if (news && token) {
    try {
      const data = await fetchJson(`${news.replace(/\/+$/, '')}/api/admin/block-usage/${encodeURIComponent(blockId)}`, { 'X-News-Token': token })
      usage.news = (data?.items ?? []).map((n: any) => ({ id: String(n.id), title: String(n.title) }))
    } catch (err: any) {
      logger.warn(`Использование блока ${blockId} в новостях не проверено: ${err.message}`)
      usage.unchecked.push('news-service (новости)')
    }
  } else {
    usage.unchecked.push('news-service (нет адреса или токена в окружении)')
  }
  return usage
}

/** Блок по id — или null. Отдельно, чтобы контроллер не тянул репозиторий. */
export async function loadBlock(blockId: string): Promise<Block | null> {
  return AppDataSource.getRepository(Block).findOne({ where: { id: blockId } })
}
