import { AppDataSource } from '../config/database'
import { Form } from '../models/Form'
import { FormDestination, DestinationType } from '../models/FormDestination'
import type {
  EmailDestinationConfig,
  WebhookDestinationConfig,
  TelegramDestinationConfig,
  GoogleSheetsDestinationConfig,
  SlackDestinationConfig,
  RestApiDestinationConfig,
  FieldMappingRule,
} from '../models/FormDestination'
import type { FormField, FormFieldValidation } from '../models/Form'
import { logger } from './Logger'

// ─── Validation ──────────────────────────────────────────────────

export interface ValidationError {
  field: string
  message: string
}

function validateField(
  field: FormField,
  value: unknown
): string | null {
  const v = field.validation
  const strVal = value != null ? String(value) : ''

  if (v.required && (!value || strVal.trim() === '')) {
    return `Поле "${field.label}" обязательно для заполнения`
  }

  if (!value && !v.required) return null

  if (v.minLength && strVal.length < v.minLength) {
    return `Минимальная длина поля "${field.label}" — ${v.minLength} симв.`
  }
  if (v.maxLength && strVal.length > v.maxLength) {
    return `Максимальная длина поля "${field.label}" — ${v.maxLength} симв.`
  }
  if (v.min != null && Number(value) < v.min) {
    return `Минимальное значение поля "${field.label}" — ${v.min}`
  }
  if (v.max != null && Number(value) > v.max) {
    return `Максимальное значение поля "${field.label}" — ${v.max}`
  }

  // Preset patterns
  if (v.preset === 'email') {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(strVal)) return `Некорректный email в поле "${field.label}"`
  }
  if (v.preset === 'phone') {
    const phoneRe = /^[\d\s\-+()]{7,20}$/
    if (!phoneRe.test(strVal)) return `Некорректный номер телефона в поле "${field.label}"`
  }
  if (v.preset === 'url') {
    try { new URL(strVal) } catch {
      return `Некорректный URL в поле "${field.label}"`
    }
  }

  if (v.pattern) {
    const re = new RegExp(v.pattern)
    if (!re.test(strVal)) {
      return v.patternMessage || `Поле "${field.label}" не соответствует формату`
    }
  }

  return null
}

export function validateFormData(
  fields: FormField[],
  data: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = []
  for (const field of fields) {
    const err = validateField(field, data[field.name])
    if (err) errors.push({ field: field.name, message: err })
  }
  return errors
}

// ─── Field Mapping ───────────────────────────────────────────────

function applyFieldMapping(
  data: Record<string, unknown>,
  rules: FieldMappingRule[]
): Record<string, unknown> {
  if (!rules || rules.length === 0) return { ...data }

  const result: Record<string, unknown> = {}
  for (const rule of rules) {
    let value: unknown = rule.staticValue ?? data[rule.sourceField]

    if (value != null && rule.transform) {
      const strVal = String(value)
      switch (rule.transform) {
        case 'uppercase': value = strVal.toUpperCase(); break
        case 'lowercase': value = strVal.toLowerCase(); break
        case 'trim': value = strVal.trim(); break
        case 'date-format':
          try { value = new Date(strVal).toISOString() } catch { /* keep original */ }
          break
      }
    }

    result[rule.targetField] = value
  }
  return result
}

// ─── Template rendering ──────────────────────────────────────────

function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key]
    return val != null ? String(val) : ''
  })
}

// ─── Destination Dispatchers ─────────────────────────────────────

