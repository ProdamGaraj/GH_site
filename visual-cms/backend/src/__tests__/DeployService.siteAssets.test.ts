/**
 * Проводка ассетов уровня сайта: Site.settings.{globalCss,globalJs,customHeadHtml,
 * customBodyEndHtml} → опции generatePage. Это «оживление» ранее мёртвой
 * конфигурации сайта (раньше до деплоя не доходила).
 *
 * siteAssetOptions приватный — дёргаем через `as any`. БД мокаем (метод чистый,
 * к репозиториям не обращается → новых SQL нет, P4.4).
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

describe('DeployService.siteAssetOptions', () => {
  const svc: any = new DeployService()

  it('маппит globalCss/globalJs + custom head/body из settings', () => {
    const site = {
      settings: {
        globalCss: '.site{color:red}',
        globalJs: 'siteInit()',
        customHeadHtml: '<meta name="x">',
        customBodyEndHtml: '<!-- end -->',
      },
    }
    expect(svc.siteAssetOptions(site)).toEqual({
      siteCss: '.site{color:red}',
      siteJs: 'siteInit()',
      siteCustomHead: '<meta name="x">',
      siteCustomBodyEnd: '<!-- end -->',
    })
  })

  it('site = undefined → все поля undefined (нет пустых тегов)', () => {
    expect(svc.siteAssetOptions(undefined)).toEqual({
      siteCss: undefined,
      siteJs: undefined,
      siteCustomHead: undefined,
      siteCustomBodyEnd: undefined,
    })
  })

  it('пустые строки в settings → undefined', () => {
    const site = { settings: { globalCss: '', globalJs: '' } }
    expect(svc.siteAssetOptions(site)).toEqual({
      siteCss: undefined,
      siteJs: undefined,
      siteCustomHead: undefined,
      siteCustomBodyEnd: undefined,
    })
  })

  it('settings отсутствует → все поля undefined', () => {
    expect(svc.siteAssetOptions({})).toEqual({
      siteCss: undefined,
      siteJs: undefined,
      siteCustomHead: undefined,
      siteCustomBodyEnd: undefined,
    })
  })
})
