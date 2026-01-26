/**
 * Сервис деплоя страниц - генерирует статические HTML файлы
 */

import * as fs from 'fs'
import * as path from 'path'
import { htmlGenerator } from './HtmlGenerator'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'
import { linkedBlocksService } from './LinkedBlocksService'
import { DataBinding } from '../models/DataBinding'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { PageDataConfig } from './DataBindingGenerator'

// Папка для публикации - используем переменную окружения или путь относительно /app
const PUBLIC_DIR = process.env.PUBLIC_SITE_DIR || '/app/public-site'

export interface DeployResult {
  success: boolean
  message: string
  deployedPages: string[]
  errors: string[]
  publicUrl?: string
}

export class DeployService {
  private pageRepository = AppDataSource.getRepository(Page)
  private dataBindingRepository = AppDataSource.getRepository(DataBinding)
  private dataSourceRepository = AppDataSource.getRepository(DataSourceEntity)

  /**
   * Деплоит одну страницу
   */
  async deployPage(pageId: string): Promise<DeployResult> {
    const errors: string[] = []
    const deployedPages: string[] = []

    try {
      const page = await this.pageRepository.findOne({ where: { id: pageId } })
      
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

      // Создаём папку public-site если не существует
      this.ensureDirectoryExists(PUBLIC_DIR)

      // Обновляем структуру, подставляя актуальные блоки из библиотеки
      const updatedStructure = await linkedBlocksService.updateLinkedBlocks(page.structure)

      // Загружаем data bindings для страницы
      const dataConfig = await this.preparePageDataConfig(pageId)

      // Генерируем HTML
      const html = htmlGenerator.generatePage(
        updatedStructure,
        page.metadata || { title: page.name, description: '', keywords: [] },
        page.slug,
        dataConfig
      )

      // Определяем путь файла
      const fileName = page.slug === 'index' || page.slug === 'home' 
        ? 'index.html' 
        : `${page.slug}.html`
      const filePath = path.join(PUBLIC_DIR, fileName)

      // Записываем файл
      fs.writeFileSync(filePath, html, 'utf-8')
      deployedPages.push(fileName)

      // Обновляем статус страницы
      page.status = 'published'
      await this.pageRepository.save(page)

      console.log(`✅ Deployed: ${fileName}`)

      return {
        success: true,
        message: `Страница "${page.name}" успешно опубликована`,
        deployedPages,
        errors,
        publicUrl: `http://localhost:3001/${fileName}`
      }
    } catch (error: any) {
      console.error('Deploy error:', error)
      return {
        success: false,
        message: 'Ошибка при публикации',
        deployedPages,
        errors: [error.message]
      }
    }
  }

