import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { DataSource, DataSourceType, DataSourceStatus } from '../models/DataSource'
import { CredentialsManager } from '../services/CredentialsManager'
import { secureDataSourceService, FetchConfig, AuthConfig } from '../services/SecureDataSourceService'
import { cachedDataSourceService } from '../services/CachedDataSourceService'
import { Like, In } from 'typeorm'
import { asyncHandler, NotFoundError, ValidationError } from '../middleware'
import { cacheService } from '../services/CacheService'
import { resolveTestUrl } from '../utils/testUrl'

export class DataSourceController {
  private getRepository() {
    return AppDataSource.getRepository(DataSource)
  }

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const dataSourceRepository = this.getRepository()
    const {
      search, type, status, groupId, tags,
      page = 1, limit = 20, sortBy = 'updatedAt', sortOrder = 'DESC'
    } = req.query

    const where: any = {}
    if (search) where.name = Like(`%${search}%`)
    if (type) where.type = type as DataSourceType
    if (status) where.status = status as DataSourceStatus
    if (groupId) where.groupId = groupId as string

    const [items, total] = await dataSourceRepository.findAndCount({
      where,
      order: { [sortBy as string]: sortOrder },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    })

    let filteredItems = items
    if (tags) {
      const tagsArray = Array.isArray(tags) ? tags : [tags]
      filteredItems = items.filter(item =>
        item.tags?.some(tag => tagsArray.includes(tag))
      )
    }

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
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const dataSourceRepository = this.getRepository()
    const { id } = req.params

    const dataSource = await dataSourceRepository.findOne({ where: { id } })
    if (!dataSource) throw new NotFoundError('DataSource', id)

    const maskedDataSource = {
      ...dataSource,
      authConfig: dataSource.authConfig
        ? CredentialsManager.maskAuthConfig(dataSource.authConfig)
        : undefined
    }

