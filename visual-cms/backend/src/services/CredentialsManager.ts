import crypto from 'crypto'
import { logger } from './Logger'

/**
 * CredentialsManager - Сервис для безопасного управления учётными данными
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 1.1 Backend: CredentialsManager сервис
 * 
 * Требования:
 * - Шифрование AES-256 перед сохранением в БД
 * - Поддержка Environment Variables
 * - Интеграция с Secrets Manager (stub для будущего)
 * - Никогда не передавать credentials на frontend
 */

// Алгоритм шифрования
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32

// Ключ шифрования из переменной окружения
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    // В development используем fallback ключ (НЕ ДЛЯ PRODUCTION!)
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Using default encryption key. Set ENCRYPTION_KEY in production!')
      return crypto.scryptSync('default-dev-key-not-for-production', 'salt', 32)
    }
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }
  // Derive a 32-byte key from the provided key using scrypt
  return crypto.scryptSync(key, 'visual-cms-salt', 32)
}

/**
 * Тип хранения credentials
 */
export type CredentialsStorageType = 'inline' | 'env' | 'secrets'

/**
 * Интерфейс для зашифрованных данных
 */
export interface EncryptedData {
  encrypted: string      // Base64 зашифрованные данные
  iv: string             // Base64 initialization vector
  authTag: string        // Base64 authentication tag
  storageType: 'inline'
}

/**
 * Интерфейс для ссылки на environment variable
 */
export interface EnvReference {
  envVar: string         // Имя переменной окружения
  storageType: 'env'
}

/**
 * Интерфейс для ссылки на Secrets Manager
 */
export interface SecretsReference {
  secretId: string       // ID секрета в Secrets Manager
  secretKey?: string     // Ключ внутри секрета (если JSON)
  provider: 'aws' | 'vault'
  storageType: 'secrets'
}

/**
 * Объединённый тип для хранения credentials
 */
export type StoredCredentials = EncryptedData | EnvReference | SecretsReference

/**
 * CredentialsManager класс
 */
export class CredentialsManager {
  /**
   * Шифрует значение с использованием AES-256-GCM
   */
  static encrypt(value: string): EncryptedData {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(value, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    const authTag = cipher.getAuthTag()
    
    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      storageType: 'inline'
    }
  }

  /**
   * Расшифровывает значение
   */
  static decrypt(data: EncryptedData): string {
    const key = getEncryptionKey()
    const iv = Buffer.from(data.iv, 'base64')
    const authTag = Buffer.from(data.authTag, 'base64')
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(data.encrypted, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  /**
   * Получает значение из environment variable
   */
  static getFromEnv(ref: EnvReference): string | undefined {
    return process.env[ref.envVar]
  }

  /**
   * Получает значение из Secrets Manager
   * TODO: Реализовать интеграцию с AWS Secrets Manager / HashiCorp Vault
   */
  static async getFromSecrets(ref: SecretsReference): Promise<string | undefined> {
    // Stub для будущей интеграции
    logger.warn('Secrets Manager integration not implemented', { provider: ref.provider, secretId: ref.secretId })
    
    // В будущем здесь будет:
    // if (ref.provider === 'aws') {
    //   const client = new SecretsManagerClient({ region: process.env.AWS_REGION })
    //   const response = await client.send(new GetSecretValueCommand({ SecretId: ref.secretId }))
    //   ...
    // }
    
    return undefined
  }

  /**
   * Получает расшифрованное значение credentials
   */
  static async getValue(stored: StoredCredentials): Promise<string | undefined> {
    switch (stored.storageType) {
      case 'inline':
        return this.decrypt(stored as EncryptedData)
      case 'env':
        return this.getFromEnv(stored as EnvReference)
      case 'secrets':
        return this.getFromSecrets(stored as SecretsReference)
      default:
        throw new Error(`Unknown storage type: ${(stored as any).storageType}`)
    }
  }

  /**
   * Создаёт хранимое представление credentials
   */
  static store(value: string, storageType: CredentialsStorageType, options?: {
    envVar?: string
    secretId?: string
    secretKey?: string
    provider?: 'aws' | 'vault'
  }): StoredCredentials {
    switch (storageType) {
      case 'inline':
        return this.encrypt(value)
      
      case 'env':
        if (!options?.envVar) {
          throw new Error('envVar is required for env storage type')
        }
        return {
          envVar: options.envVar,
          storageType: 'env'
        }
      
      case 'secrets':
        if (!options?.secretId || !options?.provider) {
          throw new Error('secretId and provider are required for secrets storage type')
        }
        return {
          secretId: options.secretId,
          secretKey: options.secretKey,
          provider: options.provider,
          storageType: 'secrets'
        }
      
      default:
        throw new Error(`Unknown storage type: ${storageType}`)
    }
  }

  /**
   * Шифрует все sensitive поля в объекте authConfig
   */
  static encryptAuthConfig(authConfig: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = ['token', 'key', 'password', 'clientSecret', 'accessToken', 'refreshToken', 'appSecret']
    const result = { ...authConfig }
    
    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.encrypt(result[field] as string)
      }
    }
    
    // Обработка вложенного объекта headers для custom auth
    if (result.headers && typeof result.headers === 'object') {
      const encryptedHeaders: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(result.headers as Record<string, string>)) {
        // Шифруем значения заголовков, которые могут содержать credentials
        if (typeof value === 'string' && (
          key.toLowerCase().includes('authorization') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('secret')
        )) {
          encryptedHeaders[key] = this.encrypt(value)
        } else {
          encryptedHeaders[key] = value
        }
      }
      result.headers = encryptedHeaders
    }
    
