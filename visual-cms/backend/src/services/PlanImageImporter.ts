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

/** Размер страницы при выгрузке ассетов планировок. Совпадает с потолком MediaService. */
const PLAN_PAGE_SIZE = 100

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
  /** Нужен, чтобы переложить уже загруженный файл в правильную папку. */
  update?(id: string, patch: { folderId?: string | null }): Promise<any>
}

/** Дерево папок медиатеки. Импортёр создаёт в нём папку проекта. */
export interface MediaFolders {
  list(filter: { siteId?: string | null; includeGlobal?: boolean }): Promise<
    Array<{ id: string; name: string; parentId?: string | null; siteId?: string | null }>
  >
  create(input: { siteId?: string | null; parentId?: string | null; name: string }): Promise<{
    id: string
  }>
}

export interface PlanImageImporterOptions {
  /** Сайт, в чью медиатеку класть. null — глобальная. */
  siteId?: string | null
  /** Папка медиатеки. Задана — используется как есть, подпапки не создаются. */
  folderId?: string | null
  fetchImpl?: typeof fetch
  /** Подменяется в тестах. */
  media?: MediaLibrary
  folders?: MediaFolders
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
  /** Файлы, переложенные в правильную папку. */
  moved: number
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

const sameName = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

export class PlanImageImporter {
  private readonly siteId: string | null
  private readonly fixedFolderId: string | null
  private readonly fetchImpl: typeof fetch
  private readonly mediaOverride: MediaLibrary | null
  private readonly foldersOverride: MediaFolders | null

  /** Перенесённое в этом прогоне: ключ файла к нашему URL. */
  private readonly cache = new Map<string, ImportedImage>()
  /** Разрешённые пути папок: «Планировки/O'z Makon» к id. */
  private readonly folderCache = new Map<string, string | null>()
  /** Все ассеты с меткой планировки, по адресу. Выгружаются один раз за прогон. */
  private planAssets: Map<string, any> | null = null
  private stats: ImportStats = { downloaded: 0, reused: 0, failed: 0, moved: 0 }

  constructor(opts: PlanImageImporterOptions = {}) {
    this.siteId = opts.siteId ?? null
    this.fixedFolderId = opts.folderId ?? null
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.mediaOverride = opts.media ?? null
    this.foldersOverride = opts.folders ?? null
  }

