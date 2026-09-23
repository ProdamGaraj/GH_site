/**
 * Единый шрифт сайта (Inter): преобразования CSS.
 */
import {
  SITE_FONT_MARKER,
  SITE_SANS,
  definesOtherSans,
  migrateSiteCss,
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