    return result
  }

  /**
   * Поля config, которые являются секретами (для database-источников).
   */
  private static readonly CONFIG_SECRET_FIELDS = ['password', 'connectionString']

  /**
   * Шифрует секреты внутри config (password, connectionString) для database-источников.
   * Идемпотентна: уже зашифрованные значения (объект с storageType) пропускаются.
   */
  static encryptConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
    const result = { ...config }
    for (const field of this.CONFIG_SECRET_FIELDS) {
      const value = result[field]
      if (typeof value === 'string' && value.length > 0) {
        result[field] = this.encrypt(value)
      }
    }
    return result
  }

  /**
   * Расшифровывает секреты внутри config (password, connectionString).
   * Незашифрованные строки (legacy/plaintext) возвращаются как есть.
   */
  static async decryptConfigSecrets(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result = { ...config }
    for (const field of this.CONFIG_SECRET_FIELDS) {
      const value = result[field]
      if (value && typeof value === 'object' && 'storageType' in (value as object)) {
        result[field] = await this.getValue(value as StoredCredentials)
      }
    }
    return result
  }

  /**
   * Маскирует секреты config для отдачи на фронт (не раскрываем значения).
   */
  static maskConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
    const result = { ...config }
    for (const field of this.CONFIG_SECRET_FIELDS) {
      const value = result[field]
      if (value !== undefined && value !== null && value !== '') {
        result[field] = { _masked: true, hasValue: true }
      }
    }
    return result
  }

  /**
   * Расшифровывает все sensitive поля в объекте authConfig
   */
  static async decryptAuthConfig(authConfig: Record<string, unknown>): Promise<Record<string, unknown>> {
    const sensitiveFields = ['token', 'key', 'password', 'clientSecret', 'accessToken', 'refreshToken', 'appSecret']
    const result = { ...authConfig }
    
    for (const field of sensitiveFields) {
      const fieldValue = result[field]
      if (fieldValue && typeof fieldValue === 'object' && 'storageType' in (fieldValue as object)) {
        result[field] = await this.getValue(fieldValue as StoredCredentials)
      }
    }
    
    // Обработка вложенного объекта headers
    if (result.headers && typeof result.headers === 'object') {
      const decryptedHeaders: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(result.headers as Record<string, unknown>)) {
        if (value && typeof value === 'object' && 'storageType' in (value as object)) {
          decryptedHeaders[key] = await this.getValue(value as StoredCredentials)
        } else {
          decryptedHeaders[key] = value
        }
      }
      result.headers = decryptedHeaders
    }
    
    return result
  }

  /**
   * Маскирует sensitive данные для отображения в UI
   * Возвращает объект с замаскированными значениями
   */
  static maskAuthConfig(authConfig: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = ['token', 'key', 'password', 'clientSecret', 'accessToken', 'refreshToken', 'appSecret']
    const result = { ...authConfig }
    
    for (const field of sensitiveFields) {
      if (result[field]) {
        // Показываем только тип хранения, не само значение
        const fieldValue = result[field]
        if (typeof fieldValue === 'object' && fieldValue !== null && 'storageType' in fieldValue) {
          // Для зашифрованных значений — дешифруем для preview
          let preview: string | undefined
          try {
            const stored = fieldValue as StoredCredentials
            if (stored.storageType === 'inline') {
              const decrypted = this.decrypt(stored as EncryptedData)
              preview = decrypted.substring(0, 4) + '****'
            }
          } catch {
            // Не удалось дешифровать — preview не будет
          }
          result[field] = {
            _masked: true,
            storageType: (fieldValue as StoredCredentials).storageType,
            hasValue: true,
            ...(preview ? { preview } : {}),
          }
        } else if (typeof fieldValue === 'string') {
          // Если это строка (не зашифровано), маскируем
          result[field] = {
            _masked: true,
            preview: fieldValue.substring(0, 4) + '****',
            hasValue: true
          }
        }
      }
    }
    
    // Маскируем headers
    if (result.headers && typeof result.headers === 'object') {
      const maskedHeaders: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(result.headers as Record<string, unknown>)) {
        if (typeof value === 'object' && value !== null && 'storageType' in value) {
          maskedHeaders[key] = {
            _masked: true,
            storageType: (value as StoredCredentials).storageType,
            hasValue: true
          }
        } else if (typeof value === 'string') {
          maskedHeaders[key] = {
            _masked: true,
            preview: value.substring(0, 4) + '****',
            hasValue: true
          }
        } else {
          maskedHeaders[key] = value
        }
      }
      result.headers = maskedHeaders
    }
    
    return result
  }

  /**
   * Проверяет, содержит ли объект зашифрованные данные
   */
  static isEncrypted(value: unknown): value is EncryptedData {
    return (
      typeof value === 'object' &&
      value !== null &&
      'storageType' in value &&
      (value as any).storageType === 'inline' &&
      'encrypted' in value &&
      'iv' in value &&
      'authTag' in value
    )
  }

  /**
   * Генерирует случайный webhook secret
   */
  static generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Хэширует webhook secret для хранения и сравнения
   */
  static hashWebhookSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex')
  }

  /**
   * Проверяет webhook signature
   */
  static verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }
}

export default CredentialsManager
