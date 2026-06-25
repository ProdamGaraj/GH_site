/**
 * Тесты превью DeployService.renderPagePreview / renderBlockPreview.
 *
 * Главный инвариант (то, ради чего вводился бэкенд-эндпоинт превью): превью
 * рендерится ТЕМ ЖЕ каноническим генератором, что и деплой. Поэтому в выводе
 * обязаны присутствовать прод-маркеры, которых не было в старом упрощённом
 * фронтовом рендере: шрифт Muller (@font-face), carousel runtime, reset.
 *
 * Дополнительно проверяем:
 *  - инъекцию <base href> (паритет ассетов /fonts,/images с продом) и нормализацию;
 *  - что без origin <base> не инжектится;
 *  - путь с pageId подключает навигацию сайта (nav runtime);
 *  - схема валидации не разрушает глубокое дерево structure (z.any).
 *
 * Приватные методы дёргаем через `as any` (как в DeployService.*.test.ts).
 */

// Мокаем БД ДО импорта сервиса — конструктор берёт репозитории через getRepository.
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

// enrich -> identity: изолируем тест от media-вариантов и БД.
jest.mock('../services/ResponsiveImageService', () => ({
  responsiveImageService: { enrich: jest.fn(async (html: string) => html) },
}))

// linked-блоки -> identity (для pageId-пути).
jest.mock('../services/LinkedBlocksService', () => ({
  linkedBlocksService: { updateLinkedBlocks: jest.fn(async (s: any) => s) },
}))

jest.mock('../services/LanguageService', () => ({
  languageService: { getActive: jest.fn(async () => []) },
}))

jest.mock('../services/TranslationService', () => ({
  translationService: { getPageLocales: jest.fn(async () => []) },
}))

// Импортируем после моков
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DeployService } = require('../services/DeployService')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { renderPagePreviewSchema } = require('../schemas/preview.schema')

function node(partial: Record<string, any> = {}): any {
  return {
    id: partial.id ?? 'root',
    elementType: partial.elementType ?? 'container',
    tagName: partial.tagName ?? 'div',
    styles: partial.styles ?? { properties: {} },
    children: partial.children ?? [],
    attributes: partial.attributes ?? {},
    content: partial.content,
    metadata: partial.metadata ?? {},
  }
}

describe('DeployService — превью (паритет с продом)', () => {
  const ORIG_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...ORIG_ENV }
    delete process.env.PREVIEW_ASSET_ORIGIN
    delete process.env.PUBLIC_SITE_URL
  })

  describe('renderPagePreview без pageId (черновик)', () => {
    it('рендерит канонический документ: шрифт Muller, carousel runtime, reset', async () => {
      const svc: any = new DeployService()
      const html = await svc.renderPagePreview({ structure: node() })

      expect(html).toContain("font-family: 'Muller'")
      expect(html).toContain('@font-face')
      expect(html).toContain('data-carousel-track') // carousel runtime присутствует
      expect(html).toContain('box-sizing: border-box') // reset
      expect(html).toContain('<!DOCTYPE html>')
    })

    it('инжектит <base href> на origin из PREVIEW_ASSET_ORIGIN', async () => {
      process.env.PREVIEW_ASSET_ORIGIN = 'https://site.example'
      const svc: any = new DeployService()
      const html = await svc.renderPagePreview({ structure: node() })
      expect(html).toContain('<base href="https://site.example/">')
    })

    it('не инжектит <base>, если origin не задан', async () => {
      const svc: any = new DeployService()
      const html = await svc.renderPagePreview({ structure: node() })
      expect(html).not.toContain('<base href')
    })
  })

  describe('renderBlockPreview', () => {
    it('рендерит блок как автономный документ тем же генератором (шрифт + carousel)', async () => {
      const svc: any = new DeployService()
      const html = await svc.renderBlockPreview({ structure: node({ tagName: 'section' }) })
      expect(html).toContain("font-family: 'Muller'")
      expect(html).toContain('data-carousel-track')
    })
  })

  describe('renderPagePreview с pageId', () => {
    it('подключает навигацию сайта (nav runtime) и канонический генератор', async () => {
      const svc: any = new DeployService()
      svc.pageRepository.findOne = jest.fn(async () => ({
        id: 'p1',
        name: 'About',
        slug: 'about',
        siteId: 's1',
        metadata: { title: 'About', description: '', keywords: [] },
        additionalSources: [],
        site: {
          id: 's1',
          slug: 's1',
          settings: { navigation: [{ label: 'Home', pageId: 'home1' }] },
          homepageId: 'home1',
        },
      }))
      svc.pageRepository.find = jest.fn(async () => [{ id: 'home1', slug: 'index' }])
      svc.collectionRepository.find = jest.fn(async () => [])
      // приватные методы, которые ходят в БД — изолируем
      svc.injectLibraryTemplates = jest.fn(async (s: any) => s)
      svc.preparePageDataConfig = jest.fn(async () => undefined)

      const html = await svc.renderPagePreview({ structure: node(), pageId: 'p1' })

      expect(svc.injectLibraryTemplates).toHaveBeenCalled()
      expect(svc.preparePageDataConfig).toHaveBeenCalledWith('p1', expect.anything())
      expect(html).toContain('window.__siteNav') // nav runtime
      expect(html).toContain("font-family: 'Muller'") // канонический генератор
    })
  })

  describe('injectPreviewBaseHref / resolvePreviewAssetBase', () => {
    it('нормализует завершающий слэш и вставляет <base> после <head>', () => {
      const svc: any = new DeployService()
      expect(svc.injectPreviewBaseHref('<head>x</head>', 'https://a/')).toContain('<base href="https://a/">')
      expect(svc.injectPreviewBaseHref('<head>x</head>', 'https://a')).toContain('<base href="https://a/">')
    })

    it('пустой origin -> HTML без изменений', () => {
      const svc: any = new DeployService()
      expect(svc.injectPreviewBaseHref('<head>x', '')).toBe('<head>x')
    })

    it('PREVIEW_ASSET_ORIGIN важнее PUBLIC_SITE_URL', () => {
      process.env.PREVIEW_ASSET_ORIGIN = 'https://preview.host'
      process.env.PUBLIC_SITE_URL = 'https://public.host'
      const svc: any = new DeployService()
      expect(svc.resolvePreviewAssetBase(null)).toBe('https://preview.host')
    })
  })

  describe('схема валидации preview', () => {
    it('сохраняет неизвестные вложенные поля structure (z.any)', () => {
      const deep = { id: 'r', children: [{ id: 'c', custom: 'keep' }] }
      const res = renderPagePreviewSchema.safeParse({ structure: deep })
      expect(res.success).toBe(true)
      expect(res.data.structure.children[0].custom).toBe('keep')
    })

    it('отклоняет отсутствующую/нестроковую structure', () => {
      expect(renderPagePreviewSchema.safeParse({}).success).toBe(false)
      expect(renderPagePreviewSchema.safeParse({ structure: 'x' }).success).toBe(false)
    })
  })
})
