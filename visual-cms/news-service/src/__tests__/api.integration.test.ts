/**
 * Сквозной тест HTTP API на настоящем Postgres.
 *
 * Запускается, только если задан NEWS_IT_DATABASE_URL — строка подключения к
 * серверу Postgres (имя БД в ней не важно). Тест создаёт отдельную временную
 * БД `news_it_<время>`, гоняет миграции и API и в конце удаляет её:
 *
 *   NEWS_IT_DATABASE_URL=postgresql://cms_user:cms_password@localhost:15432/postgres npx jest api.integration
 */
import type { Express } from 'express'
import { Client } from 'pg'
import request from 'supertest'

const BASE_URL = process.env.NEWS_IT_DATABASE_URL
const describeIt = BASE_URL ? describe : describe.skip
const TOKEN = 'it-token'
const S1 = '11111111-1111-4111-8111-111111111111'
const S2 = '22222222-2222-4222-8222-222222222222'

describeIt('news-service API (Postgres)', () => {
  const dbName = `news_it_${Date.now()}`
  let app: Express
  let dataSource: { destroy(): Promise<void>; isInitialized: boolean }

  const admin = (method: 'get' | 'post' | 'put' | 'delete', path: string) => request(app)[method](`/api/admin${path}`).set('X-News-Token', TOKEN)

  beforeAll(async () => {
    const url = new URL(BASE_URL as string)
    url.pathname = `/${dbName}`
    process.env.DATABASE_URL = url.toString()
    process.env.NEWS_WRITE_TOKEN = TOKEN
    // Модули читают DATABASE_URL при импорте — подключаем после настройки env.
    const { ensureDatabase } = await import('../config/ensureDatabase')
    const { AppDataSource } = await import('../config/database')
    const { runSafeMigrations } = await import('../migrations/runner')
    await ensureDatabase(process.env.DATABASE_URL)
    await AppDataSource.initialize()
    await runSafeMigrations(AppDataSource)
    dataSource = AppDataSource
    app = (await import('../app')).default
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy()
    const url = new URL(BASE_URL as string)
    url.pathname = '/postgres'
    const client = new Client({ connectionString: url.toString() })
    await client.connect()
    await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
    await client.end()
  }, 60000)

  let newsId = ''

  it('админ-API без токена закрыт', async () => {
    expect((await request(app).get('/api/admin/news')).status).toBe(401)
  })

  it('словари: создание, повтор ключа — 409', async () => {
    expect((await admin('post', '/categories').send({ key: 'promo', nameRu: 'Акции', nameUz: 'Aksiyalar' })).status).toBe(201)
    expect((await admin('post', '/tags').send({ key: 'mortgage', nameRu: 'Ипотека' })).status).toBe(201)
    expect((await admin('post', '/tags').send({ key: 'spare', nameRu: 'Запасной' })).status).toBe(201)
    expect((await admin('post', '/categories').send({ key: 'promo', nameRu: 'Ещё' })).status).toBe(409)
    expect((await admin('put', '/tags/mortgage').send({ nameUz: 'Ipoteka' })).body).toMatchObject({ key: 'mortgage', nameUz: 'Ipoteka' })
  })

  it('создание: адрес из заголовка, HTML очищен, неизвестная рубрика — 400', async () => {
    const res = await admin('post', '/news').send({
      title: 'Ипотека от банка-партнёра',
      lead: 'Анонс',
      categoryKey: 'promo',
      tagKeys: ['mortgage'],
      hero: ['/media/a.webp', '/media/b.webp'],
      sections: [{ id: S1, type: 'text', html: '<p>Текст<script>alert(1)</script></p>' }],
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ slug: 'ipoteka-ot-banka-partnyora', status: 'draft', slugLocked: false })
    expect(res.body.sections[0].html).toBe('<p>Текст</p>')
    expect(res.body.locales.uz).toEqual({ enabled: false, missing: ['title', 'lead', 'section:1'] })
    newsId = res.body.id

    const twin = await admin('post', '/news').send({ title: 'Ипотека от банка-партнёра' })
    expect(twin.body.slug).toBe('ipoteka-ot-banka-partnyora-2')
    expect((await admin('post', '/news').send({ title: 'x', slug: 'ipoteka-ot-banka-partnyora' })).status).toBe(409)
    expect((await admin('post', '/news').send({ title: 'x', categoryKey: 'nope' })).status).toBe(400)
    expect((await admin('delete', `/news/${twin.body.id}`)).status).toBe(204)
  })

  it('язык отмечается только при полном переводе', async () => {
    const blocked = await admin('put', `/news/${newsId}`).send({ publishOn: ['uz'] })
    expect(blocked.status).toBe(400)
    expect(blocked.body.missing).toEqual({ uz: ['title', 'lead', 'section:1'] })

    const ok = await admin('put', `/news/${newsId}`).send({
      publishOn: ['uz'],
      translations: { uz: { title: 'Hamkor bank ipotekasi', lead: 'Anons', sections: { [S1]: '<p>Matn</p>' } } },
    })
    expect(ok.status).toBe(200)
    expect(ok.body.locales.uz).toEqual({ enabled: true, missing: [] })
  })

  it('черновика нет в чтении; после публикации — есть, адрес зафиксирован', async () => {
    expect((await request(app).get('/api/news?lang=ru')).body.items).toEqual([])
    const pub = await admin('post', `/news/${newsId}/publish`)
    expect(pub.body).toMatchObject({ status: 'published', slugLocked: true })
    expect(pub.body.publishedAt).toBeTruthy()

    const ru = await request(app).get('/api/news?lang=ru')
    expect(ru.body.items.map((i: { slug: string }) => i.slug)).toEqual(['ipoteka-ot-banka-partnyora'])
    const uz = await request(app).get('/api/news?lang=uz&full=1')
    expect(uz.body.items[0]).toMatchObject({ title: 'Hamkor bank ipotekasi', url: '/uz/news/ipoteka-ot-banka-partnyora/' })
    expect(uz.body.items[0].sections[0]).toMatchObject({ text: [{ html: '<p>Matn</p>' }], photoText: [], sliderText: [] })
    expect(uz.body.items[0].hero).toHaveLength(2)

    expect((await admin('put', `/news/${newsId}`).send({ slug: 'new-address' })).status).toBe(409)
    expect((await request(app).get('/api/news/ipoteka-ot-banka-partnyora?lang=uz')).status).toBe(200)
    expect((await request(app).get('/api/news/unknown?lang=uz')).status).toBe(404)
  })

  it('публичная лента — только после отчёта CMS о деплое', async () => {
    expect((await request(app).get('/api/public/news?lang=ru')).body.items).toEqual([])
    const report = await admin('post', '/deployed').send({ locale: 'ru', slugs: ['ipoteka-ot-banka-partnyora', 'ghost'] })
    expect(report.body).toEqual({ locale: 'ru', deployed: 1, unknown: ['ghost'] })

    const feed = await request(app).get('/api/public/news').query({ lang: 'ru', q: 'ипотека' })
    expect(feed.headers['cache-control']).toBe('public, max-age=60')
    expect(feed.body).toMatchObject({ total: 1, hasMore: false })
    expect((await request(app).get('/api/public/news?lang=uz')).body.items).toEqual([]) // uz ещё не выкачен
    const facets = await request(app).get('/api/public/news/facets?lang=ru')
    expect(facets.body.categories).toEqual([{ key: 'promo', name: 'Акции', count: 1 }])
    expect(facets.body.tags).toEqual([{ key: 'mortgage', name: 'Ипотека', count: 1 }])
  })

  it('новая секция без перевода: отметка uz остаётся, но новость выпадает из uz', async () => {
    const res = await admin('put', `/news/${newsId}`).send({
      sections: [
        { id: S1, type: 'text', html: '<p>Текст</p>' },
        { id: S2, type: 'photoText', html: '<p>Ещё</p>', media: ['/media/c.webp'], side: 'left' },
      ],
    })
    expect(res.status).toBe(200)
    expect(res.body.locales.uz).toEqual({ enabled: true, missing: ['section:2'] })
    expect(res.body.translations.uz.sections).toEqual({ [S1]: '<p>Matn</p>' })
    expect((await request(app).get('/api/news?lang=uz')).body.items).toEqual([])
    expect((await request(app).get('/api/news?lang=ru')).body.items).toHaveLength(1)
  })

  it('используемый словарь не удаляется; новость удаляется вместе с переводами', async () => {
    expect((await admin('delete', '/categories/promo')).status).toBe(409)
    expect((await admin('delete', '/tags/mortgage')).status).toBe(409)
    expect((await admin('delete', '/tags/spare')).status).toBe(204)
    expect((await admin('delete', `/news/${newsId}`)).status).toBe(204)
    expect((await admin('get', `/news/${newsId}`)).status).toBe(404)
    expect((await request(app).get('/api/public/news?lang=ru')).body.items).toEqual([])
    expect((await admin('delete', '/categories/promo')).status).toBe(204)
  })
})
