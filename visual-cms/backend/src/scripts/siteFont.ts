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

/** Семейства, которые на сайте не подключены: ссылка на них — это системный шрифт. */
const FOREIGN_FAMILY_RE = /Urbanist|Manrope|Montserrat|Muller/i

/**
 * Сокращённая запись `font: 700 16px/1 Urbanist, Arial, sans-serif`: вес,
 * размер, межстрочный — и семейство после них. `--sans` её не касается, так
 * что золотая кнопка на главной рисовалась Arial.
 *
 * Слева — не дефис и не буква: `font-family:` и `--font:` сюда не попадают.
 */
const FONT_SHORTHAND_RE =
  /((?<![-\w])font\s*:\s*[^;{}]*?\d(?:\.\d+)?(?:px|rem|em|%|pt)(?:\s*\/\s*[^\s;{}]+)?\s+)([^;{}]+)/gi

/** В сокращённой записи `font:` чужое семейство меняется на var(--sans). */
export function unifyFontShorthand(css: string, changes: string[], label: string): string {
  let replaced = 0
  const out = css.replace(FONT_SHORTHAND_RE, (match, head: string, family: string) => {
    if (!FOREIGN_FAMILY_RE.test(family)) return match
    replaced++
    const important = /\s*!important\s*$/i.test(family) ? ' !important' : ''
    return `${head}var(--sans)${important}`
  })
  if (replaced > 0) changes.push(`${label}: font: … → var(--sans) (${replaced})`)
  return out
}

/** Есть что чинить: свой `--sans` не Inter или `font:` с неподключённым семейством. */
export function needsFontFix(css: string | null | undefined): boolean {
  if (typeof css !== 'string') return false
  if (definesOtherSans(css)) return true
  for (const match of css.matchAll(FONT_SHORTHAND_RE)) {
    if (FOREIGN_FAMILY_RE.test(match[2])) return true
  }
  return false
}

/** Все правки шрифта для CSS блока или страницы. */
export function unifyFonts(css: string, changes: string[], label: string): string {
  return unifyFontShorthand(unifySansToken(css, changes, label), changes, label)
}
