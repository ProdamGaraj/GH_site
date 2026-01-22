import { Request, Response } from 'express'
import { AppDataSource } from '../config/database'
import { DataSubmission, CreateSubmissionDto, UpdateSubmissionResultDto, SubmissionStatus } from '../models/DataSubmission'
import { DataSource } from '../models/DataSource'
import { DataBinding } from '../models/DataBinding'
import validationService, { FieldValidation, ValidationResult } from '../services/ValidationService'

// Используем нативный fetch из Node.js 18+
// import { v4 as uuidv4 } from 'uuid' - не нужен, UUID генерит TypeORM

/**
 * DataSubmitController
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Контроллер для отправки данных через OUTPUT Bindings.
 * Поддерживает POST/PUT/PATCH/DELETE, валидацию, логирование.
 */

const submissionRepository = AppDataSource.getRepository(DataSubmission)
const dataSourceRepository = AppDataSource.getRepository(DataSource)
const dataBindingRepository = AppDataSource.getRepository(DataBinding)

/**
 * Интерфейс запроса на отправку данных
 */
interface SubmitDataRequest {
  // Идентификация источника
  dataSourceId?: string           // ID Data Source
  outputBindingId?: string        // ID Output Binding (если используется)
  
  // Или прямой endpoint
  endpoint?: string               // URL для отправки
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  
  // Данные
  data: Record<string, unknown>   // Payload
  
  // Mapping (если нужно преобразовать имена полей)
  fieldMapping?: Record<string, string>  // localField -> apiField
  
  // Дополнительные данные
  additionalData?: {
    timestamp?: boolean           // Добавить timestamp
    pageUrl?: boolean             // Добавить URL страницы
    sessionId?: boolean           // Добавить session ID
    customFields?: Record<string, unknown>
  }
  
  // Валидация
  validations?: FieldValidation[]
  
  // Мета-информация
  pageId?: string
  blockId?: string
  trigger?: 'form_submit' | 'button_click' | 'input_change' | 'input_blur' | 'interval' | 'custom_event' | 'api_call'
  
  // Retry
  isRetry?: boolean
  attemptNumber?: number
  originalSubmissionId?: string
}

/**
 * Результат отправки
 */
interface SubmitResult {
  success: boolean
  submissionId: string
  data?: unknown
  status?: number
  error?: {
    code: string
    message: string
    details?: unknown
  }
  validationErrors?: Record<string, string[]>
}