    res.json(maskedDataSource)
  })

  /**
   * Возвращает дешифрованный authConfig для existing DataSource
   */
  revealCredentials = asyncHandler(async (req: Request, res: Response) => {
    const dataSourceRepository = this.getRepository()
    const { id } = req.params

    const dataSource = await dataSourceRepository.findOne({ where: { id } })
    if (!dataSource) throw new NotFoundError('DataSource', id)

    if (!dataSource.authConfig) {
      return res.json({ authConfig: null })
    }

    const decrypted = await CredentialsManager.decryptAuthConfig(dataSource.authConfig)
    res.json({ authConfig: decrypted })
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const dataSourceRepository = this.getRepository()
    const { name, description, type, config, authConfig, groupId, tags, status } = req.body

    const encryptedAuthConfig = authConfig
      ? CredentialsManager.encryptAuthConfig(authConfig)
      : undefined

    const dataSource = dataSourceRepository.create({
      name, description, type, config,
      authConfig: encryptedAuthConfig,
      groupId, tags,
      status: status || 'draft',
      version: 1
    })

    await dataSourceRepository.save(dataSource)
    await cacheService.invalidateByTag('dataSources')

    const response = {
      ...dataSource,
      authConfig: dataSource.authConfig
        ? CredentialsManager.maskAuthConfig(dataSource.authConfig)
        : undefined
    }

    res.status(201).json(response)
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const dataSourceRepository = this.getRepository()
    const { id } = req.params
    const { name, description, type, config, authConfig, groupId, tags, status } = req.body

    const dataSource = await dataSourceRepository.findOne({ where: { id } })
    if (!dataSource) throw new NotFoundError('DataSource', id)

    if (name !== undefined) dataSource.name = name
    if (description !== undefined) dataSource.description = description
    if (type !== undefined) dataSource.type = type
    if (config !== undefined) dataSource.config = config
    if (groupId !== undefined) dataSource.groupId = groupId
    if (tags !== undefined) dataSource.tags = tags
    if (status !== undefined) dataSource.status = status

    if (authConfig && !this.isMaskedAuthConfig(authConfig)) {
      dataSource.authConfig = CredentialsManager.encryptAuthConfig(authConfig)
    }

    dataSource.version += 1
    await dataSourceRepository.save(dataSource)
    await cacheService.invalidateByTag('dataSources')
    await cachedDataSourceService.invalidateCache(id)

    const response = {
      ...dataSource,
      authConfig: dataSource.authConfig
        ? CredentialsManager.maskAuthConfig(dataSource.authConfig)
        : undefined
    }

    res.json(response)
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    const dataSourceRepository = this.getRepository()
    const { id } = req.params
    const result = await dataSourceRepository.delete(id)
    await cacheService.invalidateByTag('dataSources')
    await cachedDataSourceService.invalidateCache(id)
    if (result.affected === 0) throw new NotFoundError('DataSource', id)
    res.status(204).send()
  })

  testConnection = asyncHandler(async (req: Request, res: Response) => {
    const dataSourceRepository = this.getRepository()
    const { id } = req.params

    let config: Record<string, unknown>
    let authConfig: Record<string, unknown> | undefined
    let type: DataSourceType

    if (id && id !== 'new') {
      const dataSource = await dataSourceRepository.findOne({ where: { id } })
      if (!dataSource) throw new NotFoundError('DataSource', id)

      config = dataSource.config
      type = dataSource.type
      if (dataSource.authConfig) {
        authConfig = await CredentialsManager.decryptAuthConfig(dataSource.authConfig)
      }
    } else {
      const { type: bodyType, config: bodyConfig, authConfig: bodyAuthConfig } = req.body
      if (!bodyType || !bodyConfig) {
        throw new ValidationError('type and config are required for testing')
      }
      type = bodyType
      config = bodyConfig
      authConfig = bodyAuthConfig
    }

    // Override тестового endpoint/метода из тела запроса — чтобы протестировать
    // правку «Тестировать по методу» у существующего источника без пересохранения.
    // Влияет только на текущий тест; config в БД не меняется.
    const overrideKeys = ['testEndpoint', 'testMethod', 'testBody', 'insecureTLS']
    if (req.body && overrideKeys.some(k => Object.prototype.hasOwnProperty.call(req.body, k))) {
      const override: Record<string, unknown> = {}
      for (const k of overrideKeys) {
        if (Object.prototype.hasOwnProperty.call(req.body, k)) override[k] = req.body[k]
      }
      config = { ...config, ...override }
    }

    const startTime = Date.now()
    const result = await this.performConnectionTestWithRetry(type, config, authConfig)
    const responseTime = Date.now() - startTime

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
  })

  testNewConnection = asyncHandler(async (req: Request, res: Response) => {
    const { type, config, authConfig } = req.body
    const startTime = Date.now()
    const result = await this.performConnectionTestWithRetry(type, config, authConfig)
    const responseTime = Date.now() - startTime

    res.json({
      success: result.success,
      message: result.message,
      responseTime,
      sampleData: result.sampleData,
      error: result.error
    })
  })

  duplicate = asyncHandler(async (req: Request, res: Response) => {
    const dataSourceRepository = this.getRepository()
    const { id } = req.params
    const { name: newName } = req.body

    const original = await dataSourceRepository.findOne({ where: { id } })
    if (!original) throw new NotFoundError('DataSource', id)

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
    await cacheService.invalidateByTag('dataSources')

    const response = {
      ...duplicate,
      authConfig: duplicate.authConfig
        ? CredentialsManager.maskAuthConfig(duplicate.authConfig)
        : undefined
    }

    res.status(201).json(response)
  })

  invalidateCache = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const dataSourceRepository = this.getRepository()

    const dataSource = await dataSourceRepository.findOne({ where: { id } })
    if (!dataSource) throw new NotFoundError('DataSource', id)

    const invalidated = await cachedDataSourceService.invalidateCache(id)
    res.json({ success: true, invalidated, message: `Cache invalidated for DataSource ${id}` })
  })


  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Проверяет, является ли authConfig замаскированным (с frontend)
   */
  /**
   * Проверяет, является ли authConfig замаскированным (с frontend)
   */
  private isMaskedAuthConfig(authConfig: Record<string, unknown>): boolean {
    const sensitiveFields = ['token', 'key', 'password', 'clientSecret', 'accessToken', 'refreshToken', 'appSecret']

    for (const field of sensitiveFields) {
      const value = authConfig[field]
      if (value && typeof value === 'object' && '_masked' in (value as object)) {
        return true
      }
    }

    return false
  }

  /**
   * Транзиентная ли сетевая ошибка теста — стоит ли повторить.
   * Ловим временные сбои DNS/сети (EAI_AGAIN, таймауты, сброс соединения),
   * но НЕ устойчивые (CERT_HAS_EXPIRED, ECONNREFUSED, HTTP-ошибки, невалидный конфиг).
   */
  private isTransientTestError(result: { success: boolean; error?: { message?: string } }): boolean {
    if (result.success) return false
    const msg = result.error?.message || ''
    return /EAI_AGAIN|EAI_FAIL|ETIMEDOUT|ECONNRESET|ENETUNREACH|ENOTFOUND|timeout/i.test(msg)
  }

  /**
   * Тест подключения с ретраем на транзиентных сетевых ошибках. Кратковременный
   * сбой DNS/сети (частый при доступе к внутренним хостам через VPN) не должен
   * показываться как красная ошибка — делаем до 3 попыток с короткой паузой.
   */
  private async performConnectionTestWithRetry(
    type: DataSourceType,
    config: Record<string, unknown>,
    authConfig?: Record<string, unknown>
  ): Promise<{
    success: boolean
    message: string
    sampleData?: unknown
    error?: { code: string; message: string; details?: string }
  }> {
    const maxAttempts = 3
    let result = await this.performConnectionTest(type, config, authConfig)
    for (let attempt = 2; attempt <= maxAttempts && this.isTransientTestError(result); attempt++) {
      await new Promise(r => setTimeout(r, 400 * (attempt - 1)))
      result = await this.performConnectionTest(type, config, authConfig)
    }
    return result
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
   * Тест REST API подключения — делегирует SecureDataSourceService
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
    // Тест по конкретному методу/endpoint'у. Базовый URL у источника часто
    // отдаёт ошибку (это origin, а не рабочий endpoint), поэтому пользователь может
    // задать тестовый путь (config.testEndpoint) и метод (config.testMethod).
    // Заголовки/queryParams/auth берутся из источника. Если testEndpoint пуст —
    // тест по базовому URL, как раньше.
    const baseUrl = config.url as string
    const testEndpoint = (config.testEndpoint as string | undefined)?.trim()
    const effectiveUrl = resolveTestUrl(baseUrl, testEndpoint)
    const effectiveMethod = (testEndpoint
      ? (config.testMethod as FetchConfig['method'])
      : (config.method as FetchConfig['method'])) || 'GET'

    const fetchConfig: FetchConfig = {
      type: (config.type as FetchConfig['type']) || 'rest-api',
      url: effectiveUrl,
      method: effectiveMethod,
      headers: config.headers as Record<string, string> | undefined,
      queryParams: config.queryParams as Record<string, string> | undefined,
      timeout: (config.timeout as number) || 30000,
      insecureTLS: config.insecureTLS as boolean | undefined,
    }

    // Тело тестового запроса (для POST/PUT/PATCH). Парсим как JSON; при невалидном
    // JSON возвращаем понятную ошибку, а не уходим в fetch с мусором.
    const testBodyRaw = (config.testBody as string | undefined)?.trim()
    if (testBodyRaw && ['POST', 'PUT', 'PATCH'].includes(effectiveMethod || '')) {
      try {
        fetchConfig.body = JSON.parse(testBodyRaw)
      } catch {
        return {
          success: false,
          message: 'Некорректный JSON в теле тестового запроса',
          error: { code: 'INVALID_TEST_BODY', message: 'Тело тестового запроса должно быть валидным JSON' },
        }
      }
    }

    const result = await secureDataSourceService.fetchData(
      fetchConfig,
      authConfig as AuthConfig | undefined
    )

    if (!result.success) {
      return {
        success: false,
        message: result.error?.message || 'Connection failed',
        error: result.error,
      }
    }

    // Проверяем на false positive: API вернул 200 но body содержит error
    if (this.isErrorInResponseBody(result.data)) {
      const errMsg = this.extractErrorMessage(result.data)
      return {
        success: false,
        message: errMsg,
        sampleData: this.truncateSampleData(result.data),
        error: {
          code: 'API_ERROR',
          message: errMsg,
        },
      }
    }

    return {
      success: true,
      message: 'Connection successful',
      sampleData: this.truncateSampleData(result.data),
    }
  }

  /**
   * Тест GraphQL подключения — делегирует SecureDataSourceService
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
    const fetchConfig: FetchConfig = {
      type: 'graphql',
      url: config.url as string,
      query: config.query as string,
      variables: config.variables as Record<string, unknown> | undefined,
      headers: config.headers as Record<string, string> | undefined,
      timeout: (config.timeout as number) || 30000,
    }

    const result = await secureDataSourceService.fetchData(
      fetchConfig,
      authConfig as AuthConfig | undefined
    )

    if (!result.success) {
      return {
        success: false,
        message: result.error?.message || 'GraphQL query failed',
        error: result.error,
      }
    }

    return {
      success: true,
      message: 'Connection successful',
      sampleData: this.truncateSampleData(result.data),
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
   * Проверяет, содержит ли body ответа признаки ошибки (false positive detection)
   */
  private isErrorInResponseBody(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false
    const obj = data as Record<string, unknown>
    // Паттерн: { error: true, message: "..." }
    if (obj.error === true) return true
    // Паттерн: { success: false }
    if (obj.success === false) return true
    return false
  }

  /**
   * Извлекает сообщение об ошибке из body ответа
   */
  private extractErrorMessage(data: unknown): string {
    if (!data || typeof data !== 'object') return 'Unknown error'
    const obj = data as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.error_message === 'string') return obj.error_message
    return 'API returned an error response'
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
   * Обрезает sample data для preview
   */
  private truncateSampleData(data: unknown, maxItems = 5, maxDepth = 10): unknown {
    if (maxDepth <= 0) return '[...]'

    if (Array.isArray(data)) {
      const truncated = data.slice(0, maxItems).map(
        (item, index) => this.truncateSampleData(
          item,
          maxItems,
          index === 0 ? 100 : maxDepth - 1  // первый элемент — полная глубина
        )
      )
      if (data.length > maxItems) {
        truncated.push(`... and ${data.length - maxItems} more items`)
      }
      return truncated
    }

    if (data && typeof data === 'object') {
      const result: Record<string, unknown> = {}
      const keys = Object.keys(data)

      for (let i = 0; i < Math.min(keys.length, 50); i++) {
        const key = keys[i]
        result[key] = this.truncateSampleData(
          (data as Record<string, unknown>)[key],
          maxItems,
          maxDepth - 1
        )
      }

      if (keys.length > 50) {
        result['...'] = `${keys.length - 50} more fields`
      }

      return result
    }

    // Обрезаем длинные строки
    if (typeof data === 'string' && data.length > 1000) {
      return data.substring(0, 1000) + '...'
    }

    return data
  }
}

export default new DataSourceController()