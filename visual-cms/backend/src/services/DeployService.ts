/**
 * Сервис деплоя страниц - генерирует статические HTML файлы
 */

import * as fs from 'fs'
import * as path from 'path'
import { htmlGenerator, type ResolvedNavItem, type GeneratePageOptions } from './HtmlGenerator'
import { responsiveImageService } from './ResponsiveImageService'
import { AppDataSource } from '../config/database'
import { Not, In } from 'typeorm'
import { Page } from '../models/Page'
import { Block } from '../models/Block'
import { Site } from '../models/Site'
import { Collection } from '../models/Collection'
import { CollectionOverride } from '../models/CollectionOverride'
import { linkedBlocksService } from './LinkedBlocksService'
import { DataBinding } from '../models/DataBinding'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { PageDataConfig } from './DataBindingGenerator'
import type { BlockNode } from '../types/blockNode'
import { translationService } from './TranslationService'
import { languageService } from './LanguageService'
import { MacroV2Client } from './MacroV2Client'
import { logger } from './Logger'
import { mapComplexStats, type ProjectStats } from './ProjectStatsAggregator'
import { CredentialsManager } from './CredentialsManager'
import { secureDataSourceService, FetchConfig, AuthConfig } from './SecureDataSourceService'
import { resolveLoadStrategy } from './dataSourceRuntime'
import { applyCollectionTransforms } from '../utils/collectionTransforms'

// Папка для публикации - используем переменную окружения или путь относительно /app
const PUBLIC_DIR = process.env.PUBLIC_SITE_DIR || '/app/public-site'
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://localhost'

export interface DeployResult {
  success: boolean
  message: string
  deployedPages: string[]
  errors: string[]
  publicUrl?: string
}

// Определение дополнительного источника коллекции (как в Collection.additionalSources).
type AdditionalSourceDef = NonNullable<Collection['additionalSources']>[number]
// Определение дополнительного источника страницы (как в Page.additionalSources).
type PageAdditionalSourceDef = NonNullable<Page['additionalSources']>[number]

// Структурный тип «как выполнить запрос» — общий для источников коллекций и страниц.
// Содержит только поля, нужные для построения fetchConfig (без itemKey/targetBindingId).
interface AdditionalSourceRequestDef {
  dataSourceId: string
  arrayPath?: string
  endpointConfig?: {
    path?: string
    method?: string
    headers?: Record<string, string>
    queryParams?: Record<string, string>
    body?: string
    bodyFormat?: string
  }
}

// --- Превью цепочки запросов коллекции ---
export interface CollectionRequestPreviewStep {
  kind: 'main' | 'source'
  label: string
  request: {
    method: string
    url: string
    body?: unknown
    queryParams?: Record<string, string>
  }
  /** Для основного запроса — сырой ответ; для источника — данные после arrayPath. */
  response?: unknown
  /** Извлечённые значения (mainExtract / source.extract). */
  extract?: Record<string, unknown>
  error?: string
}

export interface CollectionRequestPreview {
  itemCount: number
  /** Образец элемента (первый), на котором резолвятся {{item.field}}. */
  sampleItem: unknown
  steps: CollectionRequestPreviewStep[]
  /** Итоговый объект данных страницы образца: alias → данные источника (основной + доп.). */
  finalDataStore: Record<string, unknown>
  /** Предупреждения о конфигурации (например, коллизия alias). */
  warnings: string[]
}

// --- Превью цепочки запросов страницы ---
export interface PageRequestPreview {
  steps: CollectionRequestPreviewStep[]
  /** Данные, вшиваемые в целевые привязки: подпись привязки → данные. */
  finalDataStore: Record<string, unknown>
  warnings: string[]
}

// Input-привязка страницы для UI-пикера.
export interface PageInputBinding {
  id: string
  blockId: string
  dataSourceId: string
  dataSourceName?: string
  method?: string
  path?: string
  mode?: string
}

export class DeployService {
  private pageRepository = AppDataSource.getRepository(Page)
  private blockRepository = AppDataSource.getRepository(Block)
  private siteRepository = AppDataSource.getRepository(Site)
  private dataBindingRepository = AppDataSource.getRepository(DataBinding)
  private dataSourceRepository = AppDataSource.getRepository(DataSourceEntity)
  private collectionRepository = AppDataSource.getRepository(Collection)
  private collectionOverrideRepository = AppDataSource.getRepository(CollectionOverride)

  /**
   * Генерирует HTML страницы и обогащает его адаптивными srcset.
   * Единая точка вместо прямого вызова htmlGenerator.generatePage — чтобы
   * srcset-инъекция применялась ко всем путям деплоя (страницы, сайты, переводы).
   */
  private async generatePageHtml(
    ...args: Parameters<typeof htmlGenerator.generatePage>
  ): Promise<string> {
    const html = htmlGenerator.generatePage(...args)
    return responsiveImageService.enrich(html)
  }

  /**
   * Опции уровня сайта для generatePage: общие CSS/JS и сырые HTML-инжекты.
   * Берутся из уже загруженной сущности Site (settings — jsonb той же строки),
   * поэтому новых запросов к БД не порождают (P4.4).
   */
  private siteAssetOptions(
    site?: Site | null,
  ): Pick<GeneratePageOptions, 'siteCss' | 'siteJs' | 'siteCustomHead' | 'siteCustomBodyEnd'> {
    const s = site?.settings
    return {
      siteCss: s?.globalCss || undefined,
      siteJs: s?.globalJs || undefined,
      siteCustomHead: s?.customHeadHtml || undefined,
      siteCustomBodyEnd: s?.customBodyEndHtml || undefined,
    }
  }

  /**
   * Является ли страница корнем сайта (домашней). Явно выбранная домашняя
   * (Site.homepageId) важнее legacy-конвенции slug 'index'/'home'.
   */
  private isHomePage(
    page: { id: string; slug: string },
    site?: { homepageId?: string | null } | null,
  ): boolean {
    if (site?.homepageId) return page.id === site.homepageId
    return page.slug === 'index' || page.slug === 'home'
  }

  /**
   * Относительный путь HTML-файла страницы для чистых URL (без .html в адресе):
   * домашняя → 'index.html' (URL '/'), остальные → '<slug>/index.html' (URL '/<slug>').
   */
  private pageRelPath(slug: string, isHome: boolean): string {
    return isHome ? 'index.html' : path.join(slug, 'index.html')
  }

  /**
   * Деплоит одну страницу
   */
  async deployPage(pageId: string): Promise<DeployResult> {
    const errors: string[] = []
    const deployedPages: string[] = []

    try {
      const page = await this.pageRepository.findOne({ where: { id: pageId }, relations: ['site'] })
      
      if (!page) {
        return {
          success: false,
          message: 'Страница не найдена',
          deployedPages: [],
          errors: ['Page not found']
        }
      }

      if (!page.structure) {
        return {
          success: false,
          message: 'Страница не имеет структуры',
          deployedPages: [],
          errors: ['Page has no structure']
        }
      }

      // Resolve deploy directory based on site
      const siteDir = this.resolveSiteDir(page.site)
      this.ensureDirectoryExists(siteDir)

      // Разворачиваем linked-блоки + library-templates и строим data-config на той же
      // структуре (единый источник правды — см. resolveStructureAndConfig).
      const { structure: updatedStructure, dataConfig } = await this.resolveStructureAndConfig(page)

      // Auto-links: для repeater'ов, чей dataSource совпадает с коллекцией, добавляем collectionLink
      if (dataConfig) {
        const siteCollections = await this.collectionRepository.find({
          where: { siteId: page.siteId, isActive: true },
          relations: ['dataSource'],
        })
        this.injectCollectionLinks(dataConfig, siteCollections)
      }

      // Доп.источники страницы: фетчим на деплое и вшиваем в целевые привязки как page-variable.
      if (dataConfig && page.additionalSources?.length) {
        const addErrors = await this.applyPageAdditionalSources(dataConfig, page.additionalSources)
        errors.push(...addErrors)
      }

      // Проверяем наличие переводов для переключателя языков на основной странице
      const activeLanguages = await languageService.getActive()
      const translationLocales = await translationService.getPageLocales(page.id)
      const defaultLang = activeLanguages.find(l => l.isDefault)
      let availableLangsForSwitcher: { code: string; name: string; flag: string; isDefault: boolean; direction: string }[] | undefined
      if (translationLocales.length > 0) {
        availableLangsForSwitcher = activeLanguages
          .filter(l => l.isActive && (l.isDefault || translationLocales.includes(l.code)))
          .map(l => ({ code: l.code, name: l.nativeName, flag: l.flag || '🌐', isDefault: l.isDefault, direction: l.direction }))
      }

      const isHome = this.isHomePage(page, page.site)

      // Генерируем HTML (для домашней передаём slug='index', чтобы переключатель
      // языков и пр. трактовали страницу как корень)
      const html = await this.generatePageHtml(updatedStructure, {
        metadata: page.metadata || { title: page.name, description: '', keywords: [] },
        slug: isHome ? 'index' : page.slug,
        dataConfig,
        lang: defaultLang?.code,
        direction: defaultLang?.direction,
        availableLanguages: availableLangsForSwitcher,
        ...this.siteAssetOptions(page.site),
      })

      // Чистые URL без .html: домашняя → index.html, остальные → <slug>/index.html
      const relPath = this.pageRelPath(page.slug, isHome)
      const filePath = path.join(siteDir, relPath)

      // Записываем файл
      this.ensureDirectoryExists(path.dirname(filePath))
      fs.writeFileSync(filePath, html, 'utf-8')
      deployedPages.push(relPath)

      // === Генерация мультиязычных версий ===
      await this.deployPageTranslations(page, updatedStructure, dataConfig, deployedPages, errors, siteDir, isHome)

      // Обновляем статус страницы
      page.status = 'published'
      await this.pageRepository.save(page)

      // Regenerate sitemap for the site
      if (page.site) {
        await this.generateSitemap(page.site)
        this.generateRobotsTxt(page.site)
      }

      logger.info(`Deployed: ${relPath} (site: ${page.site?.slug || 'default'})`)

      return {
        success: true,
        message: `Страница "${page.name}" успешно опубликована`,
        deployedPages,
        errors,
        publicUrl: `${PUBLIC_SITE_URL}/${isHome ? '' : page.slug}`
      }
    } catch (error: any) {
      logger.error('Deploy error', error instanceof Error ? error : undefined)
      return {
        success: false,
        message: 'Ошибка при публикации',
        deployedPages,
        errors: [error.message]
      }
    }
  }

  // ============================================================
  // Превью (паритет с деплоем, но без записи на диск)
  // ============================================================

  /**
   * Origin задеплоенных сайтов для превью. Превью-iframe живёт на origin CMS,
   * а ассеты (шрифты `/fonts`, картинки `/images`) и относительные fetch'и
   * data-runtime должны резолвиться туда же, куда и на проде. Берём из env;
   * если не задан — `<base>` не инжектим (превью работает, но шрифт может
   * откатиться на системный). Параметр `site` зарезервирован под будущую
   * per-site логику (subdomain/custom-domain).
   */
  private resolvePreviewAssetBase(_site?: Site | null): string {
    return process.env.PREVIEW_ASSET_ORIGIN || process.env.PUBLIC_SITE_URL || ''
  }

