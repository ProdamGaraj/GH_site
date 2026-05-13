/**
 * Тесты для DataBindingController.resolvePageVariable.
 * Метод приватный, дёргаем через `as any`.
 *
 * Резолвит data-source типа 'page-variable' напрямую из page.variables
 * (без round-trip к внешнему API), используется в редакторе/preview.
 */

// Мокаем БД и зависимые сервисы ДО импорта контроллера
jest.mock('../config/database', () => {
  const cache = new Map<unknown, any>()
  return {
    AppDataSource: {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (!cache.has(entity)) {
          cache.set(entity, {
            findOne: jest.fn(),
            update: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          })
        }
        return cache.get(entity)
      }),
    },
  }
})

jest.mock('../services/CachedDataSourceService', () => ({
  cachedDataSourceService: { fetchData: jest.fn() },
}))
jest.mock('../services/SecureDataSourceService', () => ({
  secureDataSourceService: { fetchData: jest.fn() },
}))
jest.mock('../services/DataFilterService', () => ({
  dataFilterService: { applyFilters: jest.fn() },
}))
jest.mock('../services/DataTransformService', () => ({
  dataTransformService: { processWithTransforms: jest.fn() },
}))
jest.mock('../services/CredentialsManager', () => ({
  CredentialsManager: { decryptAuthConfig: jest.fn() },
}))

import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'
// Импортируем после моков
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { dataBindingController } = require('../controllers/DataBindingController')

describe('DataBindingController.resolvePageVariable', () => {
  const ctrl: any = dataBindingController
  const pageRepository = AppDataSource.getRepository(Page) as any

  beforeEach(() => {
    pageRepository.findOne.mockReset()
  })

  const makeBinding = (variableName: string | null, pageId: string | null) => ({
    id: 'binding-1',
    pageId,
    dataSource: {
      id: 'ds-1',
      type: 'page-variable',
      config: variableName ? { variableName } : {},
    },
  })

  it('возвращает массив defaultValue из page.variables по имени', async () => {
    pageRepository.findOne.mockResolvedValue({
      id: 'page-1',
      variables: {
        variables: [
          { name: 'heroSlides', defaultValue: [{ id: 'a' }, { id: 'b' }] },
          { name: 'other', defaultValue: 'x' },
        ],
      },
    })
    const result = await ctrl.resolvePageVariable(makeBinding('heroSlides', 'page-1'))
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.metadata.headers['x-data-source-type']).toBe('page-variable')
  })

  it('возвращает пустой массив если page не найден', async () => {
    pageRepository.findOne.mockResolvedValue(null)
    const result = await ctrl.resolvePageVariable(makeBinding('heroSlides', 'page-1'))
    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })

  it('возвращает пустой массив если переменной с таким именем нет', async () => {
    pageRepository.findOne.mockResolvedValue({
      variables: { variables: [{ name: 'other', defaultValue: [1, 2, 3] }] },
    })
    const result = await ctrl.resolvePageVariable(makeBinding('heroSlides', 'page-1'))
    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })

  it('возвращает пустой массив если pageId отсутствует', async () => {
    const result = await ctrl.resolvePageVariable(makeBinding('heroSlides', null))
    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
    expect(pageRepository.findOne).not.toHaveBeenCalled()
  })

  it('возвращает пустой массив если variableName отсутствует в config', async () => {
    const result = await ctrl.resolvePageVariable(makeBinding(null, 'page-1'))
    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
    expect(pageRepository.findOne).not.toHaveBeenCalled()
  })

  it('передаёт defaultValue как есть (если оно объект, не массив)', async () => {
    pageRepository.findOne.mockResolvedValue({
      variables: {
        variables: [{ name: 'siteConfig', defaultValue: { theme: 'dark', count: 7 } }],
      },
    })
    const result = await ctrl.resolvePageVariable(makeBinding('siteConfig', 'page-1'))
    expect(result.data).toEqual({ theme: 'dark', count: 7 })
  })
})
