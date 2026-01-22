/**
 * useOutputBinding Hook
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Hook для управления отправкой данных:
 * - Сбор данных из формы
 * - Клиентская валидация
 * - Отправка на сервер
 * - Обработка ответа
 * - Retry логика
 * - State management
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { outputBindingApi } from '@/shared/api/outputBindingApi'
import type {
  OutputBinding,
  OutputBindingState,
  SubmitState,
  SubmitResult,
  SubmitDataRequest,
  ValidationRule,
  ClientValidationResult,
  SuccessAction,
  ErrorAction,
} from '@/shared/types/outputBinding'

/**
 * Опции hook
 */
interface UseOutputBindingOptions {
  binding: OutputBinding
  pageId?: string
  blockId?: string
  onSuccess?: (result: SubmitResult) => void
  onError?: (error: string, validationErrors?: Record<string, string[]>) => void
  onStateChange?: (state: SubmitState) => void
}

/**
 * Результат hook
 */
interface UseOutputBindingResult extends OutputBindingState {
  // Методы
  submit: (data: Record<string, unknown>) => Promise<SubmitResult | null>
  validate: (data: Record<string, unknown>) => ClientValidationResult
  reset: () => void
  clearErrors: () => void
  
  // Helpers
  getFieldError: (fieldName: string) => string | undefined
  hasFieldError: (fieldName: string) => boolean
  
  // Button state helpers
  getButtonText: () => string
  getButtonClassName: () => string
  isButtonDisabled: () => boolean
  showSpinner: () => boolean
}

/**
 * Validation patterns
 */
const PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  phone: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/,
  creditCard: /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$/,
}

/**
 * Default error messages
 */
const DEFAULT_MESSAGES: Record<string, string> = {
  required: 'Это поле обязательно',
  email: 'Введите корректный email',
  url: 'Введите корректный URL',
  phone: 'Введите корректный телефон',
  minLength: 'Минимум {value} символов',
  maxLength: 'Максимум {value} символов',
  min: 'Минимум {value}',
  max: 'Максимум {value}',
  pattern: 'Неверный формат',
  creditCard: 'Неверный номер карты',
}