async function sendEmail(
  config: EmailDestinationConfig,
  data: Record<string, unknown>
): Promise<void> {
  const body = renderTemplate(config.bodyTemplate, data)
  const subject = renderTemplate(config.subject, data)

  // Use nodemailer-style transport if SMTP configured, otherwise log
  // For simplicity, we use fetch to a mail-sending microservice or SMTP relay
  const smtpHost = config.smtpHost || process.env.SMTP_HOST
  const smtpPort = config.smtpPort || Number(process.env.SMTP_PORT) || 587

  if (!smtpHost) {
    logger.warn('No SMTP host configured — email destination will store submission only')
    logger.info(`[Email Preview] To: ${config.to.join(', ')}, Subject: ${subject}\n${body}`)
    return
  }

  // Dynamic import nodemailer (optional dep)
  try {
    // @ts-ignore — nodemailer is an optional dependency
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: config.smtpSecure ?? smtpPort === 465,
      auth: (config.smtpUser || process.env.SMTP_USER) ? {
        user: config.smtpUser || process.env.SMTP_USER,
        pass: config.smtpPass || process.env.SMTP_PASS,
      } : undefined,
    })

    await transport.sendMail({
      from: config.fromEmail
        ? `${config.fromName || ''} <${config.fromEmail}>`
        : process.env.SMTP_FROM || 'noreply@example.com',
      to: config.to.join(', '),
      cc: config.cc?.join(', '),
      bcc: config.bcc?.join(', '),
      subject,
      [config.format === 'html' ? 'html' : 'text']: body,
    })
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND') {
      logger.warn('nodemailer not installed — email not sent. Run: npm i nodemailer')
      return
    }
    throw err
  }
}

async function sendWebhook(
  config: WebhookDestinationConfig,
  data: Record<string, unknown>
): Promise<void> {
  let payload: string
  if (config.payloadTemplate) {
    payload = renderTemplate(config.payloadTemplate, data)
  } else if (config.payloadFormat === 'envelope') {
    payload = JSON.stringify({ timestamp: new Date().toISOString(), data })
  } else {
    payload = JSON.stringify(data)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers || {}),
  }

  // Auth
  if (config.authType === 'bearer' && config.authToken) {
    headers['Authorization'] = `Bearer ${config.authToken}`
  } else if (config.authType === 'api-key' && config.authToken && config.authHeaderName) {
    headers[config.authHeaderName] = config.authToken
  } else if (config.authType === 'basic' && config.authToken) {
    headers['Authorization'] = `Basic ${Buffer.from(config.authToken).toString('base64')}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeout || 30000)

  try {
    const resp = await fetch(config.url, {
      method: config.method || 'POST',
      headers,
      body: payload,
      signal: controller.signal,
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`Webhook responded with ${resp.status}: ${text.slice(0, 500)}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function sendTelegram(
  config: TelegramDestinationConfig,
  data: Record<string, unknown>
): Promise<void> {
  const text = renderTemplate(config.messageTemplate, data)
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
      parse_mode: config.parseMode || undefined,
      disable_web_page_preview: config.disablePreview || false,
    }),
  })

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(`Telegram API error: ${JSON.stringify(body)}`)
  }
}

async function sendSlack(
  config: SlackDestinationConfig,
  data: Record<string, unknown>
): Promise<void> {
  const text = renderTemplate(config.messageTemplate, data)

  const resp = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      channel: config.channel,
      username: config.username,
      icon_emoji: config.iconEmoji,
    }),
  })

  if (!resp.ok) {
    throw new Error(`Slack webhook error: ${resp.status}`)
  }
}

