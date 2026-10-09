/**
 * @jest-environment jsdom
 *
 * SEO по опубликованным файлам: sitemap, canonical/hreflang в head, robots, 404.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  SEO_LINKS_END,
  SEO_LINKS_START,
  applyPublishedSeo,
  isNoindex,
  notFoundHtml,
  robotsTxt,
  scanPublished,
  seoLinksFor,
  sitemapXml,
  versionUrl,
  withSeoLinks,
} from '../services/publishedSeo'

const LANGS = [
  { code: 'ru', isDefault: true },
  { code: 'uz', isDefault: false },
  { code: 'en', isDefault: false },
]
const SITE = 'https://gh.uz'

const page = (title: string, noindex = false) =>
  `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>${title}</title>\n` +
  (noindex ? '  <meta name="robots" content="noindex, follow">\n' : '') +
  `  <style>body{}</style>\n</head>\n<body>${title}</body>\n</html>\n`

function write(dir: string, rel: string, html: string) {
  const file = path.join(dir, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, html, 'utf-8')
}

describe('versionUrl', () => {
  it('язык в адресе, слеш на конце; главная — /ru/', () => {
    expect(versionUrl(SITE, 'ru', '')).toBe('https://gh.uz/ru/')
    expect(versionUrl(SITE, 'uz', 'complex/harizma')).toBe('https://gh.uz/uz/complex/harizma/')
  })

  it('слеш в конце адреса сайта не удваивается', () => {
    expect(versionUrl('https://gh.uz/', 'ru', 'about')).toBe('https://gh.uz/ru/about/')
  })
})

describe('isNoindex', () => {
  it('robots noindex — да; другое robots или его нет — нет', () => {
    expect(isNoindex(page('a', true))).toBe(true)
    expect(isNoindex(page('a'))).toBe(false)
    expect(isNoindex('<meta name="robots" content="index, follow">')).toBe(false)
  })
})

describe('по файлам сайта', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-'))
    write(dir, 'ru/index.html', page('Главная'))
    write(dir, 'uz/index.html', page('Bosh'))
    write(dir, 'en/index.html', page('Home', true))
    write(dir, 'ru/about/index.html', page('О нас'))
    write(dir, 'uz/about/index.html', page('Biz', true))
    write(dir, 'ru/complex/harizma/index.html', page('Harizma'))
    write(dir, 'uz/complex/harizma/index.html', page('Harizma uz'))
    // Распознаватель языка в корне и служебные файлы — не страницы языка.
    write(dir, 'about/index.html', page('stub', true))
    write(dir, 'index.html', page('stub', true))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('scanPublished: страницы по языкам, главная первой; корневые распознаватели не берутся', () => {
    const pages = scanPublished(dir, LANGS)
    expect(pages.map((p) => p.relDir)).toEqual(['', 'about', 'complex/harizma'])
    expect(pages[0].versions.map((v) => [v.lang, v.indexable])).toEqual([['ru', true], ['uz', true], ['en', false]])
    expect(pages[1].versions.map((v) => [v.lang, v.indexable])).toEqual([['ru', true], ['uz', false]])
  })

  it('sitemap: только индексируемые версии, hreflang — между ними, x-default — основной язык', () => {
    const xml = sitemapXml(scanPublished(dir, LANGS), { siteUrl: SITE, defaultLang: 'ru' })
    expect(xml).not.toContain('//ru')
    expect(xml).toContain('<loc>https://gh.uz/ru/</loc>')
    expect(xml).toContain('<loc>https://gh.uz/uz/</loc>')
    expect(xml).not.toContain('<loc>https://gh.uz/en/</loc>')
    expect(xml).toContain('<loc>https://gh.uz/ru/complex/harizma/</loc>')
    expect(xml).toContain('<loc>https://gh.uz/ru/about/</loc>')
    expect(xml).not.toContain('<loc>https://gh.uz/uz/about/</loc>')
    expect(xml).not.toContain('<loc>https://gh.uz/about/</loc>')
    // about — индексируется один язык: соседей нет, hreflang не нужен.
    const about = xml.slice(xml.indexOf('<loc>https://gh.uz/ru/about/</loc>'))
    expect(about.slice(0, about.indexOf('</url>'))).not.toContain('hreflang')
    const home = xml.slice(xml.indexOf('<loc>https://gh.uz/uz/</loc>'))
    const homeEntry = home.slice(0, home.indexOf('</url>'))
    expect(homeEntry).toContain('hreflang="ru" href="https://gh.uz/ru/"')
    expect(homeEntry).toContain('hreflang="uz" href="https://gh.uz/uz/"')
    expect(homeEntry).not.toContain('hreflang="en"')
    expect(homeEntry).toContain('hreflang="x-default" href="https://gh.uz/ru/"')
  })

  it('seoLinksFor: canonical и og:url — свой адрес; hreflang только у индексируемой версии', () => {
    const [home] = scanPublished(dir, LANGS)
    const uz = seoLinksFor(home, home.versions[1], { siteUrl: SITE, defaultLang: 'ru' })
    expect(uz).toContain('<link rel="canonical" href="https://gh.uz/uz/">')
    expect(uz).toContain('<meta property="og:url" content="https://gh.uz/uz/">')
    expect(uz).toContain('hreflang="ru"')
    expect(uz).toContain('hreflang="x-default" href="https://gh.uz/ru/"')
    const en = seoLinksFor(home, home.versions[2], { siteUrl: SITE, defaultLang: 'ru' })
    expect(en).toContain('<link rel="canonical" href="https://gh.uz/en/">')
    expect(en).not.toContain('hreflang')
  })

  it('applyPublishedSeo: блок в head каждой версии, sitemap на диске; повторный проход ничего не переписывает', () => {
    const first = applyPublishedSeo(dir, { siteUrl: SITE, languages: LANGS })
    expect(first.rewritten).toBe(7)
    const ru = fs.readFileSync(path.join(dir, 'ru/complex/harizma/index.html'), 'utf-8')
    expect(ru).toContain('<link rel="canonical" href="https://gh.uz/ru/complex/harizma/">')
    expect(ru).toContain('hreflang="uz" href="https://gh.uz/uz/complex/harizma/"')
    expect(ru.indexOf(SEO_LINKS_START)).toBeGreaterThan(ru.indexOf('</title>'))
    expect(fs.readFileSync(path.join(dir, 'about/index.html'), 'utf-8')).not.toContain(SEO_LINKS_START)
    expect(fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf-8')).toContain('https://gh.uz/ru/complex/harizma/')

    const again = applyPublishedSeo(dir, { siteUrl: SITE, languages: LANGS })
    expect(again.rewritten).toBe(0)
    expect(fs.readFileSync(path.join(dir, 'ru/complex/harizma/index.html'), 'utf-8')).toBe(ru)
  })

  it('перевод стал полным — у соседей появляется hreflang (блок заменяется, не дублируется)', () => {
    applyPublishedSeo(dir, { siteUrl: SITE, languages: LANGS })
    write(dir, 'uz/about/index.html', page('Biz'))
    applyPublishedSeo(dir, { siteUrl: SITE, languages: LANGS })
    const ru = fs.readFileSync(path.join(dir, 'ru/about/index.html'), 'utf-8')
    expect(ru).toContain('hreflang="uz" href="https://gh.uz/uz/about/"')
    expect(ru.split(SEO_LINKS_START)).toHaveLength(2)
    expect(ru.split(SEO_LINKS_END)).toHaveLength(2)
  })

  it('основной язык первым, даже если в списке он не первый', () => {
    const { pages } = applyPublishedSeo(dir, { siteUrl: SITE, languages: [LANGS[1], LANGS[0]] })
    expect(pages[0].versions.map((v) => v.lang)).toEqual(['ru', 'uz'])
  })

  it('папки языка нет — пустая карта, без ошибки', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-empty-'))
    try {
      const { pages } = applyPublishedSeo(empty, { siteUrl: SITE, languages: LANGS })
      expect(pages).toEqual([])
      expect(fs.readFileSync(path.join(empty, 'sitemap.xml'), 'utf-8')).toContain('<urlset')
    } finally {
      fs.rmSync(empty, { recursive: true, force: true })
    }
  })
})

describe('withSeoLinks', () => {
  const block = `${SEO_LINKS_START}\n  <link rel="canonical" href="x">\n  ${SEO_LINKS_END}`

  it('без title — перед </head>', () => {
    const html = withSeoLinks('<html><head><meta charset="UTF-8"></head><body></body></html>', block)
    expect(html.indexOf(SEO_LINKS_START)).toBeLessThan(html.indexOf('</head>'))
  })

  it('без head — файл не трогается', () => {
    expect(withSeoLinks('<p>x</p>', block)).toBe('<p>x</p>')
  })
})

describe('robotsTxt', () => {
  it('открыт: Allow и Sitemap без двойного слеша', () => {
    expect(robotsTxt('https://gh.uz/', false)).toBe('User-agent: *\nAllow: /\n\nSitemap: https://gh.uz/sitemap.xml\n')
  })

  it('закрыт (тестовый стенд): Disallow всего', () => {
    expect(robotsTxt('https://test.gh.uz', true)).toBe('User-agent: *\nDisallow: /\n')
  })
})

describe('notFoundHtml', () => {
  const html = notFoundHtml({ siteName: 'Golden House', languages: LANGS })

  it('основной язык в разметке, noindex, ссылка на главную языка', () => {
    expect(html).toContain('<html lang="ru">')
    expect(html).toContain('<meta name="robots" content="noindex">')
    expect(html).toContain('<title>Страница не найдена — Golden House</title>')
    expect(html).toContain('href="/ru/"')
  })

  it('тексты всех языков сайта — для выбора по адресу', () => {
    expect(html).toContain('Sahifa topilmadi')
    expect(html).toContain('Page not found')
  })

  it('язык без своих текстов — английский', () => {
    const kz = notFoundHtml({ siteName: '', languages: [{ code: 'kz', isDefault: true }] })
    expect(kz).toContain('<title>Page not found</title>')
  })

  it('язык из адреса меняет тексты (/uz/...)', () => {
    const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'))
    document.body.innerHTML = html.slice(html.indexOf('<main>'), html.indexOf('</main>') + 7)
    window.history.pushState({}, '', '/uz/nope/')
    new Function(script)()
    expect(document.documentElement.lang).toBe('uz')
    expect(document.querySelector('[data-nf="title"]')!.textContent).toBe('Sahifa topilmadi')
    expect(document.querySelector('[data-nf="home"]')!.getAttribute('href')).toBe('/uz/')
    expect(document.title).toBe('Sahifa topilmadi — Golden House')
  })
})
