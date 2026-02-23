/**
 * Сервис деплоя страниц - генерирует статические HTML файлы
 */

import * as fs from 'fs'
import * as path from 'path'
import { htmlGenerator } from './HtmlGenerator'
import { AppDataSource } from '../config/database'
import { Page } from '../models/Page'
import { Block } from '../models/Block'
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
  private blockRepository = AppDataSource.getRepository(Block)
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

      // Сначала инжектируем library templates (нужно до preparePageDataConfig)
      let updatedStructure = await linkedBlocksService.updateLinkedBlocks(page.structure)
      updatedStructure = await this.injectLibraryTemplates(updatedStructure, pageId)

      // Загружаем data bindings для страницы, используя обновлённую структуру с templates
      const dataConfig = await this.preparePageDataConfig(pageId, updatedStructure)
      
      console.log('📋 DataConfig for deploy:', JSON.stringify(dataConfig, null, 2))

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
            console.log(`✅ Found template by linkedBlockId ${libraryTemplateId} -> ${templateId}`)
            return true
          }
          console.log(`❌ Template with linkedBlockId ${libraryTemplateId} not found in container ${containerId}`)
        }
        
        // Fallback: ищем первый блок с isTemplate=true или берём первого ребёнка
        if (node.children && Array.isArray(node.children)) {
          const templateChild = node.children.find((child: any) => child.metadata?.isTemplate === true)
          if (templateChild?.id) {
            templateId = templateChild.id
            console.log(`Using template-marked child: ${templateId}`)
            return true
          }
          
          const firstChild = node.children[0]
          if (firstChild?.id) {
            templateId = firstChild.id
            console.log(`⚠️ Using first child as fallback template: ${templateId}`)
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
      console.log(`📦 Loaded library template: ${template.id} (${template.name})`)
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
              console.log(`✅ Injecting template ${libraryTemplateId} into container ${node.id}`)
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
              console.log(`⏭️ Template ${libraryTemplateId} already exists in descendants of ${node.id}, skipping injection`)
            }
            
            node = updatedNode
          } else {
            console.warn(`⚠️ Template ${libraryTemplateId} not found in database`)
          }
        }
      }

      return node
    }

    return injectTemplates(structure)
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
        console.log('No blocks found in page structure')
        return undefined
      }

      // Создаем маппинг linkedBlockId -> реальный blockId на странице ПЕРЕД загрузкой привязок
      const linkedBlockIdMapping = this.buildLinkedBlockMapping(structure)
      
      console.log('🗺️ Linked block mapping:', linkedBlockIdMapping)
      console.log('📋 Block IDs on page:', blockIds.slice(0, 5))
      console.log('🔗 Linked block IDs on page:', linkedBlockIds)

      // Загружаем активные bindings для этих блоков
      // ВАЖНО: Берем ТОЛЬКО привязки для этой страницы (pageId = pageId)
      // ИЛИ привязки где blockId напрямую присутствует на странице
      // НЕ берем привязки библиотечных блоков (pageId = null, blockId = libraryBlockId)
      const bindings = await this.dataBindingRepository
        .createQueryBuilder('binding')
        .leftJoinAndSelect('binding.dataSource', 'dataSource')
        .where(
          // Обязательно isActive = true И одно из условий
          'binding.isActive = :isActive AND (' +
          // Привязки для этой конкретной страницы
          '(binding.pageId = :pageId AND binding.blockId IN (:...blockIds))' +
          // ИЛИ привязки где blockId напрямую есть на странице (не через linked)
          ' OR (binding.blockId IN (:...blockIds) AND binding.pageId IS NULL)' +
          ')',
          { 
            pageId,
            blockIds,
            isActive: true
          }
        )
        .orderBy('binding.priority', 'ASC')
        .getMany()
      
      console.log('🔍 Raw bindings from DB:', bindings.map(b => ({ id: b.id, blockId: b.blockId, pageId: b.pageId })))
      
      // Фильтруем: если есть привязка с pageId, она имеет приоритет над привязкой без pageId
      const bindingsByBlockId = new Map<string, any>()
      for (const binding of bindings) {
        const existingBinding = bindingsByBlockId.get(binding.blockId)
        // Привязка с pageId имеет приоритет
        if (!existingBinding || (binding.pageId && !existingBinding.pageId)) {
          bindingsByBlockId.set(binding.blockId, binding)
        }
      }
      const filteredBindings = Array.from(bindingsByBlockId.values())

      if (!filteredBindings.length) {
        console.log('❌ No active bindings found for blocks:', blockIds.slice(0, 5))
        console.log('❌ Page ID:', pageId)
        return undefined
      }

      console.log(`✅ Found ${filteredBindings.length} bindings for ${blockIds.length} blocks`)

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
          const restConfig = ds.config as any
          return {
            alias: ds.name, // Используем name как alias
            dataSourceId: ds.id,
            endpoint: restConfig?.url || `/api/data-sources/${ds.id}/data`,
            loadStrategy: 'pageLoad', // По умолчанию загружаем при загрузке страницы
            cacheEnabled: false,
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
            console.log(`✅ Mapping binding blockId ${binding.blockId} -> actual page blockId ${actualBlockId}`)
          } else if (!blockIds.includes(binding.blockId)) {
            // Если этот blockId вообще не найден на странице - логируем ошибку
            console.warn(`⚠️ Binding blockId ${binding.blockId} NOT FOUND on page!`)
            console.warn(`⚠️ Available blockIds: ${blockIds.slice(0, 10).join(', ')}...`)
            return null // Пропускаем эту привязку
          } else {
            console.log(`ℹ️ Binding blockId ${binding.blockId} is direct (found on page)`)
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
                console.log(`✅ Found template for container ${actualBlockId}: ${templateId}`)
              } else {
                // Fallback: всегда используем libraryTemplateId
                templateId = libraryTemplateId
                console.log(`⚠️ Fallback: using libraryTemplateId for itemTemplate: ${templateId}`)
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
              // Динамические фильтры для runtime
              dynamicFilters: inputConfig.dynamicFilters?.map((df: any) => ({
                id: df.id,
                sourceBlockId: df.sourceBlockId,
                field: df.field,
                operator: df.operator,
                skipIfEmpty: df.skipIfEmpty
              })),
              repeaterConfig: inputConfig.mode === 'repeater' ? {
                itemTemplate: templateId,
                containerSelector: `[data-element-id="${actualBlockId}"]`,
                arrayPath: inputConfig.arrayPath, // Путь к массиву данных в ответе
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
        variables: []
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
            console.log(`⏭️ Skipping duplicate repeater binding for template: ${templateKey}`)
            return false
          }
          
          // Пропускаем если уже есть биндинг для этого контейнера
          if (seenContainers.has(containerKey)) {
            console.log(`⏭️ Skipping duplicate repeater binding for container: ${containerKey}`)
            return false
          }
          
          seenTemplates.add(templateKey)
          seenContainers.add(containerKey)
        }
        return true
      })

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