export function useOutputBinding(options: UseOutputBindingOptions): UseOutputBindingResult {
  const { binding, pageId, blockId, onSuccess, onError, onStateChange } = options

  // State
  const [state, setState] = useState<OutputBindingState>({
    state: 'idle',
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    validationErrors: {},
    lastResult: null,
    attemptCount: 0,
  })

  // Refs для retry и cleanup
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    }
  }, [])

  // Update state safely
  const updateState = useCallback((updates: Partial<OutputBindingState>) => {
    if (!isMountedRef.current) return
    setState(prev => {
      const newState = { ...prev, ...updates }
      if (updates.state && onStateChange) {
        onStateChange(updates.state)
      }
      return newState
    })
  }, [onStateChange])

  /**
   * Клиентская валидация
   */
  const validate = useCallback((data: Record<string, unknown>): ClientValidationResult => {
    const errors: Record<string, string[]> = {}
    let firstErrorField: string | undefined

    for (const fieldValidation of binding.validations) {
      const { fieldName, rules } = fieldValidation
      const value = data[fieldName]
      const fieldErrors: string[] = []

      for (const rule of rules) {
        const error = validateRule(value, rule, data)
        if (error) {
          fieldErrors.push(error)
          if (!firstErrorField) {
            firstErrorField = fieldName
          }
        }
      }

      if (fieldErrors.length > 0) {
        errors[fieldName] = fieldErrors
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      firstErrorField,
    }
  }, [binding.validations])

  /**
   * Валидация одного правила
   */
  const validateRule = (
    value: unknown, 
    rule: ValidationRule, 
    allData: Record<string, unknown>
  ): string | null => {
    const { type, value: ruleValue, message, condition } = rule

    // Проверка условия
    if (condition) {
      try {
        const fn = new Function(...Object.keys(allData), `return ${condition}`)
        if (!fn(...Object.values(allData))) {
          return null
        }
      } catch {
        // Игнорируем ошибки в условии
      }
    }

    const getError = () => {
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
          return getError()
        }
        break

      case 'email':
        if (value && !PATTERNS.email.test(String(value))) {
          return getError()
        }
        break

      case 'url':
        if (value && !PATTERNS.url.test(String(value))) {
          return getError()
        }
        break

      case 'phone':
        if (value && !PATTERNS.phone.test(String(value).replace(/\s/g, ''))) {
          return getError()
        }
        break

      case 'minLength':
        if (value && String(value).length < Number(ruleValue)) {
          return getError()
        }
        break

      case 'maxLength':
        if (value && String(value).length > Number(ruleValue)) {
          return getError()
        }
        break

      case 'min':
        if (value !== undefined && value !== null && Number(value) < Number(ruleValue)) {
          return getError()
        }
        break

      case 'max':
        if (value !== undefined && value !== null && Number(value) > Number(ruleValue)) {
          return getError()
        }
        break

      case 'pattern':
        if (value && ruleValue) {
          const regex = typeof ruleValue === 'string' ? new RegExp(ruleValue) : ruleValue as RegExp
          if (!regex.test(String(value))) {
            return getError()
          }
        }
        break

      case 'creditCard':
        if (value && !PATTERNS.creditCard.test(String(value).replace(/\s/g, ''))) {
          return getError()
        }
        break
    }

    return null
  }

  /**
   * Применить field mapping
   */
  const applyMapping = (data: Record<string, unknown>): Record<string, unknown> => {
    if (!binding.fieldMappings || binding.fieldMappings.length === 0) {
      return data
    }

    const result: Record<string, unknown> = {}

    for (const mapping of binding.fieldMappings) {
      let value = data[mapping.sourceField]

      // Пропускаем пустые если указано
      if (mapping.skipIfEmpty && (value === undefined || value === null || value === '')) {
        continue
      }

      // Применяем transform
      if (mapping.transform && mapping.transform !== 'none') {
        value = transformValue(value, mapping.transform, mapping.customTransform)
      }

      // Default value
      if ((value === undefined || value === null) && mapping.defaultValue !== undefined) {
        value = mapping.defaultValue
      }

      result[mapping.targetField] = value
    }

    return result
  }

  /**
   * Трансформация значения
   */
  const transformValue = (
    value: unknown, 
    transform: string, 
    customFn?: string
  ): unknown => {
    switch (transform) {
      case 'toString':
        return String(value ?? '')
      case 'toNumber':
        return Number(value) || 0
      case 'toBoolean':
        return Boolean(value)
      case 'toDate':
        return value ? new Date(value as string).toISOString() : null
      case 'custom':
        if (customFn) {
          try {
            const fn = new Function('value', customFn)
            return fn(value)
          } catch {
            return value
          }
        }
        return value
      default:
        return value
    }
  }

  /**
   * Выполнить success actions
   */
  const executeSuccessActions = useCallback((result: SubmitResult) => {
    for (const action of binding.successActions) {
      executeSuccessAction(action, result)
    }
  }, [binding.successActions])

  const executeSuccessAction = (action: SuccessAction, result: SubmitResult) => {
    switch (action.type) {
      case 'show_message':
        // Показать сообщение (можно использовать toast или alert)
        if (action.message) {
          console.log('Success:', action.message)
          // TODO: интеграция с toast/notification system
        }
        break

      case 'redirect':
        if (action.redirectUrl) {
          const delay = action.redirectDelay || 0
          setTimeout(() => {
            window.location.href = action.redirectUrl!
          }, delay)
        }
        break

      case 'reset_form':
        // Сброс формы - нужно вызвать reset на форме
        const form = document.querySelector('form')
        if (form) {
          form.reset()
        }
        break

      case 'show_element':
        if (action.elementSelector) {
          const el = document.querySelector(action.elementSelector)
          if (el) {
            (el as HTMLElement).style.display = ''
          }
        }
        break

      case 'hide_element':
        if (action.elementSelector) {
          const el = document.querySelector(action.elementSelector)
          if (el) {
            (el as HTMLElement).style.display = 'none'
          }
        }
        break

      case 'custom':
        if (action.customAction) {
          try {
            const fn = new Function('result', action.customAction)
            fn(result)
          } catch (e) {
            console.error('Custom action error:', e)
          }
        }
        break
    }
  }

  /**
   * Выполнить error actions
   */
  const executeErrorActions = useCallback((error: string, validationErrors?: Record<string, string[]>) => {
    for (const action of binding.errorActions) {
      executeErrorAction(action, error, validationErrors)
    }
  }, [binding.errorActions])

  const executeErrorAction = (
    action: ErrorAction, 
    error: string, 
    validationErrors?: Record<string, string[]>
  ) => {
    switch (action.type) {
      case 'show_message':
        const message = action.message || error
        console.error('Error:', message)
        // TODO: интеграция с toast/notification system
        break

      case 'show_inline_errors':
        // Ошибки уже в state.validationErrors
        break

      case 'custom':
        if (action.customAction) {
          try {
            const fn = new Function('error', 'validationErrors', action.customAction)
            fn(error, validationErrors)
          } catch (e) {
            console.error('Custom error action error:', e)
          }
        }
        break
    }
  }

  /**
   * Основной метод отправки
   */
  const submit = useCallback(async (data: Record<string, unknown>): Promise<SubmitResult | null> => {
    // Валидация
    updateState({ state: 'validating' })
    const validationResult = validate(data)

    if (!validationResult.isValid) {
      updateState({
        state: 'error',
        isError: true,
        isLoading: false,
        validationErrors: validationResult.errors,
        error: 'Ошибка валидации',
      })
      
      if (onError) {
        onError('Ошибка валидации', validationResult.errors)
      }
      executeErrorActions('Ошибка валидации', validationResult.errors)
      
      return null
    }

    // Подготовка данных
    updateState({
      state: 'submitting',
      isLoading: true,
      isError: false,
      error: null,
      validationErrors: {},
    })

    const mappedData = applyMapping(data)

    const request: SubmitDataRequest = {
      dataSourceId: binding.dataSourceId,
      outputBindingId: binding.id,
      endpoint: binding.endpoint,
      method: binding.method,
      data: mappedData,
      additionalData: binding.additionalData,
      validations: binding.validations,
      pageId,
      blockId,
      trigger: binding.trigger,
      attemptNumber: state.attemptCount + 1,
    }

    try {
      const result = await outputBindingApi.submit(request)

      if (result.success) {
        updateState({
          state: 'success',
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          lastResult: result,
          attemptCount: state.attemptCount + 1,
        })

        if (onSuccess) {
          onSuccess(result)
        }
        executeSuccessActions(result)

        // Автосброс success state
        if (binding.buttonStates?.success?.duration) {
          successTimeoutRef.current = setTimeout(() => {
            updateState({ state: 'idle', isSuccess: false })
          }, binding.buttonStates.success.duration)
        }

        return result
      } else {
        throw new Error(result.error?.message || 'Ошибка отправки')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
      
      updateState({
        state: 'error',
        isLoading: false,
        isError: true,
        error: errorMessage,
        attemptCount: state.attemptCount + 1,
      })

      // Retry логика
      const retryConfig = binding.retryConfig
      if (retryConfig?.enabled && state.attemptCount + 1 < retryConfig.maxAttempts) {
        const delay = retryConfig.exponentialBackoff
          ? retryConfig.delayMs * Math.pow(2, state.attemptCount)
          : retryConfig.delayMs

        retryTimeoutRef.current = setTimeout(() => {
          submit(data)
        }, delay)
      } else {
        if (onError) {
          onError(errorMessage)
        }
        executeErrorActions(errorMessage)
      }

      return null
    }
  }, [binding, pageId, blockId, state.attemptCount, validate, onSuccess, onError, executeSuccessActions, executeErrorActions, updateState])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    
    updateState({
      state: 'idle',
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      validationErrors: {},
      lastResult: null,
      attemptCount: 0,
    })
  }, [updateState])

  /**
   * Clear errors
   */
  const clearErrors = useCallback(() => {
    updateState({
      isError: false,
      error: null,
      validationErrors: {},
    })
  }, [updateState])

  /**
   * Get field error
   */
  const getFieldError = useCallback((fieldName: string): string | undefined => {
    const errors = state.validationErrors[fieldName]
    return errors && errors.length > 0 ? errors[0] : undefined
  }, [state.validationErrors])

  /**
   * Has field error
   */
  const hasFieldError = useCallback((fieldName: string): boolean => {
    return Boolean(state.validationErrors[fieldName]?.length)
  }, [state.validationErrors])

  /**
   * Button state helpers
   */
  const getButtonText = useCallback((): string => {
    const states = binding.buttonStates
    if (!states) return 'Отправить'

    switch (state.state) {
      case 'submitting':
      case 'validating':
        return states.loading?.text || 'Отправка...'
      case 'success':
        return states.success?.text || 'Отправлено!'
      case 'error':
        return states.error?.text || 'Ошибка'
      default:
        return states.normal?.text || 'Отправить'
    }
  }, [binding.buttonStates, state.state])

  const getButtonClassName = useCallback((): string => {
    const states = binding.buttonStates
    if (!states) return ''

    switch (state.state) {
      case 'submitting':
      case 'validating':
        return states.loading?.className || ''
      case 'success':
        return states.success?.className || ''
      case 'error':
        return states.error?.className || ''
      default:
        return states.normal?.className || ''
    }
  }, [binding.buttonStates, state.state])

  const isButtonDisabled = useCallback((): boolean => {
    if (state.state === 'submitting' || state.state === 'validating') {
      return binding.buttonStates?.loading?.disabled !== false
    }
    return false
  }, [binding.buttonStates, state.state])

  const showSpinner = useCallback((): boolean => {
    return (state.state === 'submitting' || state.state === 'validating') &&
           binding.buttonStates?.loading?.showSpinner !== false
  }, [binding.buttonStates, state.state])

  return {
    ...state,
    submit,
    validate,
    reset,
    clearErrors,
    getFieldError,
    hasFieldError,
    getButtonText,
    getButtonClassName,
    isButtonDisabled,
    showSpinner,
  }
}

export default useOutputBinding
