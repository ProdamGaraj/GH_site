/**
 * Варианты страницы при публикации: адрес (сайт + slug) держит один
 * опубликованный вариант; опубликовать другой = заменить его без простоя.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

jest.mock('../services/LanguageService', () => ({
  languageService: { getAll: jest.fn(), getActive: jest.fn() },
}))
const { languageService } = jest.requireMock('../services/LanguageService')

const SITE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'variants-'))
process.env.PUBLIC_SITE_DIR = SITE_DIR
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeployService } = require('../services/DeployService')

interface Result {
  success: boolean
  message: string
  deployedPages: string[]
  errors: string[]
  code?: string
  occupant?: { id: string; name: string }
  replaced?: { id: string; name: string }
}

interface Svc {
  deployPage(id: string): Promise<Result>
  replacePublishedVariant(id: string): Promise<Result>
  unpublishPage(id: string): Promise<{ success: boolean; removed: string[] }>
  pageRepository: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock; update: jest.Mock }
  siteRepository: { save: jest.Mock }
  generateSitemap: jest.Mock
}

type PageStub = { id: string; name: string; slug: string; status: string; siteId: string; site: typeof SITE; structure?: unknown }

const SITE = { id: 'site', slug: '', homepageId: 'home' as string | null }

function put(rel: string): void {
  const file = path.join(SITE_DIR, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '<html></html>')
}
const exists = (rel: string) => fs.existsSync(path.join(SITE_DIR, rel))

function page(id: string, status: string, extra: Partial<PageStub> = {}): PageStub {
  return { id, name: `Страница ${id}`, slug: 'harizma', status, siteId: 'site', site: SITE, structure: {}, ...extra }
}

/** Сервис с подменённой базой: pages — все страницы по id, find ищет опубликованные по slug. */
function service(pages: PageStub[]): Svc {
  const svc = new DeployService() as unknown as Svc
  const byId = new Map(pages.map((p) => [p.id, p]))
  svc.pageRepository = {
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => byId.get(where.id) ?? null),
    find: jest.fn(async ({ where }: { where: { slug: string; status: string } }) =>
      pages.filter((p) => p.slug === where.slug && p.status === where.status)),
    save: jest.fn(async (p: PageStub) => p),
    update: jest.fn(async (id: string, patch: Partial<PageStub>) => Object.assign(byId.get(id)!, patch)),
  }
  svc.siteRepository = { save: jest.fn() }
  svc.generateSitemap = jest.fn()
  return svc
}

beforeEach(() => {
  fs.rmSync(SITE_DIR, { recursive: true, force: true })
  fs.mkdirSync(SITE_DIR, { recursive: true })
  languageService.getAll.mockResolvedValue([{ code: 'ru' }, { code: 'uz' }, { code: 'en' }])
  SITE.homepageId = 'home'
})

describe('deployPage при занятом адресе', () => {
  it('не публикует поверх чужого варианта: SLUG_OCCUPIED с именем занявшего', async () => {
    const svc = service([page('a', 'published'), page('b', 'draft')])
    const result = await svc.deployPage('b')
    expect(result.success).toBe(false)
    expect(result.code).toBe('SLUG_OCCUPIED')
    expect(result.occupant).toEqual({ id: 'a', name: 'Страница a' })
    expect(svc.pageRepository.save).not.toHaveBeenCalled()
  })

  it('опубликованный вариант другого сайта адрес не занимает', async () => {
    const svc = service([page('a', 'published', { siteId: 'site2' }), page('b', 'draft')])
    // Проверка соседа пропускает, дальше идёт обычная сборка (здесь она падает
    // на пустой структуре — важно лишь, что не SLUG_OCCUPIED).
    const result = await svc.deployPage('b')
    expect(result.code).toBeUndefined()
  })
})

