import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { DataSource, DataSourceType, DataSourceStatus } from '../models/DataSource'
import { CredentialsManager } from '../services/CredentialsManager'
import { Like, In } from 'typeorm'

/**
 * DataSourceController - Контроллер для управления источниками данных
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 1.1 Backend: DataSourceController с CRUD endpoints
 * 
 * Endpoints:
 * - GET /api/data-sources - список источников
 * - GET /api/data-sources/:id - один источник
 * - POST /api/data-sources - создание
 * - PUT /api/data-sources/:id - обновление
 * - DELETE /api/data-sources/:id - удаление
 * - POST /api/data-sources/:id/test - тестирование
 * - POST /api/data-sources/:id/duplicate - дублирование
 */
export class DataSourceController {
  /**
   * Получение repository (вызывается после инициализации базы данных)
   */
  private getRepository() {
    return AppDataSource.getRepository(DataSource)
  }

  /**
   * GET /api/data-sources
   * Получение списка источников данных с фильтрацией и пагинацией
   */
  async getAll(req: Request, res: Response) {
    try {
      const dataSourceRepository = this.getRepository()
      const {
        search,
        type,
        status,
        groupId,
        tags,
        page = 1,
        limit = 20,
        sortBy = 'updatedAt',
        sortOrder = 'DESC'
      } = req.query

      // Построение условий фильтрации
      const where: any = {}

      if (search) {
        where.name = Like(`%${search}%`)
      }

      if (type) {
        where.type = type as DataSourceType
      }

      if (status) {
        where.status = status as DataSourceStatus
      }

      if (groupId) {
        where.groupId = groupId as string
      }

      // Получение данных с пагинацией
      const [items, total] = await dataSourceRepository.findAndCount({
        where,
        order: { [sortBy as string]: sortOrder },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      })

      // Фильтрация по тегам (после получения, т.к. simple-array)
      let filteredItems = items
      if (tags) {
        const tagsArray = Array.isArray(tags) ? tags : [tags]
        filteredItems = items.filter(item => 
          item.tags?.some(tag => tagsArray.includes(tag))
        )
      }

      // Маскируем credentials перед отправкой на frontend
      const maskedItems = filteredItems.map(item => ({
        ...item,
        authConfig: item.authConfig 
          ? CredentialsManager.maskAuthConfig(item.authConfig)
          : undefined
      }))

      res.json({
        items: maskedItems,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      })
    } catch (error: any) {
      console.error('Error fetching data sources:', error)
      res.status(500).json({ 
        error: 'Failed to fetch data sources',
        message: error.message 
      })
    }
  }

  /**
   * GET /api/data-sources/:id
   * Получение одного источника данных по ID
   */
  async getById(req: Request, res: Response) {
    try {
      const dataSourceRepository = this.getRepository()
      const { id } = req.params

      const dataSource = await dataSourceRepository.findOne({
        where: { id }
      })

      if (!dataSource) {
        return res.status(404).json({ 
          error: 'Data source not found',
          message: `Data source with id "${id}" does not exist`
        })
      }

      // Маскируем credentials
      const maskedDataSource = {
        ...dataSource,
        authConfig: dataSource.authConfig 
          ? CredentialsManager.maskAuthConfig(dataSource.authConfig)
          : undefined
      }

      res.json(maskedDataSource)
    } catch (error: any) {
      console.error('Error fetching data source:', error)
      res.status(500).json({ 
        error: 'Failed to fetch data source',
        message: error.message 
      })
    }
  }

