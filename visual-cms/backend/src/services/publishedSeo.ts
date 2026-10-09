/**
 * SEO опубликованного сайта — по файлам, которые реально лежат на диске.
 *
 * Страницы выкладывают пять путей деплоя (страница, сайт, все сайты,
 * коллекции, варианты), и у каждого свои языки и свой noindex. Поэтому карта
 * сайта и ссылки между языковыми версиями строятся не из БД, а из результата:
 * `<siteDir>/<lang>/<путь>/index.html`. Что выложено — то и в sitemap; версия
 * с `<meta name="robots" content="noindex…">` (неполный перевод) — нет.
 *
 *  - sitemap.xml: адрес каждой индексируемой версии + hreflang её соседей;
 *  - в head каждой версии: canonical (свой адрес), og:url и, у индексируемой,
 *    alternate hreflang + x-default (версия основного языка) — блоком между
 *    маркерами, повторный проход заменяет его, а не дублирует;
 *  - robots.txt: открыт или, на тестовом стенде, закрыт целиком;
 *  - 404.html — своя страница «не найдено» вместо стандартной nginx.
 *
 * Корневые адреса без языка (/about/) не сканируются: там распознаватель
 * языка, он сам noindex и указывает canonical на основной язык.
 */
import * as fs from 'fs'
import * as path from 'path'

export interface SeoLanguage {
  code: string
  isDefault: boolean
}

/** Одна языковая версия страницы. */
export interface PublishedVersion {
  lang: string
  filePath: string
  indexable: boolean
  mtime: Date
}

/** Адрес страницы внутри языка ('' — главная) и её версии на языках. */
export interface PublishedPage {
  relDir: string
  versions: PublishedVersion[]
}

export const SEO_LINKS_START = '<!-- seo-links -->'
export const SEO_LINKS_END = '<!-- /seo-links -->'

/** Сколько байт начала файла читаем: там title, robots и блок ссылок. */
const HEAD_BYTES = 16 * 1024

const NOINDEX_RE = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i

export function isNoindex(html: string): boolean {
  return NOINDEX_RE.test(html)
}

function readHead(filePath: string): string {
  const fd = fs.openSync(filePath, 'r')
  try {
    const buf = Buffer.alloc(HEAD_BYTES)
    const n = fs.readSync(fd, buf, 0, HEAD_BYTES, 0)
    return buf.subarray(0, n).toString('utf-8')
  } finally {
    fs.closeSync(fd)
  }
}

/** Все `index.html` в папке языка: относительные папки, posix ('' — сама папка). */
function indexDirs(langDir: string): string[] {
  const out: string[] = []
  const walk = (dir: string, rel: string) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.isFile() && e.name === 'index.html') out.push(rel)
      else if (e.isDirectory()) walk(path.join(dir, e.name), rel ? `${rel}/${e.name}` : e.name)
    }
  }
  walk(langDir, '')
  return out
}

/**
 * Опубликованные страницы сайта по языкам. Порядок: главная, затем по
 * алфавиту; версии — в порядке `languages` (основной первым, как его
 * перечисляет вызывающий).
 */
export function scanPublished(siteDir: string, languages: SeoLanguage[]): PublishedPage[] {
  const byDir = new Map<string, PublishedVersion[]>()
  for (const lang of languages) {
    const langDir = path.join(siteDir, lang.code)
    for (const relDir of indexDirs(langDir)) {
      const filePath = path.join(langDir, ...relDir.split('/').filter(Boolean), 'index.html')
      const version: PublishedVersion = {
        lang: lang.code,
        filePath,
        indexable: !isNoindex(readHead(filePath)),
        mtime: fs.statSync(filePath).mtime,
      }
      if (!byDir.has(relDir)) byDir.set(relDir, [])
      byDir.get(relDir)!.push(version)
    }
  }
  return [...byDir.entries()]
    .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
    .map(([relDir, versions]) => ({ relDir, versions }))
}

