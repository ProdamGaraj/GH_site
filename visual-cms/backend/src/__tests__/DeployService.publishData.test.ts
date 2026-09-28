/**
 * Данные страницы при публикации (page.publishData).
 *
 * Странице задаётся источник; на деплое он запрашивается на языке этой версии
 * страницы ({{lang}} в адресе) и подставляется в разметку тем же движком, что
 * у страниц коллекции: _repeat по item.<имя>, поля — {{$.поле}}.
 *
 * Инварианты:
 *  - страница без publishData не трогается (та же структура, без запросов);
 *  - {{lang}} и arrayPath применяются к каждому источнику;
 *  - источник не ответил / не найден — деплой падает (на сайте остаётся старый
 *    файл), а превью открывается без этих данных;
 *  - previewPublishData показывает число элементов и первый элемент, ошибку —
 *    по источнику, не роняя остальные.
 *
 * Приватные методы — через `as any` (как в DeployService.*.test.ts).
 */
// Модуль, а не скрипт: иначе require-константы конфликтуют с соседними тестами в tsc.
export {}

jest.mock('../config/database', () => {
  const cache = new Map<unknown, any>()
  return {
    AppDataSource: {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (!cache.has(entity)) {
          cache.set(entity, {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          })
        }
        return cache.get(entity)
      }),
    },
  }
})

jest.mock('../services/ResponsiveImageService', () => ({
  responsiveImageService: { enrich: jest.fn(async (html: string) => html) },
}))

jest.mock('../services/LinkedBlocksService', () => ({
  linkedBlocksService: { updateLinkedBlocks: jest.fn(async (s: any) => s) },
}))

jest.mock('../services/LanguageService', () => ({
  languageService: { getActive: jest.fn(async () => [{ code: 'ru', isDefault: true, isActive: true }]) },
}))

