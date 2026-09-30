/**
 * Публикация: фото-слайды каруселей получают тему шапки по яркости верха
 * картинки (MediaAsset.topBrightness). Один вход для всех путей деплоя и
 * превью — prepareForPublish (данные страницы + темы слайдов).
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
          cache.set(entity, { findOne: jest.fn(), find: jest.fn(async () => []), save: jest.fn(), update: jest.fn() })
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
const { AppDataSource } = require('../config/database')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MediaAsset } = require('../models/MediaAsset')

const svc: any = new DeployService()
const mediaRepo = () => AppDataSource.getRepository(MediaAsset)

const slider = () => ({
  id: 'root',
  children: [
    {
      id: 'track',
      attributes: { 'data-carousel-track': 'true' },
      children: [
        { id: 'dark-photo', attributes: { 'data-carousel-slide': 'true' }, metadata: { mediaAssetId: 'm-dark' }, children: [] },
        { id: 'light-photo', attributes: { 'data-carousel-slide': 'true' }, metadata: { mediaAssetId: 'm-light' }, children: [] },
        {
          id: 'video',
          attributes: { 'data-carousel-slide': 'true', 'data-slide-video': '/media/v.mp4' },
          metadata: { mediaAssetId: 'm-video' },
          children: [],
        },
      ],
    },
  ],
})

const themes = (structure: any) =>
  structure.children[0].children.map((s: any) => s.attributes['data-header-theme'] ?? null)

beforeEach(() => mediaRepo().find.mockReset())

describe('DeployService.prepareForPublish — тема шапки над фото-слайдами', () => {
  it('фото-слайды — по яркости из медиатеки, видео — без метки (его кадры оценит браузер)', async () => {
    mediaRepo().find.mockResolvedValue([
      { id: 'm-dark', topBrightness: 35 },
      { id: 'm-light', topBrightness: 210 },
    ])
    const out = await svc.prepareForPublish({ id: 'p1' }, slider(), 'ru')
    expect(themes(out)).toEqual(['dark', 'light', null])
    // Спрашиваем только фото-слайды, одним запросом.
    expect(mediaRepo().find).toHaveBeenCalledTimes(1)
    expect(mediaRepo().find.mock.calls[0][0].where.id._value.sort()).toEqual(['m-dark', 'm-light'])
  })

  it('у файла нет яркости (не прогнан бэкфилл) — слайд без метки', async () => {
    mediaRepo().find.mockResolvedValue([{ id: 'm-dark', topBrightness: null }])
    const out = await svc.prepareForPublish({ id: 'p1' }, slider(), 'ru')
    expect(themes(out)).toEqual([null, null, null])
  })

  it('страница без каруселей — без запроса в базу', async () => {
    const plain = { id: 'root', children: [{ id: 'h1', tagName: 'h1', content: 'Привет', children: [] }] }
    const out = await svc.prepareForPublish({ id: 'p1' }, plain, 'ru')
    expect(out).toBe(plain)
    expect(mediaRepo().find).not.toHaveBeenCalled()
  })
})