/** Абсолютный адрес версии: `https://site/ru/about/` (главная — `https://site/ru/`). */
export function versionUrl(siteUrl: string, lang: string, relDir: string): string {
  const base = siteUrl.replace(/\/+$/, '')
  const rest = relDir.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return `${base}/${lang}/${rest ? `${rest}/` : ''}`
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Индексируемые версии страницы, если их хотя бы две: иначе hreflang не нужен. */
function alternatesOf(page: PublishedPage): PublishedVersion[] {
  const indexable = page.versions.filter((v) => v.indexable)
  return indexable.length >= 2 ? indexable : []
}

/** x-default — версия основного языка, а без неё — первая из индексируемых. */
function xDefaultOf(alternates: PublishedVersion[], defaultLang: string): PublishedVersion | undefined {
  return alternates.find((v) => v.lang === defaultLang) ?? alternates[0]
}

/** Блок ссылок для head одной версии. */
export function seoLinksFor(
  page: PublishedPage,
  version: PublishedVersion,
  opts: { siteUrl: string; defaultLang: string },
): string {
  const url = (v: PublishedVersion) => escapeAttr(versionUrl(opts.siteUrl, v.lang, page.relDir))
  const lines = [
    `<link rel="canonical" href="${url(version)}">`,
    `<meta property="og:url" content="${url(version)}">`,
  ]
  const alternates = version.indexable ? alternatesOf(page) : []
  for (const v of alternates) lines.push(`<link rel="alternate" hreflang="${v.lang}" href="${url(v)}">`)
  const xDefault = xDefaultOf(alternates, opts.defaultLang)
  if (xDefault) lines.push(`<link rel="alternate" hreflang="x-default" href="${url(xDefault)}">`)
  return [SEO_LINKS_START, ...lines.map((l) => `  ${l}`), `  ${SEO_LINKS_END}`].join('\n')
}

const BLOCK_RE = new RegExp(`[ \\t]*${SEO_LINKS_START}[\\s\\S]*?${SEO_LINKS_END}\\n?`)

/**
 * Ставит блок в head: на место прежнего, иначе сразу после `</title>` (в
 * начале файла — его видно в первых байтах), а без title — перед `</head>`.
 */
export function withSeoLinks(html: string, block: string): string {
  if (BLOCK_RE.test(html)) return html.replace(BLOCK_RE, `  ${block}\n`)
  const title = html.indexOf('</title>')
  if (title !== -1) {
    const at = title + '</title>'.length
    return `${html.slice(0, at)}\n  ${block}${html.slice(at)}`
  }
  const head = html.indexOf('</head>')
  if (head === -1) return html
  return `${html.slice(0, head)}  ${block}\n${html.slice(head)}`
}

/** Карта сайта: каждая индексируемая версия со ссылками на соседей. */
export function sitemapXml(pages: PublishedPage[], opts: { siteUrl: string; defaultLang: string }): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
  xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
  for (const page of pages) {
    const alternates = alternatesOf(page)
    const xDefault = xDefaultOf(alternates, opts.defaultLang)
    for (const version of page.versions.filter((v) => v.indexable)) {
      xml += '  <url>\n'
      xml += `    <loc>${escapeAttr(versionUrl(opts.siteUrl, version.lang, page.relDir))}</loc>\n`
      xml += `    <lastmod>${version.mtime.toISOString().split('T')[0]}</lastmod>\n`
      for (const v of alternates) {
        xml += `    <xhtml:link rel="alternate" hreflang="${v.lang}" href="${escapeAttr(versionUrl(opts.siteUrl, v.lang, page.relDir))}" />\n`
      }
      if (xDefault) {
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeAttr(versionUrl(opts.siteUrl, xDefault.lang, page.relDir))}" />\n`
      }
      xml += '  </url>\n'
    }
  }
  xml += '</urlset>\n'
  return xml
}

/** robots.txt. `closed` — тестовый стенд: поисковикам нельзя ничего. */
export function robotsTxt(siteUrl: string, closed: boolean): string {
  if (closed) return 'User-agent: *\nDisallow: /\n'
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl.replace(/\/+$/, '')}/sitemap.xml\n`
}

/** Тексты страницы «не найдено»; язык без своего текста получает английский. */
const NOT_FOUND_TEXT: Record<string, { title: string; lead: string; home: string }> = {
  ru: { title: 'Страница не найдена', lead: 'Возможно, адрес изменился или страница удалена.', home: 'На главную' },
  uz: { title: 'Sahifa topilmadi', lead: 'Manzil o‘zgargan yoki sahifa o‘chirilgan bo‘lishi mumkin.', home: 'Bosh sahifaga' },
  en: { title: 'Page not found', lead: 'The address may have changed or the page was removed.', home: 'Go to home page' },
}

/**
 * Своя страница 404: текст на языке из адреса (/uz/... — узбекский), без
 * языка в адресе — основной. Ссылки абсолютные от корня: nginx отдаёт её
 * по любому несуществующему пути.
 */
export function notFoundHtml(opts: { siteName: string; languages: SeoLanguage[] }): string {
  const codes = opts.languages.map((l) => l.code)
  const def = opts.languages.find((l) => l.isDefault)?.code || codes[0] || 'ru'
  const texts: Record<string, { title: string; lead: string; home: string }> = {}
  for (const code of codes.length ? codes : [def]) texts[code] = NOT_FOUND_TEXT[code] ?? NOT_FOUND_TEXT.en
  const first = texts[def] ?? NOT_FOUND_TEXT.en
  const name = escapeAttr(opts.siteName || '')
  // </script> в данных закрыл бы тег — экранируем «<».
  const data = JSON.stringify({ def, texts, site: opts.siteName || '' }).replace(/</g, '\\u003c')
  return `<!DOCTYPE html>
