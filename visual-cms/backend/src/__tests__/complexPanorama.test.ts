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
const { migrateComplexPanorama, PANORAMA_LINK_ID } = require('../scripts/complexPanorama')
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

  it('панорамы нет — кнопки нет вовсе', () => {
    expect(links(svc.substituteItemData(result.structure, { panorama: [] }))).toHaveLength(0)
    expect(links(svc.substituteItemData(result.structure, {}))).toHaveLength(0)
  })
})