async function sendRestApi(
  config: RestApiDestinationConfig,
  data: Record<string, unknown>
): Promise<void> {
  let mapped = data
  if (config.fieldMapping) {
    mapped = {}
    for (const [from, to] of Object.entries(config.fieldMapping)) {
      mapped[to] = data[from]
    }
  }
  if (config.extraFields) {
    mapped = { ...mapped, ...config.extraFields }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers || {}),
  }

  if (config.authType === 'bearer' && config.authConfig?.token) {
    headers['Authorization'] = `Bearer ${config.authConfig.token}`
  } else if (config.authType === 'api-key' && config.authConfig?.key && config.authConfig?.headerName) {
    headers[config.authConfig.headerName] = config.authConfig.key
  } else if (config.authType === 'basic' && config.authConfig?.username) {
    const cred = `${config.authConfig.username}:${config.authConfig.password || ''}`
    headers['Authorization'] = `Basic ${Buffer.from(cred).toString('base64')}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeout || 30000)

  try {
    const resp = await fetch(config.url, {
      method: config.method || 'POST',
      headers,
      body: JSON.stringify(mapped),
      signal: controller.signal,
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`REST API responded with ${resp.status}: ${text.slice(0, 500)}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function sendGoogleSheets(
  config: GoogleSheetsDestinationConfig,
  data: Record<string, unknown>
): Promise<void> {
  // Google Sheets integration requires googleapis package
  // For now, log what would be sent
  logger.info(`[Google Sheets] Would append row to ${config.spreadsheetId}/${config.sheetName}`)
  logger.info(`[Google Sheets] Data: ${JSON.stringify(data)}`)

  try {
    // @ts-ignore — googleapis is an optional dependency
    const { google } = await import('googleapis')
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(config.credentials),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Build row based on column mapping
    const row: unknown[] = []
    const mappedData: Record<string, unknown> = {}
    for (const [field, col] of Object.entries(config.columnMapping)) {
      mappedData[col] = data[field]
    }
    if (config.addTimestamp && config.timestampColumn) {
      mappedData[config.timestampColumn] = new Date().toISOString()
    }

    // Sort by column letter and build values array
    const sortedCols = Object.keys(mappedData).sort()
    for (const col of sortedCols) {
      row.push(mappedData[col])
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: `${config.sheetName}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND') {
      logger.warn('googleapis not installed — Google Sheets not sent. Run: npm i googleapis')
      return
    }
    throw err
  }
}

// ─── Main Dispatch ───────────────────────────────────────────────

export interface DestinationResult {
  destinationId: string
  destinationName: string
  success: boolean
  error?: string
  durationMs: number
}

export async function dispatchToDestination(
  destination: FormDestination,
  rawData: Record<string, unknown>
): Promise<DestinationResult> {
  const start = Date.now()
  const data = destination.fieldMapping?.length
    ? applyFieldMapping(rawData, destination.fieldMapping)
    : rawData

  try {
    switch (destination.type) {
      case 'email':
        await sendEmail(destination.config as EmailDestinationConfig, data)
        break
      case 'webhook':
        await sendWebhook(destination.config as WebhookDestinationConfig, data)
        break
      case 'telegram':
        await sendTelegram(destination.config as TelegramDestinationConfig, data)
        break
      case 'google-sheets':
        await sendGoogleSheets(destination.config as GoogleSheetsDestinationConfig, data)
        break
      case 'slack':
        await sendSlack(destination.config as SlackDestinationConfig, data)
        break
      case 'rest-api':
        await sendRestApi(destination.config as RestApiDestinationConfig, data)
        break
      default:
        throw new Error(`Unsupported destination type: ${destination.type}`)
    }

    return {
      destinationId: destination.id,
      destinationName: destination.name,
      success: true,
      durationMs: Date.now() - start,
    }
  } catch (err: any) {
    logger.error(`Destination "${destination.name}" (${destination.type}) failed:`, err.message)
    return {
      destinationId: destination.id,
      destinationName: destination.name,
      success: false,
      error: err.message,
      durationMs: Date.now() - start,
    }
  }
}

export async function dispatchToAllDestinations(
  destinations: FormDestination[],
  data: Record<string, unknown>
): Promise<DestinationResult[]> {
  const active = destinations
    .filter((d) => d.isActive)
    .sort((a, b) => a.priority - b.priority)

  const results = await Promise.allSettled(
    active.map((dest) => dispatchToDestination(dest, data))
  )

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          destinationId: active[i].id,
          destinationName: active[i].name,
          success: false,
          error: (r.reason as Error)?.message || 'Unknown error',
          durationMs: 0,
        }
  )
}

// ─── Update destination stats ────────────────────────────────────

export async function updateDestinationStats(
  results: DestinationResult[]
): Promise<void> {
  const repo = AppDataSource.getRepository(FormDestination)

  for (const r of results) {
    try {
      if (r.success) {
        await repo
          .createQueryBuilder()
          .update(FormDestination)
          .set({
            successCount: () => '"successCount" + 1',
            lastSuccessAt: new Date(),
            lastError: null,
          })
          .where('id = :id', { id: r.destinationId })
          .execute()
      } else {
        await repo
          .createQueryBuilder()
          .update(FormDestination)
          .set({
            failureCount: () => '"failureCount" + 1',
            lastError: r.error || 'Unknown error',
          })
          .where('id = :id', { id: r.destinationId })
          .execute()
      }
    } catch (err) {
      logger.error(`Failed to update stats for destination ${r.destinationId}:`, err as Error)
    }
  }
}
