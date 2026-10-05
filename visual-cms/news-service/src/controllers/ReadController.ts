import { Request, Response } from 'express'
import { buildFacets, parseFeedQuery, runFeed } from '../services/feed'
import { cardsIn, detailBySlug, detailsIn } from '../services/catalog'
import { logger } from '../services/Logger'
import { normalizeLocale } from '../services/news'
import { feedEntriesCached, snapshot } from '../services/newsStore'

/** Сколько секунд браузер и nginx держат ответ публичной ленты. */
const PUBLIC_MAX_AGE = 60

function limitOf(value: unknown): number | undefined {
  const n = Number.parseInt(typeof value === 'string' ? value : '', 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500) : undefined
}

function fail(res: Response, what: string, err: unknown): void {
  logger.error(`${what} failed`, err instanceof Error ? err : undefined)
  res.status(500).json({ error: 'Internal error' })
}

/**
 * Чтение новостей.
 *  - Внутреннее (DataSource CMS, server-fetch): то, что опубликовано на языке,
 *    — по нему CMS строит страницы новостей и статичные карточки.
 *  - Публичное (через nginx, браузер): лента и варианты фильтров — только то,
 *    что уже выкачено на сайт.
 */
export class ReadController {
  /**
   * GET /api/news?lang=[&full=1][&limit=N]
   * Карточки (для ленты на /news и главной) или, с `full=1`, полные данные
   * страниц — для коллекции CMS. От новых к старым.
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const locale = normalizeLocale(req.query.lang as string)
      const limit = limitOf(req.query.limit)
      const s = await snapshot()
      const full = req.query.full === '1' || req.query.full === 'true'
      res.json({ locale, items: full ? detailsIn(s, locale, limit) : cardsIn(s, locale, limit) })
    } catch (err) {
      fail(res, 'news.list', err)
    }
  }

  /** GET /api/news/:slug?lang= — страница новости; 404, если на языке её нет. */
  static async detail(req: Request, res: Response): Promise<void> {
    try {
      const locale = normalizeLocale(req.query.lang as string)
      const item = detailBySlug(await snapshot(), locale, req.params.slug)
      if (!item) {
        res.status(404).json({ error: 'Not found' })
        return
      }
      res.json(item)
    } catch (err) {
      fail(res, 'news.detail', err)
    }
  }

  /** GET /api/public/news?lang&offset&limit&q&category&tags&tagMode&from&to — порция ленты. */
  static async feed(req: Request, res: Response): Promise<void> {
    try {
      const locale = normalizeLocale(req.query.lang as string)
      const page = runFeed(await feedEntriesCached(locale), parseFeedQuery(req.query as Record<string, unknown>))
      res.set('Cache-Control', `public, max-age=${PUBLIC_MAX_AGE}`)
      res.json({ locale, ...page })
    } catch (err) {
      fail(res, 'news.feed', err)
    }
  }

  /** GET /api/public/news/facets?lang — рубрики, теги и месяцы с новостями. */
  static async facets(req: Request, res: Response): Promise<void> {
    try {
      const locale = normalizeLocale(req.query.lang as string)
      const s = await snapshot()
      res.set('Cache-Control', `public, max-age=${PUBLIC_MAX_AGE}`)
      res.json({ locale, ...buildFacets(await feedEntriesCached(locale), s.dict, locale) })
    } catch (err) {
      fail(res, 'news.facets', err)
    }
  }
}
