/**
 * Пересоздание адаптивных размеров уже загруженной картинки
 * (MediaService.regenerateVariants + scripts/regenerate-media-variants.ts).
 * sharp настоящий, хранилище и база — заглушки.
 */
import sharp from 'sharp'

const stored = new Map<string, Buffer>()
const deleted: string[] = []
const updates: Array<{ id: string; patch: any }> = []
let assetsInDb: any[] = []

jest.mock('../services/MinioStorageService', () => ({
  minioStorageService: {
    putObject: jest.fn(async (key: string, body: Buffer) => {
      stored.set(key, body)
    }),
    getObject: jest.fn(async (key: string) => {
      const body = stored.get(key)
      if (!body) throw new Error(`NoSuchKey ${key}`)
      return body
    }),
    deleteObject: jest.fn(async (key: string) => {
      deleted.push(key)
      stored.delete(key)
    }),
    publicUrl: (key: string) => `/media/${key}`,
  },
}))

jest.mock('../config/database', () => ({
  AppDataSource: {
    initialize: jest.fn(),
    getRepository: () => ({
      update: jest.fn(async (id: string, patch: any) => {
        updates.push({ id, patch })
      }),
      find: jest.fn(async () => assetsInDb),
    }),
  },
}))

jest.mock('../services/MediaFolderService', () => ({ mediaFolderService: {} }))

import { mediaService } from '../services/MediaService'
import { minioStorageService } from '../services/MinioStorageService'
import { planVariantChanges } from '../services/mediaVariants'
import { knownWidths, regenerateMediaVariants } from '../scripts/regenerate-media-variants'

const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const PROJECT_WIDTHS = [3840, 2560, 1920, 1728, 1600, 1512, 1440, 1366, 1280, 1024, 768, 430, 375]

async function picture(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .jpeg()
    .toBuffer()
}

const variant = (w: number) => ({ width: w, height: Math.round(w / 2), storageKey: `${UUID}.w${w}.webp`, sizeBytes: 10 })

function asset(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'asset-1',
    kind: 'image',
    mimeType: 'image/jpeg',
    fileName: 'photo.jpg',
    storageKey: `${UUID}.jpg`,
    width: 2000,
    height: 1000,
    variants: null,
    ...overrides,
  }
}

beforeEach(async () => {
  stored.clear()
  deleted.length = 0
  updates.length = 0
  assetsInDb = []
  jest.clearAllMocks()
  stored.set(`${UUID}.jpg`, await picture(2000, 1000))
})

describe('planVariantChanges', () => {
  it('создаёт недостающие; лишние остаются, пока не просили чистить', () => {
    expect(planVariantChanges([1920, 1728, 1600], [1920, 768, 375])).toEqual({ create: [768, 375], remove: [] })
  })

  it('prune — лишние на удаление', () => {
    expect(planVariantChanges([1920, 1728, 1600], [1920, 768, 375], { prune: true })).toEqual({
      create: [768, 375],
      remove: [1728, 1600],
    })
  })

  it('совпадает с планом — делать нечего', () => {
    expect(planVariantChanges([768, 375], [768, 375], { prune: true })).toEqual({ create: [], remove: [] })
  })
})