describe('replacePublishedVariant', () => {
  /** deployPage подменяется: здесь проверяется оркестровка замены, а не сборка HTML. */
  function withDeploy(svc: Svc, impl: (id: string) => Promise<Result>) {
    return jest.spyOn(svc, 'deployPage').mockImplementation(impl)
  }

  it('прежний становится черновиком ДО выкладки нового, лишние языки прежнего убираются', async () => {
    for (const rel of ['harizma/index.html', 'ru/harizma/index.html', 'uz/harizma/index.html', 'en/harizma/index.html']) put(rel)
    const a = page('a', 'published')
    const b = page('b', 'draft')
    const svc = service([a, b])
    const deploy = withDeploy(svc, async () => {
      expect(a.status).toBe('draft') // иначе уникальный индекс не дал бы опубликовать b
      return { success: true, message: 'ok', deployedPages: ['ru/harizma/index.html', 'harizma/index.html', 'uz/harizma/index.html'], errors: [] }
    })

    const result = await svc.replacePublishedVariant('b')

    expect(deploy).toHaveBeenCalledWith('b')
    expect(result.success).toBe(true)
    expect(result.replaced).toEqual({ id: 'a', name: 'Страница a' })
    expect(exists('en/harizma/index.html')).toBe(false) // был только у прежнего
    expect(exists('uz/harizma/index.html')).toBe(true) // перезаписан новым
    expect(exists('ru/harizma/index.html')).toBe(true)
    expect(svc.generateSitemap).toHaveBeenCalledWith(SITE)
  })

  it('вариант главной: главная сайта переходит на новый вариант', async () => {
    put('index.html')
    put('ru/index.html')
    const home = page('home', 'published', { slug: 'mainpage' })
    const next = page('home2', 'draft', { slug: 'mainpage' })
    const svc = service([home, next])
    withDeploy(svc, async () => {
      expect(SITE.homepageId).toBe('home2') // новый выкладывается уже как главная
      return { success: true, message: 'ok', deployedPages: ['ru/index.html', 'index.html'], errors: [] }
    })

    const result = await svc.replacePublishedVariant('home2')

    expect(result.success).toBe(true)
    expect(svc.siteRepository.save).toHaveBeenCalledWith(expect.objectContaining({ homepageId: 'home2' }))
    expect(exists('index.html')).toBe(true)
  })

  it('новый не выложился — прежний перевыкладывается, главная и статусы возвращаются', async () => {
    put('ru/index.html')
    const home = page('home', 'published', { slug: 'mainpage' })
    const next = page('home2', 'draft', { slug: 'mainpage' })
    const svc = service([home, next])
    const deploy = withDeploy(svc, async (id) => {
      if (id === 'home2') return { success: false, message: 'сломалось', deployedPages: [], errors: ['x'] }
      home.status = 'published' // настоящий deployPage отмечает перевыложенный опубликованным
      return { success: true, message: 'ok', deployedPages: ['ru/index.html'], errors: [] }
    })

    const result = await svc.replacePublishedVariant('home2')

    expect(result.success).toBe(false)
    expect(result.message).toMatch(/остался «Страница home»/)
    expect(deploy.mock.calls.map((c) => c[0])).toEqual(['home2', 'home'])
    expect(svc.pageRepository.update).toHaveBeenCalledWith('home2', { status: 'draft' })
    expect(SITE.homepageId).toBe('home')
    expect(home.status).toBe('published')
    expect(exists('ru/index.html')).toBe(true) // файлы прежнего не тронуты
  })

  it('и прежний не перевыложился — статус всё равно возвращается «опубликовано»', async () => {
    const a = page('a', 'published')
    const svc = service([a, page('b', 'draft')])
    withDeploy(svc, async () => ({ success: false, message: 'нет', deployedPages: [], errors: ['x'] }))

    await svc.replacePublishedVariant('b')

    expect(a.status).toBe('published')
    expect(svc.pageRepository.save).toHaveBeenLastCalledWith(a)
  })

  it('адрес свободен — обычная публикация', async () => {
    const svc = service([page('b', 'draft')])
    const deploy = withDeploy(svc, async () => ({ success: true, message: 'ok', deployedPages: [], errors: [] }))
    const result = await svc.replacePublishedVariant('b')
    expect(result.replaced).toBeUndefined()
    expect(deploy).toHaveBeenCalledTimes(1)
    expect(svc.siteRepository.save).not.toHaveBeenCalled()
  })
})

describe('unpublishPage у черновика-варианта', () => {
  it('ничего не удаляет: файлы по адресу принадлежат опубликованному варианту', async () => {
    put('harizma/index.html')
    put('ru/harizma/index.html')
    const svc = service([page('a', 'published'), page('b', 'draft')])
    const result = await svc.unpublishPage('b')
    expect(result.success).toBe(true)
    expect(result.removed).toEqual([])
    expect(exists('ru/harizma/index.html')).toBe(true)
    expect(svc.pageRepository.save).not.toHaveBeenCalled()
  })
})
