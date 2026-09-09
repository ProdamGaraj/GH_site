/**
 * Перенос планировок в медиатеку.
 *
 * Проверяется в первую очередь экономия: одна планировка типовая для десятков
 * квартир, и без дедупликации синк скачивал бы один и тот же чертёж сотни раз.
 * Второе — что сбой на одном файле не уносит остальные.
 */
import { PlanImageImporter, PLAN_TITLE_PREFIX, PLAN_TAG } from '../services/PlanImageImporter'
import type { MacroPlanFile } from '../services/MacroSellClient'

const URL_A =
  'https://macrocrm.gh.uz/estate/files/tmp/5139395/3707992/xjAwXYqCdzd_YSoimFKalQeyJlIjoxNzg5MTI4MDAwfQ/planirovka_k2.jpg'
/** Та же картинка после перевыпуска подписи. */
const URL_A_RESIGNED =
  'https://macrocrm.gh.uz/estate/files/tmp/5139395/3707992/ZZZZnewsignatureZZZZeyJlIjoxOTk5OTk5OTk5fQ/planirovka_k2.jpg'
const URL_B =
  'https://macrocrm.gh.uz/estate/files/tmp/5139395/3707987/QQQQQQQQQQQQQQQQQQQQeyJlIjoxNzg5MTI4MDAwfQ/planirovka_c_mebelyu.jpg'

function file(url: string, title = 'Main image'): MacroPlanFile {
  return { url, title, thumbUrl: url.replace('/tmp/', '/tmp/thumb/') }
}

/** Мок медиатеки: помнит загруженное и умеет искать по подстроке, как настоящая. */
function makeMedia() {
  const stored: any[] = []
  let counter = 0
  return {
    stored,
    upload: jest.fn(async (input: any) => {
      counter++
      const asset = {
        id: 'asset-' + counter,
        title: input.title,
        alt: input.alt,
        tags: input.tags,
        fileName: input.file.originalname,
        mimeType: input.file.mimetype,
        sizeBytes: input.file.size,
        storageKey: 'key-' + counter,
        _uploadInput: input,
      }
      stored.push(asset)
      return asset as any
    }),
    list: jest.fn(async (filter: any) => ({
      items: stored
        .filter((a) => !filter.search || String(a.title).includes(filter.search))
        .map((a) => ({
          ...a,
          url: `https://cms/media/${a.storageKey}`,
          optimizedUrl: `https://cms/media/${a.storageKey}.opt.webp`,
          thumbnailUrl: `https://cms/media/${a.storageKey}.thumb.webp`,
        })),
      total: stored.length,
      page: 1,
      limit: 30,
      totalPages: 1,
    })),
    toDto: jest.fn((asset: any) => ({
      ...asset,
      url: `https://cms/media/${asset.storageKey}`,
      optimizedUrl: `https://cms/media/${asset.storageKey}.opt.webp`,
      thumbnailUrl: `https://cms/media/${asset.storageKey}.thumb.webp`,
    })),
  }
}

/** Мок скачивания: по умолчанию отдаёт крошечную валидную картинку. */
function makeFetch(overrides: Record<string, { status?: number; bytes?: number }> = {}) {
  const requested: string[] = []
  const fn = (async (url: any) => {
    const key = String(url)
    requested.push(key)
    const rule = overrides[key] ?? {}
    const status = rule.status ?? 200
    const bytes = rule.bytes ?? 1024
    return {
      ok: status >= 200 && status < 300,
      status,
      arrayBuffer: async () => new ArrayBuffer(bytes),
    } as unknown as Response
  }) as unknown as typeof fetch
  return { fn, requested }
}

function makeImporter(
  fetchOverrides: Record<string, { status?: number; bytes?: number }> = {}
) {
  const media = makeMedia()
  const { fn, requested } = makeFetch(fetchOverrides)
  const importer = new PlanImageImporter({ media, fetchImpl: fn, siteId: 'site-1' })
  return { importer, media, requested }
}

