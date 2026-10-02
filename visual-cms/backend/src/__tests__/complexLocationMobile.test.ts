/**
 * «Локация» на телефоне: ряд маршрутов и строка «текст + Панорама 360°»
 * перестраиваются в столбик переопределениями брейкпоинта Mobile. Блок — снимок
 * живого «Complex location» после миграции панорамы (как на стенде); CSS —
 * настоящий генератор деплоя.
 */
// Модуль, а не скрипт: иначе require-константы конфликтуют с соседними тестами в tsc.
export {}

jest.mock('../config/database', () => ({
  AppDataSource: { getRepository: jest.fn(() => ({ findOne: jest.fn(), find: jest.fn(async () => []) })) },
}))
jest.mock('../services/ResponsiveImageService', () => ({
  responsiveImageService: { enrich: jest.fn(async (html: string) => html) },
}))
jest.mock('../services/LinkedBlocksService', () => ({
  linkedBlocksService: { updateLinkedBlocks: jest.fn(async (s: any) => s) },
}))
jest.mock('../services/TranslationService', () => ({
  translationService: { getPageLocales: jest.fn(async () => []) },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeployService } = require('../services/DeployService')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { htmlGenerator } = require('../services/HtmlGenerator')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { migrateComplexPanorama } = require('../scripts/complexPanorama')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { layoutLocationMobile, LOCATION_MOBILE_RULES, LOCATION_MOBILE_BP } = require('../scripts/complexLocationMobile')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { findAll, MigrationError } = require('../scripts/choiceToPlanTypes')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LIVE = require('./fixtures/locationBlockLive.json')

const svc: any = new DeployService()
const STAND = migrateComplexPanorama(LIVE).structure
const result = layoutLocationMobile(STAND)

const ROW_ID = '1790915613212-096ere2iw'
const TRIP_LINKS_ID = 'location-trip-links'
const BUTTONS_ID = '1790915974882-uiv2n2y7v'

const byId = (root: any, id: string) => findAll(root, (n: any) => n.id === id)[0]
const parentOf = (root: any, id: string) => findAll(root, (n: any) => (n.children ?? []).some((c: any) => c.id === id))[0]
const overrideOf = (root: any, id: string, bp = LOCATION_MOBILE_BP) =>
  parentOf(root, id).variations?.[bp]?.inheritedOverrides?.[id]

describe('блок «Локация»: раскладка на телефоне', () => {
  it('до миграции переопределений нет — ряд маршрутов flex-строкой с min-width 70%', () => {
    for (const id of [ROW_ID, TRIP_LINKS_ID, BUTTONS_ID]) expect(overrideOf(STAND, id)).toBeUndefined()
    expect(byId(STAND, BUTTONS_ID).styles.properties).toMatchObject({ minWidth: '70%', flexDirection: 'row-reverse' })
  })

  it('текст и «Панорама 360°» — столбиком, кнопка под текстом', () => {
    expect(overrideOf(result.structure, ROW_ID).styles).toEqual({ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' })
  })

  it('кнопки маршрутов и отдел продаж — столбиком', () => {
    expect(overrideOf(result.structure, TRIP_LINKS_ID).styles).toEqual({ flexDirection: 'column', alignItems: 'stretch', gap: '12px' })
  })

  it('кнопки маршрутов — столбиком в порядке как на ПК (такси первым), без min-width 70%', () => {
    expect(overrideOf(result.structure, BUTTONS_ID).styles).toEqual({ flexDirection: 'column-reverse', minWidth: '0', gap: '8px' })
  })

  it('ПК и планшет не меняются: базовые стили прежние, переопределения только на Mobile', () => {
    for (const id of [ROW_ID, TRIP_LINKS_ID, BUTTONS_ID]) {
      expect(byId(result.structure, id).styles).toEqual(byId(STAND, id).styles)
      expect(Object.keys(parentOf(result.structure, id).variations)).toEqual([LOCATION_MOBILE_BP])
    }
    expect(result.changes).toHaveLength(LOCATION_MOBILE_RULES.length)
  })

  it('повторный запуск ничего не меняет, исходник не мутируется', () => {
    const snapshot = JSON.stringify(STAND)
    layoutLocationMobile(STAND)
    expect(JSON.stringify(STAND)).toBe(snapshot)
    expect(layoutLocationMobile(result.structure)).toMatchObject({ alreadyMigrated: true, changes: [] })
  })

  it('чужая разметка — понятная ошибка, а не тихий пропуск', () => {
    const broken = JSON.parse(JSON.stringify(STAND))
    const [links] = findAll(broken, (n: any) => n.id === TRIP_LINKS_ID)
    links.attributes = { ...links.attributes, class: 'other' }
    expect(() => layoutLocationMobile(broken)).toThrow(MigrationError)
    expect(() => layoutLocationMobile(broken)).toThrow('.location-trip-links')
  })
})

describe('CSS деплоя страницы проекта', () => {
  const BREAKPOINTS = [
    { id: 'desktop-hd', name: 'Desktop HD', width: 1440 },
    { id: 'desktop-fhd', name: 'Desktop FHD', width: 1920 },
    { id: 'tablet', name: 'Tablet', width: 768 },
    { id: 'mobile', name: 'Mobile', width: 375 },
  ]
  const offices = [
    { name: 'Отдел продаж', address: 'ул. Бабура, 1' },
    { name: 'Офис на Чиланзаре', address: 'ул. Катартал, 2' },
  ]
  const tree = { ...result.structure, metadata: { ...result.structure.metadata, breakpoints: BREAKPOINTS } }
  const page = svc.substituteItemData(tree, { panorama: [{ url: 'https://tour.example.com/x' }], mapOffices: offices })
  const html: string = htmlGenerator.generatePage(page, {
    metadata: { title: 'Harizma', description: '', keywords: [] },
    slug: 'complex/harizma',
  })
  // Правила брейкпоинтов — в секции «Responsive styles» (в CSS блока есть свои @media).
  const mediaBody = (query: string) => {
    const start = html.indexOf(`@media ${query} {`, html.indexOf('/* Responsive styles */'))
    expect(start).toBeGreaterThan(-1)
    return html.slice(start, html.indexOf('\n    }\n', start))
  }

  it('правила только в диапазоне телефона (до 767px), с приоритетом над встроенными стилями', () => {
    const mobile = mediaBody('(max-width: 767px)')
    expect(mobile).toMatch(new RegExp(`\\[data-element-id="${TRIP_LINKS_ID}"\\] \\{[^}]*flex-direction: column !important`))
    expect(mobile).toMatch(new RegExp(`\\[data-element-id="${BUTTONS_ID}"\\] \\{[^}]*flex-direction: column-reverse !important[^}]*min-width: 0 !important`))
    expect(mobile).toMatch(new RegExp(`\\[data-element-id="${ROW_ID}"\\] \\{[^}]*flex-direction: column !important`))
    // Все CSS-правила этих узлов — телефонные: ПК и планшет живут на встроенных
    // стилях. (Правило группы кнопок повторяется по разу на офис — переопределение
    // лежит в шаблоне повтора; копии одинаковые.)
    for (const id of [ROW_ID, TRIP_LINKS_ID, BUTTONS_ID]) {
      const selector = `[data-element-id="${id}"]`
      expect(html.split(selector).length - 1).toBe(mobile.split(selector).length - 1)
    }
  })

  it('ряд каждого офиса из повтора попадает под то же правило', () => {
    const elements = (id: string) => html.match(new RegExp(`<[a-z]+\\b[^>]*data-element-id="${id}"`, 'g')) ?? []
    expect(elements(TRIP_LINKS_ID)).toHaveLength(offices.length)
    expect(elements(BUTTONS_ID)).toHaveLength(offices.length)
  })
})
