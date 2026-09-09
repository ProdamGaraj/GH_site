/**
 * Перенос файлов планировок из MacroCRM в медиатеку CMS.
 *
 * Зачем вообще переносить. Ссылки Macro подписаны и истекают: в сегменте
 * подписи лежит base64 от {"e":<unix-время>}, и на снятых данных это трое
 * суток. Сохранив URL как есть, мы получили бы страницу проекта, у которой
 * планировки пропадают через три дня после синка, плюс браузеры посетителей
 * ходили бы за картинками прямо в CRM по подписанным ссылкам.
 *
 * Дедупликация — по стабильной части ссылки (id файла и имя), а не по URL:
 * при следующем синке подпись будет другой, а файл тем же. Ключ пишется в
 * title загруженного ассета, по нему же и ищется.
 *
 * Одна планировка типовая для десятков квартир, поэтому реально скачиваются
 * десятки файлов, а не сотни: импортёр помнит уже перенесённое в пределах
 * прогона и не ходит за одним файлом дважды.
 */

import { stableFileKey } from './PlanTypeGrouper'
import type { MacroPlanFile } from './MacroSellClient'
import { logger } from './Logger'

/** Префикс title, по которому ассет опознаётся как перенесённая планировка. */
export const PLAN_TITLE_PREFIX = 'macro-plan:'
/** Метка в тегах — чтобы планировки было видно в медиатеке отдельной выборкой. */
export const PLAN_TAG = 'macro-plan'

/** Разумный потолок на файл планировки: чертёж в 20 МБ — это ошибка выгрузки. */
const MAX_FILE_BYTES = 20 * 1024 * 1024

/**
 * То, что импортёру нужно от медиатеки.
 *
 * Описано интерфейсом, а не через typeof mediaService, чтобы модуль не тянул
 * за собой подключение к базе и хранилищу: тесту импортёра они не нужны, а
 * импорт синглтона поднимает и то, и другое ещё до первой строки теста.
 */
export interface MediaLibrary {
  upload(input: any): Promise<any>
  list(filter: any): Promise<{ items: any[] }>
  toDto(asset: any): any
}

export interface PlanImageImporterOptions {
  /** Сайт, в чью медиатеку класть. null — глобальная. */
  siteId?: string | null
  /** Папка медиатеки. */
  folderId?: string | null
  fetchImpl?: typeof fetch
  /** Подменяется в тестах. */
  media?: MediaLibrary
}

export interface ImportedImage {
  title: string
  url: string
  thumbUrl: string
}

export interface ImportStats {
  downloaded: number
  reused: number
  failed: number
}

/**
 * MIME по расширению.
 *
 * Полагаться на Content-Type ответа нельзя: Macro отдаёт файлы через nginx,
 * и на .jpg приходил application/octet-stream. MediaService по такому типу
 * не опознал бы картинку и не сделал бы ни превью, ни вариантов.
 */
function mimeFromName(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

function fileNameFrom(url: string): string {
  const path = url.split('?')[0]
  const last = path.split('/').filter(Boolean).pop()
  return last || 'plan.jpg'
}

export class PlanImageImporter {
  private readonly siteId: string | null
  private readonly folderId: string | null
  private readonly fetchImpl: typeof fetch
  private readonly mediaOverride: MediaLibrary | null

  /** Перенесённое в этом прогоне: ключ файла к нашему URL. */
  private readonly cache = new Map<string, ImportedImage>()
  private stats: ImportStats = { downloaded: 0, reused: 0, failed: 0 }

  constructor(opts: PlanImageImporterOptions = {}) {
    this.siteId = opts.siteId ?? null
    this.folderId = opts.folderId ?? null
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.mediaOverride = opts.media ?? null
  }

  /**
   * Настоящая медиатека подгружается по требованию: она тянет базу, MinIO и
   * sharp, и делать это при импорте модуля незачем.
   */
  private get media(): MediaLibrary {
    if (this.mediaOverride) return this.mediaOverride
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./MediaService').mediaService as MediaLibrary
  }

  getStats(): ImportStats {
    return { ...this.stats }
  }

  /**
   * Переносит файлы одной планировки.
   *
   * Файл, который не удалось перенести, ВЫПАДАЕТ из результата, а не остаётся
   * ссылкой на CRM: протухшая ссылка на странице выглядит как сломанная
   * картинка, отсутствующая — просто как один ракурс вместо трёх.
   */
  async importFiles(files: MacroPlanFile[]): Promise<ImportedImage[]> {
    const out: ImportedImage[] = []
    for (const file of files) {
      const imported = await this.importOne(file)
      if (imported) out.push(imported)
    }
    return out
  }

  private async importOne(file: MacroPlanFile): Promise<ImportedImage | null> {
    const key = stableFileKey(file.url)

    const cached = this.cache.get(key)
    if (cached) {
      this.stats.reused++
      return { ...cached, title: file.title || cached.title }
    }

    try {
      const existing = await this.findExisting(key)
      if (existing) {
        this.cache.set(key, existing)
        this.stats.reused++
        return { ...existing, title: file.title || existing.title }
      }

      const uploaded = await this.download(file, key)
      this.cache.set(key, uploaded)
      this.stats.downloaded++
      return { ...uploaded, title: file.title || uploaded.title }
    } catch (err) {
      this.stats.failed++
      logger.warn('Не удалось перенести файл планировки', {
        key,
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  /** Ищет уже перенесённый файл по точному совпадению title. */
  private async findExisting(key: string): Promise<ImportedImage | null> {
    const title = PLAN_TITLE_PREFIX + key
    const found = await this.media.list({
      siteId: this.siteId,
      includeGlobal: true,
      search: title,
      limit: 50,
    })
    // search работает по подстроке, поэтому совпадение проверяем точно:
    // ключ «3707992/plan.jpg» — подстрока ключа «13707992/plan.jpg».
    // list уже отдаёт DTO, повторно прогонять через toDto не нужно.
    const match = (found.items ?? []).find((asset) => asset.title === title)
    if (!match) return null
    return {
      title: match.alt ?? '',
      url: match.optimizedUrl ?? match.url,
      thumbUrl: match.thumbnailUrl ?? '',
    }
  }

  private async download(file: MacroPlanFile, key: string): Promise<ImportedImage> {
    const res = await this.fetchImpl(file.url)
    if (!res.ok) throw new Error(`скачивание вернуло ${res.status}`)

    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0) throw new Error('пустой файл')
    if (buffer.length > MAX_FILE_BYTES) {
      throw new Error(`файл ${buffer.length} байт, потолок ${MAX_FILE_BYTES}`)
    }

    const fileName = fileNameFrom(file.url)
    const mimeType = mimeFromName(fileName)

    const asset = await this.media.upload({
      file: {
        buffer,
        originalname: fileName,
        mimetype: mimeType,
        size: buffer.length,
      } as Express.Multer.File,
      siteId: this.siteId,
      folderId: this.folderId,
      title: PLAN_TITLE_PREFIX + key,
      alt: file.title || '',
      tags: [PLAN_TAG],
      // Чертежи весят по несколько мегабайт, а на карточке показываются
      // в четверть экрана: без вариантов страница с двадцатью планировками
      // тянула бы десятки мегабайт.
      optimize: true,
      variantWidths: [480, 768, 1280],
    })

    const dto = this.media.toDto(asset)
    return {
      title: file.title || '',
      url: dto.optimizedUrl ?? dto.url,
      thumbUrl: dto.thumbnailUrl ?? '',
    }
  }
}
