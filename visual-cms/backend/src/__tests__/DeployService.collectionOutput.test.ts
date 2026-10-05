/**
 * Деплой коллекции новостей в папку, где уже живёт страница списка.
 *
 * Страницы новостей — /<язык>/news/<slug>/, список — /<язык>/news/index.html.
 * Раньше деплой коллекции удалял папку news целиком вместе со списком. Теперь
 * убираются только папки элементов прошлой генерации; после деплоя коллекция
 * сообщает news-service, какие новости выкачены на каждом языке.
 *
 * Файлы — настоящие (временная папка); БД, языки, переводы и рендер страницы
 * элемента подменены.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

const repo = {
  findOne: jest.fn(),
  find: jest.fn(async () => []),
  findByIds: jest.fn(async () => []),
  save: jest.fn(async (e: unknown) => e),
}
jest.mock('../config/database', () => ({ AppDataSource: { getRepository: jest.fn(() => repo) } }))
jest.mock('../services/LanguageService', () => ({
  languageService: {
    getActive: jest.fn(async () => [
      { code: 'ru', nativeName: 'Русский', isDefault: true, isActive: true, direction: 'ltr' },
      { code: 'uz', nativeName: 'Oʻzbekcha', isDefault: false, isActive: true, direction: 'ltr' },
    ]),
  },
}))
jest.mock('../services/TranslationService', () => ({
  translationService: {
    getPageLocales: jest.fn(async () => ['uz']),
    getTranslationMap: jest.fn(async () => ({})),
    applyTranslations: jest.fn((structure: unknown, _map: unknown, metadata: unknown) => ({ structure, metadata })),
  },
}))
jest.mock('../services/LinkedBlocksService', () => ({ linkedBlocksService: { updateLinkedBlocks: jest.fn(async (s: unknown) => s) } }))
jest.mock('../services/ResponsiveImageService', () => ({ responsiveImageService: { enrich: jest.fn(async (h: string) => h) } }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeployService } = require('../services/DeployService')

type Items = Record<string, Array<{ slug: string; title: string }>>

let siteDir: string
let svc: any
let itemsByLang: Items
let fetchSpy: jest.SpyInstance

const collection = {
  id: 'col-news',
  name: 'Новости',
  basePath: '/news',
  slugField: 'slug',
  titleField: 'title',
  apiIdField: 'slug',
  templatePageId: 'tpl',
  templatePage: { id: 'tpl', name: 'Новость', structure: { id: 'root', children: [] }, metadata: { title: '{{item.title}}', description: '', keywords: [] } },
  site: { id: 'site-1', slug: 'main', settings: {} },
  overrides: [],
  useCache: false,
  reportDeployTo: 'news-service',
}

const file = (rel: string) => path.join(siteDir, rel)
const exists = (rel: string) => fs.existsSync(file(rel))
function write(rel: string, text: string): void {
  fs.mkdirSync(path.dirname(file(rel)), { recursive: true })
  fs.writeFileSync(file(rel), text)
}
const reports = () => fetchSpy.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)))

beforeEach(() => {
  siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'))
  process.env.NEWS_SERVICE_URL = 'http://news-service:5200'
  process.env.NEWS_WRITE_TOKEN = 'secret'
  repo.findOne.mockResolvedValue({ ...collection })
  fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response)

  svc = new DeployService()
  itemsByLang = {
    ru: [
      { slug: 'vaucher-makro', title: 'Ваучер' },
      { slug: 'novyy-etap', title: 'Новый этап' },
    ],
    uz: [{ slug: 'vaucher-makro', title: 'Vaucher' }],
  }
  svc.resolveSiteDir = () => siteDir
  svc.resolveNavigation = () => []
  svc.injectLibraryTemplates = async (s: unknown) => s
  svc.preparePageDataConfig = async () => undefined
  svc.fetchProjectStats = async () => ({})
  svc.collectionSwitcherLanguages = async () => undefined
  svc.fetchCollectionApiData = async (_c: unknown, lang: string) => ({ items: itemsByLang[lang] ?? [], raw: {} })
  svc.renderCollectionTemplateItem = async (p: { itemSlug: string; lang?: string }) => `<html>${p.lang}:${p.itemSlug}</html>`

  // Страница списка новостей, выкаченная обычным деплоем страниц.
  write('ru/news/index.html', 'список ru')
  write('uz/news/index.html', 'список uz')
  write('news/index.html', 'распознаватель языка списка')
})

afterEach(() => {
  fetchSpy.mockRestore()
  fs.rmSync(siteDir, { recursive: true, force: true })
})

it('страницы новостей пишутся рядом со списком, список остаётся', async () => {
  const result = await svc.deployCollection('col-news')

  expect(result.errors).toEqual([])
  expect(result.success).toBe(true)
  expect(fs.readFileSync(file('ru/news/index.html'), 'utf-8')).toBe('список ru')
  expect(fs.readFileSync(file('uz/news/index.html'), 'utf-8')).toBe('список uz')
  expect(fs.readFileSync(file('news/index.html'), 'utf-8')).toBe('распознаватель языка списка')
  expect(fs.readFileSync(file('ru/news/vaucher-makro/index.html'), 'utf-8')).toBe('<html>ru:vaucher-makro</html>')
  expect(fs.readFileSync(file('uz/news/vaucher-makro/index.html'), 'utf-8')).toBe('<html>uz:vaucher-makro</html>')
  expect(exists('uz/news/novyy-etap')).toBe(false) // на uz её нет
  expect(exists('news/novyy-etap/index.html')).toBe(true) // распознаватель языка
})

it('после деплоя news-service получает выкаченное по языкам', async () => {
  await svc.deployCollection('col-news')
  expect(fetchSpy).toHaveBeenCalledTimes(2)
  expect(fetchSpy.mock.calls[0][0]).toBe('http://news-service:5200/api/admin/deployed')
  expect(fetchSpy.mock.calls[0][1].headers['X-News-Token']).toBe('secret')
  expect(reports()).toEqual(
    expect.arrayContaining([
      { locale: 'ru', slugs: ['vaucher-makro', 'novyy-etap'] },
      { locale: 'uz', slugs: ['vaucher-makro'] },
    ])
  )
})

it('снятая новость исчезает со всех языков; чужая страница в папке не трогается', async () => {
  await svc.deployCollection('col-news')
  write('ru/news/archive/index.html', 'чужая страница')

  itemsByLang = { ru: [{ slug: 'vaucher-makro', title: 'Ваучер' }], uz: [] }
  const result = await svc.deployCollection('col-news')

  expect(result.success).toBe(true)
  expect(exists('ru/news/novyy-etap')).toBe(false)
  expect(exists('news/novyy-etap')).toBe(false)
  expect(exists('uz/news/vaucher-makro')).toBe(false)
  expect(exists('ru/news/vaucher-makro/index.html')).toBe(true)
  expect(exists('ru/news/archive/index.html')).toBe(true)
  expect(exists('ru/news/index.html')).toBe(true)
  expect(reports().slice(-2)).toEqual(
    expect.arrayContaining([
      { locale: 'ru', slugs: ['vaucher-makro'] },
      { locale: 'uz', slugs: [] },
    ])
  )
})

it('коллекция опустела — все страницы новостей убраны, список остаётся, сервис знает', async () => {
  await svc.deployCollection('col-news')
  itemsByLang = { ru: [], uz: [] }

  const result = await svc.deployCollection('col-news')

  expect(result.success).toBe(true)
  for (const rel of ['ru/news/vaucher-makro', 'ru/news/novyy-etap', 'uz/news/vaucher-makro', 'news/vaucher-makro']) {
    expect(exists(rel)).toBe(false)
  }
  expect(exists('ru/news/index.html')).toBe(true)
  expect(exists('news/index.html')).toBe(true)
  expect(reports().slice(-2)).toEqual(
    expect.arrayContaining([
      { locale: 'ru', slugs: [] },
      { locale: 'uz', slugs: [] },
    ])
  )
})

it('сбой отчёта — предупреждение, деплой успешен', async () => {
  fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'))
  const result = await svc.deployCollection('col-news')
  expect(result.success).toBe(true)
  expect(result.errors).toEqual(expect.arrayContaining([expect.stringMatching(/^Отчёт о деплое \(news-service, ru\): ECONNREFUSED/)]))
})

it('коллекция без отчёта (estate) — сервисам ничего не шлёт', async () => {
  repo.findOne.mockResolvedValue({ ...collection, reportDeployTo: null })
  await svc.deployCollection('col-news')
  expect(fetchSpy).not.toHaveBeenCalled()
})
