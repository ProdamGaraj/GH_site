import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { DataBinding, DataBindingFullConfig, FilterConfig, SortConfig } from '../models/DataBinding'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { secureDataSourceService, FetchConfig, AuthConfig } from '../services/SecureDataSourceService'
import { dataFilterService } from '../services/DataFilterService'
import { dataTransformService } from '../services/DataTransformService'
import { CredentialsManager } from '../services/CredentialsManager'

/**
 * Data Binding Controller
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 2.1 Backend: Data Fetching Service
 * 
 * API для управления Data Bindings и получения данных
 */

const dataBindingRepository = AppDataSource.getRepository(DataBinding)
const dataSourceRepository = AppDataSource.getRepository(DataSourceEntity)

class DataBindingController {
  /**
   * GET /api/data-bindings
   * Получить все bindings (опционально по blockId или pageId)
   * blockId может быть одним ID или массивом ID (для поиска по nodeId и linkedBlockId)
   */
  async getAll(req: Request, res: Response) {
    try {
      const { blockId, pageId, bindingType } = req.query

      const queryBuilder = dataBindingRepository.createQueryBuilder('binding')
        .leftJoinAndSelect('binding.dataSource', 'dataSource')
        .orderBy('binding.priority', 'ASC')

      if (blockId) {
        // blockId может быть строкой или массивом (через запятую)
        const blockIds = typeof blockId === 'string' && blockId.includes(',') 
          ? blockId.split(',').map(id => id.trim())
          : [blockId as string]
        
        if (blockIds.length === 1) {
          queryBuilder.andWhere('binding.blockId = :blockId', { blockId: blockIds[0] })
        } else {
          queryBuilder.andWhere('binding.blockId IN (:...blockIds)', { blockIds })
        }
      }

      if (pageId) {
        queryBuilder.andWhere('binding.pageId = :pageId', { pageId })
      }

      if (bindingType) {
        queryBuilder.andWhere('binding.bindingType = :bindingType', { bindingType })
      }

      const bindings = await queryBuilder.getMany()

      res.json(bindings)
    } catch (error: any) {
      console.error('Error fetching bindings:', error)
      res.status(500).json({
        error: 'Failed to fetch bindings',
        message: error.message
      })
    }
  }