  /**
   * POST /api/data-sources
   * Создание нового источника данных
   */
  async create(req: Request, res: Response) {
    try {
      const dataSourceRepository = this.getRepository()
      const { name, description, type, config, authConfig, groupId, tags, status } = req.body

      // Валидация обязательных полей
      if (!name || !type || !config) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'name, type, and config are required fields'
        })
      }

      // Шифрование credentials если есть
      const encryptedAuthConfig = authConfig 
        ? CredentialsManager.encryptAuthConfig(authConfig)
        : undefined

      // Создание записи
      const dataSource = dataSourceRepository.create({
        name,
        description,
        type,
        config,
        authConfig: encryptedAuthConfig,
        groupId,
        tags,
        status: status || 'draft',
        version: 1
      })

      await dataSourceRepository.save(dataSource)

      // Возвращаем с замаскированными credentials
      const response = {
        ...dataSource,
        authConfig: dataSource.authConfig 
          ? CredentialsManager.maskAuthConfig(dataSource.authConfig)
          : undefined
      }

      res.status(201).json(response)
    } catch (error: any) {
      console.error('Error creating data source:', error)
      res.status(500).json({ 
        error: 'Failed to create data source',
        message: error.message 
      })
    }
  }

  /**
   * PUT /api/data-sources/:id
   * Обновление источника данных
   */
  async update(req: Request, res: Response) {
    try {
      const dataSourceRepository = this.getRepository()
      const { id } = req.params
      const { name, description, type, config, authConfig, groupId, tags, status } = req.body

      const dataSource = await dataSourceRepository.findOne({ where: { id } })

      if (!dataSource) {
        return res.status(404).json({ 
          error: 'Data source not found',
          message: `Data source with id "${id}" does not exist`
        })
      }

      // Обновляем поля
      if (name !== undefined) dataSource.name = name
      if (description !== undefined) dataSource.description = description
      if (type !== undefined) dataSource.type = type
      if (config !== undefined) dataSource.config = config
      if (groupId !== undefined) dataSource.groupId = groupId
      if (tags !== undefined) dataSource.tags = tags
      if (status !== undefined) dataSource.status = status

      // Обновляем authConfig только если переданы новые credentials
      // (не masked объекты)
      if (authConfig && !this.isMaskedAuthConfig(authConfig)) {
        dataSource.authConfig = CredentialsManager.encryptAuthConfig(authConfig)
      }

      // Увеличиваем версию
      dataSource.version += 1

      await dataSourceRepository.save(dataSource)

      // Возвращаем с замаскированными credentials
      const response = {
        ...dataSource,
        authConfig: dataSource.authConfig 
          ? CredentialsManager.maskAuthConfig(dataSource.authConfig)
          : undefined
      }

      res.json(response)
    } catch (error: any) {
      console.error('Error updating data source:', error)
      res.status(500).json({ 
        error: 'Failed to update data source',
        message: error.message 
      })
    }
  }

  /**
   * DELETE /api/data-sources/:id
   * Удаление источника данных
   */
  async delete(req: Request, res: Response) {
    try {
      const dataSourceRepository = this.getRepository()
      const { id } = req.params

      const result = await dataSourceRepository.delete(id)

      if (result.affected === 0) {
        return res.status(404).json({ 
          error: 'Data source not found',
          message: `Data source with id "${id}" does not exist`
        })
      }

      res.status(204).send()
    } catch (error: any) {
      console.error('Error deleting data source:', error)
      res.status(500).json({ 
        error: 'Failed to delete data source',
        message: error.message 
      })
    }
  }

  /**
   * POST /api/data-sources/:id/test
   * Тестирование подключения к источнику данных
   */
  async testConnection(req: Request, res: Response) {
    try {
      const dataSourceRepository = this.getRepository()
      const { id } = req.params
      
      // Можно тестировать существующий источник или новую конфигурацию
      let config: Record<string, unknown>
      let authConfig: Record<string, unknown> | undefined
      let type: DataSourceType

      if (id && id !== 'new') {
        // Тестируем существующий источник
        const dataSource = await dataSourceRepository.findOne({ where: { id } })
        
        if (!dataSource) {
          return res.status(404).json({ 
            error: 'Data source not found',
            message: `Data source with id "${id}" does not exist`
          })
        }

        config = dataSource.config
        type = dataSource.type
        
        // Расшифровываем credentials для теста
        if (dataSource.authConfig) {
          authConfig = await CredentialsManager.decryptAuthConfig(dataSource.authConfig)
        }
      } else {
        // Тестируем новую конфигурацию из body
        const { type: bodyType, config: bodyConfig, authConfig: bodyAuthConfig } = req.body
        
        if (!bodyType || !bodyConfig) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'type and config are required for testing'
          })
        }

        type = bodyType
        config = bodyConfig
        authConfig = bodyAuthConfig
      }

      // Выполняем тест подключения
      const startTime = Date.now()
      const result = await this.performConnectionTest(type, config, authConfig)
      const responseTime = Date.now() - startTime

      // Обновляем статус последнего запроса для существующего источника
      if (id && id !== 'new') {
        await dataSourceRepository.update(id, {
          lastFetchAt: new Date(),
          lastFetchStatus: result.success ? 'success' : 'error',
          lastFetchError: result.success ? undefined : result.error?.message
        })
      }

      res.json({
        success: result.success,
        message: result.message,
        responseTime,
        sampleData: result.sampleData,
        error: result.error
      })
    } catch (error: any) {
      console.error('Error testing connection:', error)
      res.status(500).json({ 
        success: false,
        message: 'Connection test failed',
        error: {
          code: 'TEST_ERROR',
          message: error.message
        }
      })
    }
  }

  /**
   * POST /api/data-sources/new/test
   * Тестирование новой конфигурации без сохранения
   */
  async testNewConnection(req: Request, res: Response) {
    try {
      const { type, config, authConfig } = req.body
      
      if (!type || !config) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'type and config are required for testing'
        })
      }

      // Выполняем тест подключения
      const startTime = Date.now()
      const result = await this.performConnectionTest(type, config, authConfig)
      const responseTime = Date.now() - startTime

      res.json({
        success: result.success,
        message: result.message,
        responseTime,
        sampleData: result.sampleData,
        error: result.error
      })
    } catch (error: any) {
      console.error('Error testing new connection:', error)
      res.status(500).json({ 
        success: false,
        message: 'Connection test failed',
        error: {
          code: 'TEST_ERROR',
          message: error.message
        }
      })
    }
  }

  /**
   * POST /api/data-sources/:id/duplicate
   * Дублирование источника данных
   */
  async duplicate(req: Request, res: Response) {
    try {
      const dataSourceRepository = this.getRepository()
      const { id } = req.params
      const { name: newName } = req.body

      const original = await dataSourceRepository.findOne({ where: { id } })

      if (!original) {
        return res.status(404).json({ 
          error: 'Data source not found',
          message: `Data source with id "${id}" does not exist`
        })
      }

      // Создаём копию
      const duplicate = dataSourceRepository.create({
        name: newName || `${original.name} (copy)`,
        description: original.description,
        type: original.type,
        config: { ...original.config },
        authConfig: original.authConfig ? { ...original.authConfig } : undefined,
        groupId: original.groupId,
        tags: original.tags ? [...original.tags] : undefined,
        status: 'draft',
        version: 1
      })

      await dataSourceRepository.save(duplicate)

      // Возвращаем с замаскированными credentials
      const response = {
        ...duplicate,
        authConfig: duplicate.authConfig 
          ? CredentialsManager.maskAuthConfig(duplicate.authConfig)
          : undefined
      }

      res.status(201).json(response)
    } catch (error: any) {
      console.error('Error duplicating data source:', error)
      res.status(500).json({ 
        error: 'Failed to duplicate data source',
        message: error.message 
      })
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Проверяет, является ли authConfig замаскированным (с frontend)
   */
  private isMaskedAuthConfig(authConfig: Record<string, unknown>): boolean {
    const sensitiveFields = ['token', 'key', 'password', 'clientSecret', 'accessToken', 'refreshToken']
    
    for (const field of sensitiveFields) {
      const value = authConfig[field]
      if (value && typeof value === 'object' && '_masked' in (value as object)) {
        return true
      }
    }
    
    return false
  }

  /**
   * Выполняет тест подключения к источнику данных
   */
  private async performConnectionTest(
    type: DataSourceType,
    config: Record<string, unknown>,
    authConfig?: Record<string, unknown>
  ): Promise<{
    success: boolean
    message: string
    sampleData?: unknown
    error?: { code: string; message: string; details?: string }
  }> {
    try {
      switch (type) {
        case 'rest-api':
        case 'feed':
          return await this.testRestApi(config, authConfig)
        
        case 'graphql':
          return await this.testGraphQL(config, authConfig)
        
        case 'database':
          return await this.testDatabase(config)
        
        case 'external':
          return await this.testExternalService(config, authConfig)
        
        case 'static':
          return this.testStaticData(config)
        
        case 'computed':
          return { 
            success: true, 
            message: 'Computed data source configuration is valid' 
          }
        
        case 'form-data':
          return { 
            success: true, 
            message: 'Form data source configuration is valid' 
          }
        
        default:
          return {
            success: false,
            message: `Unknown data source type: ${type}`,
            error: {
              code: 'UNKNOWN_TYPE',
              message: `Data source type "${type}" is not supported`
            }
          }
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Connection test failed',
        error: {
          code: 'CONNECTION_ERROR',
          message: error.message,
          details: error.stack
        }
      }
    }
  }

  /**
   * Тест REST API подключения
   */
  private async testRestApi(
    config: Record<string, unknown>,
    authConfig?: Record<string, unknown>
  ): Promise<{
    success: boolean
    message: string
    sampleData?: unknown
    error?: { code: string; message: string; details?: string }
  }> {
    const url = config.url as string
    const method = (config.method as string) || 'GET'
    const headers: Record<string, string> = { ...(config.headers as Record<string, string> || {}) }
    const timeout = (config.timeout as number) || 30000

    // Добавляем авторизацию
    if (authConfig) {
      this.applyAuth(headers, authConfig)
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
          error: {
            code: `HTTP_${response.status}`,
            message: response.statusText
          }
        }
      }

      const contentType = response.headers.get('content-type')
      let sampleData: unknown

      if (contentType?.includes('application/json')) {
        const data = await response.json()
        // Ограничиваем размер sample data
        sampleData = this.truncateSampleData(data)
      } else {
        const text = await response.text()
        sampleData = text.substring(0, 1000)
      }

      return {
        success: true,
        message: 'Connection successful',
        sampleData
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Request timeout',
          error: {
            code: 'TIMEOUT',
            message: `Request timed out after ${timeout}ms`
          }
        }
      }

      return {
        success: false,
        message: error.message,
        error: {
          code: 'NETWORK_ERROR',
          message: error.message
        }
      }
    }
  }

  /**
   * Тест GraphQL подключения
   */
  private async testGraphQL(
    config: Record<string, unknown>,
    authConfig?: Record<string, unknown>
  ): Promise<{
    success: boolean
    message: string
    sampleData?: unknown
    error?: { code: string; message: string; details?: string }
  }> {
    const url = config.url as string
    const query = config.query as string
    const variables = config.variables as Record<string, unknown> | undefined
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      ...(config.headers as Record<string, string> || {}) 
    }

    if (authConfig) {
      this.applyAuth(headers, authConfig)
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          variables
        })
      })

      const data = await response.json() as { errors?: Array<{ message: string }>; data?: unknown }

      if (data.errors && data.errors.length > 0) {
        return {
          success: false,
          message: 'GraphQL errors',
          error: {
            code: 'GRAPHQL_ERROR',
            message: data.errors.map((e) => e.message).join(', ')
          }
        }
      }

      return {
        success: true,
        message: 'Connection successful',
        sampleData: this.truncateSampleData(data.data)
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: {
          code: 'GRAPHQL_ERROR',
          message: error.message
        }
      }
    }
  }

  /**
   * Тест Database подключения
   * TODO: Реализовать подключение к БД
   */
  private async testDatabase(
    config: Record<string, unknown>
  ): Promise<{
    success: boolean
    message: string
    sampleData?: unknown
    error?: { code: string; message: string; details?: string }
  }> {
    // Stub - в будущем реализовать подключение к PostgreSQL/MySQL/SQLite
    return {
      success: false,
      message: 'Database connections are not yet implemented',
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Database connection testing will be available in a future release'
      }
    }
  }

  /**
   * Тест External Service подключения
   */
  private async testExternalService(
    config: Record<string, unknown>,
    authConfig?: Record<string, unknown>
  ): Promise<{
    success: boolean
    message: string
    sampleData?: unknown
    error?: { code: string; message: string; details?: string }
  }> {
    // Используем REST API тест с предопределёнными настройками для сервиса
    const serviceType = config.serviceType as string
    let url = config.url as string

    // Модифицируем URL для разных сервисов
    if (serviceType === 'wordpress' && config.wordpress) {
      const wp = config.wordpress as Record<string, unknown>
      url = `${url}${wp.endpoint || '/wp-json/wp/v2/posts'}`
    } else if (serviceType === 'strapi' && config.strapi) {
      const strapi = config.strapi as Record<string, unknown>
      url = `${url}/api/${strapi.contentType || 'articles'}`
    }

    return this.testRestApi({ ...config, url, method: 'GET' }, authConfig)
  }

  /**
   * Тест Static Data
   */
  private testStaticData(
    config: Record<string, unknown>
  ): {
    success: boolean
    message: string
    sampleData?: unknown
    error?: { code: string; message: string; details?: string }
  } {
    try {
      const data = config.data
      
      if (data === undefined || data === null) {
        return {
          success: false,
          message: 'No data provided',
          error: {
            code: 'NO_DATA',
            message: 'Static data source requires data to be provided'
          }
        }
      }

      return {
        success: true,
        message: 'Static data is valid',
        sampleData: this.truncateSampleData(data)
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Invalid static data',
        error: {
          code: 'INVALID_DATA',
          message: error.message
        }
      }
    }
  }

  /**
   * Применяет авторизацию к headers
   */
  private applyAuth(headers: Record<string, string>, authConfig: Record<string, unknown>) {
    const authType = authConfig.type as string

    switch (authType) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${authConfig.token}`
        break
      
      case 'api-key':
        const placement = authConfig.placement as string
        const keyName = authConfig.keyName as string
        const key = authConfig.key as string
        
        if (placement === 'header') {
          headers[keyName] = key
        }
        // Query params обрабатываются отдельно при формировании URL
        break
      
      case 'basic':
        const credentials = Buffer.from(
          `${authConfig.username}:${authConfig.password}`
        ).toString('base64')
        headers['Authorization'] = `Basic ${credentials}`
        break
      
      case 'oauth2':
        if (authConfig.accessToken) {
          headers['Authorization'] = `Bearer ${authConfig.accessToken}`
        }
        break
      
      case 'custom':
        const customHeaders = authConfig.headers as Record<string, string>
        if (customHeaders) {
          Object.assign(headers, customHeaders)
        }
        break
    }
  }

  /**
   * Обрезает sample data для preview
   */
  private truncateSampleData(data: unknown, maxItems = 5, maxDepth = 3): unknown {
    if (maxDepth <= 0) return '[...]'
    
    if (Array.isArray(data)) {
      const truncated = data.slice(0, maxItems).map(
        item => this.truncateSampleData(item, maxItems, maxDepth - 1)
      )
      if (data.length > maxItems) {
        truncated.push(`... and ${data.length - maxItems} more items`)
      }
      return truncated
    }
    
    if (data && typeof data === 'object') {
      const result: Record<string, unknown> = {}
      const keys = Object.keys(data)
      
      for (let i = 0; i < Math.min(keys.length, 20); i++) {
        const key = keys[i]
        result[key] = this.truncateSampleData(
          (data as Record<string, unknown>)[key], 
          maxItems, 
          maxDepth - 1
        )
      }
      
      if (keys.length > 20) {
        result['...'] = `${keys.length - 20} more fields`
      }
      
      return result
    }
    
    // Обрезаем длинные строки
    if (typeof data === 'string' && data.length > 500) {
      return data.substring(0, 500) + '...'
    }
    
    return data
  }
}

export default new DataSourceController()
