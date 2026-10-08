/**
 * Hero раздела новостей по дизайну golden-house/news.html: живой блок
 * «News header» → hero-панель; узлы с переводами сохраняют id.
 */
import { HERO_CSS_MARKER, HERO_DEFAULT_IMAGE, HERO_LEAD_ID, HERO_PILL_ID, HERO_TEXT, HERO_TITLE_ID, HERO_TRANSLATIONS, migrateNewsHeader } from '../scripts/newsListDesign'
import { MigrationError, StructureNode, findAll } from '../scripts/choiceToPlanTypes'

const LIVE: StructureNode = require('./fixtures/newsHeaderBlockLive.json')
const byId = (root: StructureNode, id: string) => findAll(root, (n) => n.id === id)[0]

describe('migrateNewsHeader — живой блок', () => {
  const r = migrateNewsHeader(LIVE)

  it('hero: фото фоном, пилюля, заголовок, подзаголовок — тексты дизайна', () => {
    expect(r.alreadyMigrated).toBe(false)
    expect(r.structure.attributes!.class).toBe('news-hero')
    expect(r.structure.styles!.properties).toEqual({ backgroundImage: `url("${HERO_DEFAULT_IMAGE}")` })
    expect(byId(r.structure, HERO_PILL_ID)).toMatchObject({ tagName: 'span', content: HERO_TEXT.pill })
    expect(byId(r.structure, HERO_TITLE_ID)).toMatchObject({ tagName: 'h1', content: HERO_TEXT.title })
    expect(byId(r.structure, HERO_LEAD_ID)).toMatchObject({ tagName: 'p', content: HERO_TEXT.lead })
  })

  it('встроенные поля 180px ушли; корень и id блока те же; стили — hero', () => {
    expect(LIVE.styles!.properties!.marginLeft).toBe('180px')
    expect(r.structure.styles!.properties!.marginLeft).toBeUndefined()
    expect(r.structure.id).toBe(LIVE.id)
    expect(String(r.structure.metadata!.globalCss)).toContain(HERO_CSS_MARKER)
    expect(String(r.structure.metadata!.globalCss)).toContain('@media (max-width: 560px)')
  })

  it('«Новости» (перевод Yangiliklar) стал пилюлей — перевод верен; новые тексты получают переводы', () => {
    expect(byId(LIVE, HERO_PILL_ID).content).toBe('Новости')
    const nodes = new Set(HERO_TRANSLATIONS.filter((t) => t.locale === 'uz').map((t) => t.nodeId))
    expect([...nodes].sort()).toEqual([HERO_LEAD_ID, HERO_TITLE_ID].sort())
  })

  it('исходник не мутирует; повторно — без правок', () => {
    expect(byId(LIVE, HERO_PILL_ID).tagName).toBe('h1')
    expect(migrateNewsHeader(r.structure).alreadyMigrated).toBe(true)
  })

  it('прежний фон блока сохраняется', () => {
    const withBg = { ...LIVE, styles: { properties: { backgroundImage: 'url("/media/own.jpg")' } } }
    expect(migrateNewsHeader(withBg).structure.styles!.properties!.backgroundImage).toBe('url("/media/own.jpg")')
  })

  it('блок изменился (нет узлов заголовка) — ошибка', () => {
    expect(() => migrateNewsHeader({ id: 'x', children: [] })).toThrow(MigrationError)
  })
})
