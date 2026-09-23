/**
 * Единый шрифт сайта — Inter.
 *
 * Что было: Inter подключён на всех страницах (customHeadHtml сайта), но
 * использовала его только главная. Базовый CSS генератора ставит body шрифт
 * Muller, а файлов /fonts/Muller-*.woff2 на сайте нет (404) — news, commerce,
 * страницы проектов рисовались системным шрифтом. Блоки about/buyers/contacts
 * задавали `--sans: "Urbanist", "Manrope"`, которые не подключены, — тоже
 * системный. В CSS сайта лежало `html { font-family: Montserrat !important }`:
 * Montserrat не подключён, а body свой шрифт задаёт сам, так что правило
 * ничего не делало.
 *
 * Здесь только чистые преобразования CSS: запись — в `migrate-site-font.ts`.
 * Все функции идемпотентны.
 */

export const SITE_SANS = '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

/** Маркер правила шрифта в CSS сайта — по нему узнаём, что оно уже есть. */
export const SITE_FONT_MARKER = '/* site-font: Inter */'

const SITE_FONT_RULE = `${SITE_FONT_MARKER}
/* Шрифт сайта. Inter подключён в customHeadHtml (Google Fonts, 400–800).
   Базовый CSS генератора ставит body шрифт Muller, файлов которого на сайте
   нет, — без этого правила страница без своего шрифта рисуется системным. */
:root {
  --sans: ${SITE_SANS};
}

body {
  font-family: var(--sans);
}
`

const MONTSERRAT_RULE_RE = /html\s*\{\s*font-family\s*:\s*Montserrat\s*!important\s*;?\s*\}\s*/i

const SANS_TOKEN_RE = /--sans\s*:\s*([^;}]+)/g

function normalizeValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** CSS сайта: убрать мёртвое правило Montserrat и задать шрифт один раз. */
export function migrateSiteCss(css: string, changes: string[]): string {
  let out = css
  if (MONTSERRAT_RULE_RE.test(out)) {
    out = out.replace(MONTSERRAT_RULE_RE, '')
    changes.push('CSS сайта: убрано html { font-family: Montserrat !important } (шрифт не подключён)')
  }
  if (!out.includes(SITE_FONT_MARKER)) {
    out = (out.trimEnd() ? out.trimEnd() + '\n\n' : '') + SITE_FONT_RULE
    changes.push('CSS сайта: --sans = Inter, body { font-family: var(--sans) }')
  }
  return out
}

/**
 * Блок или страница со своим `--sans`: значение приводится к Inter.
 *
 * Токен переопределяет сайтовый (CSS блоков и страниц идёт после CSS сайта),
 * поэтому оставить «Urbanist», «Manrope» — значит оставить системный шрифт.
 */
export function unifySansToken(css: string, changes: string[], label: string): string {
  let replaced = 0
  const out = css.replace(SANS_TOKEN_RE, (match, value: string) => {
    if (normalizeValue(value) === SITE_SANS) return match
    replaced++
    return `--sans: ${SITE_SANS}`
  })
  if (replaced > 0) changes.push(`${label}: --sans → Inter (${replaced})`)
  return out
}

export function definesOtherSans(css: string | null | undefined): boolean {
  if (typeof css !== 'string') return false
  for (const match of css.matchAll(SANS_TOKEN_RE)) {
    if (normalizeValue(match[1]) !== SITE_SANS) return true
  }
  return false
}
