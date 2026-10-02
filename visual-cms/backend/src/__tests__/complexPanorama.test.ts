/**
 * «Панорама 360°» в «Локации»: кнопка по ссылке проекта. Блок — снимок
 * живого «Complex location» со стенда; подстановка данных — настоящий движок
 * деплоя коллекции (DeployService.substituteItemData).
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
const { migrateComplexPanorama, PANORAMA_LINK_ID, PANORAMA_LINK_STYLES } = require('../scripts/complexPanorama')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { htmlGenerator } = require('../services/HtmlGenerator')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { findAll, incompleteNodes } = require('../scripts/choiceToPlanTypes')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LIVE = require('./fixtures/locationBlockLive.json')

const svc: any = new DeployService()
const result = migrateComplexPanorama(LIVE)
const links = (root: any) => findAll(root, (n: any) => n.attributes?.id === PANORAMA_LINK_ID)

describe('блок «Локация» (живой снимок)', () => {
  it('до миграции ссылка всегда скрыта и ведёт на эту же секцию', () => {
    const [link] = links(LIVE)
    expect(link.attributes).toMatchObject({ href: '#location', hidden: '' })
  })

  it('после — ссылка в повторе по item.panorama, href панорамы, новая вкладка, без hidden', () => {
    const [link] = links(result.structure)
    expect(link.attributes).toMatchObject({ href: '{{$.url}}', target: '_blank', rel: 'noopener' })
    expect(link.attributes).not.toHaveProperty('hidden')
    const [wrapper] = findAll(result.structure, (n: any) => (n.children ?? []).includes(link))
    expect(wrapper._repeat).toEqual({ source: 'item.panorama' })
    expect(wrapper.styles.properties.display).toBe('contents')
    expect(incompleteNodes(result.structure)).toEqual([])
  })

  it('id и текст ссылки прежние — перевод («360° panorama») продолжает работать', () => {
    const [before] = links(LIVE)
    const [after] = links(result.structure)
    expect(after.id).toBe(before.id)
    expect(after.content).toBe('Панорама 360°')
  })

  it('кнопка: рамка сплошной линией, одна строка, не сжимается; прежний вид сохранён', () => {
    const [before] = links(LIVE)
    expect(before.styles.properties).not.toHaveProperty('borderStyle') // причина бага
    const [after] = links(result.structure)
    expect(after.styles.properties).toEqual({ ...before.styles.properties, ...PANORAMA_LINK_STYLES })
    expect(after.styles.properties).toMatchObject({ borderColor: '#66666b', borderWidth: '1px', borderRadius: '100px' })
  })

  it('блок после первой версии миграции (как на стенде) получает только вид кнопки', () => {
    const v1 = JSON.parse(JSON.stringify(result.structure))
    const [link] = links(v1)
    for (const key of Object.keys(PANORAMA_LINK_STYLES)) delete link.styles.properties[key]
    const again = migrateComplexPanorama(v1)
    expect(again.changes).toEqual(['кнопка: рамка сплошной линией, в одну строку, не сжимается текстом'])
    expect(again.structure).toEqual(result.structure)
  })

  it('повторный запуск ничего не меняет, исходник не мутируется', () => {
    const snapshot = JSON.stringify(LIVE)
    migrateComplexPanorama(LIVE)
    expect(JSON.stringify(LIVE)).toBe(snapshot)
    expect(migrateComplexPanorama(result.structure)).toMatchObject({ alreadyMigrated: true, changes: [] })
  })
})

describe('страница проекта после подстановки данных', () => {
  it('у проекта есть панорама — кнопка со ссылкой', () => {
    const page = svc.substituteItemData(result.structure, { panorama: [{ url: 'https://tour.example.com/dostlik' }] })
    const found = links(page)
    expect(found).toHaveLength(1)
    expect(found[0].attributes.href).toBe('https://tour.example.com/dostlik')
  })

  it('в HTML у кнопки сплошная рамка, одна строка и запрет сжатия', () => {
    const page = svc.substituteItemData(result.structure, { panorama: [{ url: 'https://tour.example.com/dostlik' }] })
    const html: string = htmlGenerator.generatePage(page, {
      metadata: { title: 'Harizma', description: '', keywords: [] },
      slug: 'complex/harizma',
    })
    // Стили узла — инлайн в style ссылки.
    const tag = html.match(/<a\b[^>]*id="panoramaLink"[^>]*>/)?.[0]
    expect(tag).toBeDefined()
    expect(tag).toMatch(/border-style:\s*solid/)
    expect(tag).toMatch(/white-space:\s*nowrap/)
    expect(tag).toMatch(/flex-shrink:\s*0/)
  })

  it('панорамы нет — кнопки нет вовсе', () => {
    expect(links(svc.substituteItemData(result.structure, { panorama: [] }))).toHaveLength(0)
    expect(links(svc.substituteItemData(result.structure, {}))).toHaveLength(0)
  })
})
