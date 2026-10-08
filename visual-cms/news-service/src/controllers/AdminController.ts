import { Request, Response } from 'express'
import { EntityManager, In, Repository } from 'typeorm'
import { AppDataSource } from '../config/database'
import { News } from '../models/News'
import { NewsCategory, NewsTag } from '../models/NewsDictionary'
import { NewsDeployment } from '../models/NewsDeployment'
import { NewsTranslation } from '../models/NewsTranslation'
import type { CreateNewsInput, UpdateNewsInput } from '../schemas/news.schema'
import { logger } from '../services/Logger'
import { NewsRow, NewsStatus, TrRow } from '../services/news'
import { blockedNewLocales, localeStates, normalizeSections, translationRows, translationsForAdmin } from '../services/newsInput'
import { invalidateNews } from '../services/newsStore'
import { slugify, uniqueSlug } from '../services/slug'

/** Ошибка запроса с кодом ответа: 400 — данные, 404 — нет записи, 409 — конфликт. */
class HttpError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, unknown>) {
    super(message)
  }
}

function handle(what: string, fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await fn(req, res)
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message, ...err.details })
        return
      }
      logger.error(`${what} failed`, err instanceof Error ? err : undefined)
      res.status(500).json({ error: 'Internal error' })
    }
  }
}

const newsRepo = (m?: EntityManager) => (m ?? AppDataSource.manager).getRepository(News)
const trRepo = (m?: EntityManager) => (m ?? AppDataSource.manager).getRepository(NewsTranslation)

function toTrRows(rows: NewsTranslation[]): TrRow[] {
  return rows.map((r) => ({ newsId: r.newsId, locale: r.locale, field: r.field, value: r.value }))
}

async function findNews(id: string, m?: EntityManager): Promise<News> {
  const news = await newsRepo(m).findOne({ where: { id } })
  if (!news) throw new HttpError(404, 'Новость не найдена')
  return news
}

/** Новость для админки: поля, переводы в форме редактора и состояние языков. */
async function adminView(id: string): Promise<Record<string, unknown>> {
  const news = await findNews(id)
  const rows = toTrRows(await trRepo().find({ where: { newsId: id } }))
  return { ...news, translations: translationsForAdmin(rows), locales: localeStates(news as NewsRow, rows) }
}

/** Рубрика и теги должны существовать: опечатка в ключе — ошибка, а не тихий пропуск. */
async function checkDictionaries(categoryKey: string | null | undefined, tagKeys: string[] | undefined): Promise<void> {
  if (categoryKey) {
    const found = await AppDataSource.getRepository(NewsCategory).count({ where: { key: categoryKey } })
    if (!found) throw new HttpError(400, `Нет рубрики «${categoryKey}»`)
  }
  if (tagKeys && tagKeys.length > 0) {
    const found = await AppDataSource.getRepository(NewsTag).find({ where: { key: In(tagKeys) }, select: { key: true } })
    const unknown = tagKeys.filter((k) => !found.some((t) => t.key === k))
    if (unknown.length > 0) throw new HttpError(400, `Нет тегов: ${unknown.join(', ')}`)
  }
}

async function takenSlugs(m: EntityManager, exceptId?: string): Promise<Set<string>> {
  const rows = await newsRepo(m).find({ select: { id: true, slug: true } })
  return new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.slug))
}

/** Переводы новости заменяются целиком; перевод удалённой секции отбрасывается. */
async function replaceTranslations(m: EntityManager, newsId: string, rows: TrRow[]): Promise<void> {
  await trRepo(m).delete({ newsId })
  if (rows.length > 0) await trRepo(m).insert(rows)
}

function assertLocalesReady(before: readonly string[], after: NewsRow, rows: TrRow[]): void {
  const blocked = blockedNewLocales(before, after, rows)
  if (Object.keys(blocked).length > 0) {
    throw new HttpError(400, 'Язык можно отметить только при полном переводе', { missing: blocked })
  }
}

function uniqueKeys(keys: string[] | undefined): string[] | undefined {
  return keys ? [...new Set(keys)] : undefined
}

export class AdminController {
  // --- Новости ---

