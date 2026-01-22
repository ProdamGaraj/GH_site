/**
 * Logger Service
 * 
 * Структурированное логирование для production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  requestId?: string
  service?: string
  error?: {
    name: string
    message: string
    stack?: string
  }
}

class Logger {
  private serviceName: string
  private minLevel: LogLevel

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }

  constructor(serviceName = 'visual-cms') {
    this.serviceName = serviceName
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel]
  }

  private formatEntry(entry: LogEntry): string {
    if (process.env.NODE_ENV === 'production') {
      // JSON format for production (for log aggregators)
      return JSON.stringify(entry)
    }
    
    // Human-readable format for development
    const { timestamp, level, message, context, requestId, error } = entry
    let output = `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${message}`
    
    if (requestId) {
      output += ` (req: ${requestId})`
    }
    
    if (context && Object.keys(context).length > 0) {
      output += ` ${JSON.stringify(context)}`
    }
    
    if (error) {
      output += `\n  Error: ${error.name}: ${error.message}`
      if (error.stack) {
        output += `\n  Stack: ${error.stack}`
      }
    }
    
    return output
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      context,
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    const formatted = this.formatEntry(entry)

    switch (level) {
      case 'error':
        console.error(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      default:
        console.log(formatted)
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log('warn', message, context, error)
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error)
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context)
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, unknown>
  ) {}

  debug(message: string, additionalContext?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.context, ...additionalContext })
  }

  info(message: string, additionalContext?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.context, ...additionalContext })
  }

  warn(message: string, additionalContext?: Record<string, unknown>, error?: Error): void {
    this.parent.warn(message, { ...this.context, ...additionalContext }, error)
  }

  error(message: string, error?: Error, additionalContext?: Record<string, unknown>): void {
    this.parent.error(message, error, { ...this.context, ...additionalContext })
  }
}

// Singleton instance
export const logger = new Logger()

/**
 * Request logger middleware
 */
export const requestLogger = (req: any, res: any, next: any) => {
  const startTime = Date.now()
  const requestId = req.id || req.headers['x-request-id']

  // Log request
  logger.info('Request received', {
    method: req.method,
    path: req.path,
    query: req.query,
    requestId,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  })

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      requestId,
    }
    
    if (res.statusCode >= 500) {
      logger.error('Request completed', undefined, logData)
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed', logData)
    } else {
      logger.info('Request completed', logData)
    }
  })

  next()
}