  getStats(): ImportStats {
    return { ...this.stats }
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

  private get folders(): MediaFolders {
    if (this.foldersOverride) return this.foldersOverride
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./MediaFolderService').mediaFolderService as MediaFolders
  }

  /**
   * Переносит файлы одной планировки.
   *
   * `folderPath` — куда класть: например ['Планировки', "O'z Makon Business"].
   * Папки создаются при необходимости и ищутся по имени. Если задан явный
   * folderId, путь игнорируется.
   *
   * Файл, который не удалось перенести, ВЫПАДАЕТ из результата, а не остаётся
   * ссылкой на CRM: протухшая ссылка на странице выглядит как сломанная
   * картинка, отсутствующая — просто как один ракурс вместо трёх.
   */
  async importFiles(files: MacroPlanFile[], folderPath: string[] = []): Promise<ImportedImage[]> {
    const folderId = await this.resolveFolder(folderPath)
    const out: ImportedImage[] = []
    for (const file of files) {
      const imported = await this.importOne(file, folderId)
      if (imported) out.push(imported)
    }
    return out
  }

  /**
   * Перекладывает уже перенесённые файлы в папку проекта по их адресам.
   *
   * Нужен для типов, восстановленных из базы: у них картинки — уже НАШИ ссылки,
   * и обычный путь импорта им не подходит (по ключу из нашего же URL файл не
   * найдётся, и импортёр скачал бы его из собственной медиатеки). Поэтому ищем
   * по адресу среди ассетов с меткой планировки.
   *
   * Возвращает число переложенных.
   */
  async relocate(urls: string[], folderPath: string[]): Promise<number> {
    const folderId = await this.resolveFolder(folderPath)
    if (!folderId || !this.media.update) return 0

    let moved = 0
    for (const url of urls) {
      if (!url) continue
      try {
        const asset = await this.findByUrl(url)
        if (!asset || (asset.folderId ?? null) === folderId) continue
        await this.media.update(asset.id, { folderId })
        asset.folderId = folderId
        this.stats.moved++
        moved++
      } catch (err) {
        logger.warn('Не удалось переложить планировку в папку', {
          url,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return moved
  }

  /**
   * Ассет по нашему публичному адресу.
   *
   * Поиск в медиатеке идёт по имени файла и подписям, а не по URL, поэтому
   * один раз выгружаем все ассеты с меткой планировки и складываем в карту.
   */
  private async findByUrl(url: string): Promise<any | null> {
    if (!this.planAssets) {
      this.planAssets = new Map<string, any>()
      let page = 1
      for (;;) {
        const chunk = await this.media.list({
          siteId: this.siteId,
          includeGlobal: true,
          tag: PLAN_TAG,
          page,
          limit: PLAN_PAGE_SIZE,
        })
        const items = chunk.items ?? []
        for (const asset of items) {
          if (asset.url) this.planAssets.set(asset.url, asset)
          if (asset.optimizedUrl) this.planAssets.set(asset.optimizedUrl, asset)
        }
        if (items.length < PLAN_PAGE_SIZE) break
        page++
      }
    }
    return this.planAssets.get(url) ?? null
  }

  /**
   * Находит или создаёт папку по пути имён.
   *
   * Сопоставление по имени, а не по id: id автосозданной папки нигде не
   * хранится. Поэтому переименование такой папки в интерфейсе приведёт к тому,
   * что следующий прогон заведёт рядом новую со старым именем.
   */
  private async resolveFolder(path: string[]): Promise<string | null> {
    if (this.fixedFolderId) return this.fixedFolderId
    const clean = path.map((part) => (part || '').trim()).filter(Boolean)
    // Пустой сегмент означает, что вызывающий не знает имени папки. Молча
    // положить файл уровнем выше — худший исход: выглядит как норма, а на деле
    // чертежи проекта оказываются в общей куче. Сообщаем.
    if (clean.length !== path.length) {
      logger.warn('В пути папки планировок пустой сегмент', { path })
    }
    if (clean.length === 0) return null

    const cacheKey = clean.join('/')
    const cached = this.folderCache.get(cacheKey)
    if (cached !== undefined) return cached

    try {
      const existing = await this.folders.list({ siteId: this.siteId, includeGlobal: true })
      let parentId: string | null = null
      for (const name of clean) {
        const hit = existing.find(
          (f) => sameName(f.name, name) && (f.parentId ?? null) === parentId
        )
        if (hit) {
          parentId = hit.id
          continue
        }
        const created = await this.folders.create({
          siteId: this.siteId,
          parentId,
          name,
        })
        existing.push({ id: created.id, name, parentId })
        parentId = created.id
      }
      this.folderCache.set(cacheKey, parentId)
      return parentId
    } catch (err) {
      // Папка — удобство, а не условие работы: не смогли разложить, положим
      // в корень, но синк из-за этого срывать не будем.
      logger.warn('Не удалось разложить планировки по папкам', {
        path: cacheKey,
        error: err instanceof Error ? err.message : String(err),
      })
      this.folderCache.set(cacheKey, null)
      return null
    }
  }

  private async importOne(
    file: MacroPlanFile,
    folderId: string | null
  ): Promise<ImportedImage | null> {
    const key = stableFileKey(file.url)

    const cached = this.cache.get(key)
    if (cached) {
      this.stats.reused++
      return { ...cached, title: file.title || cached.title }
    }

    try {
      const existing = await this.findExisting(key, folderId)
      if (existing) {
        this.cache.set(key, existing)
        this.stats.reused++
        return { ...existing, title: file.title || existing.title }
      }

      const uploaded = await this.download(file, key, folderId)
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

  /**
   * Ищет уже перенесённый файл по точному совпадению title.
   *
   * Заодно перекладывает найденный в нужную папку: первые прогоны шли без
   * папки и свалили всё в корень медиатеки, а разбирать сотни файлов руками —
   * не работа для человека.
   */
  private async findExisting(key: string, folderId: string | null): Promise<ImportedImage | null> {
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

    if (folderId && (match.folderId ?? null) !== folderId && this.media.update) {
      try {
        await this.media.update(match.id, { folderId })
        this.stats.moved++
      } catch (err) {
        // Не переложился — не повод терять картинку: она уже есть и работает.
        logger.warn('Не удалось переложить планировку в папку', {
          id: match.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return {
      title: match.alt ?? '',
      url: match.optimizedUrl ?? match.url,
      thumbUrl: match.thumbnailUrl ?? '',
    }
  }

  private async download(
    file: MacroPlanFile,
    key: string,
    folderId: string | null
  ): Promise<ImportedImage> {
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
      folderId,
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