  /** GET /api/admin/news — все новости, свежие правки сверху. */
  static listNews = handle('admin.listNews', async (_req, res) => {
    const [news, translations] = await Promise.all([newsRepo().find({ order: { updatedAt: 'DESC' } }), trRepo().find()])
    const rows = toTrRows(translations)
    res.json({
      items: news.map((n) => ({
        id: n.id,
        slug: n.slug,
        status: n.status,
        title: n.title,
        publishedAt: n.publishedAt,
        categoryKey: n.categoryKey,
        tagKeys: n.tagKeys,
        hero: n.hero.slice(0, 1),
        updatedAt: n.updatedAt,
        locales: localeStates(n as NewsRow, rows.filter((r) => r.newsId === n.id)),
      })),
    })
  })

  /**
   * GET /api/admin/block-usage/:blockId — новости, где блок данных CMS стоит
   * секцией (CMS решает по этому, можно ли переписать блок якорями).
   */
  static blockUsage = handle('admin.blockUsage', async (req, res) => {
    const blockId = req.params.blockId
    const news = await newsRepo().find({ order: { updatedAt: 'DESC' } })
    res.json({
      items: news
        .filter((n) => n.sections.some((s) => s.type === 'block' && s.blockId === blockId))
        .map((n) => ({ id: n.id, title: n.title, status: n.status })),
    })
  })

  /** GET /api/admin/news/:id */
  static getNews = handle('admin.getNews', async (req, res) => {
    res.json(await adminView(req.params.id))
  })

  /** POST /api/admin/news — черновик. Адрес — из заголовка, если не задан. */
  static createNews = handle('admin.createNews', async (req, res) => {
    const body = req.body as CreateNewsInput
    const tagKeys = uniqueKeys(body.tagKeys) ?? []
    await checkDictionaries(body.categoryKey, tagKeys)
    const id = await AppDataSource.transaction(async (m) => {
      const taken = await takenSlugs(m)
      if (body.slug && taken.has(body.slug)) throw new HttpError(409, `Адрес «${body.slug}» уже занят`)
      const sections = normalizeSections(body.sections ?? [])
      const news = newsRepo(m).create({
        slug: body.slug ?? uniqueSlug(slugify(body.title), taken),
        status: 'draft',
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
        categoryKey: body.categoryKey ?? null,
        tagKeys,
        title: body.title.trim(),
        lead: (body.lead ?? '').trim(),
        cover: body.cover ?? null,
        hero: body.hero ?? [],
        sections,
        publishOn: [...new Set(body.publishOn ?? [])],
      })
      const saved = await newsRepo(m).save(news)
      const rows = translationRows(saved.id, body.translations, sections)
      assertLocalesReady([], saved as NewsRow, rows)
      await replaceTranslations(m, saved.id, rows)
      return saved.id
    })
    invalidateNews()
    res.status(201).json(await adminView(id))
  })

  /**
   * PUT /api/admin/news/:id — частичное обновление. Адрес меняется только
   * до первой публикации. Отметку языка можно поставить при полном переводе.
   */
  static updateNews = handle('admin.updateNews', async (req, res) => {
    const body = req.body as UpdateNewsInput
    const tagKeys = uniqueKeys(body.tagKeys)
    await checkDictionaries(body.categoryKey, tagKeys)
    await AppDataSource.transaction(async (m) => {
      const news = await findNews(req.params.id, m)
      const before = [...news.publishOn]
      if (body.slug !== undefined && body.slug !== news.slug) {
        if (news.slugLocked) throw new HttpError(409, 'Адрес зафиксирован после публикации — ссылки на новость уже разошлись')
        if ((await takenSlugs(m, news.id)).has(body.slug)) throw new HttpError(409, `Адрес «${body.slug}» уже занят`)
        news.slug = body.slug
      }
      if (body.title !== undefined) news.title = body.title.trim()
      if (body.lead !== undefined) news.lead = body.lead.trim()
      if (body.categoryKey !== undefined) news.categoryKey = body.categoryKey
      if (tagKeys !== undefined) news.tagKeys = tagKeys
      if (body.cover !== undefined) news.cover = body.cover
      if (body.hero !== undefined) news.hero = body.hero
      if (body.sections !== undefined) news.sections = normalizeSections(body.sections)
      if (body.publishOn !== undefined) news.publishOn = [...new Set(body.publishOn)]
      if (body.publishedAt) news.publishedAt = new Date(body.publishedAt)

      // Переводы: присланные или прежние — заново против текущих секций,
      // чтобы перевод удалённой секции не висел в базе.
      const existing = toTrRows(await trRepo(m).find({ where: { newsId: news.id } }))
      const source = body.translations ?? translationsForAdmin(existing)
      const rows = translationRows(news.id, source, news.sections)
      assertLocalesReady(before, news as NewsRow, rows)
      await newsRepo(m).save(news)
      await replaceTranslations(m, news.id, rows)
    })
    invalidateNews()
    res.json(await adminView(req.params.id))
  })

