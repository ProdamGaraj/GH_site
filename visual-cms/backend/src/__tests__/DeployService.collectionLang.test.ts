/**
 * Мультиязычный деплой коллекций (часть A связки estate → Collection):
 *  - applyLangPlaceholder: подстановка {{lang}} в URL/queryParams источника
 *    (позволяет одному DataSource обслуживать все языки; no-op без плейсхолдера);
 *  - computeItemBase / ensureUniqueSlug: общие хелперы генерации slug, вынесенные
 *    из per-item цикла (DRY между дефолтной и языковыми версиями).
 *
 * Методы приватные — дёргаем через `as any`. БД мокаем (методы чистые).
 */
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeployService } = require('../services/DeployService')

const svc: any = new DeployService()

describe('DeployService.applyLangPlaceholder', () => {
  it('подставляет {{lang}} в URL', () => {
    const cfg: any = { url: 'http://estate-service:5100/api/complexes?full=1&lang={{lang}}' }
    svc.applyLangPlaceholder(cfg, 'uz')
    expect(cfg.url).toBe('http://estate-service:5100/api/complexes?full=1&lang=uz')
  })

  it('подставляет {{ lang }} с пробелами', () => {
    const cfg: any = { url: 'http://x/api?lang={{ lang }}' }
    svc.applyLangPlaceholder(cfg, 'en')
    expect(cfg.url).toBe('http://x/api?lang=en')
  })

  it('подставляет во все вхождения в URL', () => {
    const cfg: any = { url: 'http://x/{{lang}}/api?lang={{lang}}' }
    svc.applyLangPlaceholder(cfg, 'ru')
    expect(cfg.url).toBe('http://x/ru/api?lang=ru')
  })

  it('подставляет в значения queryParams (строки)', () => {
    const cfg: any = { url: 'http://x/api', queryParams: { lang: '{{lang}}', full: '1' } }
    svc.applyLangPlaceholder(cfg, 'uz')
    expect(cfg.queryParams).toEqual({ lang: 'uz', full: '1' })
  })

  it('no-op, если плейсхолдера нет (существующие источники не затрагиваются)', () => {
    const cfg: any = { url: 'http://x/api?full=1', queryParams: { a: 'b' } }
    svc.applyLangPlaceholder(cfg, 'uz')
    expect(cfg.url).toBe('http://x/api?full=1')
    expect(cfg.queryParams).toEqual({ a: 'b' })
  })
})

describe('DeployService.computeItemBase', () => {
  const collection: any = { name: 'Проекты', slugField: 'slug', titleField: 'name' }

  it('берёт id, title по titleField, slug по slugField', () => {
    const r = svc.computeItemBase(collection, { id: 'x1', slug: 'assalom-dostlik', name: 'Assalom' })
    expect(r).toEqual({ itemId: 'x1', itemTitle: 'Assalom', baseSlug: 'assalom-dostlik' })
  })

  it('нормализует slug через slugify (транслит/регистр)', () => {
    const r = svc.computeItemBase(collection, { id: '1', slug: 'Привет Мир', name: 'T' })
    expect(r.baseSlug).toBe('privet-mir')
  })

  it('fallback: _id как itemId, name коллекции как title, slug из title', () => {
    const r = svc.computeItemBase(collection, { _id: 'm2' })
    expect(r.itemId).toBe('m2')
    expect(r.itemTitle).toBe('Проекты')
    expect(r.baseSlug).toBe('proekty')
  })

  it('fallback slug на itemId, если нет ни slug, ни title', () => {
    const r = svc.computeItemBase({ name: '', slugField: 'slug', titleField: 'name' }, { id: 'abc' })
    expect(r.baseSlug).toBe('abc')
  })
})

describe('DeployService.ensureUniqueSlug', () => {
  it('возвращает slug как есть, если он свободен', () => {
    const used = new Set<string>()
    const errors: string[] = []
    expect(svc.ensureUniqueSlug('a', used, errors)).toBe('a')
    expect(used.has('a')).toBe(true)
    expect(errors).toHaveLength(0)
  })

  it('добавляет суффикс при конфликте и пишет предупреждение', () => {
    const used = new Set<string>(['a'])
    const errors: string[] = []
    expect(svc.ensureUniqueSlug('a', used, errors)).toBe('a-2')
    expect(svc.ensureUniqueSlug('a', used, errors)).toBe('a-3')
    expect(errors).toHaveLength(2)
  })
})
