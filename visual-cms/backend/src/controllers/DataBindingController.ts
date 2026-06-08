import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { DataBinding, DataBindingFullConfig, FilterConfig, SortConfig } from '../models/DataBinding'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { Page } from '../models/Page'
import { secureDataSourceService, FetchConfig, AuthConfig } from '../services/SecureDataSourceService'
import { cachedDataSourceService } from '../services/CachedDataSourceService'
import { dataFilterService } from '../services/DataFilterService'
import { dataTransformService } from '../services/DataTransformService'
import { CredentialsManager } from '../services/CredentialsManager'
import { subRequestEnricher } from '../services/SubRequestEnricher'
import { asyncHandler, NotFoundError, ValidationError, AppError } from '../middleware'

const dataBindingRepository = AppDataSource.getRepository(DataBinding)
const dataSourceRepository = AppDataSource.getRepository(DataSourceEntity)
const pageRepository = AppDataSource.getRepository(Page)

class DataBindingController {

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { blockId, pageId, bindingType } = req.query

    const queryBuilder = dataBindingRepository.createQueryBuilder('binding')
      .leftJoinAndSelect('binding.dataSource', 'dataSource')
      .orderBy('binding.priority', 'ASC')

    if (blockId) {
      const blockIds = typeof blockId === 'string' && blockId.includes(',')
        ? blockId.split(',').map(id => id.trim())
        : [blockId as string]

      if (blockIds.length === 1) {
        queryBuilder.andWhere('binding.blockId = :blockId', { blockId: blockIds[0] })
      } else {
        queryBuilder.andWhere('binding.blockId IN (:...blockIds)', { blockIds })
      }
    }

    if (pageId) queryBuilder.andWhere('binding.pageId = :pageId', { pageId })
    if (bindingType) queryBuilder.andWhere('binding.bindingType = :bindingType', { bindingType })