class DataSubmitController {
  /**
   * POST /api/data/submit
   * Отправка данных
   */
  async submit(req: Request, res: Response) {
    const startTime = Date.now()
    let submission: DataSubmission | null = null
    
    try {
      const body = req.body as SubmitDataRequest
      const {
        dataSourceId,
        outputBindingId,
        endpoint: directEndpoint,
        method = 'POST',
        data,
        fieldMapping,
        additionalData,
        validations,
        pageId,
        blockId,
        trigger = 'api_call',
        isRetry = false,
        attemptNumber = 1,
        originalSubmissionId,
      } = body

      // Получаем информацию о клиенте
      const clientIp = this.getClientIp(req)
      const userAgent = this.truncateUserAgent(req.headers['user-agent'] || '')
      const referrer = req.headers['referer'] as string || undefined
      const sessionId = req.headers['x-session-id'] as string || undefined

      // Определяем endpoint и настройки
      let endpoint: string
      let headers: Record<string, string> = {}
      let authConfig: Record<string, unknown> | null = null

      if (dataSourceId) {
        // Используем Data Source
        const dataSource = await dataSourceRepository.findOne({ 
          where: { id: dataSourceId } 
        })
        
        if (!dataSource) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'DATA_SOURCE_NOT_FOUND',
              message: 'Data Source не найден',
            }
          })
        }

        // Получаем endpoint и headers из config
        const dsConfig = dataSource.config || {}
        endpoint = (dsConfig.url || dsConfig.endpoint) as string || ''
        headers = (dsConfig.headers as Record<string, string>) || {}
        authConfig = dataSource.authConfig || null
      } else if (directEndpoint) {
        endpoint = directEndpoint
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ENDPOINT',
            message: 'Необходимо указать dataSourceId или endpoint',
          }
        })
      }

      // Создаём запись о submission
      submission = submissionRepository.create({
        dataSourceId: dataSourceId || null,
        pageId: pageId || null,
        blockId: blockId || null,
        outputBindingId: outputBindingId || null,
        method,
        endpoint: this.sanitizeEndpoint(endpoint),
        trigger,
        status: 'pending',
        fieldsCount: Object.keys(data).length,
        fieldNames: Object.keys(data),
        anonymizedIp: this.anonymizeIp(clientIp),
        userAgent,
        referrer,
        sessionId,
        isRetry,
        attemptNumber,
        originalSubmissionId,
      })

      await submissionRepository.save(submission)

      // Валидация данных
      if (validations && validations.length > 0) {
        const validationResult = validationService.validate(data, validations)
        
        if (!validationResult.isValid) {
          const result = await this.updateSubmissionResult(submission, {
            status: 'failed',
            durationMs: Date.now() - startTime,
            errorCode: 'VALIDATION_ERROR',
            errorMessage: 'Ошибка валидации данных',
            validationErrorsCount: validationService.getErrorFieldNames(validationResult).length,
            validationErrorFields: validationService.getErrorFieldNames(validationResult),
          })

          return res.status(400).json({
            success: false,
            submissionId: submission.id,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Ошибка валидации данных',
            },
            validationErrors: validationResult.errors,
          } as SubmitResult)
        }

        // Используем sanitized данные
        Object.assign(data, validationResult.sanitizedData)
      }

      // Применяем field mapping
      let payload: Record<string, unknown> = data
      if (fieldMapping) {
        payload = this.applyFieldMapping(data, fieldMapping)
      }

      // Добавляем дополнительные данные
      if (additionalData) {
        if (additionalData.timestamp) {
          payload._timestamp = new Date().toISOString()
        }
        if (additionalData.pageUrl && referrer) {
          payload._pageUrl = referrer
        }
        if (additionalData.sessionId && sessionId) {
          payload._sessionId = sessionId
        }
        if (additionalData.customFields) {
          Object.assign(payload, additionalData.customFields)
        }
      }

      // Настраиваем запрос с использованием нативного fetch
      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      }

      // Добавляем авторизацию
      if (authConfig) {
        this.applyAuth(fetchHeaders, authConfig)
      }

      // Создаём AbortController для timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000) // 30 секунд

      try {
        // Отправляем запрос с fetch
        const response = await fetch(endpoint, {
          method: method,
          headers: fetchHeaders,
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        
        clearTimeout(timeout)

        const responseData = await response.json().catch(() => null)

        if (!response.ok) {
          // Сервер вернул ошибку
          await this.updateSubmissionResult(submission, {
            status: 'failed',
            responseStatusCode: response.status,
            durationMs: Date.now() - startTime,
            errorCode: `HTTP_${response.status}`,
            errorMessage: `Сервер вернул ошибку: ${response.status}`,
          })

          return res.status(response.status).json({
            success: false,
            submissionId: submission.id,
            error: {
              code: `HTTP_${response.status}`,
              message: `Сервер вернул ошибку: ${response.status}`,
              details: responseData,
            },
          } as SubmitResult)
        }

        // Успешная отправка
        await this.updateSubmissionResult(submission, {
          status: 'success',
          responseStatusCode: response.status,
          durationMs: Date.now() - startTime,
        })

        return res.json({
          success: true,
          submissionId: submission.id,
          data: responseData,
          status: response.status,
        } as SubmitResult)

      } catch (fetchError) {
        clearTimeout(timeout)
        throw fetchError
      }

    } catch (error) {
      const durationMs = Date.now() - startTime
      const fetchError = error as Error

      // Определяем тип ошибки
      let status: SubmissionStatus = 'failed'
      let errorCode = 'UNKNOWN_ERROR'
      let errorMessage = 'Произошла ошибка при отправке данных'
      let responseStatus: number | undefined

      if (fetchError.name === 'AbortError') {
        status = 'timeout'
        errorCode = 'TIMEOUT'
        errorMessage = 'Превышено время ожидания ответа'
      } else if (fetchError.message?.includes('fetch')) {
        errorCode = 'NO_RESPONSE'
        errorMessage = 'Сервер не ответил на запрос: ' + fetchError.message
      }

      // Обновляем submission
      if (submission) {
        await this.updateSubmissionResult(submission, {
          status,
          responseStatusCode: responseStatus,
          durationMs,
          errorCode,
          errorMessage,
        })
      }

      return res.status(responseStatus || 500).json({
        success: false,
        submissionId: submission?.id,
        error: {
          code: errorCode,
          message: errorMessage,
          details: fetchError.message,
        },
      } as SubmitResult)
    }
  }

  /**
   * GET /api/data/submissions
   * Получить историю отправок (для аналитики)
   */
  async getSubmissions(req: Request, res: Response) {
    try {
      const {
        pageId,
        blockId,
        dataSourceId,
        status,
        startDate,
        endDate,
        limit = 50,
        offset = 0,
      } = req.query

      const queryBuilder = submissionRepository.createQueryBuilder('submission')
        .orderBy('submission.createdAt', 'DESC')
        .take(Number(limit))
        .skip(Number(offset))

      if (pageId) {
        queryBuilder.andWhere('submission.pageId = :pageId', { pageId })
      }
      if (blockId) {
        queryBuilder.andWhere('submission.blockId = :blockId', { blockId })
      }
      if (dataSourceId) {
        queryBuilder.andWhere('submission.dataSourceId = :dataSourceId', { dataSourceId })
      }
      if (status) {
        queryBuilder.andWhere('submission.status = :status', { status })
      }
      if (startDate) {
        queryBuilder.andWhere('submission.createdAt >= :startDate', { startDate })
      }
      if (endDate) {
        queryBuilder.andWhere('submission.createdAt <= :endDate', { endDate })
      }

      const [submissions, total] = await queryBuilder.getManyAndCount()

      return res.json({
        items: submissions,
        total,
        limit: Number(limit),
        offset: Number(offset),
      })
    } catch (error) {
      console.error('Error fetching submissions:', error)
      return res.status(500).json({
        error: 'Ошибка получения истории отправок',
      })
    }
  }

  /**
   * GET /api/data/submissions/:id
   * Получить одну запись
   */
  async getSubmissionById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const submission = await submissionRepository.findOne({ where: { id } })

      if (!submission) {
        return res.status(404).json({ error: 'Запись не найдена' })
      }

      return res.json(submission)
    } catch (error) {
      console.error('Error fetching submission:', error)
      return res.status(500).json({ error: 'Ошибка получения записи' })
    }
  }

  /**
   * GET /api/data/submissions/stats
   * Статистика отправок
   */
  async getStats(req: Request, res: Response) {
    try {
      const { pageId, dataSourceId, startDate, endDate } = req.query

      let whereClause = ''
      const params: Record<string, unknown> = {}

      if (pageId) {
        whereClause += ' AND "pageId" = :pageId'
        params.pageId = pageId
      }
      if (dataSourceId) {
        whereClause += ' AND "dataSourceId" = :dataSourceId'
        params.dataSourceId = dataSourceId
      }
      if (startDate) {
        whereClause += ' AND "createdAt" >= :startDate'
        params.startDate = startDate
      }
      if (endDate) {
        whereClause += ' AND "createdAt" <= :endDate'
        params.endDate = endDate
      }

      const stats = await submissionRepository.query(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG("durationMs") as avg_duration,
          COUNT(CASE WHEN "validationErrorsCount" > 0 THEN 1 END) as validation_errors
        FROM data_submissions
        WHERE 1=1 ${whereClause}
        GROUP BY status
      `, Object.values(params))

      const total = await submissionRepository.query(`
        SELECT COUNT(*) as total
        FROM data_submissions
        WHERE 1=1 ${whereClause}
      `, Object.values(params))

      return res.json({
        total: Number(total[0]?.total || 0),
        byStatus: stats,
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
      return res.status(500).json({ error: 'Ошибка получения статистики' })
    }
  }

  // ============ Helper Methods ============

  /**
   * Обновить результат submission
   */
  private async updateSubmissionResult(
    submission: DataSubmission,
    result: UpdateSubmissionResultDto
  ): Promise<DataSubmission> {
    Object.assign(submission, result)
    return submissionRepository.save(submission)
  }

  /**
   * Получить IP клиента
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for']
    if (forwarded) {
      const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')
      return ips[0].trim()
    }
    return req.ip || req.socket.remoteAddress || ''
  }

  /**
   * Анонимизировать IP (убираем последний октет)
   */
  private anonymizeIp(ip: string): string {
    if (!ip) return ''
    
    // IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.')
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0`
      }
    }
    
    // IPv6 - обрезаем до первых 4 групп
    if (ip.includes(':')) {
      const parts = ip.split(':')
      return parts.slice(0, 4).join(':') + '::'
    }

    return ip
  }

  /**
   * Обрезать User Agent
   */
  private truncateUserAgent(ua: string): string {
    return ua.substring(0, 200)
  }

  /**
   * Очистить endpoint от sensitive данных для логирования
   */
  private sanitizeEndpoint(endpoint: string): string {
    try {
      const url = new URL(endpoint)
      // Убираем query params, которые могут содержать токены
      url.search = ''
      return url.toString()
    } catch {
      return endpoint.split('?')[0]
    }
  }

  /**
   * Применить field mapping
   */
  private applyFieldMapping(
    data: Record<string, unknown>,
    mapping: Record<string, string>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [localField, value] of Object.entries(data)) {
      const apiField = mapping[localField] || localField
      result[apiField] = value
    }

    return result
  }

  /**
   * Применить авторизацию к запросу (для fetch headers)
   */
  private applyAuth(
    headers: Record<string, string>,
    authConfig: Record<string, unknown>
  ): void {
    const authType = authConfig.type as string

    switch (authType) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${authConfig.token}`
        break

      case 'api-key':
        const headerName = (authConfig.headerName as string) || 'X-API-Key'
        headers[headerName] = authConfig.apiKey as string
        break

      case 'basic':
        const credentials = Buffer.from(
          `${authConfig.username}:${authConfig.password}`
        ).toString('base64')
        headers['Authorization'] = `Basic ${credentials}`
        break

      case 'oauth2':
        // OAuth2 токен должен быть уже получен
        if (authConfig.accessToken) {
          headers['Authorization'] = `Bearer ${authConfig.accessToken}`
        }
        break
    }
  }
}

export default new DataSubmitController()
