/**
 * Slim structured logger for estate-service.
 *
 * Совместим по API с logger основного backend (info/warn/error/debug), но без
 * лишних зависимостей — сервис изолирован. LOG_LEVEL управляет порогом,
 * production даёт JSON-строки для агрегаторов.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

class Logger {
  private minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

  private shouldLog(level: LogLevel): boolean {
    return PRIORITY[level] >= PRIORITY[this.minLevel]
  }

  private emit(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'estate-service',
      message,
      ...(context && Object.keys(context).length ? { context } : {}),
      ...(error ? { error: { name: error.name, message: error.message, stack: error.stack } } : {}),
    }

    const line =
      process.env.NODE_ENV === 'production'
        ? JSON.stringify(entry)
        : `[${entry.timestamp}] ${level.toUpperCase().padEnd(5)} ${message}` +
          (context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : '') +
          (error ? `\n  ${error.name}: ${error.message}` : '')

    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.emit('debug', message, context)
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.emit('info', message, context)
  }
  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.emit('warn', message, context, error)
  }
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.emit('error', message, context, error)
  }
}

export const logger = new Logger()