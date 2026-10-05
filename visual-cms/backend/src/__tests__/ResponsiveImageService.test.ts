/**
 * Регрессия: uuid в адресе `/media/<uuid>.png` — uuid хранилища, а не id
 * записи MediaAsset. Сервис искал по id, ничего не находил, и сайт грузил
 * оригиналы. Здесь у записи id намеренно другой.
 */
const find = jest.fn()
jest.mock('../config/database', () => ({
  AppDataSource: { getRepository: jest.fn(() => ({ find })) },
}))
jest.mock('../services/Logger', () => ({ logger: { warn: jest.fn() } }))

import { Like } from 'typeorm'
import { responsiveImageService } from '../services/ResponsiveImageService'

const STORAGE = '58f397f3-bca6-42ec-8465-0d89e40f4c03'
const RECORD_ID = 'b650a5f9-2000-42da-9957-fb07f4587053'

const ASSET = {
  id: RECORD_ID,
  storageKey: `${STORAGE}.png`,
  optimizedStorageKey: `${STORAGE}.opt.webp`,
  width: 3840,
  variants: [{ width: 1280, height: 720, storageKey: `${STORAGE}.w1280.webp`, sizeBytes: 1 }],
}

beforeEach(() => find.mockReset())

it('ищет файлы по uuid хранилища и облегчает и <img>, и CSS-фон', async () => {
  find.mockResolvedValue([ASSET])
  const html = `<section style="background-image: url(&quot;/media/${STORAGE}.png&quot;)"><img src="/media/${STORAGE}.png"></section>`
  const out = await responsiveImageService.enrich(html)

  expect(find).toHaveBeenCalledTimes(1)
  expect(find.mock.calls[0][0].where).toEqual([{ storageKey: Like(`${STORAGE}.%`) }])
  expect(out).toContain(`url(&quot;/media/${STORAGE}.opt.webp&quot;)`)
  expect(out).toContain(`src="/media/${STORAGE}.opt.webp"`)
  expect(out).toContain(`srcset="/media/${STORAGE}.opt.webp 3840w, /media/${STORAGE}.w1280.webp 1280w"`)
})

it('без ссылок на медиатеку база не запрашивается', async () => {
  const html = '<p>текст</p>'
  expect(await responsiveImageService.enrich(html)).toBe(html)
  expect(find).not.toHaveBeenCalled()
})

it('файла нет в медиатеке — html как был', async () => {
  find.mockResolvedValue([])
  const html = `<img src="/media/${STORAGE}.png">`
  expect(await responsiveImageService.enrich(html)).toBe(html)
})

it('ошибка базы не роняет деплой — html как был', async () => {
  find.mockRejectedValue(new Error('db down'))
  const html = `<img src="/media/${STORAGE}.png">`
  expect(await responsiveImageService.enrich(html)).toBe(html)
})
