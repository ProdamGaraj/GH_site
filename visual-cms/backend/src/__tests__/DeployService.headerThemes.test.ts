/**
 * Публикация: фото-слайды каруселей получают тему шапки по яркости верха
 * картинки (MediaAsset.topBrightness). Файл — по uuid хранилища из адреса
 * фона (у оригинала и производных он общий), без фона — по mediaAssetId. Один
 * вход для всех путей деплоя и превью — prepareForPublish.
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

const DARK = '11111111-1111-4111-8111-111111111111'
const LIGHT = '22222222-2222-4222-8222-222222222222'

const photo = (id: string, file: string) => ({
  id,
  attributes: { 'data-carousel-slide': 'true' },
  metadata: { mediaAssetId: 'stale-record' },
  styles: { properties: { backgroundImage: `url("/media/${file}.opt.webp")` } },
  children: [],
})

const slider = () => ({
  id: 'root',
  children: [
    {
      id: 'track',
      attributes: { 'data-carousel-track': 'true' },
      children: [
        photo('dark-photo', DARK),
        photo('light-photo', LIGHT),
        { id: 'no-bg', attributes: { 'data-carousel-slide': 'true' }, metadata: { mediaAssetId: 'm-plain' }, children: [] },
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
  it('фото — по файлу из адреса фона; без фона — по записи; видео — без метки', async () => {
    mediaRepo().find
      .mockResolvedValueOnce([
        { id: 'a1', storageKey: `${DARK}.png`, topBrightness: 35 },
        { id: 'a2', storageKey: `${LIGHT}.jpg`, topBrightness: 210 },
      ])
      .mockResolvedValueOnce([{ id: 'm-plain', storageKey: 'x.png', topBrightness: 40 }])
    const out = await svc.prepareForPublish({ id: 'p1' }, slider(), 'ru')
    expect(themes(out)).toEqual(['dark', 'light', 'dark', null])
    // Файлы — по uuid хранилища (любой производный), запись — по id.
    const [byFile, byId] = mediaRepo().find.mock.calls.map((c: any[]) => c[0].where)
    expect(byFile.map((w: any) => w.storageKey._value)).toEqual([`${DARK}.%`, `${LIGHT}.%`])
    expect(byId.id._value).toEqual(['m-plain'])
  })

  it('у файла нет яркости (не прогнан бэкфилл) — слайд без метки', async () => {
    mediaRepo().find.mockResolvedValue([{ id: 'a1', storageKey: `${DARK}.png`, topBrightness: null }])
    const out = await svc.prepareForPublish({ id: 'p1' }, slider(), 'ru')
    expect(themes(out)).toEqual([null, null, null, null])
  })

  it('страница без каруселей — без запроса в базу', async () => {
    const plain = { id: 'root', children: [{ id: 'h1', tagName: 'h1', content: 'Привет', children: [] }] }
    const out = await svc.prepareForPublish({ id: 'p1' }, plain, 'ru')
    expect(out).toBe(plain)
    expect(mediaRepo().find).not.toHaveBeenCalled()
  })
})
