/**
 * Снятие страницы с публикации.
 *
 * До этого снятие удаляло только `/<slug>/`, а с языковыми префиксами
 * страница продолжала открываться по `/ru/<slug>/` и `/uz/<slug>/`.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

jest.mock('../services/LanguageService', () => ({
  languageService: { getAll: jest.fn(), getActive: jest.fn() },
}))
const { languageService } = jest.requireMock('../services/LanguageService')

const SITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'unpublish-'))
process.env.PUBLIC_SITE_DIR = SITE_DIR
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeployService } = require('../services/DeployService')

interface Svc {
  unpublishPage(id: string): Promise<{ success: boolean; message: string; removed: string[] }>
  undeployPage(slug: string, siteSlug?: string): Promise<boolean>
  pageRepository: { findOne: jest.Mock; save: jest.Mock }
  generateSitemap: jest.Mock
}

function put(rel: string): void {
  const file = path.join(SITE_DIR, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '<html></html>')
}
const exists = (rel: string) => fs.existsSync(path.join(SITE_DIR, rel))

const SITE = { id: 'site', slug: '', homepageId: 'home' }

function service(page: Record<string, unknown> | null): Svc {
  const svc = new DeployService() as unknown as Svc
  svc.pageRepository = { findOne: jest.fn().mockResolvedValue(page), save: jest.fn() }
  svc.generateSitemap = jest.fn()
  return svc
}

beforeEach(() => {
  fs.rmSync(SITE_DIR, { recursive: true, force: true })
  fs.mkdirSync(SITE_DIR, { recursive: true })
  languageService.getAll.mockResolvedValue([{ code: 'ru' }, { code: 'uz' }, { code: 'en' }])
})

describe('unpublishPage', () => {
  it('убирает страницу из корня и всех языков, ставит черновик, обновляет sitemap', async () => {
    for (const rel of ['harizma-old/index.html', 'ru/harizma-old/index.html', 'uz/harizma-old/index.html']) put(rel)
    put('ru/about/index.html')
    const page = { id: 'p1', slug: 'harizma-old', status: 'published', site: SITE }
    const svc = service(page)

    const result = await svc.unpublishPage('p1')

    expect(result.success).toBe(true)
    expect(result.removed).toHaveLength(3)
    expect(exists('harizma-old')).toBe(false)
    expect(exists('ru/harizma-old')).toBe(false)
    expect(exists('uz/harizma-old')).toBe(false)
    expect(exists('ru/about/index.html')).toBe(true)
    expect(page.status).toBe('draft')
    expect(svc.pageRepository.save).toHaveBeenCalledWith(page)
    expect(svc.generateSitemap).toHaveBeenCalledWith(SITE)
  })

  it('главную не снимает: корень сайта без неё отдаёт 404', async () => {
    put('index.html')
    put('ru/index.html')
    const page = { id: 'home', slug: 'mainpage', status: 'published', site: SITE }
    const svc = service(page)

    const result = await svc.unpublishPage('home')

    expect(result.success).toBe(false)
    expect(result.message).toMatch(/главн/i)
    expect(exists('index.html')).toBe(true)
    expect(exists('ru/index.html')).toBe(true)
    expect(page.status).toBe('published')
    expect(svc.pageRepository.save).not.toHaveBeenCalled()
  })

  it('несуществующая страница — отказ без побочных эффектов', async () => {
    const svc = service(null)
    const result = await svc.unpublishPage('nope')
    expect(result.success).toBe(false)
    expect(svc.generateSitemap).not.toHaveBeenCalled()
  })

  it('страница без файлов на сайте всё равно становится черновиком', async () => {
    const page = { id: 'p2', slug: 'never-deployed', status: 'published', site: SITE }
    const result = await service(page).unpublishPage('p2')
    expect(result.success).toBe(true)
    expect(result.removed).toEqual([])
    expect(page.status).toBe('draft')
  })
})

describe('undeployPage (по slug)', () => {
  it('убирает адрес во всех языках, а не только в корне', async () => {
    put('news/index.html')
    put('ru/news/index.html')
    put('uz/news/index.html')
    const svc = service(null)
    await expect(svc.undeployPage('news')).resolves.toBe(true)
    expect(exists('ru/news')).toBe(false)
    expect(exists('uz/news')).toBe(false)
  })

  it('нечего удалять — false', async () => {
    await expect(service(null).undeployPage('ghost')).resolves.toBe(false)
  })
})
