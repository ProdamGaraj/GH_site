import { CredentialsManager } from './CredentialsManager'

/**
 * Secure Data Source Service
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 2.1 Backend: Data Fetching Service
 * 
 * Безопасное получение данных из внешних источников с поддержкой авторизации.
 * Все credentials расшифровываются только на backend.
 */

// Типы
export interface FetchConfig {
  type: 'rest-api' | 'feed' | 'graphql' | 'static'
  url?: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  queryParams?: Record<string, string>
  body?: unknown
  bodyFormat?: 'json' | 'form-data' | 'raw'
  timeout?: number
  // GraphQL
  query?: string
  variables?: Record<string, unknown>
  // Static
  data?: unknown
}

export interface AuthConfig {
  type: 'none' | 'bearer' | 'api-key' | 'basic' | 'oauth2' | 'custom'
  // Bearer
  token?: string
  // API Key
  key?: string
  keyName?: string
  placement?: 'header' | 'query'
  // Basic
  username?: string
  password?: string
  // OAuth2
  accessToken?: string
  refreshToken?: string
  tokenUrl?: string
  clientId?: string
  clientSecret?: string
  // Custom
  headers?: Record<string, string>
}

export interface FetchResult {
  success: boolean
  data?: unknown
  error?: {
    code: string
    message: string
    details?: string
  }
  metadata?: {
    statusCode: number
    headers: Record<string, string>
    responseTime: number
  }
}

export interface RetryConfig {
  enabled: boolean
  maxAttempts: number
  delayMs: number
  backoffMultiplier?: number
}

class SecureDataSourceService {
  private defaultTimeout = 30000 // 30 seconds
  private defaultRetryConfig: RetryConfig = {
    enabled: true,
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2
  }

  /**
   * Получить данные из источника с авторизацией
   */
  async fetchData(
    config: FetchConfig,
    authConfig?: AuthConfig,
    retryConfig?: Partial<RetryConfig>
  ): Promise<FetchResult> {
    const retry = { ...this.defaultRetryConfig, ...retryConfig }

    // Static data - возвращаем сразу
    if (config.type === 'static') {
      return {
        success: true,
        data: config.data,
        metadata: {
          statusCode: 200,
          headers: {},
          responseTime: 0
        }
      }
    }

    // Выполняем запрос с retry
    let lastError: Error | null = null
    let attempt = 0

    while (attempt < (retry.enabled ? retry.maxAttempts : 1)) {
      attempt++
      
      try {
        const result = await this.executeFetch(config, authConfig)
        return result
      } catch (error: any) {
        lastError = error
        
        // Не retry для определённых ошибок
        if (this.isNonRetryableError(error)) {
          break
        }
        
        if (attempt < retry.maxAttempts && retry.enabled) {
          const delay = retry.delayMs * Math.pow(retry.backoffMultiplier || 1, attempt - 1)
          await this.sleep(delay)
        }
      }
    }

    return {
      success: false,
      error: {
        code: 'FETCH_FAILED',
        message: lastError?.message || 'Failed to fetch data',
        details: `Failed after ${attempt} attempts`
      }
    }
  }

