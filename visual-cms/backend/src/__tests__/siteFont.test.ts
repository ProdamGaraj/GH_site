/**
 * Единый шрифт сайта (Inter): преобразования CSS.
 */
import {
  SITE_FONT_MARKER,
  SITE_SANS,
  definesOtherSans,
  migrateSiteCss,
  needsFontFix,
  unifyFontShorthand,
  unifyFonts,
  unifySansToken,
} from '../scripts/siteFont'

const LIVE_SITE_CSS = '.gmenu{display:flex}\n.gburger{display:none}\nhtml{\n    font-family: Montserrat !important\n}'
const URBANIST =
  ':root {\n  --ink: #15181d;\n  --sans: "Urbanist", "Manrope", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n}\nbody { font-family: var(--sans); }'

describe('migrateSiteCss', () => {
  it('убирает мёртвое правило Montserrat и добавляет шрифт сайта', () => {
    const changes: string[] = []
    const out = migrateSiteCss(LIVE_SITE_CSS, changes)
    expect(out).not.toMatch(/Montserrat/)
    expect(out).toContain('.gmenu{display:flex}')
    expect(out).toContain('.gburger{display:none}')
    expect(out).toContain(`--sans: ${SITE_SANS}`)
    expect(out).toContain('font-family: var(--sans)')
    expect(changes).toHaveLength(2)
  })

  it('повторный запуск ничего не меняет', () => {
    const once = migrateSiteCss(LIVE_SITE_CSS, [])
    const changes: string[] = []
    expect(migrateSiteCss(once, changes)).toBe(once)
    expect(changes).toEqual([])
    expect(once.split(SITE_FONT_MARKER)).toHaveLength(2)
  })

  it('пустой CSS сайта — только правило шрифта', () => {
    const out = migrateSiteCss('', [])
    expect(out.startsWith(SITE_FONT_MARKER)).toBe(true)
  })
})

describe('unifySansToken', () => {
  it('Urbanist/Manrope → Inter, остальной CSS не тронут', () => {
    const changes: string[] = []
    const out = unifySansToken(URBANIST, changes, 'блок «About Hero»')
    expect(out).toContain(`--sans: ${SITE_SANS};`)
    expect(out).toContain('--ink: #15181d;')
    expect(out).toContain('body { font-family: var(--sans); }')
    expect(changes).toEqual(['блок «About Hero»: --sans → Inter (1)'])
  })

  it('уже Inter — без правок (пробелы не считаются отличием)', () => {
    const css = `:root { --sans:   ${SITE_SANS.replace(/, /g, ',  ')} }`
    const changes: string[] = []
    expect(unifySansToken(css, changes, 'x')).toBe(css)
    expect(changes).toEqual([])
  })

  it('использование var(--sans) не путается с объявлением', () => {
    const css = 'a { font-family: var(--sans); }'
    expect(unifySansToken(css, [], 'x')).toBe(css)
  })

  it('последнее объявление без точки с запятой перед } тоже заменяется', () => {
    const out = unifySansToken(':root{--sans: "Urbanist"}', [], 'x')
    expect(out).toBe(`:root{--sans: ${SITE_SANS}}`)
  })
})

describe('definesOtherSans', () => {
  it('находит только чужое значение токена', () => {
    expect(definesOtherSans(URBANIST)).toBe(true)
    expect(definesOtherSans(`:root{--sans: ${SITE_SANS};}`)).toBe(false)
    expect(definesOtherSans('a { font-family: var(--sans) }')).toBe(false)
    expect(definesOtherSans(undefined)).toBe(false)
  })
})

describe('unifyFontShorthand', () => {
  // Золотая кнопка на главной и в контактах: `--sans` её не касается.
  const BUTTON = '.gold-cta {\n  color: #fff;\n  font: 700 16px/1 Urbanist, Arial, sans-serif;\n  cursor: pointer;\n}'

  it('чужое семейство → var(--sans), вес, размер и межстрочный сохранены', () => {
    const changes: string[] = []
    const out = unifyFontShorthand(BUTTON, changes, 'страница mainpage')
    expect(out).toContain('font: 700 16px/1 var(--sans);')
    expect(out).toContain('cursor: pointer;')
    expect(changes).toEqual(['страница mainpage: font: … → var(--sans) (1)'])
  })

  it('!important не теряется', () => {
    const out = unifyFontShorthand('a{font: 600 14px Manrope, sans-serif !important}', [], 'x')
    expect(out).toBe('a{font: 600 14px var(--sans) !important}')
  })

  it('подключённые и системные семейства не трогаются', () => {
    const css = 'a{font: 700 16px/1 Inter, Arial, sans-serif} b{font: 12px monospace}'
    const changes: string[] = []
    expect(unifyFontShorthand(css, changes, 'x')).toBe(css)
    expect(changes).toEqual([])
  })

  it('font-family и --font — не сокращённая запись', () => {
    const css = 'a{font-family: Urbanist, sans-serif} :root{--font: 700 16px Urbanist}'
    expect(unifyFontShorthand(css, [], 'x')).toBe(css)
  })

  it('повторный запуск ничего не меняет', () => {
    const once = unifyFontShorthand(BUTTON, [], 'x')
    const changes: string[] = []
    expect(unifyFontShorthand(once, changes, 'x')).toBe(once)
    expect(changes).toEqual([])
  })
})

describe('needsFontFix / unifyFonts', () => {
  it('находит и чужой --sans, и чужую сокращённую запись', () => {
    expect(needsFontFix(URBANIST)).toBe(true)
    expect(needsFontFix('a{font: 700 16px/1 Urbanist, Arial}')).toBe(true)
    expect(needsFontFix(`:root{--sans: ${SITE_SANS}} a{font: 700 16px Inter}`)).toBe(false)
    expect(needsFontFix(null)).toBe(false)
  })

  it('unifyFonts делает обе правки за раз', () => {
    const changes: string[] = []
    const out = unifyFonts(URBANIST + '\na{font: 700 16px/1 Urbanist, Arial}', changes, 'x')
    expect(needsFontFix(out)).toBe(false)
    expect(changes).toHaveLength(2)
  })
})