  /**
   * GET /api/data-bindings/:id
   * Получить один binding по ID
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params

      const binding = await dataBindingRepository.findOne({
        where: { id },
        relations: ['dataSource']
      })

      if (!binding) {
        return res.status(404).json({
          error: 'Binding not found',
          message: `Data binding with id "${id}" does not exist`
        })
      }

      res.json(binding)
    } catch (error: any) {
      console.error('Error fetching binding:', error)
      res.status(500).json({
        error: 'Failed to fetch binding',
        message: error.message
      })
    }
  }

  /**
   * POST /api/data-bindings
   * Создать новый binding
   */
  async create(req: Request, res: Response) {
    try {
      const { blockId, pageId, dataSourceId, bindingType, config, isActive, priority } = req.body

      // Валидация
      if (!blockId || !dataSourceId || !bindingType || !config) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'blockId, dataSourceId, bindingType, and config are required'
        })
      }

      // Проверяем существование DataSource
      const dataSource = await dataSourceRepository.findOne({ where: { id: dataSourceId } })
      if (!dataSource) {
        return res.status(404).json({
          error: 'Data source not found',
          message: `Data source with id "${dataSourceId}" does not exist`
        })
      }

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

      // Загружаем с relations
      const savedBinding = await dataBindingRepository.findOne({
        where: { id: binding.id },
        relations: ['dataSource']
      })

      res.status(201).json(savedBinding)
    } catch (error: any) {
      console.error('Error creating binding:', error)
      res.status(500).json({
        error: 'Failed to create binding',
        message: error.message
      })
    }
  }

  /**
   * PUT /api/data-bindings/:id
   * Обновить binding
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const updates = req.body

      console.log('📝 Updating binding:', id)
      console.log('📝 Updates received:', JSON.stringify(updates, null, 2))

      const binding = await dataBindingRepository.findOne({ where: { id } })

      if (!binding) {
        return res.status(404).json({
          error: 'Binding not found',
          message: `Data binding with id "${id}" does not exist`
        })
      }

      // Обновляем поля
      Object.assign(binding, {
        ...updates,
        updatedAt: new Date()
      })

      console.log('📝 Binding after assign:', JSON.stringify(binding.config, null, 2))

      await dataBindingRepository.save(binding)

      const updatedBinding = await dataBindingRepository.findOne({
        where: { id },
        relations: ['dataSource']
      })

      console.log('✅ Saved binding config:', JSON.stringify(updatedBinding?.config, null, 2))

      res.json(updatedBinding)
    } catch (error: any) {
      console.error('Error updating binding:', error)
      res.status(500).json({
        error: 'Failed to update binding',
        message: error.message
      })
    }
  }

  /**
   * DELETE /api/data-bindings/:id
   * Удалить binding
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      const binding = await dataBindingRepository.findOne({ where: { id } })

      if (!binding) {
        return res.status(404).json({
          error: 'Binding not found',
          message: `Data binding with id "${id}" does not exist`
        })
      }

      await dataBindingRepository.remove(binding)

      res.json({ message: 'Binding deleted successfully' })
    } catch (error: any) {
      console.error('Error deleting binding:', error)
      res.status(500).json({
        error: 'Failed to delete binding',
        message: error.message
      })
    }
  }

  /**
   * POST /api/data/fetch
   * Получить данные из источника с фильтрацией/сортировкой/пагинацией
   * 
   * Body:
   * - dataSourceId: string - ID источника данных
   * - config: object - конфигурация запроса (опционально)
   * - filters: FilterConfig[] - фильтры (опционально)
   * - sorting: SortConfig[] - сортировка (опционально)
   * - pagination: { page: number, limit: number } - пагинация (опционально)
   * - variables: object - переменные для фильтров (опционально)
   * - arrayPath: string - путь к массиву данных (опционально)
   */
  async fetchData(req: Request, res: Response) {
    try {
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

      if (!dataSourceId) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'dataSourceId is required'
        })
      }

      // Получаем Data Source
      const dataSource = await dataSourceRepository.findOne({ where: { id: dataSourceId } })

      if (!dataSource) {
        return res.status(404).json({
          error: 'Data source not found',
          message: `Data source with id "${dataSourceId}" does not exist`
        })
      }

      // Расшифровываем credentials
      let authConfig = undefined
      if (dataSource.authConfig) {
        authConfig = await CredentialsManager.decryptAuthConfig(dataSource.authConfig)
      }

      // Fetch данных
      const fetchConfig = (requestConfig || dataSource.config) as unknown as FetchConfig
      const result = await secureDataSourceService.fetchData(fetchConfig, authConfig as unknown as AuthConfig)

      if (!result.success) {
        // Обновляем статус в Data Source
        await dataSourceRepository.update(dataSourceId, {
          lastFetchAt: new Date(),
          lastFetchStatus: 'error',
          lastFetchError: result.error?.message
        })

        return res.status(502).json({
          error: 'Fetch failed',
          message: result.error?.message,
          details: result.error?.details
        })
      }

      // Обновляем статус успешного fetch
      await dataSourceRepository.update(dataSourceId, {
        lastFetchAt: new Date(),
        lastFetchStatus: 'success',
        lastFetchError: undefined
      })

      // Извлекаем массив данных по пути (если указан)
      let data = result.data
      if (arrayPath) {
        data = dataFilterService.getValueByPath(data, arrayPath)
        if (!Array.isArray(data)) {
          data = [data]
        }
      }

      // Если данные не массив, оборачиваем
      const dataArray = Array.isArray(data) ? data : [data]

      // Подготавливаем фильтры с resolved значениями
      let preparedFilters: FilterConfig[] | undefined = filters
      if (filters && (variables || urlParams)) {
        preparedFilters = dataFilterService.prepareFilters(filters, {
          variables,
          urlParams
        })
      }

      // Применяем фильтрацию, сортировку, пагинацию
      const processedResult = dataFilterService.process(
        dataArray,
        preparedFilters,
        sorting,
        pagination ? { enabled: true, itemsPerPage: pagination.limit || 10, style: 'numbers' } : undefined
      )

      // Если была пагинация, применяем page
      if (pagination?.page && pagination.page > 1) {
        const paginatedResult = dataFilterService.applyPagination(
          dataArray.filter((_, i) => {
            // Применяем фильтры заново для корректного подсчёта
            if (!preparedFilters || preparedFilters.length === 0) return true
            return dataFilterService.applyFilters([dataArray[i]], preparedFilters).length > 0
          }),
          { enabled: true, itemsPerPage: pagination.limit || 10, style: 'numbers' },
          pagination.page
        )
        
        res.json({
          success: true,
          data: paginatedResult.items,
          metadata: {
            total: processedResult.total,
            filtered: processedResult.filtered,
            page: paginatedResult.page,
            totalPages: paginatedResult.totalPages,
            responseTime: result.metadata?.responseTime
          }
        })
        return
      }

      res.json({
        success: true,
        data: processedResult.items,
        metadata: {
          total: processedResult.total,
          filtered: processedResult.filtered,
          page: processedResult.page,
          totalPages: processedResult.totalPages,
          responseTime: result.metadata?.responseTime
        }
      })
    } catch (error: any) {
      console.error('Error fetching data:', error)
      res.status(500).json({
        error: 'Failed to fetch data',
        message: error.message
      })
    }
  }

  /**
   * POST /api/data/fetch-with-binding
   * Получить данные используя конфигурацию binding
   * 
   * Body:
   * - bindingId: string - ID binding (опционально, если указан blockId)
   * - blockId: string - ID блока (опционально, если указан bindingId)
   * - pageId: string - ID страницы (опционально)
   * - variables: object - переменные (опционально)
   * - urlParams: object - URL параметры (опционально)
   * - page: number - номер страницы (опционально)
   */
  async fetchWithBinding(req: Request, res: Response) {
    try {
      const { bindingId, blockId, pageId, variables, urlParams, page } = req.body

      // Получаем binding
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

      if (!binding) {
        return res.status(404).json({
          error: 'Binding not found',
          message: 'No active input binding found for this block'
        })
      }

      const config = binding.config
      const inputConfig = config.inputConfig

      if (!inputConfig) {
        return res.status(400).json({
          error: 'Invalid binding',
          message: 'Binding has no input configuration'
        })
      }

      // Расшифровываем credentials
      let authConfig = undefined
      if (binding.dataSource.authConfig) {
        authConfig = await CredentialsManager.decryptAuthConfig(binding.dataSource.authConfig)
      }

      // Fetch основных данных
      const result = await secureDataSourceService.fetchData(
        binding.dataSource.config as unknown as FetchConfig,
        authConfig as unknown as AuthConfig
      )

      console.log('[fetchWithBinding] result from secureDataSourceService:', JSON.stringify(result, null, 2))

      if (!result.success) {
        // Обновляем статус binding
        await dataBindingRepository.update(binding.id, {
          lastFetchAt: new Date(),
          lastFetchStatus: 'error',
          lastFetchError: result.error?.message
        })

        return res.status(502).json({
          error: 'Fetch failed',
          message: result.error?.message
        })
      }

      // Извлекаем данные по arrayPath для Repeater
      let data = result.data
      console.log('[fetchWithBinding] BEFORE arrayPath - data type:', typeof data, 'arrayPath:', inputConfig.arrayPath)
      console.log('[fetchWithBinding] BEFORE arrayPath - data keys:', data ? Object.keys(data) : 'null')
      
      if (inputConfig.mode === 'repeater' && inputConfig.arrayPath) {
        console.log('[fetchWithBinding] Extracting arrayPath:', inputConfig.arrayPath, 'from data')
        data = dataFilterService.getValueByPath(data, inputConfig.arrayPath)
        console.log('[fetchWithBinding] AFTER getValueByPath - data type:', typeof data, 'isArray:', Array.isArray(data))
      }

      console.log('[fetchWithBinding] data after arrayPath extraction:', JSON.stringify(data, null, 2)?.substring(0, 500))

      const dataArray = Array.isArray(data) ? data : [data]

      console.log('[fetchWithBinding] dataArray:', dataArray.length, 'items')

      // Подготавливаем фильтры
      let preparedFilters = inputConfig.filters
      if (preparedFilters && (variables || urlParams)) {
        preparedFilters = dataFilterService.prepareFilters(preparedFilters, {
          variables,
          urlParams
        })
      }

      // Обработка данных
      const pagination = inputConfig.pagination
      const processedResult = dataFilterService.process(
        dataArray,
        preparedFilters,
        inputConfig.sorting,
        pagination
      )

      // Пагинация
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

      // Применяем маппинг (для Single mode) или возвращаем items (для Repeater)
      let mappedData: unknown

      if (inputConfig.mode === 'single' && inputConfig.fieldMappings && inputConfig.fieldMappings.length > 0) {
        mappedData = dataTransformService.applyMapping(
          finalItems[0],
          inputConfig.fieldMappings,
          { variables }
        )
      } else {
        // Для Repeater возвращаем массив, для Single без маппинга - первый элемент
        mappedData = inputConfig.mode === 'single' ? finalItems[0] : finalItems
      }

      console.log('[fetchWithBinding] mappedData for mode=' + inputConfig.mode + ':', JSON.stringify(mappedData, null, 2))

      // Вычисляемые поля
      if (config.computedFields && config.computedFields.length > 0) {
        if (inputConfig.mode === 'single') {
          const computed = await dataTransformService.applyComputedFields(
            finalItems[0],
            config.computedFields,
            { variables }
          )
          mappedData = { ...mappedData as object, ...computed }
        }
        // Для Repeater computed поля применяются на клиенте
      }

      // Обновляем статус binding
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
    } catch (error: any) {
      console.error('Error fetching with binding:', error)
      res.status(500).json({
        error: 'Failed to fetch data',
        message: error.message
      })
    }
  }

  /**
   * POST /api/data/submit-with-binding
   * �������� ������ ����� OUTPUT binding
   * 
   * �������� �: Stage 3.4 OUTPUT Bindings
   * - �������� ������
   * - ������������� payload
   * - ������� �� ������� API
   * - ���������� submission
   */
  async submitWithBinding(req: Request, res: Response) {
    try {
      const { bindingId, blockId, pageId, payload, skipValidation } = req.body

      if (!payload) {
        return res.status(400).json({
          error: 'Payload is required'
        })
      }

      // ������ binding
      let binding: DataBinding | null = null

      if (bindingId) {
        binding = await dataBindingRepository.findOne({
          where: { id: bindingId },
          relations: ['dataSource']
        })
      } else if (blockId) {
        binding = await dataBindingRepository.findOne({
          where: {
            blockId,
            bindingType: 'output',
            isActive: true
          },
          relations: ['dataSource']
        })
      }

      if (!binding) {
        return res.status(404).json({
          error: 'Output binding not found'
        })
      }

      if (!binding.dataSource) {
        return res.status(400).json({
          error: 'Data source not configured for this binding'
        })
      }

      const config = binding.config as DataBindingFullConfig
      const outputConfig = config.outputConfig

      if (!outputConfig) {
        return res.status(400).json({
          error: 'Output configuration not found'
        })
      }

      // �������� (���� ��������)
      // �������� (���� ���� �������)
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

      // ������������� payload ����� �������
      let transformedPayload = payload
      if (outputConfig.payloadMappings && outputConfig.payloadMappings.length > 0) {
        transformedPayload = await dataTransformService.applyFieldMappingsToPayload(
          payload,
          outputConfig.payloadMappings
        )
      }

      // ��������� endpoint � �����
      const endpoint = (outputConfig.endpointPath || binding.dataSource.config.baseUrl || binding.dataSource.config.url) as string | undefined
      const method = outputConfig.method || 'POST'
      const contentType = 'application/json'

      if (!endpoint) {
        return res.status(400).json({
          error: 'No endpoint configured for submission'
        })
      }

      // ������� auth ������������
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

      // ������ FetchConfig ��� submitData
      const fetchHeaders: Record<string, string> = {
        'Content-Type': contentType
      }
      const sourceHeaders = binding.dataSource.config.headers as Record<string, string> | undefined
      if (sourceHeaders) {
        Object.assign(fetchHeaders, sourceHeaders)
      }

      const fetchConfig: FetchConfig = {
        type: 'rest-api',
        url: endpoint,
        method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        headers: fetchHeaders
      }

      // ��������� ������
      const startTime = Date.now()
      try {
        const response = await secureDataSourceService.submitData(
          fetchConfig,
          authConfig,
          transformedPayload
        )

        const responseTime = Date.now() - startTime
        console.log('Submission successful:', {
          bindingId: binding.id,
          blockId: binding.blockId,
          endpoint,
          method,
          responseTime,
          status: response.metadata?.statusCode
        })

        // �������� ������ binding
        await dataBindingRepository.update(binding.id, {
          lastFetchAt: new Date(),
          lastFetchStatus: 'success',
          lastFetchError: null
        })

        res.json({
          success: true,
          data: response.data,
          metadata: {
            responseTime,
            status: response.metadata?.statusCode
          }
        })
      } catch (submitError: any) {
        const responseTime = Date.now() - startTime

        // ������� ������
        console.error('Submission failed:', {
          bindingId: binding.id,
          error: submitError.message,
          responseTime
        })

        // �������� ������ binding
        await dataBindingRepository.update(binding.id, {
          lastFetchAt: new Date(),
          lastFetchStatus: 'error',
          lastFetchError: submitError.message
        })

        res.status(submitError.response?.status || 500).json({
          success: false,
          error: 'Submission failed',
          message: submitError.message,
          metadata: {
            responseTime,
            status: submitError.response?.status
          }
        })
      }
    } catch (error: any) {
      console.error('Error in submitWithBinding:', error)
      res.status(500).json({
        error: 'Failed to submit data',
        message: error.message
      })
    }
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
   */
  async fetchWithTransforms(req: Request, res: Response) {
    try {
      const { 
        bindingId, 
        filters, 
        search, 
        sort, 
        pagination,
        computeFields,
        transformsOverride 
      } = req.body

      if (!bindingId) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'bindingId is required'
        })
      }

      // Получаем binding
      const binding = await dataBindingRepository.findOne({
        where: { id: bindingId },
        relations: ['dataSource']
      })

      if (!binding) {
        return res.status(404).json({
          error: 'Binding not found',
          message: `Data binding with id "${bindingId}" does not exist`
        })
      }

      const config = binding.config as DataBindingFullConfig
      const inputConfig = config.inputConfig

      if (!inputConfig) {
        return res.status(400).json({
          error: 'Invalid binding',
          message: 'Binding has no input configuration'
        })
      }

      // Расшифровываем credentials
      let authConfig = undefined
      if (binding.dataSource.authConfig) {
        authConfig = await CredentialsManager.decryptAuthConfig(binding.dataSource.authConfig)
      }

      // Fetch данных из источника
      const fetchResult = await secureDataSourceService.fetchData(
        binding.dataSource.config as unknown as FetchConfig,
        authConfig as unknown as AuthConfig
      )

      if (!fetchResult.success) {
        await dataBindingRepository.update(binding.id, {
          lastFetchAt: new Date(),
          lastFetchStatus: 'error',
          lastFetchError: fetchResult.error?.message
        })

        return res.status(502).json({
          error: 'Fetch failed',
          message: fetchResult.error?.message
        })
      }

      // Получаем responseMapping из DataSource config или используем дефолт
      const dsConfig = binding.dataSource.config as any
      const responseMapping = dsConfig.responseMapping || {
        dataPath: inputConfig.arrayPath || 'data',
        fieldMappings: undefined
      }

      // Получаем трансформации - приоритет у transformsOverride (для тестирования)
      const transforms = transformsOverride || (inputConfig as any).transforms || []

      console.log('📊 fetchWithTransforms - bindingId:', bindingId)
      console.log('📊 fetchWithTransforms - using transformsOverride:', !!transformsOverride)
      console.log('📊 fetchWithTransforms - transforms count:', transforms.length)
      console.log('📊 fetchWithTransforms - transforms:', JSON.stringify(transforms, null, 2))

      // Применяем трансформации через DataTransformService
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

      // Обновляем статус binding
      await dataBindingRepository.update(binding.id, {
        lastFetchAt: new Date(),
        lastFetchStatus: transformResult.success ? 'success' : 'error',
        lastFetchError: transformResult.error || null
      })

      if (!transformResult.success) {
        return res.status(500).json({
          error: 'Transform failed',
          message: transformResult.error
        })
      }

      res.json({
        success: true,
        data: transformResult.data,
        meta: transformResult.meta
      })
    } catch (error: any) {
      console.error('Error in fetchWithTransforms:', error)
      res.status(500).json({
        error: 'Failed to fetch and transform data',
        message: error.message
      })
    }
  }
}

export const dataBindingController = new DataBindingController()

export default dataBindingController









