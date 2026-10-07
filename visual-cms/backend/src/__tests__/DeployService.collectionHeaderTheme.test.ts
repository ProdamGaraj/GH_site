/**
 * Тема шапки над фото-слайдами на страницах коллекции.
 *
 * У страниц коллекции фото слайдов приходят из данных элемента ({{$.image}}),
 * поэтому тема по яркости фото ставится ПОСЛЕ подстановки. Раньше коллекции
 * этот шаг пропускали: фото-слайды проектов уходили на сайт без темы.
 */
const UUID = '11111111-2222-4333-8444-555555555555'

jest.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(), find: jest.fn(async () => []), save: jest.fn(), findByIds: jest.fn(),
    }),
  },
}))
jest.mock('../services/mediaAssetLookup', () => ({
  ...jest.requireActual('../services/mediaAssetLookup'),
  findAssetsByStorageUuids: jest.fn(async (uuids: string[]) =>
    uuids.includes('11111111-2222-4333-8444-555555555555')
      ? [{ id: 'asset-1', storageKey: '11111111-2222-4333-8444-555555555555.jpg', topBrightness: 220 }]
      : []
  ),
}))

import { deployService } from '../services/DeployService'

const svc = deployService as any

const template = {
  id: 'root',
  tagName: 'div',
  children: [
    {
      id: 'track',
      tagName: 'div',
      attributes: { 'data-carousel-track': 'true' },
      _repeat: { source: 'item.slides' },
      children: [
        {
          id: 'slide',
          tagName: 'div',
          attributes: { 'data-carousel-slide': 'true', 'data-slide-video': '{{$.video}}' },
          styles: { properties: { backgroundImage: 'url("{{$.image}}")' } },
          children: [],
        },
      ],
    },
  ],
}

async function render(item: Record<string, unknown>): Promise<any[]> {
  let captured: any = null
  const spy = jest.spyOn(svc, 'generatePageHtml').mockImplementation(async (structure: any) => {
    captured = structure
    return '<html></html>'
  })
  try {
    await svc.renderCollectionTemplateItem({
      collection: { id: 'c', basePath: '/complex', additionalSources: [] },
      item,
      itemId: '1',
      itemTitle: 'Проект',
      itemSlug: 'project',
      templatePageId: 'tpl',
      templateStructure: template,
      metaTitleTpl: '',
      metaDescTpl: '',
      metaKeywords: [],
      resolvedNav: [],
      mainExtractedValues: {},
      statsByItemId: {},
      errors: [],
    })
  } finally {
    spy.mockRestore()
  }
  return captured.children[0].children
}

describe('коллекция: тема шапки над фото-слайдами из данных', () => {
  it('светлое фото из медиатеки — слайд получает data-header-theme="light"', async () => {
    const [slide] = await render({ slides: [{ image: `/media/${UUID}.opt.webp`, video: '' }] })
    expect(slide.attributes['data-header-theme']).toBe('light')
  })

  it('видео-слайд не размечается — его кадры оценивает рантайм карусели', async () => {
    const [slide] = await render({ slides: [{ image: `/media/${UUID}.jpg`, video: '/media/v.mp4' }] })
    expect(slide.attributes['data-header-theme']).toBeUndefined()
  })

  it('фото не из медиатеки — без метки (шапка решит сама)', async () => {
    const [slide] = await render({ slides: [{ image: 'https://cdn.example/x.jpg', video: '' }] })
    expect(slide.attributes['data-header-theme']).toBeUndefined()
  })
})