  /** DELETE /api/admin/news/:id — вместе с переводами и отметками деплоя. */
  static deleteNews = handle('admin.deleteNews', async (req, res) => {
    const result = await newsRepo().delete({ id: req.params.id })
    if (!result.affected) throw new HttpError(404, 'Новость не найдена')
    invalidateNews()
    res.status(204).end()
  })

  private static setStatus(status: NewsStatus) {
    return handle(`admin.${status}`, async (req, res) => {
      const news = await findNews(req.params.id)
      news.status = status
      if (status === 'published') {
        // Дата — первой публикации; адрес с этого момента не меняется.
        news.publishedAt = news.publishedAt ?? new Date()
        news.slugLocked = true
      }
      await newsRepo().save(news)
      invalidateNews()
      res.json(await adminView(news.id))
    })
  }

  /** POST /api/admin/news/:id/publish */
  static publish = AdminController.setStatus('published')
  /** POST /api/admin/news/:id/unpublish — обратно в черновики. */
  static unpublish = AdminController.setStatus('draft')
  /** POST /api/admin/news/:id/archive — снята с сайта, но не черновик. */
  static archive = AdminController.setStatus('archived')

  // --- Словари: рубрики и теги ---

  private static dictionary(kind: 'category' | 'tag') {
    const repo = (): Repository<NewsCategory | NewsTag> =>
      AppDataSource.getRepository(kind === 'category' ? NewsCategory : NewsTag) as Repository<NewsCategory | NewsTag>
    const label = kind === 'category' ? 'Рубрика' : 'Тег'
    const usage = (key: string) =>
      kind === 'category'
        ? newsRepo().count({ where: { categoryKey: key } })
        : newsRepo().createQueryBuilder('n').where(':key = ANY(n.tagKeys)', { key }).getCount()

    return {
      list: handle(`admin.${kind}.list`, async (_req, res) => {
        res.json({ items: await repo().find({ order: { order: 'ASC', key: 'ASC' } }) })
      }),
      create: handle(`admin.${kind}.create`, async (req, res) => {
        if (await repo().count({ where: { key: req.body.key } })) throw new HttpError(409, `${label} «${req.body.key}» уже есть`)
        const saved = await repo().save(repo().create(req.body))
        invalidateNews()
        res.status(201).json(saved)
      }),
      update: handle(`admin.${kind}.update`, async (req, res) => {
        const row = await repo().findOne({ where: { key: req.params.key } })
        if (!row) throw new HttpError(404, `${label} не найден(а)`)
        const saved = await repo().save(Object.assign(row, req.body))
        invalidateNews()
        res.json(saved)
      }),
      /** Используемую запись не удаляем — её прячут (hidden). */
      remove: handle(`admin.${kind}.delete`, async (req, res) => {
        const used = await usage(req.params.key)
        if (used > 0) throw new HttpError(409, `${label} используется в новостях (${used}) — скройте вместо удаления`)
        const result = await repo().delete({ key: req.params.key })
        if (!result.affected) throw new HttpError(404, `${label} не найден(а)`)
        invalidateNews()
        res.status(204).end()
      }),
    }
  }

  static categories = AdminController.dictionary('category')
  static tags = AdminController.dictionary('tag')

  // --- Отчёт CMS о деплое ---

  /**
   * POST /api/admin/deployed { locale, slugs } — после деплоя коллекции
   * новостей CMS сообщает, какие адреса выкачены на языке. Набор заменяется
   * целиком: чего нет в отчёте — уже нет и на сайте.
   */
  static deployed = handle('admin.deployed', async (req, res) => {
    const { locale, slugs } = req.body as { locale: string; slugs: string[] }
    const result = await AppDataSource.transaction(async (m) => {
      const found = slugs.length ? await newsRepo(m).find({ where: { slug: In(slugs) }, select: { id: true, slug: true } }) : []
      const repo = m.getRepository(NewsDeployment)
      await repo.delete({ locale })
      if (found.length > 0) await repo.insert(found.map((n) => ({ newsId: n.id, locale })))
      return { deployed: found.length, unknown: slugs.filter((s) => !found.some((n) => n.slug === s)) }
    })
    invalidateNews()
    res.json({ locale, ...result })
  })
}
