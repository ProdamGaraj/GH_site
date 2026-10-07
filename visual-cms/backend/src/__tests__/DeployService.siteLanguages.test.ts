/**
 * Язык — параметр сайта: у каждой страницы версия на каждом активном языке.
 *
 *  - нет перевода поля — текст основного языка (карта переводов просто без
 *    этого поля), версия строится всё равно;
 *  - перевод неполон — <meta name="robots" content="noindex, follow">;
 *  - переключатель и распознаватель языка предлагают основной язык и языки,
 *    на которые есть перевод; sitemap (hreflang) — только полные переводы.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

jest.mock('../config/database', () => ({
  AppDataSource: { getRepository: jest.fn(() => ({ find: jest.fn(async () => []), findOne: jest.fn(), save: jest.fn() })) },
}))
const LANGS = [
  { code: 'ru', nativeName: 'Русский', flag: 'ru', isDefault: true, isActive: true, direction: 'ltr' },
  { code: 'uz', nativeName: 'Oʻzbekcha', flag: 'uz', isDefault: false, isActive: true, direction: 'ltr' },
  { code: 'en', nativeName: 'English', flag: 'en', isDefault: false, isActive: true, direction: 'ltr' },
]
jest.mock('../services/LanguageService', () => ({ languageService: { getActive: jest.fn(async () => LANGS) } }))
/** uz переведён полностью, en — не хватает 5 полей. */
const MISSING: Record<string, number> = { uz: 0, en: 5 }
jest.mock('../services/TranslationService', () => ({
  translationService: {
    getPageLocales: jest.fn(async () => ['uz']),
    getTranslationMap: jest.fn(async (_id: string, lang: string) => (lang === 'uz' ? { title: { content: 'Sarlavha' } } : {})),
    countMissing: jest.fn(async (_id: string, lang: string) => MISSING[lang] ?? 0),
    applyTranslations: jest.fn((structure: unknown, _map: unknown, metadata: unknown) => ({ structure, metadata })),
  },
  applyVariableMediaTranslations: (v: unknown) => v,
}))

import { htmlGenerator } from '../services/HtmlGenerator'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeployService } = require('../services/DeployService')

const page = {
  id: 'p1',
  name: 'О нас',
  slug: 'about',
  metadata: { title: 'О нас', description: '', keywords: [] },
  updatedAt: new Date('2026-10-07T00:00:00Z'),
  site: { id: 's', slug: 'main', settings: {} },
}
const root = { id: 'root', tagName: 'div', elementType: 'container', styles: { properties: {} }, attributes: {}, metadata: {}, children: [] }

describe('HtmlGenerator: noindex', () => {
  const html = (noindex?: boolean) => htmlGenerator.generatePage(root as any, { metadata: page.metadata, slug: 'about', noindex })

  it('неполный перевод — robots noindex, follow', () => {
    expect(html(true)).toContain('<meta name="robots" content="noindex, follow">')
  })

  it('без флага — мета robots нет', () => {
    expect(html(false)).not.toContain('name="robots"')
    expect(html()).not.toContain('name="robots"')
  })
})

describe('deployPageTranslations: все активные языки', () => {
  let dir: string
  let svc: any
  let calls: Array<{ lang: string; noindex?: boolean; switcher?: string[] }>

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'langs-'))
    svc = new DeployService()
    calls = []
    svc.prepareForPublish = async (_p: unknown, s: unknown) => s
    svc.generatePageHtml = async (_s: unknown, o: { lang: string; noindex?: boolean; availableLanguages?: Array<{ code: string }> }) => {
      calls.push({ lang: o.lang, noindex: o.noindex, switcher: o.availableLanguages?.map((l) => l.code) })
      return `<html lang="${o.lang}"></html>`
    }
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('язык без перевода строится; неполный — noindex; полный — без', async () => {
    const errors: string[] = []
    const deployed: string[] = []
    await svc.deployPageTranslations(page, root, undefined, deployed, errors, dir, false)
    expect(errors).toEqual([])
    expect(fs.existsSync(path.join(dir, 'uz', 'about', 'index.html'))).toBe(true)
    expect(fs.existsSync(path.join(dir, 'en', 'about', 'index.html'))).toBe(true)
    expect(calls.map((c) => [c.lang, c.noindex])).toEqual([
      ['uz', false],
      ['en', true],
    ])
  })

  it('переключатель — основной и языки с переводом (en без перевода в нём нет)', async () => {
    await svc.deployPageTranslations(page, root, undefined, [], [], dir, false)
    for (const c of calls) expect(c.switcher).toEqual(['ru', 'uz'])
    const langJson = JSON.parse(fs.readFileSync(path.join(dir, 'languages.json'), 'utf-8'))
    expect(langJson.map((l: { code: string }) => l.code)).toEqual(['ru', 'uz'])
  })
})

describe('offeredLanguages / switcherLanguages', () => {
  const svc = new DeployService() as any

  it('основной + языки с переводом; неактивные — никогда', () => {
    const langs = [...LANGS, { code: 'kz', nativeName: 'Қазақ', isDefault: false, isActive: false, direction: 'ltr' }]
    expect(svc.offeredLanguages(langs, ['uz', 'kz']).map((l: { code: string }) => l.code)).toEqual(['ru', 'uz'])
  })

  it('переводов нет — переключателя нет', () => {
    expect(svc.switcherLanguages(LANGS, [])).toBeUndefined()
    expect(svc.switcherLanguages(LANGS, ['en'])).toEqual([
      { code: 'ru', name: 'Русский', flag: 'ru', isDefault: true, direction: 'ltr' },
      { code: 'en', name: 'English', flag: 'en', isDefault: false, direction: 'ltr' },
    ])
  })
})

describe('sitemap: hreflang только для полных переводов', () => {
  it('uz полный — в hreflang, en неполный — нет', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-'))
    const svc = new DeployService() as any
    svc.resolveSiteDir = () => dir
    svc.resolveSiteUrl = () => 'https://example.uz'
    svc.pageRepository = { find: async () => [page] }
    try {
      await svc.generateSitemap(page.site)
      const xml = fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf-8')
      expect(xml).toContain('hreflang="uz"')
      expect(xml).not.toContain('hreflang="en"')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