jest.mock('../services/TranslationService', () => ({
  translationService: { getPageLocales: jest.fn(async () => []) },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeployService } = require('../services/DeployService')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { secureDataSourceService } = require('../services/SecureDataSourceService')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { updateDataSettingsSchema } = require('../schemas/page.schema')

const DS_ID = '1ddf808d-77ee-4f07-aed7-0c21c82d1356'
const CATALOG_DS = {
  id: DS_ID,
  type: 'rest-api',
  config: { url: 'http://estate-service:5100/api/complexes?lang={{lang}}', method: 'GET' },
}

/** Сетка карточек: узел повторяется по item.complexes, внутри — поля элемента. */
function grid(): any {
  return {
    id: 'root',
    elementType: 'container',
    tagName: 'div',
    styles: { properties: {} },
    attributes: {},
    children: [
      {
        id: 'grid',
        elementType: 'container',
        tagName: 'div',
        styles: { properties: {} },
        attributes: { class: 'project-grid' },
        _repeat: { source: 'item.complexes' },
        children: [
          {
            id: 'card',
            elementType: 'text',
            tagName: 'a',
            styles: { properties: {} },
            attributes: { href: '/complex/{{$.slug}}' },
            content: '{{$.name}}',
            children: [],
          },
        ],
      },
    ],
  }
}

const COMPLEXES = [
  { slug: 'assalom-dostlik', name: 'Assalom Doʼstlik' },
  { slug: 'ozmakon-business', name: 'OʼzMakon' },
]

function svcWith(ds: any = CATALOG_DS): any {
  const svc: any = new DeployService()
  svc.dataSourceRepository.findOne = jest.fn(async () => ds)
  return svc
}

describe('DeployService.applyPublishData', () => {
  let fetchData: jest.SpyInstance
  beforeEach(() => {
    fetchData = jest
      .spyOn(secureDataSourceService, 'fetchData')
      .mockResolvedValue({ success: true, data: { items: COMPLEXES, total: 2 } })
  })
  afterEach(() => fetchData.mockRestore())

  it('без publishData — та же структура и ни одного запроса', async () => {
    const svc = svcWith()
    const structure = grid()
    expect(await svc.applyPublishData({ id: 'p1' }, structure, 'ru')).toBe(structure)
    expect(await svc.applyPublishData({ id: 'p1', publishData: [] }, structure, 'ru')).toBe(structure)
    expect(fetchData).not.toHaveBeenCalled()
  })

  it('разворачивает узел по данным источника (arrayPath) и подставляет поля', async () => {
    const svc = svcWith()
    const page = { id: 'p1', publishData: [{ name: 'complexes', dataSourceId: DS_ID, arrayPath: 'items' }] }
    const out = await svc.applyPublishData(page, grid(), 'ru')
    const cards = out.children[0].children
    expect(cards.map((c: any) => c.content)).toEqual(['Assalom Doʼstlik', 'OʼzMakon'])
    expect(cards.map((c: any) => c.attributes.href)).toEqual(['/complex/assalom-dostlik', '/complex/ozmakon-business'])
    expect(out.children[0]._repeat).toBeUndefined()
  })

  it('исходная структура не мутирует (её же дальше переводят на другие языки)', async () => {
    const svc = svcWith()
    const structure = grid()
    const before = JSON.stringify(structure)
    await svc.applyPublishData({ id: 'p1', publishData: [{ name: 'complexes', dataSourceId: DS_ID, arrayPath: 'items' }] }, structure, 'ru')
    expect(JSON.stringify(structure)).toBe(before)
  })

  it('запрашивает источник на языке версии страницы ({{lang}})', async () => {
    const svc = svcWith()
    const page = { id: 'p1', publishData: [{ name: 'complexes', dataSourceId: DS_ID, arrayPath: 'items' }] }
    await svc.applyPublishData(page, grid(), 'uz')
    expect(fetchData.mock.calls[0][0].url).toBe('http://estate-service:5100/api/complexes?lang=uz')
    // Конфиг самого источника не испорчен подстановкой: следующий язык снова получит плейсхолдер.
    expect(CATALOG_DS.config.url).toContain('{{lang}}')
  })

  it('без arrayPath в item.<имя> лежит весь ответ', async () => {
    fetchData.mockResolvedValue({ success: true, data: COMPLEXES })
    const svc = svcWith()
    const out = await svc.applyPublishData({ id: 'p1', publishData: [{ name: 'complexes', dataSourceId: DS_ID }] }, grid(), 'ru')
    expect(out.children[0].children).toHaveLength(2)
  })

  it('источник не ответил — ошибка с именем данных (деплой не пишет пустую страницу)', async () => {
    fetchData.mockResolvedValue({ success: false, error: { message: 'ECONNREFUSED' } })
    const svc = svcWith()
    const page = { id: 'p1', publishData: [{ name: 'complexes', dataSourceId: DS_ID, arrayPath: 'items' }] }
    await expect(svc.applyPublishData(page, grid(), 'ru')).rejects.toThrow(/«complexes».*ECONNREFUSED/)
  })

  it('источник удалён — ошибка', async () => {
    const svc = svcWith(null)
    const page = { id: 'p1', publishData: [{ name: 'complexes', dataSourceId: DS_ID }] }
    await expect(svc.applyPublishData(page, grid(), 'ru')).rejects.toThrow(/«complexes».*не найден/)
  })
})

describe('DeployService.previewPublishData', () => {
  let fetchData: jest.SpyInstance
  afterEach(() => fetchData.mockRestore())

  it('число элементов и первый элемент; ошибка — по своему источнику', async () => {
    fetchData = jest
      .spyOn(secureDataSourceService, 'fetchData')
      .mockResolvedValueOnce({ success: true, data: { items: COMPLEXES } })
      .mockResolvedValueOnce({ success: false, error: { message: 'timeout' } })
    const svc = svcWith()
    svc.pageRepository.findOne = jest.fn(async () => ({
      id: 'p1',
      publishData: [
        { name: 'complexes', dataSourceId: DS_ID, arrayPath: 'items' },
        { name: 'news', dataSourceId: DS_ID },
      ],
    }))
    const out = await svc.previewPublishData('p1')
    expect(out).toEqual([
      { name: 'complexes', count: 2, sample: COMPLEXES[0] },
      { name: 'news', count: null, sample: null, error: expect.stringContaining('timeout') },
    ])
    // Без lang — язык по умолчанию сайта.
    expect(fetchData.mock.calls[0][0].url).toBe('http://estate-service:5100/api/complexes?lang=ru')
  })

  it('ответ-объект: count null, sample — сам объект', async () => {
    fetchData = jest.spyOn(secureDataSourceService, 'fetchData').mockResolvedValue({ success: true, data: { total: 5 } })
    const svc = svcWith()
    svc.pageRepository.findOne = jest.fn(async () => ({ id: 'p1', publishData: [{ name: 'stats', dataSourceId: DS_ID }] }))
    expect(await svc.previewPublishData('p1', 'uz')).toEqual([{ name: 'stats', count: null, sample: { total: 5 } }])
  })
})

describe('renderPagePreview — данные при публикации', () => {
  let fetchData: jest.SpyInstance
  afterEach(() => fetchData.mockRestore())

  function previewSvc(): any {
    const svc = svcWith()
    svc.pageRepository.findOne = jest.fn(async () => ({
      id: 'p1',
      name: 'Home',
      slug: 'index',
      siteId: 's1',
      metadata: { title: 'Home', description: '', keywords: [] },
      additionalSources: [],
      publishData: [{ name: 'complexes', dataSourceId: DS_ID, arrayPath: 'items' }],
      site: { id: 's1', slug: 's1', settings: {}, homepageId: 'p1' },
    }))
    svc.pageRepository.find = jest.fn(async () => [])
    svc.collectionRepository.find = jest.fn(async () => [])
    svc.injectLibraryTemplates = jest.fn(async (s: any) => s)
    svc.preparePageDataConfig = jest.fn(async () => undefined)
    return svc
  }

  it('превью показывает те же карточки, что получит публикация', async () => {
    fetchData = jest.spyOn(secureDataSourceService, 'fetchData').mockResolvedValue({ success: true, data: { items: COMPLEXES } })
    const html = await previewSvc().renderPagePreview({ structure: grid(), pageId: 'p1' })
    expect(html).toContain('Assalom Doʼstlik')
    expect(html).toContain('/complex/ozmakon-business')
    expect(html).not.toContain('{{$.name}}')
  })

  it('источник не ответил — превью открывается, без карточек и без плейсхолдеров', async () => {
    fetchData = jest.spyOn(secureDataSourceService, 'fetchData').mockResolvedValue({ success: false, error: { message: 'down' } })
    const html = await previewSvc().renderPagePreview({ structure: grid(), pageId: 'p1' })
    expect(html).toContain('project-grid')
    expect(html).not.toContain('{{$.name}}')
    expect(html).not.toContain('/complex/')
  })
})

describe('updateDataSettingsSchema.publishData', () => {
  const ok = { name: 'complexes', dataSourceId: DS_ID, arrayPath: 'items' }

  it('принимает корректные данные', () => {
    expect(updateDataSettingsSchema.safeParse({ publishData: [ok] }).success).toBe(true)
    expect(updateDataSettingsSchema.safeParse({ publishData: [] }).success).toBe(true)
  })

  it('имя — идентификатор (item.<имя> в разметке)', () => {
    for (const name of ['1abc', 'with-dash', 'with space', '', 'item.x']) {
      expect(updateDataSettingsSchema.safeParse({ publishData: [{ ...ok, name }] }).success).toBe(false)
    }
    expect(updateDataSettingsSchema.safeParse({ publishData: [{ ...ok, name: '_catalog2' }] }).success).toBe(true)
  })

  it('имена не повторяются', () => {
    const r = updateDataSettingsSchema.safeParse({ publishData: [ok, { ...ok, arrayPath: '' }] })
    expect(r.success).toBe(false)
  })

  it('источник — uuid', () => {
    expect(updateDataSettingsSchema.safeParse({ publishData: [{ ...ok, dataSourceId: 'abc' }] }).success).toBe(false)
  })
})