<html lang="${def}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>${escapeAttr(first.title)}${name ? ` — ${name}` : ''}</title>
<style>
  html, body { margin: 0; min-height: 100%; }
  body { display: grid; place-items: center; min-height: 100vh; padding: 24px; box-sizing: border-box; background: #f4f1ea; color: #15181d; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; }
  .nf-code { margin: 0; font-size: clamp(72px, 18vw, 160px); font-weight: 800; line-height: 1; color: #fdb82a; }
  .nf-title { margin: 12px 0 0; font-size: clamp(24px, 5vw, 40px); line-height: 1.1; }
  .nf-lead { max-width: 460px; margin: 12px auto 0; color: rgba(21, 24, 29, .66); font-size: 16px; line-height: 1.5; }
  .nf-home { display: inline-flex; align-items: center; min-height: 48px; margin-top: 28px; padding: 0 24px; border-radius: 999px; background: #15181d; color: #fff; font-weight: 800; text-decoration: none; }
  .nf-site { margin-top: 28px; color: rgba(21, 24, 29, .5); font-size: 14px; }
</style>
</head>
<body>
<main>
  <p class="nf-code">404</p>
  <h1 class="nf-title" data-nf="title">${escapeAttr(first.title)}</h1>
  <p class="nf-lead" data-nf="lead">${escapeAttr(first.lead)}</p>
  <a class="nf-home" data-nf="home" href="/${def}/">${escapeAttr(first.home)}</a>
  ${name ? `<p class="nf-site">${name}</p>` : ''}
</main>
<script>
(function(){
  var d = ${data};
  var seg = (location.pathname.split('/')[1] || '').toLowerCase();
  var lang = d.texts[seg] ? seg : d.def;
  var t = d.texts[lang];
  if (!t) return;
  document.documentElement.lang = lang;
  document.title = t.title + (d.site ? ' — ' + d.site : '');
  document.querySelector('[data-nf="title"]').textContent = t.title;
  document.querySelector('[data-nf="lead"]').textContent = t.lead;
  var home = document.querySelector('[data-nf="home"]');
  home.textContent = t.home;
  home.setAttribute('href', '/' + lang + '/');
})();
</script>
</body>
</html>
`
}

export interface SeoResult {
  pages: PublishedPage[]
  /** Файлы, в которых блок ссылок поменялся (переписаны). */
  rewritten: number
}

/**
 * Проход по сайту: блок ссылок в head каждой версии и sitemap.xml. Файл
 * переписывается, только если блок в нём другой.
 */
export function applyPublishedSeo(
  siteDir: string,
  opts: { siteUrl: string; languages: SeoLanguage[] },
): SeoResult {
  const defaultLang = opts.languages.find((l) => l.isDefault)?.code || opts.languages[0]?.code || ''
  const ordered = [...opts.languages].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
  const pages = scanPublished(siteDir, ordered)
  let rewritten = 0
  for (const page of pages) {
    for (const version of page.versions) {
      const block = seoLinksFor(page, version, { siteUrl: opts.siteUrl, defaultLang })
      if (readHead(version.filePath).includes(block)) continue
      const html = fs.readFileSync(version.filePath, 'utf-8')
      const next = withSeoLinks(html, block)
      if (next !== html) {
        fs.writeFileSync(version.filePath, next, 'utf-8')
        rewritten++
      }
    }
  }
  fs.writeFileSync(path.join(siteDir, 'sitemap.xml'), sitemapXml(pages, { siteUrl: opts.siteUrl, defaultLang }), 'utf-8')
  return { pages, rewritten }
}