  /**
   * Инжектит `<base href>` сразу после `<head>`, чтобы относительные URL
   * (шрифты/картинки/относительные fetch) резолвились к origin сайта — это даёт
   * паритет превью с продом. Затрагивает ТОЛЬКО HTML превью; деплой не меняется.
   */
  private injectPreviewBaseHref(html: string, baseHref: string): string {
    if (!baseHref) return html
    const normalized = baseHref.replace(/\/+$/, '').replace(/"/g, '&quot;')
    return html.replace(/<head>/i, `<head>\n  <base href="${normalized}/">`)
  }

  /**
   * Метаданные по умолчанию для превью несохранённой страницы/блока.
   */
  private previewMetadata(structure: BlockNode): { title: string; description: string; keywords: string[] } {
    const meta = structure?.metadata as { title?: string; name?: string; description?: string } | undefined
    return {
      title: meta?.title || meta?.name || 'Предпросмотр',
      description: meta?.description || '',
      keywords: [],
    }
  }

  /**
   * Рендерит превью СТРАНИЦЫ тем же путём, что и деплой (`htmlGenerator.generatePage`
   * + responsive-images), но возвращает строку без записи на диск.
   *
   * Гибрид «черновик + pageId»: вёрстка берётся из переданного `structure`
   * (несохранённый черновик редактора), а данные/навигация/ассеты сайта —
   * резолвятся по `pageId`. Это переиспользует существующие приватные методы
   * (linkedBlocks → injectLibraryTemplates → preparePageDataConfig → коллекции →
   * доп.источники → resolveNavigation → siteAssetOptions), поэтому превью почти
   * 1:1 совпадает с опубликованной страницей.
   *
   * Без `pageId` (новая несохранённая страница) — автономный рендер черновика
   * без данных/навигации (вёрстка/карусель/формы/шрифт всё равно 1:1).
   */
  async renderPagePreview(input: { pageId?: string; structure: BlockNode; lang?: string }): Promise<string> {
    const { pageId, structure: draftStructure, lang } = input
    if (!draftStructure) {
      throw new Error('structure is required')
    }

    const page = pageId
      ? await this.pageRepository.findOne({ where: { id: pageId }, relations: ['site'] })
      : null

    // Нет сохранённой страницы — рендерим черновик как автономный документ.
    if (!page) {
      const html = await this.generatePageHtml(draftStructure, {
        metadata: this.previewMetadata(draftStructure),
        slug: 'preview',
        lang,
      })
      return this.injectPreviewBaseHref(html, this.resolvePreviewAssetBase(null))
    }

    // Разворачиваем linked-блоки + library-templates на ЧЕРНОВОЙ структуре и
    // строим data-config на ней же (как resolveStructureAndConfig, но для
    // переданного черновика, а не page.structure из БД).
    let structure = await linkedBlocksService.updateLinkedBlocks(draftStructure)
    structure = await this.injectLibraryTemplates(structure, page.id)
    const dataConfig = await this.preparePageDataConfig(page.id, structure)

    // Данные: auto-links коллекций + доп.источники страницы (как в deployPage).
    if (dataConfig) {
      const siteCollections = await this.collectionRepository.find({
        where: { siteId: page.siteId, isActive: true },
        relations: ['dataSource'],
      })
      this.injectCollectionLinks(dataConfig, siteCollections)
      if (page.additionalSources?.length) {
        await this.applyPageAdditionalSources(dataConfig, page.additionalSources)
      }
    }

    // Навигация: одиночный deployPage её опускает, но в превью пользователь хочет
    // видеть меню — берём «опубликованное» состояние сайта (как deploySite).
    let resolvedNav: ResolvedNavItem[] | undefined
    if (page.site) {
      const allSitePages = await this.pageRepository.find({ where: { siteId: page.siteId } })
      resolvedNav = this.resolveNavigation(page.site.settings?.navigation, allSitePages, page.site.homepageId)
    }

    // Язык: переключатель показываем только при наличии переводов (как в deploy).
    const activeLanguages = await languageService.getActive()
    const translationLocales = await translationService.getPageLocales(page.id)
    const defaultLang = activeLanguages.find(l => l.isDefault)
    let availableLanguages: { code: string; name: string; flag: string; isDefault: boolean; direction: string }[] | undefined
    if (translationLocales.length > 0) {
      availableLanguages = activeLanguages
        .filter(l => l.isActive && (l.isDefault || translationLocales.includes(l.code)))
        .map(l => ({ code: l.code, name: l.nativeName, flag: l.flag || '🌐', isDefault: l.isDefault, direction: l.direction }))
    }

    const isHome = this.isHomePage(page, page.site)

    const html = await this.generatePageHtml(structure, {
      metadata: page.metadata || { title: page.name, description: '', keywords: [] },
      slug: isHome ? 'index' : page.slug,
      dataConfig,
      lang: lang || defaultLang?.code,
      direction: defaultLang?.direction,
      availableLanguages,
      navigation: resolvedNav,
      ...this.siteAssetOptions(page.site),
    })

    return this.injectPreviewBaseHref(html, this.resolvePreviewAssetBase(page.site))
  }

  /**
   * Рендерит превью БЛОКА как автономную страницу тем же генератором.
   * Блок вне контекста страницы, поэтому без data-bindings/навигации — но
   * шрифт/карусель/формы/стили рендерятся 1:1 с продом.
   */
  async renderBlockPreview(input: { structure: BlockNode; lang?: string }): Promise<string> {
    const { structure, lang } = input
    if (!structure) {
      throw new Error('structure is required')
    }
    const html = await this.generatePageHtml(structure, {
      metadata: this.previewMetadata(structure),
      slug: 'preview',
      lang,
    })
    return this.injectPreviewBaseHref(html, this.resolvePreviewAssetBase(null))
  }

  /**
   * Деплоит все опубликованные страницы
   */
  async deployAll(): Promise<DeployResult> {
    const errors: string[] = []
    const deployedPages: string[] = []

    try {
      const pages = await this.pageRepository.find({
        where: { status: Not('archived') },
        relations: ['site'],
      })

      if (pages.length === 0) {
        return {
          success: false,
          message: 'Нет страниц для деплоя',
          deployedPages: [],
          errors: []
        }
      }

      // Создаём корневую папку
      this.ensureDirectoryExists(PUBLIC_DIR)

      // Копируем assets (шрифты, изображения)
      this.copyAssets()

      // Group pages by site
      const sitePages = new Map<string, Page[]>()
      const sitesMap = new Map<string, Site>()
      for (const page of pages) {
        const siteKey = page.siteId || '__default__'
        if (!sitePages.has(siteKey)) sitePages.set(siteKey, [])
        sitePages.get(siteKey)!.push(page)
        if (page.site) sitesMap.set(siteKey, page.site)
      }

      for (const page of pages) {
        if (!page.structure) {
          errors.push(`Страница "${page.name}" не имеет структуры`)
          continue
        }

        try {
          const siteDir = this.resolveSiteDir(page.site)
          this.ensureDirectoryExists(siteDir)

          // Обновляем структуру (linked-блоки + library-templates) и строим data-config
          // на той же структуре — иначе repeater-привязки внутри linked-блоков теряются.
          const { structure: updatedStructure, dataConfig } = await this.resolveStructureAndConfig(page)

          // Проверяем переводы для переключателя
          const pageLangs = await translationService.getPageLocales(page.id)
          const allActiveLangs = await languageService.getActive()
          const defLang = allActiveLangs.find(l => l.isDefault)
          let pageLangSwitcher: { code: string; name: string; flag: string; isDefault: boolean; direction: string }[] | undefined
          if (pageLangs.length > 0) {
            pageLangSwitcher = allActiveLangs
              .filter(l => l.isActive && (l.isDefault || pageLangs.includes(l.code)))
              .map(l => ({ code: l.code, name: l.nativeName, flag: l.flag || '🌐', isDefault: l.isDefault, direction: l.direction }))
          }
          
          const isHome = this.isHomePage(page, page.site)

          const html = await this.generatePageHtml(updatedStructure, {
            metadata: page.metadata || { title: page.name, description: '', keywords: [] },
            slug: isHome ? 'index' : page.slug,
            dataConfig,
            lang: defLang?.code,
            direction: defLang?.direction,
            availableLanguages: pageLangSwitcher,
            ...this.siteAssetOptions(page.site),
          })

          // Чистые URL без .html: домашняя → index.html, остальные → <slug>/index.html
          const relPath = this.pageRelPath(page.slug, isHome)
          const filePath = path.join(siteDir, relPath)

          this.ensureDirectoryExists(path.dirname(filePath))
          fs.writeFileSync(filePath, html, 'utf-8')
          deployedPages.push(`${page.site?.slug || ''}/${relPath}`.replace(/^\//, ''))

          // Mark page as published
          page.status = 'published'
          await this.pageRepository.save(page)

          // Deploy translations for this page
          await this.deployPageTranslations(page, updatedStructure, dataConfig, deployedPages, errors, siteDir, isHome)
          
          logger.info(`Deployed: ${relPath} (site: ${page.site?.slug || 'default'})`)
        } catch (err: any) {
          errors.push(`Ошибка при генерации "${page.name}": ${err.message}`)
        }
      }

      // Generate sitemap.xml and robots.txt per site
      for (const [siteKey, site] of sitesMap.entries()) {
        await this.generateSitemap(site)
        this.generateRobotsTxt(site)
      }

      return {
        success: errors.length === 0,
        message: `Опубликовано ${deployedPages.length} страниц`,
        deployedPages,
        errors,
        publicUrl: `${PUBLIC_SITE_URL}/`
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Ошибка при публикации',
        deployedPages,
        errors: [error.message]
      }
    }
  }

  /**
   * Деплоит все страницы конкретного сайта
   */
  async deploySite(siteId: string): Promise<DeployResult> {
    const errors: string[] = []
    const deployedPages: string[] = []

    try {
      const site = await this.siteRepository.findOne({ where: { id: siteId } })
      if (!site) {
        return { success: false, message: 'Сайт не найден', deployedPages: [], errors: ['Site not found'] }
      }

      const pages = await this.pageRepository.find({
        where: { siteId, status: Not('archived') },
      })

      if (pages.length === 0) {
        return { success: false, message: 'Нет страниц для публикации', deployedPages: [], errors: [] }
      }

      const siteDir = this.resolveSiteDir(site)
      this.ensureDirectoryExists(siteDir)
      // Clean old HTML files before deploying fresh pages
      this.cleanHtmlFiles(siteDir)
      this.copyAssetsToDir(siteDir)

      // Resolve navigation from site settings
      const allSitePages = await this.pageRepository.find({ where: { siteId } })
      const resolvedNav = this.resolveNavigation(site.settings?.navigation, allSitePages, site.homepageId)

      // Загружаем коллекции заранее для auto-links в repeater'ах
      const siteCollections = await this.collectionRepository.find({
        where: { siteId, isActive: true },
        relations: ['dataSource'],
      })

      for (const page of pages) {
        if (!page.structure) {
          errors.push(`Страница "${page.name}" не имеет структуры`)
          continue
        }
        try {
          // Разворачиваем linked-блоки + library-templates и строим data-config на той же
          // структуре — иначе repeater-привязки внутри linked-блоков теряются (см. deployPage).
          const { structure: updatedStructure, dataConfig } = await this.resolveStructureAndConfig(page)

          // Auto-links: для repeater'ов, чей dataSource совпадает с коллекцией, добавляем collectionLink
          if (dataConfig) {
            this.injectCollectionLinks(dataConfig, siteCollections)
          }

          const pageLangs = await translationService.getPageLocales(page.id)
          const allActiveLangs = await languageService.getActive()
          const defLang = allActiveLangs.find(l => l.isDefault)
          let pageLangSwitcher: { code: string; name: string; flag: string; isDefault: boolean; direction: string }[] | undefined
          if (pageLangs.length > 0) {
            pageLangSwitcher = allActiveLangs
              .filter(l => l.isActive && (l.isDefault || pageLangs.includes(l.code)))
              .map(l => ({ code: l.code, name: l.nativeName, flag: l.flag || '🌐', isDefault: l.isDefault, direction: l.direction }))
          }

          const isHome = this.isHomePage(page, site)

          const html = await this.generatePageHtml(updatedStructure, {
            metadata: page.metadata || { title: page.name, description: '', keywords: [] },
            slug: isHome ? 'index' : page.slug,
            dataConfig,
            lang: defLang?.code,
            direction: defLang?.direction,
            availableLanguages: pageLangSwitcher,
            navigation: resolvedNav,
            ...this.siteAssetOptions(site),
          })

          // Чистые URL без .html: домашняя → index.html, остальные → <slug>/index.html
          const relPath = this.pageRelPath(page.slug, isHome)
          const filePath = path.join(siteDir, relPath)
          this.ensureDirectoryExists(path.dirname(filePath))
          fs.writeFileSync(filePath, html, 'utf-8')
          deployedPages.push(relPath)

          // Mark page as published
          page.status = 'published'
          await this.pageRepository.save(page)

          await this.deployPageTranslations(page, updatedStructure, dataConfig, deployedPages, errors, siteDir, isHome)
          logger.info(`Site "${site.slug}" deployed: ${relPath}`)
        } catch (err: any) {
          errors.push(`Ошибка "${page.name}": ${err.message}`)
        }
      }

      // Generate SEO files
      await this.generateSitemap(site)
      this.generateRobotsTxt(site)

      // НОВОЕ: деплой коллекций сайта (используем уже загруженные siteCollections)
      for (const collection of siteCollections) {
        try {
          const colResult = await this.deployCollection(collection.id)
          deployedPages.push(...colResult.deployedPages)
          errors.push(...colResult.errors)
          logger.info(`Collection "${collection.name}": ${colResult.deployedPages.length} pages`)
        } catch (colErr: any) {
          errors.push(`Collection "${collection.name}": ${colErr.message}`)
        }
      }

      // Update site status
      site.status = 'active'
      await this.siteRepository.save(site)

      return {
        success: errors.length === 0,
        message: `Сайт "${site.name}": опубликовано ${deployedPages.length} страниц`,
        deployedPages,
        errors,
        publicUrl: this.resolveSiteUrl(site),
      }
    } catch (error: any) {
      return { success: false, message: 'Ошибка при публикации сайта', deployedPages, errors: [error.message] }
    }
  }

  /**
   * Деплоит все страницы коллекции (Collection)
   * Для каждого элемента из API генерирует отдельную HTML-страницу
   */
  async deployCollection(collectionId: string): Promise<DeployResult> {
    const errors: string[] = []
    const deployedPages: string[] = []

    try {
      // 1. Загрузить коллекцию с overrides (одним запросом — Проблема 10)
      const collection = await this.collectionRepository.findOne({
        where: { id: collectionId },
        relations: ['dataSource', 'statsDataSource', 'templatePage', 'site', 'overrides'],
      })
      if (!collection) {
        return { success: false, message: 'Коллекция не найдена', deployedPages: [], errors: ['Collection not found'] }
      }
      if (!collection.site) {
        return { success: false, message: 'Коллекция не привязана к сайту', deployedPages: [], errors: ['No site'] }
      }

      // 2. Загрузить элементы из API
      let items: any[] = []
      // Начальный контекст extract из основного ответа (mainExtract)
      const mainExtractedValues: Record<string, unknown> = {}
      try {
        const { items: fetchedItems, raw } = await this.fetchCollectionApiData(collection)
        items = fetchedItems
        // Применяем mainExtract — значения доступны в additionalSources как {{extract.name}}
        if (collection.mainExtract) {
          for (const [name, dotPath] of Object.entries(collection.mainExtract)) {
            mainExtractedValues[name] = this.resolveExtractPath(raw, dotPath)
          }
        }
        // Обновляем кеш
        collection.cachedApiData = items
        collection.lastCachedAt = new Date()
        await this.collectionRepository.save(collection)
      } catch (fetchErr: any) {
        // Проблема 8: fallback на кеш
        if (collection.useCache && collection.cachedApiData && Array.isArray(collection.cachedApiData)) {
          items = collection.cachedApiData
          errors.push(`API fetch failed (${fetchErr.message}), using cached data from ${collection.lastCachedAt?.toISOString()}`)
          logger.warn(`Collection ${collection.name}: API failed, using cache`)
        } else {
          return {
            success: false,
            message: `Не удалось загрузить данные: ${fetchErr.message}`,
            deployedPages: [],
            errors: [fetchErr.message],
          }
        }
      }

      // Серверные трансформации элементов коллекции (include/exclude/sort/limit/unique/...).
      // Кеш (cachedApiData) хранит сырой массив; применяются на чтении, поэтому
      // совпадает с preview (CollectionController.getItems).
      items = applyCollectionTransforms(items, collection.transforms)

      if (items.length === 0) {
        return { success: true, message: 'Коллекция пуста — нет элементов для генерации', deployedPages: [], errors: [] }
      }

      // 3. Построить Maps для overrides — по apiItemId и по apiItemSlug (fallback)
      const overridesByItemId = new Map<string, CollectionOverride>()
      const overridesBySlug = new Map<string, CollectionOverride>()
      if (collection.overrides) {
        for (const ov of collection.overrides) {
          if (ov.apiItemId) overridesByItemId.set(ov.apiItemId, ov)
          if (ov.apiItemSlug) overridesBySlug.set(ov.apiItemSlug, ov)
        }
      }

      // 4. Загрузить все custom pages одним запросом
      const allOverrides = collection.overrides || []
      const customPageIds = allOverrides.map(ov => ov.customPageId)
      const customPages = customPageIds.length > 0
        ? await this.pageRepository.findByIds(customPageIds)
        : []
      const customPagesMap = new Map(customPages.map(p => [p.id, p]))

      // 5. Подготовить шаблонную страницу (один раз)
      const templatePage = collection.templatePage || await this.pageRepository.findOne({ where: { id: collection.templatePageId } })
      if (!templatePage || !templatePage.structure) {
        return { success: false, message: 'Шаблонная страница не имеет структуры', deployedPages: [], errors: ['Template page has no structure'] }
      }

      // Инжектируем library templates в шаблон (один раз)
      let templateStructure = await linkedBlocksService.updateLinkedBlocks(templatePage.structure)
      templateStructure = await this.injectLibraryTemplates(templateStructure, templatePage.id)

      // Подготовить data config шаблона (один раз)
      const templateDataConfig = await this.preparePageDataConfig(templatePage.id, templateStructure)

      // Resolve deploy directory — очищаем перед генерацией, чтобы не оставались stale-файлы
      const siteDir = this.resolveSiteDir(collection.site)
      const collectionDir = path.join(siteDir, collection.basePath.replace(/^\//, ''))
      if (collectionDir !== siteDir && fs.existsSync(collectionDir)) {
        fs.rmSync(collectionDir, { recursive: true, force: true })
      }
      this.ensureDirectoryExists(collectionDir)

      // Resolve navigation for the site
      const allSitePages = await this.pageRepository.find({ where: { siteId: collection.siteId } })
      const resolvedNav = this.resolveNavigation(collection.site.settings?.navigation, allSitePages)

      // 6. Для каждого элемента — генерировать HTML
      const usedSlugs = new Set<string>()

      // 5.5. Загрузить агрегированную статистику по проектам (Macro v2 estateSell/list).
      // Если statsDataSource не задан — statsByItemId пустой, item.__stats будет null.
      let statsByItemId: Record<string, unknown> = {}
      try {
        statsByItemId = await this.fetchProjectStats(collection, items)
      } catch (statsErr: any) {
        errors.push(`Stats fetch failed: ${statsErr.message}`)
        logger.warn(`Collection ${collection.name}: stats failed`, { error: statsErr.message })
      }

      for (const item of items) {
        const itemId = String(item.id || item._id || '')
        // Прокидываем статистику в item; enrichItemForCollections подхватит её и положит в __stats
        if (statsByItemId[itemId]) {
          ;(item as any).__stats = statsByItemId[itemId]
        }
        const rawSlug = this.getNestedValue(item, collection.slugField)
        const itemTitle = this.getNestedValue(item, collection.titleField) || collection.name

        // Slug всегда нормализуется через slugify — единый формат URL независимо от источника
        let itemSlug = this.slugify(String(rawSlug || itemTitle || '')) || itemId

        // Определить override (match по id, fallback по slug)
        const override = overridesByItemId.get(itemId) || overridesBySlug.get(itemSlug)

        // Override может задать кастомный slug для файла — тоже нормализуем
        if (override?.apiItemSlug) {
          itemSlug = this.slugify(override.apiItemSlug) || itemSlug
        }

        // Проверка slug-конфликтов внутри коллекции
        if (usedSlugs.has(itemSlug)) {
          let suffix = 2
          while (usedSlugs.has(`${itemSlug}-${suffix}`)) suffix++
          itemSlug = `${itemSlug}-${suffix}`
          errors.push(`Slug conflict: "${itemSlug}" — added suffix`)
        }
        usedSlugs.add(itemSlug)

        try {
          let pageStructure: any
          let pageDataConfig: PageDataConfig | undefined
          let pageMetadata: { title: string; description: string; keywords: string[] }

          if (override) {
            // Кастомная страница
            const customPage = customPagesMap.get(override.customPageId)
            if (!customPage || !customPage.structure) {
              errors.push(`Custom page for "${itemTitle}" (${override.customPageId}) has no structure, skipping`)
              continue
            }
            let customStructure = await linkedBlocksService.updateLinkedBlocks(customPage.structure)
            customStructure = await this.injectLibraryTemplates(customStructure, customPage.id)
            pageStructure = customStructure
            pageDataConfig = await this.preparePageDataConfig(customPage.id, customStructure)
            pageMetadata = customPage.metadata || { title: itemTitle, description: '', keywords: [] }
          } else {
            // Дополнительные источники: фетчим и прикрепляем к item ДО подстановки,
            // чтобы данные были доступны как {{item.<itemKey>.field}} в шаблоне.
            // Источники выполняются по порядку; extract-значения предыдущих доступны
            // в последующих через {{extract.name}}.
            if (collection.additionalSources?.length) {
              const extractedValues: Record<string, unknown> = { ...mainExtractedValues }
              for (const source of collection.additionalSources) {
                try {
                  const data = await this.fetchAdditionalSourceForItem(source, item, extractedValues)
                  // extract считаем по полному ответу (для цепочки {{extract.name}})
                  if (source.extract) {
                    for (const [name, dotPath] of Object.entries(source.extract)) {
                      extractedValues[name] = this.resolveExtractPath(data, dotPath)
                    }
                  }
                  // JOIN: при необходимости берём только совпадающий по ключу элемент
                  if (source.itemKey) (item as any)[source.itemKey] = this.applyAdditionalSourceJoin(data, source, item)
                } catch (srcErr: any) {
                  errors.push(`Additional source "${source.itemKey}" failed for "${itemTitle}": ${srcErr.message}`)
                  if (source.itemKey) (item as any)[source.itemKey] = null
                }
              }
            }

            // Авто-шаблон с контекстом элемента — подставляем данные в структуру
            pageStructure = this.substituteItemData(templateStructure, item)
            pageDataConfig = this.injectCollectionContext(templateDataConfig, collection, item, itemId)
            const enriched = this.enrichItemForCollections(item)
            const metaCtx = { item: enriched, $: enriched }
            pageMetadata = {
              title: this.replaceTemplateVars(templatePage.metadata?.title || itemTitle, metaCtx),
              description: this.replaceTemplateVars(templatePage.metadata?.description || '', metaCtx),
              keywords: templatePage.metadata?.keywords || [],
            }
          }

          // Генерируем HTML
          const html = await this.generatePageHtml(pageStructure, {
            metadata: pageMetadata,
            slug: itemSlug,
            dataConfig: pageDataConfig,
            navigation: resolvedNav,
            ...this.siteAssetOptions(collection.site),
          })

          // Записываем файл (чистый URL без .html: <basePath>/<slug>/index.html → /<basePath>/<slug>)
          const filePath = path.join(collectionDir, itemSlug, 'index.html')
          this.ensureDirectoryExists(path.dirname(filePath))
          fs.writeFileSync(filePath, html, 'utf-8')
          deployedPages.push(`${collection.basePath.replace(/^\/|\/$/g, '')}/${itemSlug}`)

          logger.info(`Collection "${collection.name}": deployed ${itemSlug} (${override ? 'custom' : 'template'})`)
        } catch (itemErr: any) {
          errors.push(`Error deploying "${itemTitle}" (${itemSlug}): ${itemErr.message}`)
        }
      }

      return {
        success: errors.filter(e => !e.includes('using cached data')).length === 0,
        message: `Коллекция "${collection.name}": опубликовано ${deployedPages.length}/${items.length} страниц`,
        deployedPages,
        errors,
      }
    } catch (error: any) {
      logger.error('Deploy collection error', error instanceof Error ? error : undefined)
      return { success: false, message: 'Ошибка при публикации коллекции', deployedPages, errors: [error.message] }
    }
  }

  /**
   * Строит FetchConfig + AuthConfig для основного запроса коллекции (с учётом endpointConfig).
   * Вынесено отдельно, чтобы переиспользовать в fetchCollectionApiData и previewCollectionRequest.
   */
  private async buildCollectionFetchConfig(
    collection: Collection
  ): Promise<{ fetchConfig: FetchConfig; authConfig?: AuthConfig }> {
    const ds = collection.dataSource
    if (!ds) throw new Error('Data source not loaded')

    const config = ds.config as any
    if (!config?.url) throw new Error('Data source has no URL')

    let authConfig: AuthConfig | undefined
    if (ds.authConfig) {
      authConfig = (await CredentialsManager.decryptAuthConfig(
        ds.authConfig as Record<string, unknown>
      )) as unknown as AuthConfig
    }

    const fetchConfig: FetchConfig = { type: ds.type as FetchConfig['type'], ...config }

    const ec = collection.endpointConfig
    if (ec) {
      if (ec.path) {
        const base = (config.url as string).replace(/\/+$/, '')
        const suffix = ec.path.startsWith('/') ? ec.path : `/${ec.path}`
        fetchConfig.url = `${base}${suffix}`
      }
      if (ec.method) fetchConfig.method = ec.method as FetchConfig['method']
      if (ec.headers) fetchConfig.headers = { ...(fetchConfig.headers || {}), ...ec.headers }
      if (ec.queryParams) fetchConfig.queryParams = { ...(fetchConfig.queryParams || {}), ...ec.queryParams }
      if (ec.body !== undefined) {
        fetchConfig.body = ec.body
        if (ec.bodyFormat) fetchConfig.bodyFormat = ec.bodyFormat as FetchConfig['bodyFormat']
      }
    }

    return { fetchConfig, authConfig }
  }

  /**
   * Загружает данные из data source коллекции с учётом endpointConfig.
   * Возвращает items (по arrayPath) и raw-ответ (для mainExtract).
   */
  private async fetchCollectionApiData(
    collection: Collection
  ): Promise<{ items: any[]; raw: unknown }> {
    const { fetchConfig, authConfig } = await this.buildCollectionFetchConfig(collection)

    const result = await secureDataSourceService.fetchData(fetchConfig, authConfig)
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to fetch collection data')
    }

    const raw = result.data
    const items = this.getNestedValue(raw, collection.arrayPath)

    if (!Array.isArray(items)) {
      throw new Error(`Expected array at "${collection.arrayPath}", got ${typeof items}`)
    }

    return { items, raw }
  }

  /**
   * Превью полной цепочки запросов коллекции на ОДНОМ образце-элементе (первом).
   * Выполняет реальные запросы: основной → mainExtract → каждый additionalSource
   * (с накоплением extract). Возвращает по-шаговую раскладку и итоговый объект данных.
   *
   * Используется панелью «Просмотр запроса» в редакторе коллекции — не пишет файлов,
   * не трогает кеш и не деплоит.
   */
  async previewCollectionRequest(collectionId: string): Promise<CollectionRequestPreview> {
    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId },
      relations: ['dataSource'],
    })
    if (!collection) throw new Error('Collection not found')

    const steps: CollectionRequestPreviewStep[] = []
    const finalDataStore: Record<string, unknown> = {}
    const warnings: string[] = []

    // --- Шаг 1: основной запрос ---
    const { fetchConfig: mainConfig, authConfig: mainAuth } =
      await this.buildCollectionFetchConfig(collection)
    const mainStep: CollectionRequestPreviewStep = {
      kind: 'main',
      label: 'Основной запрос',
      request: {
        method: mainConfig.method || 'GET',
        url: mainConfig.url || '',
        body: mainConfig.body,
        queryParams: mainConfig.queryParams,
      },
    }

    let items: any[] = []
    const extractedValues: Record<string, unknown> = {}

    const mainResult = await secureDataSourceService.fetchData(mainConfig, mainAuth)
    if (!mainResult.success) {
      mainStep.error = mainResult.error?.message || 'Failed to fetch collection data'
      steps.push(mainStep)
      return { itemCount: 0, sampleItem: null, steps, finalDataStore, warnings }
    }

    const raw = mainResult.data
    mainStep.response = raw

    const rawItems = this.getNestedValue(raw, collection.arrayPath)
    items = Array.isArray(rawItems) ? applyCollectionTransforms(rawItems, collection.transforms) : []

    // mainExtract
    if (collection.mainExtract) {
      const extract: Record<string, unknown> = {}
      for (const [name, dotPath] of Object.entries(collection.mainExtract)) {
        const val = this.resolveExtractPath(raw, dotPath)
        extract[name] = val
        extractedValues[name] = val
      }
      mainStep.extract = extract
    }
    steps.push(mainStep)

    const sampleItem = items[0] ?? null
    // Клон образца, к которому прикрепляются данные доп.источников — так же, как на деплое.
    // Этот объект и есть `item`, доступный в шаблоне через {{item.*}}.
    const enrichedItem: any = sampleItem ? JSON.parse(JSON.stringify(sampleItem)) : {}

    // --- Шаг 2..N: дополнительные источники (на образце-элементе) ---
    if (collection.additionalSources?.length) {
      for (const source of collection.additionalSources) {
        const stepLabel = source.itemKey ? `item.${source.itemKey}` : '(ключ не задан)'
        const step: CollectionRequestPreviewStep = {
          kind: 'source',
          label: stepLabel,
          request: { method: 'GET', url: '' },
        }

        if (!source.itemKey) {
          warnings.push('Один из доп.источников: не задан ключ (itemKey).')
        }

        try {
          const { fetchConfig, authConfig } = await this.buildAdditionalSourceFetchConfig(
            source,
            enrichedItem,
            extractedValues
          )
          step.request = {
            method: fetchConfig.method || 'GET',
            url: fetchConfig.url || '',
            body: fetchConfig.body,
            queryParams: fetchConfig.queryParams,
          }

          const result = await secureDataSourceService.fetchData(fetchConfig, authConfig)
          if (!result.success) {
            step.error = result.error?.message || 'Failed to fetch additional source data'
            steps.push(step)
            continue
          }

          const data = source.arrayPath
            ? this.getNestedValue(result.data, source.arrayPath)
            : result.data
          step.response = data

          // source.extract → накапливаем в общий контекст (по полному ответу)
          if (source.extract) {
            const extract: Record<string, unknown> = {}
            for (const [name, dotPath] of Object.entries(source.extract)) {
              const val = this.resolveExtractPath(data, dotPath)
              extract[name] = val
              extractedValues[name] = val
            }
            step.extract = extract
          }

          // Прикрепляем к образцу под ключом (с JOIN, если задан) — как увидит шаблон.
          if (source.itemKey) enrichedItem[source.itemKey] = this.applyAdditionalSourceJoin(data, source, enrichedItem)
        } catch (err: any) {
          step.error = err.message
        }
        steps.push(step)
      }
    }

    return {
      itemCount: items.length,
      sampleItem,
      steps,
      // Итоговый объект = образец-элемент с прикреплёнными доп.данными (это и есть `item` в шаблоне).
      finalDataStore: Object.keys(enrichedItem).length ? enrichedItem : finalDataStore,
      warnings,
    }
  }

  /**
   * Загружает агрегированную статистику по ЖК из Macro v2 (estateComplexes/listStats)
   * и возвращает map { [itemId]: ProjectStats }.
   *
   * Один POST-запрос на всю коллекцию (Macro считает min/max/count сама).
   *
   * Поведение:
   *  - Если у коллекции не задан statsDataSource — возвращает {} (статистика не показывается).
   *  - Кеш: cachedStatsData в БД, TTL = collection.cacheTtl.
   *  - complexIds извлекаются из item.id (item коллекции "Проекты" в v1 = ЖК с тем же id, что в v2).
   *  - currency берётся из dataSource.config.currency (если задан в UI), иначе null.
   */
  private async fetchProjectStats(
    collection: Collection,
    items: any[]
  ): Promise<Record<string, ProjectStats>> {
    if (!collection.statsDataSource || !collection.statsDataSourceId) return {}
    if (!Array.isArray(items) || items.length === 0) return {}

    // Проверяем кеш: если свежий — отдаём как есть.
    const ttlMs = (collection.cacheTtl || 600) * 1000
    const cachedAt = collection.cachedStatsAt ? new Date(collection.cachedStatsAt).getTime() : 0
    const isFresh = cachedAt > 0 && (Date.now() - cachedAt) < ttlMs
    if (isFresh && collection.cachedStatsData && typeof collection.cachedStatsData === 'object') {
      return collection.cachedStatsData as Record<string, ProjectStats>
    }

    // Готовим клиента
    const ds = collection.statsDataSource
    const cfg = (ds.config || {}) as any
    const baseUrl = cfg.baseUrl || cfg.url
    if (!baseUrl) throw new Error('statsDataSource has no baseUrl/url in config')

    const authConfig = ds.authConfig
      ? await CredentialsManager.decryptAuthConfig(ds.authConfig as Record<string, unknown>)
      : null
    const token = authConfig && typeof authConfig.token === 'string' ? authConfig.token : ''
    if (!token) {
      throw new Error('statsDataSource has no bearer token (auth.type must be "bearer")')
    }

    const currency = typeof cfg.currency === 'string' && cfg.currency ? cfg.currency : null

    const client = new MacroV2Client({
      baseUrl,
      token,
      timeoutMs: typeof cfg.timeout === 'number' ? cfg.timeout : undefined,
    })

    const complexIds = this.extractComplexIds(items)
    if (complexIds.length === 0) return {}

    const rawStats = await client.fetchComplexStats(complexIds)

    // Индексируем ответ по id, чтобы быстро смаппить к items
    const byComplexId = new Map<number, typeof rawStats[number]>()
    for (const r of rawStats) byComplexId.set(r.id, r)

    const result: Record<string, ProjectStats> = {}
    for (const item of items) {
      const itemId = String(item.id || item._id || '')
      if (!itemId) continue
      const complexId = Number(item.id)
      if (!Number.isFinite(complexId)) continue
      const raw = byComplexId.get(complexId)
      if (!raw) continue
      result[itemId] = mapComplexStats(raw, currency)
    }

    // Сохраняем в кеш
    collection.cachedStatsData = result
    collection.cachedStatsAt = new Date()
    try {
      await this.collectionRepository.save(collection)
    } catch (saveErr: any) {
      logger.warn(`failed to persist cachedStatsData: ${saveErr.message}`)
    }

    return result
  }

  /**
   * Извлекает массив complexIds (= item.id) из items коллекции.
   * Структура коллекции "Проекты": item.id = id ЖК в Macro (v1 и v2 разделяют id).
   */
  private extractComplexIds(items: any[]): number[] {
    const out: number[] = []
    for (const item of items) {
      const n = Number(item?.id)
      if (Number.isFinite(n) && n > 0) out.push(n)
    }
    return out
  }

  /**
   * Инжектирует контекст элемента коллекции в DataConfig
   * Проблема 2: фильтр только к binding'ам с тем же dataSourceId
   */
  private injectCollectionContext(
    templateConfig: PageDataConfig | undefined,
    collection: Collection,
    item: any,
    itemId: string
  ): PageDataConfig | undefined {
    if (!templateConfig) return undefined

    // Глубокая копия, чтобы не мутировать шаблонный config
    const config: PageDataConfig = JSON.parse(JSON.stringify(templateConfig))

    // Поле API, по которому идентифицируем элемент. Default 'id' (для legacy записей в БД,
    // где колонка может быть NULL/undefined).
    const apiIdField = collection.apiIdField || 'id'

    // Добавляем _collectionItem и _collectionFilter в конфиг
    // Они будут доступны в runtime JS
    ;(config as any)._collectionItem = item
    ;(config as any)._collectionFilter = {
      field: apiIdField,
      operator: 'eq',
      value: itemId,
    }
    // Проблема 4: кеш и polling настройки
    ;(config as any)._collectionCacheTtl = collection.cacheTtl
    ;(config as any)._collectionPollInterval = collection.pollInterval

    // Проблема 2: добавить фильтр ТОЛЬКО к binding'ам с тем же dataSourceId
    for (const binding of config.bindings) {
      const matchingDs = config.dataSources.find(ds => ds.alias === binding.sourceAlias)
      if (matchingDs && matchingDs.dataSourceId === collection.dataSourceId) {
        if (!binding.dynamicFilters) {
          binding.dynamicFilters = []
        }
        // Добавляем static collection filter (не динамический — значение известно при деплое)
        ;(binding as any)._collectionFilter = {
          field: apiIdField,
          operator: 'eq',
          value: itemId,
        }
      }
    }

    return config
  }

  /**
   * Строит FetchConfig + AuthConfig для дополнительного источника, резолвя плейсхолдеры
   * {{item.field}} и {{extract.name}} в path/body/queryParams. Вынесено для переиспользования
   * в fetchAdditionalSourceForItem и previewCollectionRequest.
   */
  private async buildAdditionalSourceFetchConfig(
    source: AdditionalSourceRequestDef,
    item: any,
    extractedValues: Record<string, unknown>
  ): Promise<{ fetchConfig: FetchConfig; authConfig?: AuthConfig }> {
    const ds = await this.dataSourceRepository.findOne({ where: { id: source.dataSourceId } })
    if (!ds) throw new Error(`DataSource not found: ${source.dataSourceId}`)

    const config = ds.config as any
    if (!config?.url) throw new Error(`DataSource has no URL: ${source.dataSourceId}`)

    let authConfig: AuthConfig | undefined
    if (ds.authConfig) {
      authConfig = (await CredentialsManager.decryptAuthConfig(
        ds.authConfig as Record<string, unknown>
      )) as unknown as AuthConfig
    }

    const fetchConfig: FetchConfig = {
      type: ds.type as FetchConfig['type'],
      ...config,
    }

    const ec = source.endpointConfig
    if (ec) {
      if (ec.path) {
        const resolvedPath = this.resolvePlaceholders(ec.path, item, extractedValues)
        const base = (config.url as string).replace(/\/+$/, '')
        const suffix = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`
        fetchConfig.url = `${base}${suffix}`
      }
      if (ec.method) fetchConfig.method = ec.method as FetchConfig['method']
      if (ec.headers) fetchConfig.headers = { ...(fetchConfig.headers || {}), ...ec.headers }
      if (ec.queryParams) {
        const resolved: Record<string, string> = {}
        for (const [k, v] of Object.entries(ec.queryParams as Record<string, string>)) {
          resolved[k] = this.resolvePlaceholders(v, item, extractedValues)
        }
        fetchConfig.queryParams = { ...(fetchConfig.queryParams || {}), ...resolved }
      }
      if (ec.body !== undefined) {
        fetchConfig.body = this.resolvePlaceholders(ec.body, item, extractedValues)
        if (ec.bodyFormat) fetchConfig.bodyFormat = ec.bodyFormat as FetchConfig['bodyFormat']
      }
    }

    return { fetchConfig, authConfig }
  }

  /**
   * Фетчит данные одного дополнительного источника для конкретного элемента коллекции.
   * Плейсхолдеры {{item.field}} в path/body/queryParams подставляются значениями из item.
   */
  private async fetchAdditionalSourceForItem(
    source: AdditionalSourceRequestDef,
    item: any,
    extractedValues: Record<string, unknown> = {}
  ): Promise<unknown> {
    const { fetchConfig, authConfig } = await this.buildAdditionalSourceFetchConfig(
      source,
      item,
      extractedValues
    )

    const result = await secureDataSourceService.fetchData(fetchConfig, authConfig)
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to fetch additional source data')
    }

    const data = result.data
    if (source.arrayPath) {
      return this.getNestedValue(data, source.arrayPath)
    }
    return data
  }

  /**
   * Подставляет плейсхолдеры в строке:
   *   {{item.field}}    — значение из текущего элемента коллекции
   *   {{extract.name}}  — значение, извлечённое из предыдущего additionalSource / mainExtract
   *
   * Если значение — массив или объект, подставляется как JSON (без кавычек вокруг плейсхолдера).
   * Это позволяет писать в body: {"ids": {{extract.complexIds}}}
   */
  private resolvePlaceholders(
    template: string,
    item: any,
    extractedValues: Record<string, unknown> = {}
  ): string {
    return template.replace(/\{\{(item|extract)\.([^}]+)\}\}/g, (_, prefix, path) => {
      const val = prefix === 'extract'
        ? extractedValues[path]
        : this.getNestedValue(item, path)
      if (val === undefined || val === null) return ''
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    })
  }

  /**
   * Извлекает значение по пути с поддержкой синтаксиса array mapping:
   *   "data[].id"   → собирает поле id из каждого элемента массива data → [id1, id2, ...]
   *   "[].id"       → использует корень как массив
   *   "data"        → обычная dot-notation (делегирует getNestedValue)
   */
  private resolveExtractPath(obj: any, path: string): unknown {
    const arrayMapMatch = path.match(/^([^[]*)\[\]\.?(.*)$/)
    if (arrayMapMatch) {
      const [, arrayPath, fieldPath] = arrayMapMatch
      const arr = arrayPath ? this.getNestedValue(obj, arrayPath) : obj
      if (!Array.isArray(arr)) return undefined
      return fieldPath
        ? arr.map(item => this.getNestedValue(item, fieldPath))
        : arr
    }
    return this.getNestedValue(obj, path)
  }

  /**
   * JOIN ответа доп.источника с текущим элементом коллекции.
   * Если задан source.join и data — массив, возвращает единственный элемент, где
   * data[i][sourceField] === item[itemField] (строковое сравнение), иначе null.
   * Без join или для не-массива возвращает data без изменений.
   */
  private applyAdditionalSourceJoin(data: unknown, source: AdditionalSourceDef, item: any): unknown {
    if (!source.join || !Array.isArray(data)) return data
    const { itemField, sourceField } = source.join
    const itemVal = this.getNestedValue(item, itemField)
    const match = data.find(el => String(this.getNestedValue(el, sourceField)) === String(itemVal))
    return match ?? null
  }

  /**
   * Рекурсивно подставляет данные элемента коллекции в дерево структуры страницы.
   * Заменяет маркеры {{item.fieldName}} в content, attributes, styles.
   * Поддерживает вложенные поля через dot notation: {{item.address.city}}.
   *
   * Перед обходом обогащает item производным полем `__allFiles` —
   * это flatMap всех `houses[].files[]` (если есть). Используется как универсальный
   * источник медиа-файлов для шаблона (Hero берёт [0], галерея — slice(1)).
   *
   * Поддерживает повторители (repeater) через служебное поле node._repeat:
   *   { source: 'item.__allFiles', offset?: number, limit?: number }
   * Первый ребёнок такого узла используется как item-template; остальные children
   * игнорируются. Внутри template-копии доступен плейсхолдер `{{$.field}}` —
   * текущий элемент массива.
   */
  private substituteItemData(structure: any, item: any): any {
    const enrichedItem = this.enrichItemForCollections(item)
    const node = JSON.parse(JSON.stringify(structure))
    this.substituteNode(node, { item: enrichedItem, $: enrichedItem })
    return node
  }

  /**
   * Добавляет к item производные поля для шаблонов: __allFiles.
   * Не мутирует исходный объект.
   *
   * Структура MacroCRM: item.houses[].files[] — это массив папок/категорий
   * (например "Галерея", "Документы"), и внутри каждой папки лежит свой
   * .files[] с настоящими файлами (file_url, file_name, is_title и т.д.).
   * Делаем плоский список реальных файлов со всех домов и всех папок.
   * Файлы с `is_title === 1` поднимаются в начало (чтобы Hero брал именно их).
   */
  private enrichItemForCollections(item: any): any {
    if (!item || typeof item !== 'object') return item
    const houses = Array.isArray(item.houses) ? item.houses : []
    const allFiles: any[] = []
    for (const h of houses) {
      if (!h || !Array.isArray(h.files)) continue
      for (const folder of h.files) {
        if (folder && Array.isArray(folder.files)) {
          for (const f of folder.files) {
            if (f && typeof f === 'object') allFiles.push(f)
          }
        } else if (folder && typeof folder === 'object' && (folder.file_url || folder.url)) {
          // Fallback: если в API окажется плоская структура (h.files = массив файлов)
          allFiles.push(folder)
        }
      }
    }
    // Дедупликация: одинаковый файл может быть прикреплён к нескольким домам/папкам,
    // а в CRM Macro один и тот же файл часто загружается несколько раз — каждая
    // загрузка получает свой URL и id, но имя файла совпадает.
    //
    // Ключ дедупа (внутри одного item): file_name (если есть) → file_url → url.
    // file_name приоритетнее URL, потому что разные URL для одного файла —
    // основной кейс мусора. Допускаем риск ложного срабатывания (два разных
    // файла с одинаковым именем в одном проекте), он крайне маловероятен.
    //
    // При коллизии оставляем копию с is_title=1 (она важна для Hero).
    const seen = new Map<string, number>() // key -> index in deduped
    const deduped: any[] = []
    for (const f of allFiles) {
      const key = f?.file_name || f?.file_url || f?.url
      if (!key) { deduped.push(f); continue }
      const idx = seen.get(key)
      if (idx === undefined) {
        seen.set(key, deduped.length)
        deduped.push(f)
      } else if (f?.is_title === 1 && deduped[idx]?.is_title !== 1) {
        deduped[idx] = f
      }
    }
    // Сортируем: is_title=1 первыми, остальные сохраняют порядок API (stable sort)
    deduped.sort((a, b) => (b?.is_title ? 1 : 0) - (a?.is_title ? 1 : 0))
    return { ...item, __allFiles: deduped }
  }

  private substituteNode(node: any, ctx: { item: any; $: any }): void {
    if (!node || typeof node !== 'object') return

    // Repeater: разворачиваем children по массиву из source
    if (node._repeat && typeof node._repeat === 'object' && typeof node._repeat.source === 'string') {
      this.expandRepeaterNode(node, ctx)
      return
    }

    // Подстановка в content
    if (typeof node.content === 'string') {
      node.content = this.replaceTemplateVars(node.content, ctx)
    }

    // Подстановка в attributes (src, href, alt, title, etc.)
    if (node.attributes && typeof node.attributes === 'object') {
      for (const key of Object.keys(node.attributes)) {
        if (typeof node.attributes[key] === 'string') {
          node.attributes[key] = this.replaceTemplateVars(node.attributes[key], ctx)
        }
      }
    }

    // Подстановка в styles.properties (backgroundImage url и т.д.)
    if (node.styles?.properties && typeof node.styles.properties === 'object') {
      for (const key of Object.keys(node.styles.properties)) {
        if (typeof node.styles.properties[key] === 'string') {
          node.styles.properties[key] = this.replaceTemplateVars(node.styles.properties[key], ctx)
        }
      }
    }

    // Рекурсия по children
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        this.substituteNode(child, ctx)
      }
    }

    // Рекурсия по variations.specificChildren
    if (node.variations && typeof node.variations === 'object') {
      for (const variation of Object.values(node.variations) as any[]) {
        if (Array.isArray(variation?.specificChildren)) {
          for (const child of variation.specificChildren) {
            this.substituteNode(child, ctx)
          }
        }
      }
    }
  }

  /**
   * Разворачивает _repeat-узел: берёт первого ребёнка как шаблон,
   * клонирует его N раз по массиву из source с учётом offset/limit,
   * подставляя в каждой копии {{$.field}}.
   */
  private expandRepeaterNode(node: any, ctx: { item: any; $: any }): void {
    const cfg = node._repeat as { source: string; offset?: number; limit?: number }
    delete node._repeat

    // source может начинаться с 'item.' или '$.'
    let arr: any
    if (cfg.source.startsWith('item.')) {
      arr = this.getNestedValue(ctx.item, cfg.source.slice(5))
    } else if (cfg.source.startsWith('$.')) {
      arr = this.getNestedValue(ctx.$, cfg.source.slice(2))
    } else {
      arr = this.getNestedValue(ctx.item, cfg.source)
    }

    if (!Array.isArray(arr)) {
      node.children = []
      return
    }

    const offset = Math.max(0, cfg.offset ?? 0)
    const sliced = arr.slice(offset, cfg.limit != null ? offset + cfg.limit : undefined)

    const template = Array.isArray(node.children) && node.children.length > 0 ? node.children[0] : null
    if (!template || sliced.length === 0) {
      node.children = []
      return
    }

    const newChildren: any[] = []
    for (const arrItem of sliced) {
      const clone = JSON.parse(JSON.stringify(template))
      this.substituteNode(clone, { item: ctx.item, $: arrItem })
      newChildren.push(clone)
    }
    node.children = newChildren
  }

  private replaceTemplateVars(str: string, ctx: { item: any; $: any }): string {
    // {{item.field.subfield}} — берёт из item
    // {{$.field}} — берёт из текущего элемента массива (внутри _repeat)
    return str.replace(/\{\{(item|\$)\.([a-zA-Z0-9_.]+)\}\}/g, (_match, scope: string, fieldPath: string) => {
      const root = scope === '$' ? ctx.$ : ctx.item
      const value = this.getNestedValue(root, fieldPath)
      return value !== undefined && value !== null ? String(value) : ''
    })
  }

  /**
   * Транслитерация и slugify строки для URL-безопасного имени файла.
   * Поддерживает кириллицу, латиницу, цифры.
   */
  private slugify(str: string): string {
    const cyrillic: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
      з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
      п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
      ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
      я: 'ya',
    }
    return str
      .toLowerCase()
      .split('')
      .map(ch => cyrillic[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100)
  }

  /**
   * Auto-links: для repeater-биндингов, чей dataSource совпадает с коллекцией,
   * добавляем collectionLink (basePath + slugField), чтобы runtime генерировал href.
   */
  private injectCollectionLinks(config: PageDataConfig, collections: Collection[]): void {
    if (!collections.length) return

    // Строим Map dataSourceId -> collection (первая подходящая)
    const dsToCollection = new Map<string, Collection>()
    for (const col of collections) {
      if (!dsToCollection.has(col.dataSourceId)) {
        dsToCollection.set(col.dataSourceId, col)
      }
    }

    for (const binding of config.bindings) {
      if (binding.type !== 'repeater' || !binding.repeaterConfig) continue

      // Найти dataSource alias -> dataSourceId
      const ds = config.dataSources.find(d => d.alias === binding.sourceAlias)
      if (!ds) continue

      const collection = dsToCollection.get(ds.dataSourceId)
      if (!collection) continue

      // Инжектируем collectionLink
      const linkSelector = (binding.repeaterConfig as any)._collectionLinkSelector || undefined
      ;(binding.repeaterConfig as any).collectionLink = {
        basePath: collection.basePath.replace(/\/+$/, ''),
        slugField: collection.slugField,
        titleField: collection.titleField,
        ...(linkSelector && { linkSelector }),
      }
      delete (binding.repeaterConfig as any)._collectionLinkSelector
    }
  }

  /**
   * Получает значение по вложенному пути (dot notation)
   */
  private getNestedValue(obj: any, dotPath: string): any {
    if (!obj || !dotPath) return undefined
    return dotPath.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Получает список опубликованных файлов
   */
  getDeployedFiles(): string[] {
    if (!fs.existsSync(PUBLIC_DIR)) {
      return []
    }
    return fs.readdirSync(PUBLIC_DIR).filter(f => f.endsWith('.html'))
  }

  /**
   * Удаляет опубликованный файл
   */
  async undeployPage(slug: string, siteSlug?: string): Promise<boolean> {
    const dir = siteSlug ? path.join(PUBLIC_DIR, 'sites', siteSlug) : PUBLIC_DIR
    const isHome = slug === 'index' || slug === 'home'
    let removed = false

    if (isHome) {
      const filePath = path.join(dir, 'index.html')
      if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); removed = true }
    } else {
      // Директорный формат: <slug>/index.html
      const pageDir = path.join(dir, slug)
      if (fs.existsSync(pageDir)) { fs.rmSync(pageDir, { recursive: true, force: true }); removed = true }
      // Legacy плоский файл <slug>.html
      const legacy = path.join(dir, `${slug}.html`)
      if (fs.existsSync(legacy)) { fs.unlinkSync(legacy); removed = true }
    }
    return removed
  }

  /**
   * Удаляет всю директорию развёртывания сайта
   */
  cleanupSiteDir(siteSlug: string): boolean {
    if (!siteSlug) {
      // Root site — only clean generated HTML files, not static assets
      const htmlFiles = fs.readdirSync(PUBLIC_DIR).filter(f => f.endsWith('.html') && f !== 'index.html')
      htmlFiles.forEach(f => fs.unlinkSync(path.join(PUBLIC_DIR, f)))
      return htmlFiles.length > 0
    }
    const dir = path.join(PUBLIC_DIR, 'sites', siteSlug)
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      return true
    }
    return false
  }

  /**
   * Создаёт директорию если не существует
   */
  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  /**
   * Удаляет все .html файлы из директории (не рекурсивно)
   */
  private cleanHtmlFiles(dir: string): void {
    if (!fs.existsSync(dir)) return
    const htmlFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'))
    htmlFiles.forEach(f => fs.unlinkSync(path.join(dir, f)))
  }

  /**
   * Разрешает navigation items: pageId → href URL
   */
  private resolveNavigation(navItems: any[] | undefined, pages: Page[], homepageId?: string | null): ResolvedNavItem[] {
    if (!navItems || navItems.length === 0) return []

    const pageSlugMap = new Map(pages.map(p => [p.id, p.slug]))

    const resolve = (items: any[]): ResolvedNavItem[] =>
      items.map(item => {
        let href = item.url || '#'
        if (item.pageId) {
          const slug = pageSlugMap.get(item.pageId)
          if (slug !== undefined) {
            // Домашняя страница (выбранная в настройках сайта или legacy index/home) → '/'
            const isHome = (!!homepageId && item.pageId === homepageId) || slug === 'home' || slug === 'index'
            href = isHome ? '/' : `/${slug}`
          }
        }
        return {
          label: item.label || '',
          href,
          openInNewTab: item.openInNewTab || false,
          children: item.children ? resolve(item.children) : undefined,
        }
      })

    return resolve(navItems)
  }

  /**
   * Рекурсивно собирает все blockId и linkedBlockId из структуры
   */
  private collectBlockIdsWithLinks(structure: any): { blockIds: string[], linkedBlockIds: string[] } {
    const blockIds: string[] = []
    const linkedBlockIds: string[] = []
    
    const collect = (node: any) => {
      if (!node) return
      
      if (node.id) {
        blockIds.push(node.id)
      }
      
      // Если блок имеет linkedBlockId - добавляем его в отдельный массив
      if (node.metadata?.linkedBlockId) {
        linkedBlockIds.push(node.metadata.linkedBlockId)
      }
      
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(collect)
      }
    }
    
    collect(structure)
    return { blockIds, linkedBlockIds }
  }

  /**
   * Загружает активные привязки для набора blockId/linkedBlockId страницы.
   * Матчит и привязки с pageId, и привязки без pageId (legacy / library-block).
   * При дублях blockId приоритет у привязки с заданным pageId.
   *
   * Единый источник правды для поиска активных привязок страницы.
   */
  private async queryActiveBindings(
    blockIds: string[],
    linkedBlockIds: string[],
    pageId: string
  ): Promise<DataBinding[]> {
    if (!blockIds.length) return []

    const hasLinked = linkedBlockIds.length > 0
    const whereClause =
      'binding.isActive = :isActive AND (' +
      '(binding.pageId = :pageId AND binding.blockId IN (:...blockIds))' +
      ' OR (binding.blockId IN (:...blockIds) AND binding.pageId IS NULL)' +
      (hasLinked
        ? ' OR (binding.blockId IN (:...linkedBlockIds) AND binding.pageId IS NULL)' +
          ' OR (binding.pageId = :pageId AND binding.blockId IN (:...linkedBlockIds))'
        : '') +
      ')'
    const queryParams: Record<string, unknown> = { pageId, blockIds, isActive: true }
    if (hasLinked) queryParams.linkedBlockIds = linkedBlockIds

    const bindings = await this.dataBindingRepository
      .createQueryBuilder('binding')
      .leftJoinAndSelect('binding.dataSource', 'dataSource')
      .where(whereClause, queryParams)
      .orderBy('binding.priority', 'ASC')
      .getMany()

    // Дедуп по blockId: привязка с pageId имеет приоритет над привязкой без pageId.
    const byBlockId = new Map<string, DataBinding>()
    for (const binding of bindings) {
      const existing = byBlockId.get(binding.blockId)
      if (!existing || (binding.pageId && !existing.pageId)) {
        byBlockId.set(binding.blockId, binding)
      }
    }
    return Array.from(byBlockId.values())
  }

  /**
   * Возвращает input-привязки страницы с читаемыми метаданными — для пикера в редакторе.
   * Использует ту же логику разрешения структуры и поиска привязок, что и деплой.
   */
  async getPageInputBindings(pageId: string): Promise<PageInputBinding[]> {
    if (!pageId) return []
    const page = await this.pageRepository.findOne({ where: { id: pageId } })
    if (!page?.structure) return []

    let structure = await linkedBlocksService.updateLinkedBlocks(page.structure)
    structure = await this.injectLibraryTemplates(structure, page.id)

    const { blockIds, linkedBlockIds } = this.collectBlockIdsWithLinks(structure)
    const bindings = await this.queryActiveBindings(blockIds, linkedBlockIds, pageId)

    return bindings
      .filter(b => b.bindingType === 'input')
      .map(b => {
        const cfg = b.config as any
        const ep = cfg?.inputConfig?.endpoint
        return {
          id: b.id,
          blockId: b.blockId,
          dataSourceId: b.dataSourceId,
          dataSourceName: b.dataSource?.name,
          method: ep?.method,
          path: ep?.path,
          mode: cfg?.inputConfig?.mode,
        }
      })
  }

  /**
   * Вшивает данные в КОНКРЕТНУЮ привязку (по bindingId) как page-variable.
   * Целевой привязке назначается уникальный alias `__add_<bindingId>`, чтобы не конфликтовать
   * с другими привязками к тому же DataSource. Runtime ищет `_dataStore[bindingId] || [alias]`,
   * поэтому привязка подхватит вшитые данные без изменений рантайма.
   */
  private injectAdditionalSourcesByBinding(
    config: PageDataConfig,
    additionalData: Array<{ targetBindingId: string; dataSourceId: string; data: unknown }>
  ): void {
    for (const { targetBindingId, dataSourceId, data } of additionalData) {
      const binding = config.bindings.find(b => (b as any).bindingId === targetBindingId)
      if (!binding) {
        logger.warn(`injectAdditionalSourcesByBinding: target binding ${targetBindingId} not found — skipped`)
        continue
      }
      const uniqueAlias = `__add_${targetBindingId}`
      ;(binding as any).sourceAlias = uniqueAlias

      const existingVarIdx = config.variables.findIndex(v => v.name === uniqueAlias)
      if (existingVarIdx >= 0) {
        config.variables[existingVarIdx].defaultValue = data
      } else {
        config.variables.push({ name: uniqueAlias, type: 'object', defaultValue: data })
      }

      const existingDsIdx = config.dataSources.findIndex(ds => ds.alias === uniqueAlias)
      if (existingDsIdx >= 0) {
        config.dataSources[existingDsIdx].type = 'page-variable'
        config.dataSources[existingDsIdx].variableName = uniqueAlias
        config.dataSources[existingDsIdx].dataSourceId = dataSourceId
      } else {
        config.dataSources.push({
          alias: uniqueAlias,
          dataSourceId,
          loadStrategy: 'pageLoad',
          cacheEnabled: false,
          type: 'page-variable',
          variableName: uniqueAlias,
        })
      }
    }
  }

  /**
   * Фетчит доп.источники страницы (с extract-цепочкой) и вшивает их в целевые привязки.
   * Мутирует переданный dataConfig. Возвращает ошибки (не бросает).
   */
  private async applyPageAdditionalSources(
    config: PageDataConfig,
    sources: PageAdditionalSourceDef[]
  ): Promise<string[]> {
    const errors: string[] = []
    const additionalData: Array<{ targetBindingId: string; dataSourceId: string; data: unknown }> = []
    const extractedValues: Record<string, unknown> = {}

    for (const source of sources) {
      try {
        // У страницы нет «item» — плейсхолдеры {{item.*}} резолвятся в пусто, доступны {{extract.*}}.
        const data = await this.fetchAdditionalSourceForItem(source, {}, extractedValues)
        if (source.extract) {
          for (const [name, dotPath] of Object.entries(source.extract)) {
            extractedValues[name] = this.resolveExtractPath(data, dotPath)
          }
        }
        additionalData.push({ targetBindingId: source.targetBindingId, dataSourceId: source.dataSourceId, data })
      } catch (err: any) {
        errors.push(`Page additional source (binding ${source.targetBindingId}) failed: ${err.message}`)
        additionalData.push({ targetBindingId: source.targetBindingId, dataSourceId: source.dataSourceId, data: null })
      }
    }

    this.injectAdditionalSourcesByBinding(config, additionalData)
    return errors
  }

  /**
   * Превью цепочки доп.запросов страницы (реальные вызовы). Не пишет файлов, не деплоит.
   */
  async previewPageRequest(pageId: string): Promise<PageRequestPreview> {
    const page = await this.pageRepository.findOne({ where: { id: pageId } })
    if (!page) throw new Error('Page not found')

    const steps: CollectionRequestPreviewStep[] = []
    const finalDataStore: Record<string, unknown> = {}
    const warnings: string[] = []
    const sources = page.additionalSources || []
    if (!sources.length) return { steps, finalDataStore, warnings }

    const bindings = await this.getPageInputBindings(pageId)
    const bindingLabel = (id: string): string | null => {
      const b = bindings.find(x => x.id === id)
      if (!b) return null
      const ep = [b.method, b.path].filter(Boolean).join(' ')
      return `${b.dataSourceName || 'DataSource'}${ep ? ' · ' + ep : ''}`
    }

    const extractedValues: Record<string, unknown> = {}
    for (const source of sources) {
      const label = source.targetBindingId ? bindingLabel(source.targetBindingId) : null
      const stepLabel = label || '(привязка не выбрана)'
      const step: CollectionRequestPreviewStep = { kind: 'source', label: stepLabel, request: { method: 'GET', url: '' } }

      if (!source.targetBindingId) {
        warnings.push('Один из доп.источников: не выбрана целевая привязка.')
      } else if (!label) {
        warnings.push(`Целевая привязка ${source.targetBindingId.slice(0, 8)}… не найдена на странице (возможно, удалена).`)
      }

      try {
        const { fetchConfig, authConfig } = await this.buildAdditionalSourceFetchConfig(source, {}, extractedValues)
        step.request = {
          method: fetchConfig.method || 'GET',
          url: fetchConfig.url || '',
          body: fetchConfig.body,
          queryParams: fetchConfig.queryParams,
        }
        const result = await secureDataSourceService.fetchData(fetchConfig, authConfig)
        if (!result.success) {
          step.error = result.error?.message || 'Failed to fetch additional source data'
          steps.push(step)
          continue
        }
        const data = source.arrayPath ? this.getNestedValue(result.data, source.arrayPath) : result.data
        step.response = data
        if (source.extract) {
          const extract: Record<string, unknown> = {}
          for (const [name, dotPath] of Object.entries(source.extract)) {
            const val = this.resolveExtractPath(data, dotPath)
            extract[name] = val
            extractedValues[name] = val
          }
          step.extract = extract
        }
        let key = stepLabel
        if (key in finalDataStore) key = `${key} (${source.targetBindingId.slice(0, 8)})`
        finalDataStore[key] = data
      } catch (err: any) {
        step.error = err.message
      }
      steps.push(step)
    }

    return { steps, finalDataStore, warnings }
  }

  /**
   * Строит маппинг linkedBlockId -> реальный ID на странице
   */
  private buildLinkedBlockMapping(structure: any): Record<string, string> {
    const mapping: Record<string, string> = {}
    
    const collect = (node: any) => {
      if (!node) return
      
      // Если блок имеет linkedBlockId, создаем маппинг
      if (node.id && node.metadata?.linkedBlockId) {
        mapping[node.metadata.linkedBlockId] = node.id
      }
      
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(collect)
      }
    }
    
    collect(structure)
    return mapping
  }

  /**
   * Находит template блок внутри контейнера по linkedBlockId (рекурсивно во всех потомках)
   */
  private findTemplateInContainer(structure: any, containerId: string, libraryTemplateId?: string): string | null {
    let templateId: string | null = null
    
    // Рекурсивный поиск блока по linkedBlockId
    const findByLinkedId = (node: any, targetLinkedId: string): string | null => {
      if (!node) return null
      
      if (node.metadata?.linkedBlockId === targetLinkedId && node.id) {
        return node.id
      }
      
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          const found = findByLinkedId(child, targetLinkedId)
          if (found) return found
        }
      }
      
      return null
    }
    
    const findContainer = (node: any): boolean => {
      if (!node) return false
      
      if (node.id === containerId) {
        // Нашли контейнер
        if (libraryTemplateId) {
          // Рекурсивно ищем блок с metadata.linkedBlockId === libraryTemplateId
          templateId = findByLinkedId(node, libraryTemplateId)
          if (templateId) {
            logger.debug(`Found template by linkedBlockId ${libraryTemplateId} -> ${templateId}`)
            return true
          }
          logger.warn(`Template with linkedBlockId ${libraryTemplateId} not found in container ${containerId}`)
        }
        
        // Fallback: ищем первый блок с isTemplate=true или берём первого ребёнка
        if (node.children && Array.isArray(node.children)) {
          const templateChild = node.children.find((child: any) => child.metadata?.isTemplate === true)
          if (templateChild?.id) {
            templateId = templateChild.id
            logger.debug(`Using template-marked child: ${templateId}`)
            return true
          }
          
          const firstChild = node.children[0]
          if (firstChild?.id) {
            templateId = firstChild.id
            logger.debug(`Using first child as fallback template: ${templateId}`)
            return true
          }
        }
        return false
      }
      
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          if (findContainer(child)) return true
        }
      }
      
      return false
    }
    
    findContainer(structure)
    return templateId
  }

  /**
   * Injects library template structures into containers with repeater bindings
   */
  private async injectLibraryTemplates(structure: any, pageId: string): Promise<any> {
    // We need to load the template blocks from the database
    // Get all library template IDs from raw bindings before they were transformed

    const bindings = await this.dataBindingRepository
      .createQueryBuilder('binding')
      .where('binding.pageId = :pageId', { pageId })
      .andWhere('binding.isActive = :isActive', { isActive: true })
      .getMany()

    // Find bindings that use library templates
    const templateIds = new Set<string>()
    for (const binding of bindings) {
      const config = binding.config as any
      // Check both libraryTemplateId (old) and templateId (new) for compatibility
      const templateId = config.inputConfig?.libraryTemplateId || config.inputConfig?.templateId
      if (templateId) {
        templateIds.add(templateId)
      }
    }

    if (templateIds.size === 0) {
      return structure
    }

    // Load all template blocks from database
    const templates = await this.blockRepository.findByIds(Array.from(templateIds))
    const templateMap = new Map<string, any>()
    for (const template of templates) {
      templateMap.set(template.id, template.structure)
      logger.debug(`Loaded library template: ${template.id} (${template.name})`)
    }

    // Recursively inject templates into containers (BOTTOM-UP: children first, then parent)
    const injectTemplates = (node: any): any => {
      if (!node) return node

      // СНАЧАЛА обрабатываем детей (bottom-up), чтобы вложенные контейнеры получили template первыми
      if (node.children && Array.isArray(node.children)) {
        node = { ...node, children: node.children.map(injectTemplates) }
      }

      // Traverse viewport-specific children (responsive variations)
      if (node.variations) {
        const updatedVariations: any = { ...node.variations }
        for (const [bpId, variation] of Object.entries(updatedVariations) as [string, any][]) {
          if (variation.specificChildren && Array.isArray(variation.specificChildren)) {
            updatedVariations[bpId] = {
              ...variation,
              specificChildren: variation.specificChildren.map(injectTemplates)
            }
          }
        }
        node = { ...node, variations: updatedVariations }
      }

      // Check if this node has a binding with libraryTemplateId
      const binding = bindings.find((b: any) => {
        const config = b.config as any
        // Match by blockId or by linkedBlockId
        return b.blockId === node.id || b.blockId === node.metadata?.linkedBlockId
      })
      
      if (binding) {
        const config = binding.config as any
        // Check both libraryTemplateId (old) and templateId (new) for compatibility
        const libraryTemplateId = config.inputConfig?.libraryTemplateId || config.inputConfig?.templateId
        
        if (libraryTemplateId) {
          const templateStructure = templateMap.get(libraryTemplateId)
          
          if (templateStructure) {
            // Clone the node to avoid mutation
            const updatedNode = { ...node }
            
            // Add template as the first child if children is empty or doesn't contain the template
            if (!updatedNode.children) {
              updatedNode.children = []
            }
            
            // Рекурсивная проверка: template может быть глубже (внутри вложенного контейнера)
            const hasTemplateRecursive = (n: any, targetLinkedId: string): boolean => {
              if (!n) return false
              if (n.metadata?.linkedBlockId === targetLinkedId) return true
              if (n.children && Array.isArray(n.children)) {
                return n.children.some((child: any) => hasTemplateRecursive(child, targetLinkedId))
              }
              return false
            }
            
            // Check if template already exists anywhere in descendants (by linkedBlockId)
            const templateExists = updatedNode.children.some(
              (child: any) => hasTemplateRecursive(child, libraryTemplateId)
            )
            
            if (!templateExists) {
              logger.debug(`Injecting template ${libraryTemplateId} into container ${node.id}`)
              // Clone template structure and mark it with linkedBlockId
              const templateWithMeta = {
                ...templateStructure,
                metadata: {
                  ...templateStructure.metadata,
                  linkedBlockId: libraryTemplateId
                }
              }
              updatedNode.children = [templateWithMeta, ...updatedNode.children]
            } else {
              logger.debug(`Template ${libraryTemplateId} already exists in descendants of ${node.id}, skipping injection`)
            }
            
            node = updatedNode
          } else {
            logger.warn(`Template ${libraryTemplateId} not found in database`)
          }
        }
      }

      return node
    }

    return injectTemplates(structure)
  }

  /**
   * Генерирует HTML-страницы для всех языковых версий
   */
  private async deployPageTranslations(
    page: Page,
    structure: any,
    dataConfig: PageDataConfig | undefined,
    deployedPages: string[],
    errors: string[],
    siteDir?: string,
    isHome: boolean = page.slug === 'index' || page.slug === 'home',
  ): Promise<void> {
    const deployDir = siteDir || PUBLIC_DIR
    try {
      const languages = await languageService.getActive()
      const defaultLang = languages.find(l => l.isDefault)
      const translationLocales = await translationService.getPageLocales(page.id)

      if (translationLocales.length === 0) return

      // Build available languages list for the switcher widget
      const availableLanguages = languages
        .filter(l => l.isActive && (l.isDefault || translationLocales.includes(l.code)))
        .map(l => ({
          code: l.code,
          name: l.nativeName,
          flag: l.flag || '🌐',
          isDefault: l.isDefault,
          direction: l.direction,
        }))

      for (const lang of languages) {
        // Skip default language — already deployed as the main file
        if (lang.isDefault) continue
        // Only deploy if we have translations for this locale
        if (!translationLocales.includes(lang.code)) continue

        try {
          const translationMap = await translationService.getTranslationMap(page.id, lang.code)
          const { structure: translatedStructure, metadata: translatedMetadata } = 
            translationService.applyTranslations(
              structure, 
              translationMap, 
              page.metadata || { title: page.name, description: '', keywords: [] }
            )

          // Generate localized HTML with lang attribute and language switcher
          const localizedHtml = await this.generatePageHtml(translatedStructure, {
            metadata: translatedMetadata,
            slug: isHome ? 'index' : page.slug,
            dataConfig,
            lang: lang.code,
            direction: lang.direction,
            availableLanguages,
            ...this.siteAssetOptions(page.site),
          })

          // Create language directory: /en/, /kz/, etc.
          const langDir = path.join(deployDir, lang.code)
          this.ensureDirectoryExists(langDir)

          // Чистые URL без .html: домашняя → <lang>/index.html, остальные → <lang>/<slug>/index.html
          const relPath = this.pageRelPath(page.slug, isHome)
          const filePath = path.join(langDir, relPath)

          this.ensureDirectoryExists(path.dirname(filePath))
          fs.writeFileSync(filePath, localizedHtml, 'utf-8')
          deployedPages.push(`${lang.code}/${relPath}`)
          logger.info(`Deployed [${lang.code}]: ${lang.code}/${relPath}`)
        } catch (err: any) {
          errors.push(`Ошибка при генерации "${page.name}" [${lang.code}]: ${err.message}`)
        }
      }

      // Generate language switcher data JSON for client-side switching
      if (translationLocales.length > 0) {
        const langData = languages
          .filter(l => l.isActive && (l.isDefault || translationLocales.includes(l.code)))
          .map(l => ({
            code: l.code,
            name: l.nativeName,
            flag: l.flag,
            isDefault: l.isDefault,
            direction: l.direction,
          }))
        
        const langJsonPath = path.join(deployDir, 'languages.json')
        fs.writeFileSync(langJsonPath, JSON.stringify(langData, null, 2), 'utf-8')
      }
    } catch (err: any) {
      errors.push(`Ошибка при генерации переводов для "${page.name}": ${err.message}`)
    }
  }

  /**
   * Разворачивает структуру страницы (linked-блоки + library-templates) и строит
   * data-config на её основе. Единый источник правды для всех путей деплоя
   * (deployPage / deploySite / deployAll).
   *
   * Почему это важно: repeater-привязки могут висеть на блоках, которые физически
   * лежат ВНУТРИ linked-блока (например, трек hero-карусели). В сырой page.structure
   * у linked-блока children пустые, поэтому preparePageDataConfig не увидит такой
   * blockId и потеряет привязку → на опубликованной странице не будет Data Binding
   * Runtime. Раньше эту экспансию делал только deployPage; deploySite/deployAll
   * вызывали preparePageDataConfig по сырой структуре и роняли привязку.
   *
   * Возвращает развёрнутую структуру (её же надо отдавать в htmlGenerator, чтобы
   * HTML и config были согласованы) и dataConfig.
   */
  private async resolveStructureAndConfig(
    page: Page
  ): Promise<{ structure: any; dataConfig: PageDataConfig | undefined }> {
    let structure = await linkedBlocksService.updateLinkedBlocks(page.structure)
    structure = await this.injectLibraryTemplates(structure, page.id)
    const dataConfig = await this.preparePageDataConfig(page.id, structure)
    return { structure, dataConfig }
  }

  /**
   * Готовит конфигурацию data bindings для страницы
   */
  private async preparePageDataConfig(pageId: string, overrideStructure?: any): Promise<PageDataConfig | undefined> {
    try {
      // Загружаем страницу чтобы получить все blockId
      const page = await this.pageRepository.findOne({ where: { id: pageId } })
      if (!page || (!page.structure && !overrideStructure)) {
        return undefined
      }

      // Используем переданную структуру (с инжектированными templates) или из БД
      const structure = overrideStructure || page.structure

      // Собираем все blockId и linkedBlockId из структуры страницы
      const { blockIds, linkedBlockIds } = this.collectBlockIdsWithLinks(structure)
      
      if (!blockIds.length) {
        logger.debug('No blocks found in page structure')
        return undefined
      }

      // Создаем маппинг linkedBlockId -> реальный blockId на странице ПЕРЕД загрузкой привязок
      const linkedBlockIdMapping = this.buildLinkedBlockMapping(structure)
      
      logger.debug('Linked block mapping', { mapping: linkedBlockIdMapping })
      logger.debug('Block IDs on page', { blockIds: blockIds.slice(0, 5) })
      logger.debug('Linked block IDs on page', { linkedBlockIds })

      // Загружаем активные bindings для этих блоков (единая логика queryActiveBindings).
      const filteredBindings = await this.queryActiveBindings(blockIds, linkedBlockIds, pageId)

      if (!filteredBindings.length) {
        logger.warn('No active bindings found for blocks', { blockIds: blockIds.slice(0, 5) })
        logger.debug('Page ID', { pageId })
        return undefined
      }

      logger.info(`Found ${filteredBindings.length} bindings for ${blockIds.length} blocks`)

      // Собираем уникальные data sources
      const dataSourcesMap = new Map<string, DataSourceEntity>()
      for (const binding of filteredBindings) {
        if (binding.dataSource && !dataSourcesMap.has(binding.dataSource.id)) {
          dataSourcesMap.set(binding.dataSource.id, binding.dataSource)
        }
      }

      // Формируем конфигурацию
      const config: PageDataConfig = {
        dataSources: Array.from(dataSourcesMap.values()).map(ds => {
          const dsConfig = ds.config as any
          // page-variable: данные берутся из page.variables, endpoint не нужен
          if (ds.type === 'page-variable') {
            return {
              alias: ds.name,
              dataSourceId: ds.id,
              loadStrategy: 'pageLoad' as const,
              cacheEnabled: false,
              type: 'page-variable',
              variableName: dsConfig?.variableName || ds.name,
            }
          }
          // form-data: значение резолвится в браузере из URL/localStorage/cookies, endpoint не нужен
          if (ds.type === 'form-data') {
            return {
              alias: ds.name,
              dataSourceId: ds.id,
              loadStrategy: 'pageLoad' as const,
              cacheEnabled: false,
              type: 'form-data',
              formDataType: dsConfig?.dataType,
              formDataKey: dsConfig?.key,
              formDataDefault: dsConfig?.defaultValue,
            }
          }
          // Конвертируем абсолютный URL бэкенда в относительный путь для nginx proxy
          let dsEndpoint = dsConfig?.url || `/api/data-sources/${ds.id}/data`
          try {
            const parsed = new URL(dsEndpoint)
            if (parsed.hostname === 'localhost' || parsed.hostname === 'backend') {
              dsEndpoint = parsed.pathname
            }
          } catch { /* уже относительный путь */ }
          // Feed с включённым polling → клиентский авто-refresh ('interval');
          // остальные → разовая загрузка ('pageLoad'). Логика в resolveLoadStrategy.
          const loadCfg = resolveLoadStrategy(ds.type, dsConfig, {
            pollingEnabled: (ds as any).pollingEnabled,
            pollingInterval: (ds as any).pollingInterval,
          })
          return {
            alias: ds.name, // Используем name как alias
            dataSourceId: ds.id,
            endpoint: dsEndpoint,
            loadStrategy: loadCfg.loadStrategy,
            ...(loadCfg.loadInterval ? { loadInterval: loadCfg.loadInterval } : {}),
            cacheEnabled: false,
            type: ds.type,
          }
        }),
        bindings: filteredBindings.map(binding => {
          const config = binding.config as any
          const inputConfig = config.inputConfig
          const outputConfig = config.outputConfig
          
          // Определяем реальный blockId на странице (если блок linked)
          let actualBlockId = binding.blockId
          
          // Если привязка для linked блока - используем маппинг
          if (linkedBlockIdMapping[binding.blockId]) {
            actualBlockId = linkedBlockIdMapping[binding.blockId]
            logger.debug(`Mapping binding blockId ${binding.blockId} -> actual page blockId ${actualBlockId}`)
          } else if (!blockIds.includes(binding.blockId)) {
            // Если этот blockId вообще не найден на странице - логируем ошибку
            logger.warn(`Binding blockId ${binding.blockId} NOT FOUND on page`)
            logger.warn(`Available blockIds: ${blockIds.slice(0, 10).join(', ')}...`)
            return null // Пропускаем эту привязку
          } else {
            logger.debug(`Binding blockId ${binding.blockId} is direct (found on page)`)
          }
          
          if (binding.bindingType === 'input' && inputConfig) {
            // Определяем template ID для repeater
            // Проверяем разные возможные места хранения templateId для совместимости
            let templateId = config.templateBlockId || inputConfig.templateId || inputConfig.libraryTemplateId || binding.blockId
            const libraryTemplateId = config.templateBlockId || inputConfig.templateId || inputConfig.libraryTemplateId
            
            if (inputConfig.mode === 'repeater') {
              // Для repeater ищем template внутри контейнера по linkedBlockId
              const foundTemplate = this.findTemplateInContainer(structure, actualBlockId, libraryTemplateId)
              if (foundTemplate) {
                templateId = foundTemplate
                logger.debug(`Found template for container ${actualBlockId}: ${templateId}`)
              } else {
                // Fallback: всегда используем libraryTemplateId
                templateId = libraryTemplateId
                logger.debug(`Fallback: using libraryTemplateId for itemTemplate: ${templateId}`)
              }
            }
            
            return {
              blockId: actualBlockId,
              bindingId: binding.id, // Для использования fetch-with-transforms
              type: inputConfig.mode === 'repeater' ? 'repeater' : 'input',
              sourceAlias: binding.dataSource?.name || '',
              fieldMappings: inputConfig.fieldMappings?.map((fm: any) => ({
                sourceField: fm.sourceField,
                targetProperty: fm.targetProperty,
                transform: fm.transform
              })),
              fieldOverrides: inputConfig.fieldOverrides || undefined,
              // Динамические фильтры для runtime
              dynamicFilters: inputConfig.dynamicFilters?.map((df: any) => ({
                id: df.id,
                sourceBlockId: df.sourceBlockId,
                field: df.field,
                operator: df.operator,
                skipIfEmpty: df.skipIfEmpty,
                ...(df.populateFrom && { populateFrom: df.populateFrom }),
                ...(df.valueExtract && { valueExtract: df.valueExtract })
              })),
              repeaterConfig: inputConfig.mode === 'repeater' ? {
                itemTemplate: templateId,
                containerSelector: `[data-element-id="${actualBlockId}"]`,
                arrayPath: inputConfig.arrayPath,
                pagination: inputConfig.pagination?.enabled ? {
                  enabled: true,
                  pageSize: inputConfig.pagination.itemsPerPage
                } : undefined,
                ...(inputConfig.collectionLinkSelector && { _collectionLinkSelector: inputConfig.collectionLinkSelector }),
              } : undefined
            }
          } else if (binding.bindingType === 'output' && outputConfig) {
            return {
              blockId: actualBlockId,
              type: 'output',
              sourceAlias: binding.dataSource?.name || '',
              outputConfig: {
                trigger: outputConfig.trigger === 'formSubmit' ? 'submit' : 'click',
                method: outputConfig.method || outputConfig.endpoint?.method || 'POST',
                endpoint: outputConfig.endpoint?.path || outputConfig.endpointPath,
                payloadMappings: outputConfig.payloadMappings?.map((pm: any) => ({
                  sourceField: pm.sourceField,
                  targetField: pm.targetField,
                  type: pm.type || 'direct',
                  value: pm.value
                })),
                onSuccess: outputConfig.onSuccess?.[0] ? {
                  action: outputConfig.onSuccess[0].type === 'showMessage' ? 'message' : 'redirect',
                  value: outputConfig.onSuccess[0].config?.message || outputConfig.onSuccess[0].config?.url
                } : undefined,
                onError: outputConfig.onError ? {
                  action: 'message',
                  value: outputConfig.onError.showMessage,
                  retryCount: outputConfig.onError.retryAttempts
                } : undefined
              }
            }
          }
          
          return null
        }).filter(Boolean) as any[],
        variables: ((page.variables as any)?.variables || []).map((v: any) => ({
          name: v.name,
          type: v.type,
          defaultValue: v.defaultValue,
        })),
      }
      
      // Дедупликация repeater-биндингов: если несколько используют один template, оставляем только первый
      const seenTemplates = new Set<string>()
      const seenContainers = new Set<string>()
      config.bindings = config.bindings.filter(b => {
        if (b.type === 'repeater' && b.repeaterConfig) {
          const templateKey = b.repeaterConfig.itemTemplate
          const containerKey = b.repeaterConfig.containerSelector
          
          // Пропускаем если уже есть биндинг с таким же template
          if (seenTemplates.has(templateKey)) {
            logger.debug(`Skipping duplicate repeater binding for template: ${templateKey}`)
            return false
          }
          
          // Пропускаем если уже есть биндинг для этого контейнера
          if (seenContainers.has(containerKey)) {
            logger.debug(`Skipping duplicate repeater binding for container: ${containerKey}`)
            return false
          }
          
          seenTemplates.add(templateKey)
          seenContainers.add(containerKey)
        }
        return true
      })

      logger.debug(`Prepared data config for page ${pageId}`, {
        dataSources: config.dataSources.length,
        bindings: config.bindings.length,
      })

      return config
    } catch (error) {
      logger.error('Error preparing page data config', error instanceof Error ? error : undefined)
      return undefined
    }
  }

  /**
   * Копирует статические ресурсы
   */
  private copyAssets(): void {
    // Создаём папки для assets
    const fontsDir = path.join(PUBLIC_DIR, 'fonts')
    const imagesDir = path.join(PUBLIC_DIR, 'images')
    const cssDir = path.join(PUBLIC_DIR, 'css')

    this.ensureDirectoryExists(fontsDir)
    this.ensureDirectoryExists(imagesDir)
    this.ensureDirectoryExists(cssDir)

    // TODO: Копировать реальные шрифты из assets
    // Пока создаём placeholder
    const readmePath = path.join(PUBLIC_DIR, 'README.txt')
    fs.writeFileSync(readmePath, `
Golden House - Public Site
==========================

Сгенерировано: ${new Date().toISOString()}

Структура:
- /sites/<slug>/ - папки сайтов
- *.html - страницы
- /fonts - шрифты
- /images - изображения
- sitemap.xml - карта сайта (генерируется автоматически)
- robots.txt - индексация (генерируется автоматически)

Для просмотра запустите: npx serve public-site -p 3001
    `.trim(), 'utf-8')
  }

  /**
   * Copy assets to a specific site directory
   */
  private copyAssetsToDir(dir: string): void {
    const fontsDir = path.join(dir, 'fonts')
    const imagesDir = path.join(dir, 'images')
    const cssDir = path.join(dir, 'css')
    this.ensureDirectoryExists(fontsDir)
    this.ensureDirectoryExists(imagesDir)
    this.ensureDirectoryExists(cssDir)

    // Copy from shared assets if they exist
    const sharedFonts = path.join(PUBLIC_DIR, 'fonts')
    const sharedImages = path.join(PUBLIC_DIR, 'images')
    if (fs.existsSync(sharedFonts)) {
      this.copyDirContents(sharedFonts, fontsDir)
    }
    if (fs.existsSync(sharedImages)) {
      this.copyDirContents(sharedImages, imagesDir)
    }
  }

  private copyDirContents(src: string, dest: string): void {
    const files = fs.readdirSync(src)
    for (const file of files) {
      const srcPath = path.join(src, file)
      const destPath = path.join(dest, file)
      if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  // ─── Multi-site helpers ───────────────────────────────────────

  /**
   * Resolve the deploy directory for a site.
   * Sites with slug go into public-site/sites/<slug>/
   * Sites without slug (root site) or pages without a site go to public-site/
   */
  private resolveSiteDir(site?: Site | null): string {
    if (!site || !site.slug) return PUBLIC_DIR
    return path.join(PUBLIC_DIR, 'sites', site.slug)
  }

  /**
   * Resolve public URL for a site
   */
  private resolveSiteUrl(site: Site): string {
    if (site.routingMode === 'custom-domain' && site.hostname) {
      return `https://${site.hostname}`
    }
    if (site.routingMode === 'subdomain') {
      const baseHost = new URL(PUBLIC_SITE_URL).hostname
      const subdomain = site.hostname || site.slug
      return `https://${subdomain}.${baseHost}`
    }
    // path-prefix
    const prefix = site.hostname || `/${site.slug}`
    return `${PUBLIC_SITE_URL}${prefix}`
  }

  /**
   * Generate sitemap.xml for a site
   */
  async generateSitemap(site: Site): Promise<void> {
    const siteDir = this.resolveSiteDir(site)
    this.ensureDirectoryExists(siteDir)

    const pages = await this.pageRepository.find({
      where: { siteId: site.id, status: 'published' },
    })

    const baseUrl = this.resolveSiteUrl(site)
    const activeLanguages = await languageService.getActive()
    const defaultLang = activeLanguages.find(l => l.isDefault)

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
    xml += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'

    for (const page of pages) {
      const slug = (page.slug === 'index' || page.slug === 'home') ? '' : page.slug
      const pageUrl = `${baseUrl}/${slug}`.replace(/\/$/, '') || baseUrl

      // Get translation locales for hreflang
      const translationLocales = await translationService.getPageLocales(page.id)

      xml += '  <url>\n'
      xml += `    <loc>${this.escapeXml(pageUrl)}</loc>\n`
      xml += `    <lastmod>${page.updatedAt.toISOString().split('T')[0]}</lastmod>\n`

      // Add hreflang links for multi-language pages
      if (translationLocales.length > 0 && defaultLang) {
        // Default language version
        xml += `    <xhtml:link rel="alternate" hreflang="${defaultLang.code}" href="${this.escapeXml(pageUrl)}" />\n`

        for (const locale of translationLocales) {
          const localizedUrl = `${baseUrl}/${locale}/${slug}`.replace(/\/$/, '')
          xml += `    <xhtml:link rel="alternate" hreflang="${locale}" href="${this.escapeXml(localizedUrl)}" />\n`
        }

        // x-default (for language pickers)
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${this.escapeXml(pageUrl)}" />\n`
      }

      xml += '  </url>\n'
    }

    xml += '</urlset>\n'

    fs.writeFileSync(path.join(siteDir, 'sitemap.xml'), xml, 'utf-8')
    logger.info(`Generated sitemap.xml for site "${site.slug}" (${pages.length} pages)`)
  }

  /**
   * Generate robots.txt for a site
   */
  generateRobotsTxt(site: Site): void {
    const siteDir = this.resolveSiteDir(site)
    this.ensureDirectoryExists(siteDir)

    const baseUrl = this.resolveSiteUrl(site)

    let robots = 'User-agent: *\n'
    robots += 'Allow: /\n'
    robots += '\n'
    robots += `Sitemap: ${baseUrl}/sitemap.xml\n`

    fs.writeFileSync(path.join(siteDir, 'robots.txt'), robots, 'utf-8')
    logger.info(`Generated robots.txt for site "${site.slug}"`)
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}

export const deployService = new DeployService()
