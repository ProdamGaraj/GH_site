/**
 * Output Bindings Feature
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Система отправки данных форм:
 * - Маппинг полей
 * - Валидация на клиенте и сервере
 * - Триггеры отправки
 * - Обработка ответов
 * - Состояния кнопки
 * - Retry логика
 */

// Components
export {
  OutputBindingsConfig,
  PayloadMappingConfig,
  TriggersConfigPanel,
  ValidationConfigPanel,
  ResponseHandlingConfig,
} from './components'

// Hooks
export { useOutputBinding } from './hooks'

// Re-export types
export type {
  OutputBinding,
  OutputMethod,
  OutputTrigger,
  FieldMapping,
  FieldValidation,
  ValidationRule,
  ValidationRuleType,
  SanitizeRule,
  SuccessAction,
  ErrorAction,
  ButtonStates,
  RetryConfig,
  SubmitState,
  SubmitResult,
  OutputBindingState,
} from '@/shared/types/outputBinding'

// Re-export API
export { outputBindingApi } from '@/shared/api/outputBindingApi'
