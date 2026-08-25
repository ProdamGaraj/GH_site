/**
 * Провижн связки estate-service → Collection (POST /api/collections/provision-estate).
 * Идемпотентно создаёт/находит DataSource(rest-api, {{lang}}) и Collection на
 * выбранные сайт+шаблон. Репозитории и кеш мокаются.
 */
import { Request, Response, NextFunction } from 'express'

const mockRepos: Record<string, any> = {
  Collection: {
    findOne: jest.fn(),
    save: jest.fn(async (e: any) => e),
    create: jest.fn((d: any) => ({ id: 'col-new', ...d })),
  },
  Site: { findOne: jest.fn() },
  Page: {
    findOne: jest.fn(),
    save: jest.fn(async (e: any) => e),
    find: jest.fn(async () => []),
  },
  DataSource: {
    findOne: jest.fn(),
    save: jest.fn(async (e: any) => e),
    create: jest.fn((d: any) => ({ id: 'ds-new', ...d })),
  },
}

jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: any) => mockRepos[entity?.name]),
  },
}))

jest.mock('../services/CacheService', () => ({
  cacheService: { invalidateByTag: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import collectionController from '../controllers/CollectionController'

const ctrl = collectionController as any

const makeRes = () => {
  const res: Partial<Response> = {}
  res.status = jest.fn().mockReturnValue(res) as any
  res.json = jest.fn().mockReturnValue(res) as any
  return res as Response
}

const baseBody = {
  siteId: 'site-1',
  templatePageId: 'page-1',
  basePath: '/complex',
  estateBaseUrl: 'http://estate-service:5100',
  name: 'Проекты (ЖК)',
  dataSourceName: 'Estate — Комплексы',
}

const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r))
}

describe('CollectionController.provisionEstate', () => {
  const next = jest.fn() as unknown as NextFunction

  beforeEach(() => {
    jest.clearAllMocks()
    mockRepos.Site.findOne.mockResolvedValue({ id: 'site-1' })
    mockRepos.Page.findOne.mockResolvedValue({ id: 'page-1', isTemplate: false })
    mockRepos.Page.find.mockResolvedValue([])
    mockRepos.Collection.create.mockImplementation((d: any) => ({ id: 'col-new', ...d }))
    mockRepos.DataSource.create.mockImplementation((d: any) => ({ id: 'ds-new', ...d }))
  })

  it('создаёт DataSource и Collection, если их нет (201)', async () => {
    mockRepos.DataSource.findOne.mockResolvedValue(null)
    mockRepos.Collection.findOne.mockResolvedValue(null)
    const res = makeRes()

    await ctrl.provisionEstate({ body: { ...baseBody } } as Request, res, next)
    await flush()

    // DataSource создан с {{lang}} + full=1
    const createdDs = mockRepos.DataSource.create.mock.calls[0][0]
    expect(createdDs.type).toBe('rest-api')
    expect(createdDs.config.url).toBe('http://estate-service:5100/api/complexes?full=1&lang={{lang}}')

    // Collection создан с раскладкой полей estate
    const createdCol = mockRepos.Collection.create.mock.calls[0][0]
    expect(createdCol).toMatchObject({
      siteId: 'site-1',
      dataSourceId: 'ds-new',
      templatePageId: 'page-1',
      arrayPath: 'items',
      slugField: 'slug',
      titleField: 'name',
      apiIdField: 'slug',
      basePath: '/complex',
    })

    // Страница помечена шаблоном
    expect(mockRepos.Page.save).toHaveBeenCalledWith(expect.objectContaining({ isTemplate: true }))

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSourceId: 'ds-new',
        collectionId: 'col-new',
        created: { dataSource: true, collection: true },
      })
    )
  })

  it('идемпотентно: не плодит дубли при повторном вызове (200)', async () => {
    mockRepos.DataSource.findOne.mockResolvedValue({
      id: 'ds-1',
      name: 'Estate — Комплексы',
      config: { url: 'http://estate-service:5100/api/complexes?full=1&lang={{lang}}', method: 'GET' },
    })
    mockRepos.Collection.findOne.mockResolvedValue({
      id: 'col-1',
      siteId: 'site-1',
      dataSourceId: 'ds-1',
      basePath: '/complex',
      templatePageId: 'old-page',
    })
    const res = makeRes()

    await ctrl.provisionEstate({ body: { ...baseBody } } as Request, res, next)
    await flush()

    expect(mockRepos.DataSource.create).not.toHaveBeenCalled()
    expect(mockRepos.Collection.create).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSourceId: 'ds-1',
        collectionId: 'col-1',
        created: { dataSource: false, collection: false },
      })
    )
    // templatePageId синхронизирован на переданный
    const savedCol = mockRepos.Collection.save.mock.calls[0][0]
    expect(savedCol.templatePageId).toBe('page-1')
  })

  it('ValidationError, если сайт не найден', async () => {
    mockRepos.Site.findOne.mockResolvedValue(null)
    mockRepos.DataSource.findOne.mockResolvedValue(null)
    mockRepos.Collection.findOne.mockResolvedValue(null)
    const res = makeRes()
    const localNext = jest.fn() as unknown as NextFunction

    await ctrl.provisionEstate({ body: { ...baseBody } } as Request, res, localNext)
    await flush()

    expect(localNext).toHaveBeenCalledWith(expect.objectContaining({ message: 'Site not found' }))
    expect(res.status).not.toHaveBeenCalled()
  })
})