describe('перенос файлов', () => {
  it('скачивает файл и отдаёт наш URL, а не ссылку CRM', async () => {
    const { importer } = makeImporter()
    const [image] = await importer.importFiles([file(URL_A)])

    expect(image.url).toMatch(/^https:\/\/cms\/media\//)
    expect(image.url).not.toContain('macrocrm')
    expect(image.thumbUrl).toMatch(/thumb/)
  })

  it('название ракурса из CRM сохраняется', async () => {
    const { importer } = makeImporter()
    const [image] = await importer.importFiles([file(URL_A, 'Additional layout')])
    expect(image.title).toBe('Additional layout')
  })

  it('в медиатеку идёт стабильный ключ, а не подписанный URL', async () => {
    const { importer, media } = makeImporter()
    await importer.importFiles([file(URL_A)])

    const asset = media.stored[0]
    expect(asset.title).toBe(PLAN_TITLE_PREFIX + '3707992/planirovka_k2.jpg')
    expect(asset.title).not.toContain('eyJlIjox')
    expect(asset.tags).toEqual([PLAN_TAG])
  })

  it('оптимизация и адаптивные варианты запрашиваются — чертежи тяжёлые', async () => {
    const { importer, media } = makeImporter()
    await importer.importFiles([file(URL_A)])

    const input = media.stored[0]._uploadInput
    expect(input.optimize).toBe(true)
    expect(input.variantWidths).toEqual([480, 768, 1280])
  })

  it('MIME берётся из расширения, а не из ответа сервера', async () => {
    const { importer, media } = makeImporter()
    await importer.importFiles([
      file(URL_A.replace('.jpg', '.png')),
      file(URL_B.replace('.jpg', '.webp')),
    ])
    expect(media.stored.map((a) => a.mimeType)).toEqual(['image/png', 'image/webp'])
  })
})

describe('дедупликация', () => {
  it('один файл в пределах прогона скачивается один раз', async () => {
    const { importer, requested } = makeImporter()
    await importer.importFiles([file(URL_A), file(URL_A, 'другой ракурс')])

    expect(requested).toHaveLength(1)
    expect(importer.getStats()).toEqual({ downloaded: 1, reused: 1, failed: 0 })
  })

  it('перевыпущенная ссылка узнаётся как тот же файл', async () => {
    const { importer, requested } = makeImporter()
    await importer.importFiles([file(URL_A)])
    await importer.importFiles([file(URL_A_RESIGNED)])

    expect(requested).toHaveLength(1)
    expect(importer.getStats().downloaded).toBe(1)
  })

  it('следующий прогон находит файл в медиатеке и не качает заново', async () => {
    const media = makeMedia()
    const first = makeFetch()
    await new PlanImageImporter({ media, fetchImpl: first.fn }).importFiles([file(URL_A)])

    const second = makeFetch()
    const importer = new PlanImageImporter({ media, fetchImpl: second.fn })
    const [image] = await importer.importFiles([file(URL_A_RESIGNED)])

    expect(second.requested).toHaveLength(0)
    expect(importer.getStats()).toEqual({ downloaded: 0, reused: 1, failed: 0 })
    expect(image.url).toMatch(/^https:\/\/cms\/media\//)
  })

  it('совпадение title проверяется точно, а не по подстроке', async () => {
    const media = makeMedia()
    // Чужой ассет, чей ключ содержит наш как подстроку.
    media.stored.push({
      id: 'foreign',
      title: PLAN_TITLE_PREFIX + '13707992/planirovka_k2.jpg',
      alt: '',
      storageKey: 'foreign-key',
    })

    const { fn, requested } = makeFetch()
    const importer = new PlanImageImporter({ media, fetchImpl: fn })
    const [image] = await importer.importFiles([file(URL_A)])

    expect(requested).toHaveLength(1)
    expect(image.url).not.toContain('foreign-key')
  })

  it('разные файлы качаются каждый', async () => {
    const { importer, requested } = makeImporter()
    await importer.importFiles([file(URL_A), file(URL_B)])
    expect(requested).toHaveLength(2)
    expect(importer.getStats().downloaded).toBe(2)
  })
})

describe('сбои', () => {
  it('недоступный файл выпадает из набора, остальные остаются', async () => {
    const { importer } = makeImporter({ [URL_A]: { status: 404 } })
    const images = await importer.importFiles([file(URL_A), file(URL_B)])

    expect(images).toHaveLength(1)
    expect(importer.getStats()).toEqual({ downloaded: 1, reused: 0, failed: 1 })
  })

  it('битый файл не попадает на страницу ссылкой на CRM', async () => {
    const { importer } = makeImporter({ [URL_A]: { status: 403 } })
    const images = await importer.importFiles([file(URL_A)])

    expect(images).toEqual([])
  })

  it('пустой ответ отбраковывается', async () => {
    const { importer } = makeImporter({ [URL_A]: { bytes: 0 } })
    expect(await importer.importFiles([file(URL_A)])).toEqual([])
    expect(importer.getStats().failed).toBe(1)
  })

  it('слишком большой файл отбраковывается — это ошибка выгрузки', async () => {
    const { importer } = makeImporter({ [URL_A]: { bytes: 25 * 1024 * 1024 } })
    expect(await importer.importFiles([file(URL_A)])).toEqual([])
    expect(importer.getStats().failed).toBe(1)
  })

  it('падение медиатеки не роняет весь синк', async () => {
    const media = makeMedia()
    media.upload = jest.fn(async (_input: any) => {
      throw new Error('minio недоступен')
    })
    const { fn } = makeFetch()
    const importer = new PlanImageImporter({ media, fetchImpl: fn })

    expect(await importer.importFiles([file(URL_A)])).toEqual([])
    expect(importer.getStats().failed).toBe(1)
  })

  it('пустой список файлов не ходит никуда', async () => {
    const { importer, requested } = makeImporter()
    expect(await importer.importFiles([])).toEqual([])
    expect(requested).toHaveLength(0)
  })
})