describe('MediaService.regenerateVariants', () => {
  // Старое правило: шесть самых широких — телефонных размеров нет.
  const OLD = [1920, 1728, 1600, 1512, 1440, 1366]

  it('создаёт недостающие размеры из оригинала и записывает их рядом со старыми', async () => {
    const a = asset({ variants: OLD.map(variant) })
    const changes = await mediaService.regenerateVariants(a, PROJECT_WIDTHS)

    expect(changes.remove).toEqual([])
    expect(changes.create).toContain(375)
    expect(changes.create.every((w) => !OLD.includes(w))).toBe(true)

    // Файлы настоящие: webp нужной ширины.
    for (const w of changes.create) {
      const meta = await sharp(stored.get(`${UUID}.w${w}.webp`)!).metadata()
      expect(meta.format).toBe('webp')
      expect(meta.width).toBe(w)
    }

    expect(updates).toHaveLength(1)
    const saved = updates[0].patch.variants as Array<{ width: number; height: number; sizeBytes: number }>
    expect(saved.map((v) => v.width)).toEqual([...OLD, ...changes.create].sort((x, y) => y - x))
    const phone = saved.find((v) => v.width === 375)!
    expect(phone.height).toBe(188)
    expect(phone.sizeBytes).toBeGreaterThan(0)
    expect(deleted).toEqual([])
  })

  it('prune: лишние размеры убираются из записи и из хранилища', async () => {
    const a = asset({ variants: OLD.map(variant) })
    const changes = await mediaService.regenerateVariants(a, PROJECT_WIDTHS, { prune: true })

    expect(changes.remove.length).toBeGreaterThan(0)
    expect(deleted.sort()).toEqual(changes.remove.map((w) => `${UUID}.w${w}.webp`).sort())
    const saved = (updates[0].patch.variants as Array<{ width: number }>).map((v) => v.width)
    expect(saved).toHaveLength(6)
    expect(saved[0]).toBe(1920)
    expect(saved[saved.length - 1]).toBe(375)
  })

  it('dryRun: считает, но ничего не пишет и оригинал не скачивает', async () => {
    const changes = await mediaService.regenerateVariants(asset({ variants: OLD.map(variant) }), PROJECT_WIDTHS, {
      prune: true,
      dryRun: true,
    })
    expect(changes.create.length).toBeGreaterThan(0)
    expect(changes.remove.length).toBeGreaterThan(0)
    expect(updates).toEqual([])
    expect(deleted).toEqual([])
    expect(minioStorageService.getObject).not.toHaveBeenCalled()
    expect(minioStorageService.putObject).not.toHaveBeenCalled()
  })

  it('размеры уже по плану — ничего не делает', async () => {
    const first = asset()
    await mediaService.regenerateVariants(first, PROJECT_WIDTHS)
    const current = updates[0].patch.variants
    updates.length = 0
    jest.clearAllMocks()

    const changes = await mediaService.regenerateVariants(asset({ variants: current }), PROJECT_WIDTHS, { prune: true })
    expect(changes).toEqual({ create: [], remove: [] })
    expect(updates).toEqual([])
    expect(minioStorageService.putObject).not.toHaveBeenCalled()
  })

  it('ширина в записи пустая — берётся из оригинала; размеры не шире него', async () => {
    const changes = await mediaService.regenerateVariants(asset({ width: null, height: null }), PROJECT_WIDTHS)
    expect(Math.max(...changes.create)).toBe(1920)
    const saved = updates[0].patch.variants as Array<{ width: number; height: number }>
    expect(saved.find((v) => v.width === 1920)!.height).toBe(960)
  })

  it('картинка уже всех ширин — размеров нет, запись не трогается', async () => {
    const changes = await mediaService.regenerateVariants(asset({ width: 300, height: 150 }), PROJECT_WIDTHS)
    expect(changes).toEqual({ create: [], remove: [] })
    expect(updates).toEqual([])
  })

  it.each([
    ['SVG', { mimeType: 'image/svg+xml' }],
    ['GIF', { mimeType: 'image/gif' }],
    ['видео', { kind: 'video', mimeType: 'video/mp4' }],
  ])('%s не обрабатывается', async (_name, overrides) => {
    const changes = await mediaService.regenerateVariants(asset(overrides), PROJECT_WIDTHS, { prune: true })
    expect(changes).toEqual({ create: [], remove: [] })
    expect(minioStorageService.getObject).not.toHaveBeenCalled()
  })

  it('файл не удалился из хранилища — запись всё равно обновлена, ошибка не летит', async () => {
    ;(minioStorageService.deleteObject as jest.Mock).mockRejectedValueOnce(new Error('storage down'))
    const changes = await mediaService.regenerateVariants(asset({ variants: OLD.map(variant) }), PROJECT_WIDTHS, { prune: true })
    expect(changes.remove.length).toBeGreaterThan(0)
    expect(updates).toHaveLength(1)
  })
})

describe('scripts/regenerate-media-variants', () => {
  const lines: string[] = []
  const log = (line: string) => lines.push(line)
  beforeEach(() => {
    lines.length = 0
  })

  it('knownWidths: все ширины, что уже есть в медиатеке, по убыванию', () => {
    expect(knownWidths([{ variants: [variant(768), variant(1920)] }, { variants: null }, { variants: [variant(768), variant(375)] }])).toEqual([1920, 768, 375])
  })

  it('без --apply только считает', async () => {
    assetsInDb = [asset({ variants: [1920, 1728, 1600, 1512, 1440, 1366].map(variant) })]
    const report = await regenerateMediaVariants({ initDb: false, widths: PROJECT_WIDTHS, log })
    expect(report).toMatchObject({ images: 1, changed: 1, removed: 0, failed: 0 })
    expect(report.created).toBeGreaterThan(0)
    expect(updates).toEqual([])
    expect(lines[lines.length - 1]).toContain('ничего не записано')
  })

  it('--apply создаёт; битый файл не останавливает остальные', async () => {
    const other = 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee'
    assetsInDb = [
      asset({ id: 'broken', fileName: 'gone.jpg', storageKey: `${other}.jpg` }), // оригинала в хранилище нет
      asset({ id: 'ok' }),
    ]
    const report = await regenerateMediaVariants({ initDb: false, apply: true, widths: PROJECT_WIDTHS, log })
    expect(report.failed).toBe(1)
    expect(report.changed).toBe(1)
    expect(updates.map((u) => u.id)).toEqual(['ok'])
    expect(lines.some((l) => l.includes('ОШИБКА gone.jpg'))).toBe(true)
  })

  it('ширины не заданы — берутся из медиатеки; пустая медиатека — ничего не делает', async () => {
    assetsInDb = [asset({ variants: [variant(768)] }), asset({ id: 'second', variants: [variant(375)] })]
    const report = await regenerateMediaVariants({ initDb: false, log })
    expect(lines[0]).toContain('768, 375')
    // У первой нет 375, у второй нет 768.
    expect(report.created).toBe(2)

    assetsInDb = []
    expect(await regenerateMediaVariants({ initDb: false, log })).toMatchObject({ images: 0, changed: 0 })
  })
})
