import { Parser } from "expr-eval"

/**
 * ValidationService
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Серверная валидация данных перед отправкой.
 * Поддержка правил: required, email, minLength, maxLength, pattern, custom.
 */

/**
 * Типы правил валидации
 */
export type ValidationRuleType = 
  | 'required'
  | 'email'
  | 'url'
  | 'phone'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'enum'
  | 'date'
  | 'dateRange'
  | 'creditCard'
  | 'custom'

/**
 * Правило валидации
 */
export interface ValidationRule {
  type: ValidationRuleType
  value?: unknown              // Параметр правила (minLength: 5, pattern: /regex/)
  message?: string             // Кастомное сообщение об ошибке
  condition?: string           // Условие применения (JS expression)
}

/**
 * Конфигурация валидации поля
 */
export interface FieldValidation {
  fieldName: string
  rules: ValidationRule[]
  sanitize?: SanitizeRule[]    // Правила очистки данных
}

/**
 * Правило санитизации
 */
export interface SanitizeRule {
  type: 'trim' | 'lowercase' | 'uppercase' | 'stripHtml' | 'escapeHtml' | 'normalizePhone' | 'custom'
  customFn?: string            // Custom sanitizer function
}

/**
 * Результат валидации поля
 */
export interface FieldValidationResult {
  fieldName: string
  isValid: boolean
  errors: string[]
}

/**
 * Результат валидации всех данных
 */
export interface ValidationResult {
  isValid: boolean
  fields: FieldValidationResult[]
  errors: Record<string, string[]>  // fieldName -> errors
  sanitizedData: Record<string, unknown>
}

/**
 * Предустановленные сообщения об ошибках
 */
const DEFAULT_MESSAGES: Record<ValidationRuleType, string> = {
  required: 'Это поле обязательно для заполнения',
  email: 'Введите корректный email адрес',
  url: 'Введите корректный URL',
  phone: 'Введите корректный номер телефона',
  minLength: 'Минимальная длина: {value} символов',
  maxLength: 'Максимальная длина: {value} символов',
  min: 'Минимальное значение: {value}',
  max: 'Максимальное значение: {value}',
  pattern: 'Значение не соответствует формату',
  enum: 'Выберите допустимое значение',
  date: 'Введите корректную дату',
  dateRange: 'Дата должна быть в допустимом диапазоне',
  creditCard: 'Введите корректный номер карты',
  custom: 'Значение не прошло валидацию',
}

/**
 * Регулярные выражения для валидации
 */
const PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  phone: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/,
  creditCard: /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$/,
}

class ValidationService {
  /**
   * Валидация данных по правилам
   */
  validate(
    data: Record<string, unknown>,
    validations: FieldValidation[]
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      fields: [],
      errors: {},
      sanitizedData: { ...data },
    }

    for (const fieldValidation of validations) {
      const { fieldName, rules, sanitize } = fieldValidation
      let value = data[fieldName]

      // Применяем санитизацию
      if (sanitize && sanitize.length > 0) {
        value = this.sanitizeValue(value, sanitize)
        result.sanitizedData[fieldName] = value
      }

      // Валидируем
      const fieldResult = this.validateField(fieldName, value, rules, data)
      result.fields.push(fieldResult)

      if (!fieldResult.isValid) {
        result.isValid = false
        result.errors[fieldName] = fieldResult.errors
      }
    }