  /**
   * Деплоит все опубликованные страницы
   */
  async deployAll(): Promise<DeployResult> {
    const errors: string[] = []
    const deployedPages: string[] = []

    try {
      const pages = await this.pageRepository.find({
        where: { status: 'published' }
      })

      if (pages.length === 0) {
        return {
          success: false,
          message: 'Нет опубликованных страниц для деплоя',
          deployedPages: [],
          errors: []
        }
      }

      // Создаём папку public-site
      this.ensureDirectoryExists(PUBLIC_DIR)

      // Копируем assets (шрифты, изображения)
      this.copyAssets()

      for (const page of pages) {
        if (!page.structure) {
          errors.push(`Страница "${page.name}" не имеет структуры`)
          continue
        }

        try {
          // Обновляем структуру, подставляя актуальные блоки из библиотеки
          const updatedStructure = await linkedBlocksService.updateLinkedBlocks(page.structure)
          
          // Загружаем data bindings для страницы
          const dataConfig = await this.preparePageDataConfig(page.id)
          
          const html = htmlGenerator.generatePage(
            updatedStructure,
            page.metadata || { title: page.name, description: '', keywords: [] },
            page.slug,
            dataConfig
          )

          const fileName = page.slug === 'index' || page.slug === 'home' 
            ? 'index.html' 
            : `${page.slug}.html`
          const filePath = path.join(PUBLIC_DIR, fileName)

          fs.writeFileSync(filePath, html, 'utf-8')
          deployedPages.push(fileName)
          console.log(`✅ Deployed: ${fileName}`)
        } catch (err: any) {
          errors.push(`Ошибка при генерации "${page.name}": ${err.message}`)
        }
      }

      return {
        success: errors.length === 0,
        message: `Опубликовано ${deployedPages.length} страниц`,
        deployedPages,
        errors,
        publicUrl: 'http://localhost:3001/'
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
  async undeployPage(slug: string): Promise<boolean> {
    const fileName = slug === 'index' || slug === 'home' ? 'index.html' : `${slug}.html`
    const filePath = path.join(PUBLIC_DIR, fileName)
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
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
   * Готовит конфигурацию data bindings для страницы
   */
  private async preparePageDataConfig(pageId: string): Promise<PageDataConfig | undefined> {
    try {
      // Загружаем страницу чтобы получить все blockId
      const page = await this.pageRepository.findOne({ where: { id: pageId } })
      if (!page || !page.structure) {
        return undefined
      }

      // Собираем все blockId и linkedBlockId из структуры страницы
      const { blockIds, linkedBlockIds } = this.collectBlockIdsWithLinks(page.structure)
      
      if (!blockIds.length) {
        console.log('No blocks found in page structure')
        return undefined
      }

      // Загружаем активные bindings для этих блоков
      // Ищем по blockId (прямые) ИЛИ по linkedBlockId (для library блоков)
      const bindings = await this.dataBindingRepository
        .createQueryBuilder('binding')
        .leftJoinAndSelect('binding.dataSource', 'dataSource')
        .where('(binding.blockId IN (:...blockIds) OR binding.blockId IN (:...linkedBlockIds))', { 
          blockIds, 
          linkedBlockIds: linkedBlockIds.length ? linkedBlockIds : ['no-linked-blocks'] 
        })
        .andWhere('binding.isActive = :isActive', { isActive: true })
        .orderBy('binding.priority', 'ASC')
        .getMany()

      if (!bindings.length) {
        console.log('No active bindings found for blocks:', blockIds.slice(0, 5))
        console.log('Checked linkedBlockIds:', linkedBlockIds)
        return undefined
      }

      console.log(`Found ${bindings.length} bindings for ${blockIds.length} blocks (${linkedBlockIds.length} linked)`)

      // Создаем маппинг linkedBlockId -> реальный blockId на странице
      const linkedBlockIdMapping = this.buildLinkedBlockMapping(page.structure)

      // Собираем уникальные data sources
      const dataSourcesMap = new Map<string, DataSourceEntity>()
      for (const binding of bindings) {
        if (binding.dataSource && !dataSourcesMap.has(binding.dataSource.id)) {
          dataSourcesMap.set(binding.dataSource.id, binding.dataSource)
        }
      }

      // Формируем конфигурацию
      const config: PageDataConfig = {
        dataSources: Array.from(dataSourcesMap.values()).map(ds => {
          const restConfig = ds.config as any
          return {
            alias: ds.name, // Используем name как alias
            dataSourceId: ds.id,
            endpoint: restConfig?.url || `/api/data-sources/${ds.id}/data`,
            loadStrategy: 'pageLoad', // По умолчанию загружаем при загрузке страницы
            cacheEnabled: false,
          }
        }),
        bindings: bindings.map(binding => {
          const config = binding.config as any
          const inputConfig = config.inputConfig
          const outputConfig = config.outputConfig
          
          // Определяем реальный blockId на странице (если блок linked)
          let actualBlockId = binding.blockId
          if (linkedBlockIdMapping[binding.blockId]) {
            actualBlockId = linkedBlockIdMapping[binding.blockId]
            console.log(`Mapping binding blockId ${binding.blockId} -> ${actualBlockId}`)
          }
          
          if (binding.bindingType === 'input' && inputConfig) {
            // Определяем template ID - если он тоже linked, маппим
            let templateId = config.templateBlockId || binding.blockId
            if (linkedBlockIdMapping[templateId]) {
              templateId = linkedBlockIdMapping[templateId]
              console.log(`Mapping template blockId ${config.templateBlockId} -> ${templateId}`)
            }
            
            return {
              blockId: actualBlockId,
              type: inputConfig.mode === 'repeater' ? 'repeater' : 'input',
              sourceAlias: binding.dataSource?.name || '',
              fieldMappings: inputConfig.fieldMappings?.map((fm: any) => ({
                sourceField: fm.sourceField,
                targetProperty: fm.targetProperty,
                transform: fm.transform
              })),
              repeaterConfig: inputConfig.mode === 'repeater' ? {
                itemTemplate: templateId,
                containerSelector: `[data-element-id="${actualBlockId}"]`,
                pagination: inputConfig.pagination?.enabled ? {
                  enabled: true,
                  pageSize: inputConfig.pagination.itemsPerPage
                } : undefined
              } : undefined
            }
          } else if (binding.bindingType === 'output' && outputConfig) {
            return {
              blockId: actualBlockId,
              type: 'output',
              sourceAlias: binding.dataSource?.name || '',
              outputConfig: {
                trigger: outputConfig.trigger === 'formSubmit' ? 'submit' : 'click',
                method: outputConfig.method,
                endpoint: outputConfig.endpointPath,
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
        variables: []
      }

      console.log(`📦 Prepared data config for page ${pageId}:`, {
        dataSources: config.dataSources.length,
        bindings: config.bindings.length
      })

      return config
    } catch (error) {
      console.error('Error preparing page data config:', error)
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
- *.html - страницы сайта
- /fonts - шрифты Muller
- /images - изображения
- /css - стили (если есть)

Для просмотра запустите: npx serve public-site -p 3001
    `.trim(), 'utf-8')
  }
}

export const deployService = new DeployService()
