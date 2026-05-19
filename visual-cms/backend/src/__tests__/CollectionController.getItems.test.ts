/**
 * B3: тесты генерации динамических страниц проектов (Collections).
 *
 * Ранее покрытие отсутствовало (collections.test.ts тестировал только
 * Zod-схемы/`template:`). Здесь пинится фактическая логика генерации:
 *  - slugify (транслит кириллицы, нормализация);
 *  - getNestedValue (доступ по пути к titleField/slugField);
 *  - getItems: вычисление slug/generatedUrl, нормализация basePath,
 *    резолв overrides (по apiItemId и fallback по slug), warnings,
 *    fallback на кеш при ошибке API.
 */
import { Request, Response, NextFunction } from 'express'

const flushPromises = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) {
    await new Promise(resolve => setImmediate(resolve))
  }
}

const mockCollectionRepo = {
  findOne: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
}
const mockGenericRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
}

jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: any) =>
      entity?.name === 'Collection' ? mockCollectionRepo : mockGenericRepo
    ),
  },
}))

import collectionController from '../controllers/CollectionController'

const ctrl = collectionController as any

describe('CollectionController — slugify (pure)', () => {
  it.each([
    ['Alpha One', 'alpha-one'],
    ['  Hello, World! ', 'hello-world'],
    ['Привет Мир', 'privet-mir'],
    ['ёжик', 'yozhik'],
    ['Item 42', 'item-42'],
    ['---trim---', 'trim'],
    ['', ''],
  ])('slugify(%j) === %j', (input, expected) => {
    expect(ctrl.slugify(input)).toBe(expected)
  })

  it('обрезает до 100 символов', () => {
    expect(ctrl.slugify('a'.repeat(250)).length).toBe(100)
  })
})

describe('CollectionController — getNestedValue (pure)', () => {
  it('возвращает значение по вложенному пути', () => {
    expect(ctrl.getNestedValue({ a: { b: { c: 5 } } }, 'a.b.c')).toBe(5)
  })
  it('undefined для отсутствующего пути', () => {
    expect(ctrl.getNestedValue({ a: 1 }, 'a.b.c')).toBeUndefined()
  })
  it('undefined для null obj / пустого пути', () => {
    expect(ctrl.getNestedValue(null, 'a')).toBeUndefined()
    expect(ctrl.getNestedValue({ a: 1 }, '')).toBeUndefined()
  })
})

describe('CollectionController.getItems — генерация страниц', () => {
  const mockNext = jest.fn() as unknown as NextFunction
  let req: Partial<Request>
  let res: Partial<Response>
  let jsonMock: jest.Mock

  const baseCollection = (overrides: any[] = []) => ({
    id: 'c1',
    basePath: '/projects/',
    slugField: 'slug',
    titleField: 'name',
    useCache: true,
    cachedApiData: null,
    overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockCollectionRepo.save.mockResolvedValue(undefined)
    jsonMock = jest.fn()
    req = { params: { id: 'c1' }, body: {}, query: {} }
    res = { json: jsonMock, status: jest.fn().mockReturnThis() as any }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const runGetItems = async (collection: any, items: any[]) => {
    mockCollectionRepo.findOne.mockResolvedValue(collection)
    jest.spyOn(ctrl, 'fetchCollectionItems').mockResolvedValue(items)
    ctrl.getItems(req as Request, res as Response, mockNext)
    await flushPromises()
    return jsonMock.mock.calls[0]?.[0]
  }

  it('вычисляет slug из slugField, нормализует basePath (без хвостового /)', async () => {
    const out = await runGetItems(baseCollection(), [
      { id: 1, name: 'Alpha One', slug: 'Alpha One' },
    ])
    expect(out.total).toBe(1)
    expect(out.items[0]).toMatchObject({
      apiItemId: '1',
      slug: 'alpha-one',
      title: 'Alpha One',
      generatedUrl: '/projects/alpha-one',
      mode: 'template',
    })
  })

  it('fallback slug из titleField и из _id когда slug/title пусты', async () => {
    const out = await runGetItems(baseCollection(), [
      { id: 2, name: 'Бета' }, // нет slug → из name
      { _id: '9' }, // нет slug и name → из id
    ])
    expect(out.items[0]).toMatchObject({ apiItemId: '2', slug: 'beta', generatedUrl: '/projects/beta' })
    expect(out.items[1]).toMatchObject({ apiItemId: '9', slug: '9' })
  })

  it('override по apiItemId → mode custom + данные кастомной страницы', async () => {
    const out = await runGetItems(
      baseCollection([
        { id: 'o1', apiItemId: '1', customPageId: 'p1', customPage: { name: 'Custom A' } },
      ]),
      [{ id: 1, name: 'Alpha', slug: 'alpha' }]
    )
    expect(out.items[0]).toMatchObject({
      mode: 'custom',
      customPageId: 'p1',
      customPageName: 'Custom A',
      overrideId: 'o1',
    })
  })

  it('override fallback по slug когда apiItemId не совпал', async () => {
    const out = await runGetItems(
      baseCollection([{ id: 'o2', apiItemSlug: 'beta', customPageId: 'p2' }]),
      [{ id: 99, name: 'Бета' }] // slug → 'beta', apiItemId '99' не в overrides по id
    )
    expect(out.items[0]).toMatchObject({ mode: 'custom', customPageId: 'p2', overrideId: 'o2' })
  })

  it('кастомный slug из override нормализуется и даёт warning при расхождении', async () => {
    const out = await runGetItems(
      baseCollection([
        { id: 'o3', apiItemId: '1', apiItemSlug: 'Custom Slug!', customPageId: 'p3' },
      ]),
      [{ id: 1, name: 'Alpha', slug: 'alpha' }]
    )
    expect(out.items[0].slug).toBe('custom-slug')
    expect(out.items[0].generatedUrl).toBe('/projects/custom-slug')
    expect(out.warnings.some((w: string) => w.includes('Custom Slug!'))).toBe(true)
  })

  it('нормализует basePath с несколькими хвостовыми слешами', async () => {
    const out = await runGetItems(
      { ...baseCollection(), basePath: '/projects///' },
      [{ id: 1, name: 'X', slug: 'x' }]
    )
    expect(out.items[0].generatedUrl).toBe('/projects/x')
  })

  it('fallback на кеш при ошибке API + warning + fromCache', async () => {
    const collection = {
      ...baseCollection(),
      useCache: true,
      cachedApiData: [{ id: 7, name: 'Cached', slug: 'cached' }],
    }
    mockCollectionRepo.findOne.mockResolvedValue(collection)
    jest.spyOn(ctrl, 'fetchCollectionItems').mockRejectedValue(new Error('boom'))

    ctrl.getItems(req as Request, res as Response, mockNext)
    await flushPromises()

    const out = jsonMock.mock.calls[0][0]
    expect(out.items[0]).toMatchObject({ apiItemId: '7', slug: 'cached' })
    expect(out.fromCache).toBe(true)
    expect(out.warnings.some((w: string) => w.includes('API error: boom'))).toBe(true)
  })

  it('404 (next) для несуществующей коллекции', async () => {
    mockCollectionRepo.findOne.mockResolvedValue(null)
    ctrl.getItems(req as Request, res as Response, mockNext)
    await flushPromises()
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }))
  })
})