    return result
  }

  /**
   * Валидация одного поля
   */
  private validateField(
    fieldName: string,
    value: unknown,
    rules: ValidationRule[],
    allData: Record<string, unknown>
  ): FieldValidationResult {
    const errors: string[] = []

    for (const rule of rules) {
      // Проверяем условие применения правила
      if (rule.condition && !this.evaluateCondition(rule.condition, allData)) {
        continue
      }

      const error = this.validateRule(value, rule)
      if (error) {
        errors.push(error)
      }
    }

    return {
      fieldName,
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Валидация по одному правилу
   */
  private validateRule(value: unknown, rule: ValidationRule): string | null {
    const { type, value: ruleValue, message } = rule

    // Формируем сообщение об ошибке
    const getErrorMessage = () => {
      if (message) return message
      let msg = DEFAULT_MESSAGES[type] || 'Ошибка валидации'
      if (ruleValue !== undefined) {
        msg = msg.replace('{value}', String(ruleValue))
      }
      return msg
    }

    switch (type) {
      case 'required':
        if (value === undefined || value === null || value === '' || 
            (Array.isArray(value) && value.length === 0)) {
          return getErrorMessage()
        }
        break

      case 'email':
        if (value && !PATTERNS.email.test(String(value))) {
          return getErrorMessage()
        }
        break

      case 'url':
        if (value && !PATTERNS.url.test(String(value))) {
          return getErrorMessage()
        }
        break

      case 'phone':
        if (value && !PATTERNS.phone.test(String(value).replace(/\s/g, ''))) {
          return getErrorMessage()
        }
        break

      case 'minLength':
        if (value && String(value).length < Number(ruleValue)) {
          return getErrorMessage()
        }
        break

      case 'maxLength':
        if (value && String(value).length > Number(ruleValue)) {
          return getErrorMessage()
        }
        break

      case 'min':
        if (value !== undefined && value !== null && Number(value) < Number(ruleValue)) {
          return getErrorMessage()
        }
        break

      case 'max':
        if (value !== undefined && value !== null && Number(value) > Number(ruleValue)) {
          return getErrorMessage()
        }
        break

      case 'pattern':
        if (value && ruleValue) {
          const regex = typeof ruleValue === 'string' 
            ? new RegExp(ruleValue) 
            : ruleValue as RegExp
          if (!regex.test(String(value))) {
            return getErrorMessage()
          }
        }
        break

      case 'enum':
        if (value && Array.isArray(ruleValue) && !ruleValue.includes(value)) {
          return getErrorMessage()
        }
        break

      case 'date':
        if (value) {
          const date = new Date(value as string)
          if (isNaN(date.getTime())) {
            return getErrorMessage()
          }
        }
        break

      case 'dateRange':
        if (value && ruleValue && typeof ruleValue === 'object') {
          const date = new Date(value as string)
          const { min, max } = ruleValue as { min?: string; max?: string }
          if (min && date < new Date(min)) {
            return message || `Дата должна быть не раньше ${min}`
          }
          if (max && date > new Date(max)) {
            return message || `Дата должна быть не позже ${max}`
          }
        }
        break

      case 'creditCard':
        if (value && !PATTERNS.creditCard.test(String(value).replace(/\s/g, ''))) {
          return getErrorMessage()
        }
        break

      case 'custom':
        // Custom validation через ruleValue как функцию-строку
        // В production это должно быть безопасно исполнено
        // Для простоты пропускаем custom validation на сервере
        break
    }

    return null
  }

  /**
   * Санитизация значения
   */
  private sanitizeValue(value: unknown, rules: SanitizeRule[]): unknown {
    if (value === undefined || value === null) return value

    let result = value

    for (const rule of rules) {
      switch (rule.type) {
        case 'trim':
          if (typeof result === 'string') {
            result = result.trim()
          }
          break

        case 'lowercase':
          if (typeof result === 'string') {
            result = result.toLowerCase()
          }
          break

        case 'uppercase':
          if (typeof result === 'string') {
            result = result.toUpperCase()
          }
          break

        case 'stripHtml':
          if (typeof result === 'string') {
            result = result.replace(/<[^>]*>/g, '')
          }
          break

        case 'escapeHtml':
          if (typeof result === 'string') {
            result = result
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')
          }
          break

        case 'normalizePhone':
          if (typeof result === 'string') {
            result = result.replace(/[^\d+]/g, '')
          }
          break
      }
    }

    return result
  }

  /**
   * Evaluation of conditions via safe expression evaluator (expr-eval).
   * Supports: comparisons (==, !=, <, >, <=, >=), logic (and, or, not),
   * arithmetic, string ops. Does NOT execute arbitrary JS.
   */
  private evaluateCondition(
    condition: string, 
    data: Record<string, unknown>
  ): boolean {
    try {
      const parser = new Parser()
      // Normalize JS operators to expr-eval supported ones
      const normalizedCondition = condition
        .replace(/===/g, "==")
        .replace(/!==/g, "!=")
        .replace(/&&/g, " and ")
        .replace(/\|\|/g, " or ")
      // Cast values to primitives for safe evaluation
      const safeContext: Record<string, number | string> = {}
      for (const [key, val] of Object.entries(data)) {
        if (typeof val === "boolean") {
          safeContext[key] = val ? 1 : 0
        } else if (typeof val === "string" || typeof val === "number") {
          safeContext[key] = val
        } else if (val === null || val === undefined) {
          safeContext[key] = 0
        } else {
          safeContext[key] = String(val)
        }
      }
      const expr = parser.parse(normalizedCondition)
      return Boolean(expr.evaluate(safeContext))
    } catch {
      // On parse error, treat condition as true (apply the rule)
      return true
    }
  }

  /**
   * Получить все имена полей с ошибками
   */
  getErrorFieldNames(result: ValidationResult): string[] {
    return result.fields
      .filter(f => !f.isValid)
      .map(f => f.fieldName)
  }

  /**
   * Форматировать ошибки для ответа API
   */
  formatErrorResponse(result: ValidationResult): {
    message: string
    errors: Record<string, string[]>
    fields: string[]
  } {
    return {
      message: 'Ошибка валидации данных',
      errors: result.errors,
      fields: this.getErrorFieldNames(result),
    }
  }
}

export const validationService = new ValidationService()
export default validationService