  /**
   * Выполнить запрос
   */
  private async executeFetch(
    config: FetchConfig,
    authConfig?: AuthConfig
  ): Promise<FetchResult> {
    const startTime = Date.now()

    try {
      switch (config.type) {
        case 'rest-api':
        case 'feed':
          return await this.fetchRestApi(config, authConfig, startTime)
        case 'graphql':
          return await this.fetchGraphQL(config, authConfig, startTime)
        default:
          throw new Error(`Unsupported data source type: ${config.type}`)
      }
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: error.message,
          details: error.stack
        },
        metadata: {
          statusCode: 0,
          headers: {},
          responseTime: Date.now() - startTime
        }
      }
    }
  }

  /**
   * Fetch REST API / Feed
   */
  private async fetchRestApi(
    config: FetchConfig,
    authConfig?: AuthConfig,
    startTime: number = Date.now()
  ): Promise<FetchResult> {
    console.log('🌐 [SecureDataSourceService.fetchRestApi] config.url:', config.url)
    console.log('🌐 [SecureDataSourceService.fetchRestApi] config.method:', config.method)
    console.log('🌐 [SecureDataSourceService.fetchRestApi] config.queryParams:', config.queryParams)
    
    const url = this.buildUrl(config.url!, config.queryParams, authConfig)
    console.log('🌐 [SecureDataSourceService.fetchRestApi] Built URL:', url)
    
    const headers = this.buildHeaders(config.headers, authConfig)
    
    const fetchOptions: RequestInit = {
      method: config.method || 'GET',
      headers,
      signal: AbortSignal.timeout(config.timeout || this.defaultTimeout)
    }

    // Body для POST/PUT/PATCH
    if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method || '')) {
      if (config.bodyFormat === 'form-data') {
        const formData = new URLSearchParams()
        Object.entries(config.body as Record<string, string>).forEach(([key, value]) => {
          formData.append(key, value)
        })
        fetchOptions.body = formData.toString()
        ;(headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded'
      } else {
        fetchOptions.body = JSON.stringify(config.body)
        if (!(headers as Record<string, string>)['Content-Type']) {
          ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
        }
      }
    }

    const response = await fetch(url, fetchOptions)
    const responseTime = Date.now() - startTime

    // Парсим response headers
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: response.statusText,
          details: errorBody
        },
        metadata: {
          statusCode: response.status,
          headers: responseHeaders,
          responseTime
        }
      }
    }

    // Парсим ответ
    const contentType = response.headers.get('content-type') || ''
    let data: unknown

    if (contentType.includes('application/json')) {
      data = await response.json()
    } else if (contentType.includes('text/')) {
      data = await response.text()
    } else {
      // Binary данные возвращаем как base64
      const buffer = await response.arrayBuffer()
      data = Buffer.from(buffer).toString('base64')
    }

    return {
      success: true,
      data,
      metadata: {
        statusCode: response.status,
        headers: responseHeaders,
        responseTime
      }
    }
  }

  /**
   * Fetch GraphQL
   */
  private async fetchGraphQL(
    config: FetchConfig,
    authConfig?: AuthConfig,
    startTime: number = Date.now()
  ): Promise<FetchResult> {
    const url = config.url!
    const headers = this.buildHeaders(config.headers, authConfig)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: config.query,
        variables: config.variables
      }),
      signal: AbortSignal.timeout(config.timeout || this.defaultTimeout)
    })

    const responseTime = Date.now() - startTime
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    const result = await response.json() as { data?: unknown; errors?: Array<{ message: string }> }

    if (result.errors && result.errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'GRAPHQL_ERROR',
          message: result.errors.map(e => e.message).join(', ')
        },
        metadata: {
          statusCode: response.status,
          headers: responseHeaders,
          responseTime
        }
      }
    }

    return {
      success: true,
      data: result.data,
      metadata: {
        statusCode: response.status,
        headers: responseHeaders,
        responseTime
      }
    }
  }

  /**
   * Построить URL с query параметрами
   */
  private buildUrl(
    baseUrl: string,
    queryParams?: Record<string, string>,
    authConfig?: AuthConfig
  ): string {
    console.log('🔗 [buildUrl] Input baseUrl:', baseUrl)
    console.log('🔗 [buildUrl] Input queryParams:', queryParams)
    
    if (!baseUrl) {
      console.error('❌ [buildUrl] baseUrl is empty or undefined!')
      throw new Error('baseUrl is required for API request')
    }
    
    const url = new URL(baseUrl)
    
    // Добавить query параметры
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    // API Key в query
    if (authConfig?.type === 'api-key' && authConfig.placement === 'query') {
      url.searchParams.append(authConfig.keyName || 'api_key', authConfig.key || '')
    }

    const result = url.toString()
    console.log('🔗 [buildUrl] Result URL:', result)
    return result
  }

  /**
   * Построить headers с авторизацией
   */
  private buildHeaders(
    customHeaders?: Record<string, string>,
    authConfig?: AuthConfig
  ): Record<string, string> {
    const headers: Record<string, string> = {
      ...customHeaders
    }

    if (!authConfig || authConfig.type === 'none') {
      return headers
    }

    switch (authConfig.type) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${authConfig.token || authConfig.accessToken}`
        break

      case 'api-key':
        if (authConfig.placement === 'header') {
          headers[authConfig.keyName || 'X-API-Key'] = authConfig.key || ''
        }
        break

      case 'basic':
        const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64')
        headers['Authorization'] = `Basic ${credentials}`
        break

      case 'oauth2':
        if (authConfig.accessToken) {
          headers['Authorization'] = `Bearer ${authConfig.accessToken}`
        }
        break

      case 'custom':
        if (authConfig.headers) {
          Object.assign(headers, authConfig.headers)
        }
        break
    }

    return headers
  }

  /**
   * Отправить данные (для OUTPUT bindings)
   */
  async submitData(
    config: FetchConfig,
    authConfig?: AuthConfig,
    payload?: unknown
  ): Promise<FetchResult> {
    // Переопределяем body из payload
    const submitConfig: FetchConfig = {
      ...config,
      body: payload,
      method: config.method || 'POST'
    }

    return this.fetchData(submitConfig, authConfig)
  }

  /**
   * Обновить OAuth2 токен
   */
  async refreshOAuth2Token(authConfig: AuthConfig): Promise<AuthConfig> {
    if (authConfig.type !== 'oauth2' || !authConfig.refreshToken || !authConfig.tokenUrl) {
      throw new Error('Invalid OAuth2 config for token refresh')
    }

    const response = await fetch(authConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: authConfig.refreshToken,
        client_id: authConfig.clientId || '',
        client_secret: authConfig.clientSecret || ''
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to refresh OAuth2 token: ${response.statusText}`)
    }

    const data = await response.json() as { access_token: string; refresh_token?: string }

    return {
      ...authConfig,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || authConfig.refreshToken
    }
  }

  /**
   * Проверить, можно ли retry ошибку
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase()
    
    // Ошибки авторизации - не retry
    if (message.includes('401') || message.includes('403')) {
      return true
    }

    // Client errors (4xx) кроме 408 (timeout) и 429 (rate limit)
    if (message.includes('4') && !message.includes('408') && !message.includes('429')) {
      return true
    }

    return false
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}


export const secureDataSourceService = new SecureDataSourceService()
export default SecureDataSourceService