    const bindings = await queryBuilder.getMany()
    res.json(bindings)
  })

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const binding = await dataBindingRepository.findOne({
      where: { id },
      relations: ['dataSource']
    })
    if (!binding) throw new NotFoundError('DataBinding', id)
    res.json(binding)
  })

  create = asyncHandler(async (req: Request, res: Response) => {
    const { blockId, pageId, dataSourceId, bindingType, config, isActive, priority } = req.body

    const dataSource = await dataSourceRepository.findOne({ where: { id: dataSourceId } })
    if (!dataSource) throw new NotFoundError('DataSource', dataSourceId)

    const binding = dataBindingRepository.create({
      blockId,
      pageId: pageId || null,
      dataSourceId,
      bindingType,
      config,
      isActive: isActive !== undefined ? isActive : true,
      priority: priority || 0
    })

    await dataBindingRepository.save(binding)

    const savedBinding = await dataBindingRepository.findOne({
      where: { id: binding.id },
      relations: ['dataSource']
    })

    res.status(201).json(savedBinding)
  })

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const updates = req.body

    const binding = await dataBindingRepository.findOne({ where: { id } })
    if (!binding) throw new NotFoundError('DataBinding', id)

    Object.assign(binding, { ...updates, updatedAt: new Date() })
    await dataBindingRepository.save(binding)

    const updatedBinding = await dataBindingRepository.findOne({
      where: { id },
      relations: ['dataSource']
    })

    res.json(updatedBinding)
  })

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params
    const binding = await dataBindingRepository.findOne({ where: { id } })
    if (!binding) throw new NotFoundError('DataBinding', id)
    await dataBindingRepository.remove(binding)
    res.json({ message: 'Binding deleted successfully' })
  })

  fetchData = asyncHandler(async (req: Request, res: Response) => {
    const {
      dataSourceId,
      config: requestConfig,
      filters,
      sorting,
      pagination,
      variables,
      urlParams,
      arrayPath
    } = req.body

    const dataSource = await dataSourceRepository.findOne({ where: { id: dataSourceId } })
    if (!dataSource) throw new NotFoundError('DataSource', dataSourceId)

    let authConfig = undefined
    if (dataSource.authConfig) {
      authConfig = await CredentialsManager.decryptAuthConfig(dataSource.authConfig)
    }

    const fetchConfig = { type: dataSource.type, ...(requestConfig || dataSource.config) } as unknown as FetchConfig
    const result = await cachedDataSourceService.fetchData(dataSourceId, fetchConfig, authConfig as unknown as AuthConfig)

    if (!result.success) {
      await dataSourceRepository.update(dataSourceId, {
        lastFetchAt: new Date(),
        lastFetchStatus: 'error',
        lastFetchError: result.error?.message
      })
      throw new AppError(result.error?.message || 'Fetch failed', 502, 'FETCH_FAILED')
    }

    await dataSourceRepository.update(dataSourceId, {
      lastFetchAt: new Date(),
      lastFetchStatus: 'success',
      lastFetchError: undefined
    })

    let data = result.data
    if (arrayPath) {
      data = dataFilterService.getValueByPath(data, arrayPath)
      if (!Array.isArray(data)) data = [data]
    }

    const dataArray = Array.isArray(data) ? data : [data]

    let preparedFilters: FilterConfig[] | undefined = filters
    if (filters && (variables || urlParams)) {
      preparedFilters = dataFilterService.prepareFilters(filters, { variables, urlParams })
    }

    const processedResult = dataFilterService.process(
      dataArray,
      preparedFilters,
      sorting,
      pagination ? { enabled: true, itemsPerPage: pagination.limit || 10, style: 'numbers' } : undefined
    )

    if (pagination?.page && pagination.page > 1) {
      const paginatedResult = dataFilterService.applyPagination(
        dataArray.filter((_, i) => {
          if (!preparedFilters || preparedFilters.length === 0) return true
          return dataFilterService.applyFilters([dataArray[i]], preparedFilters).length > 0
        }),
        { enabled: true, itemsPerPage: pagination.limit || 10, style: 'numbers' },
        pagination.page
      )

      return res.json({
        success: true,
        data: paginatedResult.items,
        metadata: {
          total: processedResult.total,
          filtered: processedResult.filtered,
          page: paginatedResult.page,
          totalPages: paginatedResult.totalPages,
          responseTime: result.metadata?.responseTime,
          headers: result.metadata?.headers
        }
      })
    }

    res.json({
      success: true,
      data: processedResult.items,
      metadata: {
        total: processedResult.total,
        filtered: processedResult.filtered,
        page: processedResult.page,
        totalPages: processedResult.totalPages,
        responseTime: result.metadata?.responseTime,
        headers: result.metadata?.headers
      }
    })
  })

  fetchWithBinding = asyncHandler(async (req: Request, res: Response) => {
    const { bindingId, blockId, pageId, variables, urlParams, page } = req.body

    let binding: DataBinding | null = null

    if (bindingId) {
      binding = await dataBindingRepository.findOne({
        where: { id: bindingId },
        relations: ['dataSource']
      })
    } else if (blockId) {
      const query: any = { blockId, bindingType: 'input', isActive: true }
      if (pageId) query.pageId = pageId
      binding = await dataBindingRepository.findOne({
        where: query,
        relations: ['dataSource'],
        order: { priority: 'ASC' }
      })
    }

    if (!binding) throw new NotFoundError('DataBinding', bindingId || blockId || 'unknown')

    const config = binding.config
    const inputConfig = config.inputConfig
    if (!inputConfig) {
      throw new ValidationError('Binding has no input configuration')
    }

    let authConfig = undefined
    if (binding.dataSource.authConfig) {
      authConfig = await CredentialsManager.decryptAuthConfig(binding.dataSource.authConfig)
    }

    const result = await cachedDataSourceService.fetchData(
      binding.dataSource.id,
      { type: binding.dataSource.type, ...binding.dataSource.config } as unknown as FetchConfig,
      authConfig as unknown as AuthConfig
    )

    if (!result.success) {
      await dataBindingRepository.update(binding.id, {
        lastFetchAt: new Date(),
        lastFetchStatus: 'error',
        lastFetchError: result.error?.message
      })
      throw new AppError(result.error?.message || 'Fetch failed', 502, 'FETCH_FAILED')
    }

    let data = result.data
    if (inputConfig.mode === 'repeater' && inputConfig.arrayPath) {
      data = dataFilterService.getValueByPath(data, inputConfig.arrayPath)
    }

    const dataArray = Array.isArray(data) ? data : [data]

    let preparedFilters = inputConfig.filters
    if (preparedFilters && (variables || urlParams)) {
      preparedFilters = dataFilterService.prepareFilters(preparedFilters, { variables, urlParams })
    }

    const pagination = inputConfig.pagination
    const processedResult = dataFilterService.process(
      dataArray,
      preparedFilters,
      inputConfig.sorting,
      pagination
    )

    let finalItems = processedResult.items
    let finalPage = processedResult.page
    let finalTotalPages = processedResult.totalPages

    if (pagination?.enabled && page && page > 1) {
      const paginatedResult = dataFilterService.applyPagination(
        dataFilterService.applySorting(
          dataFilterService.applyFilters(dataArray, preparedFilters || []),
          inputConfig.sorting || []
        ),
        pagination,
        page
      )
      finalItems = paginatedResult.items
      finalPage = paginatedResult.page
      finalTotalPages = paginatedResult.totalPages
    }

    let mappedData: unknown
    if (inputConfig.mode === 'single' && inputConfig.fieldMappings && inputConfig.fieldMappings.length > 0) {
      mappedData = dataTransformService.applyMapping(
        finalItems[0],
        inputConfig.fieldMappings,
        { variables }
      )
    } else {
      mappedData = inputConfig.mode === 'single' ? finalItems[0] : finalItems
    }

    if (config.computedFields && config.computedFields.length > 0) {
      if (inputConfig.mode === 'single') {
        const computed = await dataTransformService.applyComputedFields(
          finalItems[0],
          config.computedFields,
          { variables }
        )
        mappedData = { ...mappedData as object, ...computed }
      }
    }

    await dataBindingRepository.update(binding.id, {
      lastFetchAt: new Date(),
      lastFetchStatus: 'success',
      lastFetchError: null
    })

    res.json({
      success: true,
      data: mappedData,
      metadata: {
        total: processedResult.total,
        filtered: processedResult.filtered,
        page: finalPage,
        totalPages: finalTotalPages,
        mode: inputConfig.mode,
        responseTime: result.metadata?.responseTime
      }
    })
  })

  submitWithBinding = asyncHandler(async (req: Request, res: Response) => {
    const { bindingId, blockId, pageId, payload, skipValidation } = req.body

    if (!payload) throw new ValidationError('Payload is required')

    let binding: DataBinding | null = null
    if (bindingId) {
      binding = await dataBindingRepository.findOne({
        where: { id: bindingId },
        relations: ['dataSource']
      })
    } else if (blockId) {
      binding = await dataBindingRepository.findOne({
        where: { blockId, bindingType: 'output', isActive: true },
        relations: ['dataSource']
      })
    }

    if (!binding) throw new NotFoundError('OutputBinding', bindingId || blockId || 'unknown')
    if (!binding.dataSource) throw new ValidationError('Data source not configured for this binding')

    const config = binding.config as DataBindingFullConfig
    const outputConfig = config.outputConfig
    if (!outputConfig) throw new ValidationError('Output configuration not found')

    // Validation
    if (outputConfig.validationRules && Object.keys(outputConfig.validationRules).length > 0 && !skipValidation) {
      const validationErrors = this.validatePayload(payload, this.flattenValidationRules(outputConfig.validationRules))
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          validationErrors
        })
      }
    }

    // Transform payload
    let transformedPayload = payload
    if (outputConfig.payloadMappings && outputConfig.payloadMappings.length > 0) {
      transformedPayload = await dataTransformService.applyFieldMappingsToPayload(
        payload,
        outputConfig.payloadMappings
      )
    }

    const endpoint = (outputConfig.endpointPath || binding.dataSource.config.baseUrl || binding.dataSource.config.url) as string | undefined
    const method = outputConfig.method || 'POST'
    if (!endpoint) throw new ValidationError('No endpoint configured for submission')

    let authConfig: AuthConfig | undefined
    if (binding.dataSource.config.authType && binding.dataSource.config.authType !== 'none') {
      const credentials = await this.resolveCredentials(binding.dataSource)
      authConfig = {
        type: binding.dataSource.config.authType as AuthConfig['type'],
        token: credentials.token,
        key: credentials.apiKey,
        username: credentials.username,
        password: credentials.password
      }
    }

    const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    const sourceHeaders = binding.dataSource.config.headers as Record<string, string> | undefined
    if (sourceHeaders) Object.assign(fetchHeaders, sourceHeaders)

    const fetchConfig: FetchConfig = {
      type: 'rest-api',
      url: endpoint,
      method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      headers: fetchHeaders
    }

    // Submit with inner try/catch for specific error handling
    const startTime = Date.now()
    try {
      const response = await secureDataSourceService.submitData(
        fetchConfig, authConfig, transformedPayload
      )
      const responseTime = Date.now() - startTime

      await dataBindingRepository.update(binding.id, {
        lastFetchAt: new Date(),
        lastFetchStatus: 'success',
        lastFetchError: null
      })

      res.json({
        success: true,
        data: response.data,
        metadata: { responseTime, status: response.metadata?.statusCode }
      })
    } catch (submitError: any) {
      const responseTime = Date.now() - startTime

      await dataBindingRepository.update(binding.id, {
        lastFetchAt: new Date(),
        lastFetchStatus: 'error',
        lastFetchError: submitError.message
      })

      res.status(submitError.response?.status || 500).json({
        success: false,
        error: 'Submission failed',
        message: submitError.message,
        metadata: { responseTime, status: submitError.response?.status }
      })
    }
  })

  fetchWithTransforms = asyncHandler(async (req: Request, res: Response) => {
    const {
      bindingId,
      filters,
      search,
      sort,
      pagination,
      computeFields,
      transformsOverride,
      configOverride
    } = req.body

    if (!bindingId) throw new ValidationError('bindingId is required')

    const binding = await dataBindingRepository.findOne({
      where: { id: bindingId },
      relations: ['dataSource']
    })
    if (!binding) throw new NotFoundError('DataBinding', bindingId)

    const config = binding.config as DataBindingFullConfig
    const inputConfig = config.inputConfig
    if (!inputConfig) throw new ValidationError('Binding has no input configuration')

    let authConfig = undefined
    if (binding.dataSource.authConfig) {
      authConfig = await CredentialsManager.decryptAuthConfig(binding.dataSource.authConfig)
    }

    const dsConfig = binding.dataSource.config as any
    let finalFetchConfig = { type: binding.dataSource.type, ...dsConfig } as unknown as FetchConfig

    if (inputConfig.endpoint) {
      const baseUrl = (dsConfig.url || '').replace(/\/$/, '')
      const path = (inputConfig.endpoint.path || '').replace(/^\//, '')
      const fullUrl = path ? `${baseUrl}/${path}` : baseUrl

      // Parse body string from endpoint config.
      // 'raw' → keep as-is; 'json'/'form-data' → parse to object so
      // SecureDataSourceService can re-serialize correctly.
      const bodyStr = (inputConfig.endpoint.body as string | undefined)?.trim()
      let endpointBody: unknown = undefined
      if (bodyStr) {
        if (inputConfig.endpoint.bodyFormat === 'raw') {
          endpointBody = bodyStr
        } else {
          try { endpointBody = JSON.parse(bodyStr) } catch { endpointBody = bodyStr }
        }
      }

      finalFetchConfig = {
        type: binding.dataSource.type,
        ...dsConfig,
        url: fullUrl,
        method: inputConfig.endpoint.method || dsConfig.method || 'GET',
        headers: { ...dsConfig.headers, ...inputConfig.endpoint.headers },
        queryParams: { ...dsConfig.queryParams, ...inputConfig.endpoint.queryParams },
        body: endpointBody,
        bodyFormat: inputConfig.endpoint.bodyFormat,
      } as unknown as FetchConfig
    }

    const fetchResult = binding.dataSource.type === 'page-variable'
      ? await this.resolvePageVariable(binding)
      : await cachedDataSourceService.fetchData(
          binding.dataSource.id, finalFetchConfig, authConfig as unknown as AuthConfig
        )

    if (!fetchResult.success) {
      await dataBindingRepository.update(binding.id, {
        lastFetchAt: new Date(),
        lastFetchStatus: 'error',
        lastFetchError: fetchResult.error?.message
      })
      throw new AppError(fetchResult.error?.message || 'Fetch failed', 502, 'FETCH_FAILED')
    }

    const dsResponseConfig = binding.dataSource.config as any
    const effectiveArrayPath = configOverride?.arrayPath || inputConfig.arrayPath || dsResponseConfig.responseMapping?.dataPath || ''
    const responseMapping = {
      dataPath: effectiveArrayPath,
      fieldMappings: dsResponseConfig.responseMapping?.fieldMappings
    }

    const transforms = configOverride?.transforms || transformsOverride || (inputConfig as any).transforms || []

    const transformResult = await dataTransformService.processWithTransforms(
      fetchResult.data,
      {
        dataPath: responseMapping.dataPath,
        fieldMappings: responseMapping.fieldMappings,
        transforms,
        filters,
        search,
        sort,
        pagination,
        computeFields
      }
    )

    await dataBindingRepository.update(binding.id, {
      lastFetchAt: new Date(),
      lastFetchStatus: transformResult.success ? 'success' : 'error',
      lastFetchError: transformResult.error || null
    })

    if (!transformResult.success) {
      throw new AppError(transformResult.error || 'Transform failed', 500, 'TRANSFORM_FAILED')
    }

    // Обогащение элементов под-запросами (цепочка, как в коллекциях): mainExtract → доп.источники.
    let outData = transformResult.data
    const subSources = inputConfig.additionalSources
    if (subSources?.length && outData) {
      if (Array.isArray(outData)) {
        const { items } = await subRequestEnricher.enrichItems(outData, subSources, inputConfig.mainExtract)
        outData = items
      } else if (typeof outData === 'object') {
        const { items } = await subRequestEnricher.enrichItems([outData], subSources, inputConfig.mainExtract)
        outData = items[0]
      }
    }

    res.json({
      success: true,
      data: outData,
      meta: transformResult.meta
    })
  })

  /**
   * Резолвит data source типа 'page-variable' напрямую из page.variables.
   * Используется в редакторе/preview, чтобы избежать round-trip и обеспечить
   * реактивный preview (изменение переменной → перерисовка репитера).
   */
  private async resolvePageVariable(binding: DataBinding): Promise<{
    success: boolean
    data: unknown
    error?: { message: string }
    metadata: { statusCode: number; headers: Record<string, string>; responseTime: number }
  }> {
    const startTime = Date.now()
    const variableName = (binding.dataSource.config as any)?.variableName
    const ok = (data: unknown) => ({
      success: true,
      data,
      metadata: { statusCode: 200, headers: { 'x-data-source-type': 'page-variable' }, responseTime: Date.now() - startTime },
    })
    if (!variableName || !binding.pageId) return ok([])
    const page = await pageRepository.findOne({ where: { id: binding.pageId } })
    const vars = (page?.variables as any)?.variables || []
    const def = vars.find((v: any) => v.name === variableName)
    return ok(def?.defaultValue ?? [])
  }


  /**
   * �������� payload �� ��������
   */

  /**
   * ������������ validationRules � ������� ������ ������
   * validationRules: Record<string, ValidationRule[]> -> Array<{ field, type, value, message }>
   */
  private flattenValidationRules(validationRules: Record<string, any[]>): any[] {
    const rules: any[] = []

    for (const [fieldName, fieldRules] of Object.entries(validationRules)) {
      for (const rule of fieldRules) {
        rules.push({
          field: fieldName,
          type: rule.type,
          value: rule.value,
          message: rule.message,
          customFunction: rule.customFunction
        })
      }
    }

    return rules
  }

  private validatePayload(payload: any, rules: any[]): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = []

    for (const rule of rules) {
      const value = this.getNestedValue(payload, rule.field)

      switch (rule.type) {
        case 'required':
          if (value === undefined || value === null || value === '') {
            errors.push({ field: rule.field, message: rule.message || 'Field is required' })
          }
          break

        case 'email':
          if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push({ field: rule.field, message: rule.message || 'Invalid email format' })
          }
          break

        case 'minLength':
          if (value && typeof value === 'string' && value.length < (rule.value as number)) {
            errors.push({ field: rule.field, message: rule.message || `Minimum length is ${rule.value}` })
          }
          break

        case 'maxLength':
          if (value && typeof value === 'string' && value.length > (rule.value as number)) {
            errors.push({ field: rule.field, message: rule.message || `Maximum length is ${rule.value}` })
          }
          break

        case 'min':
          if (value !== undefined && Number(value) < (rule.value as number)) {
            errors.push({ field: rule.field, message: rule.message || `Minimum value is ${rule.value}` })
          }
          break

        case 'max':
          if (value !== undefined && Number(value) > (rule.value as number)) {
            errors.push({ field: rule.field, message: rule.message || `Maximum value is ${rule.value}` })
          }
          break

        case 'pattern':
          if (value && !new RegExp(rule.value as string).test(value)) {
            errors.push({ field: rule.field, message: rule.message || 'Invalid format' })
          }
          break

        case 'custom':
          // Custom ��������� ����������� �� �������
          break
      }
    }

    return errors
  }

  /**
   * ������� ��������� �������� �� ����
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Получить credentials для DataSource
   */
  private async resolveCredentials(dataSource: DataSourceEntity): Promise<Record<string, string>> {
    const credentials: Record<string, string> = {}

    if (dataSource.config.apiKey) {
      credentials.apiKey = dataSource.config.apiKey as string
    }

    if (dataSource.config.username) {
      credentials.username = dataSource.config.username as string
    }

    if (dataSource.config.password) {
      //  возможно необходимо password получать из зашифрованного
      credentials.password = dataSource.config.password as string
    }

    if (dataSource.config.token) {
      credentials.token = dataSource.config.token as string
    }

    return credentials
  }

  /**
   * POST /api/data/fetch-with-transforms
   * Получить данные с применением трансформаций, фильтров, поиска и пагинации
   *
   * Body:
   * - bindingId: string - ID привязки
   * - filters: FilterCondition[] - динамические фильтры
   * - search: { query: string, fields: string[] } - поиск
   * - sort: { field: string, order: 'asc' | 'desc' } - сортировка
   * - pagination: { page: number, pageSize: number } - пагинация
   * - computeFields: string[] - поля для вычисления агрегатов
   * - transformsOverride: DataTransform[] - переопределение трансформаций (для тестирования)
   * - configOverride: { arrayPath?, transforms?, mode? } - переопределение конфигурации (для тестирования без сохранения)
   */
}

export const dataBindingController = new DataBindingController()

export default dataBindingController
