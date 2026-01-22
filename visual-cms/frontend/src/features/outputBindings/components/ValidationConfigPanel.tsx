/**
 * ValidationConfigPanel Component
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Конфигурация валидации полей перед отправкой
 */

import { useState } from 'react'
import type { 
  FieldValidation, 
  ValidationRule, 
  ValidationRuleType,
  SanitizeRule,
} from '@/shared/types/outputBinding'

interface ValidationConfigPanelProps {
  validations: FieldValidation[]
  onChange: (validations: FieldValidation[]) => void
  availableFields: string[]
}

export function ValidationConfigPanel({
  validations,
  onChange,
  availableFields,
}: ValidationConfigPanelProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null)

  const addFieldValidation = () => {
    const newValidation: FieldValidation = {
      fieldName: '',
      rules: [],
      sanitize: [],
    }
    onChange([...validations, newValidation])
  }

  const updateFieldValidation = (index: number, updates: Partial<FieldValidation>) => {
    const updated = validations.map((v, i) =>
      i === index ? { ...v, ...updates } : v
    )
    onChange(updated)
  }

  const removeFieldValidation = (index: number) => {
    onChange(validations.filter((_, i) => i !== index))
  }

  const addRule = (fieldIndex: number) => {
    const validation = validations[fieldIndex]
    const newRule: ValidationRule = {
      type: 'required',
    }
    updateFieldValidation(fieldIndex, {
      rules: [...validation.rules, newRule],
    })
  }

  const updateRule = (fieldIndex: number, ruleIndex: number, updates: Partial<ValidationRule>) => {
    const validation = validations[fieldIndex]
    const updatedRules = validation.rules.map((r, i) =>
      i === ruleIndex ? { ...r, ...updates } : r
    )
    updateFieldValidation(fieldIndex, { rules: updatedRules })
  }

  const removeRule = (fieldIndex: number, ruleIndex: number) => {
    const validation = validations[fieldIndex]
    const updatedRules = validation.rules.filter((_, i) => i !== ruleIndex)
    updateFieldValidation(fieldIndex, { rules: updatedRules })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-900">Правила валидации</h4>
          <p className="text-sm text-gray-500">
            Валидация выполняется на клиенте и сервере
          </p>
        </div>
        <button
          onClick={addFieldValidation}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          + Добавить поле
        </button>
      </div>

      {/* Field validations list */}
      {validations.length === 0 ? (
        <div className="p-6 bg-gray-50 rounded-lg text-center">
          <div className="text-3xl mb-2">✓</div>
          <p className="text-gray-600">Валидация не настроена</p>
          <p className="text-sm text-gray-400 mt-1">
            Данные будут отправлены без проверки
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {validations.map((validation, fieldIndex) => (
            <div
              key={fieldIndex}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Field header */}
              <div
                className={`
                  p-3 bg-gray-50 flex items-center justify-between cursor-pointer
                  hover:bg-gray-100 transition-colors
                `}
                onClick={() => setExpandedField(
                  expandedField === validation.fieldName ? null : validation.fieldName || `field-${fieldIndex}`
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {expandedField === (validation.fieldName || `field-${fieldIndex}`) ? '▼' : '▶'}
                  </span>
                  
                  <select
                    value={validation.fieldName}
                    onChange={(e) => {
                      e.stopPropagation()
                      updateFieldValidation(fieldIndex, { fieldName: e.target.value })
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
                  >
                    <option value="">Выберите поле...</option>
                    {availableFields.map((field) => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>

                  <span className="text-xs text-gray-500">
                    {validation.rules.length} правил
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFieldValidation(fieldIndex)
                  }}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                >
                  ✕
                </button>
              </div>

              {/* Expanded content */}
              {expandedField === (validation.fieldName || `field-${fieldIndex}`) && (
                <div className="p-4 border-t border-gray-200">
                  {/* Rules */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Правила валидации
                      </label>
                      <button
                        onClick={() => addRule(fieldIndex)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        + Добавить правило
                      </button>
                    </div>

                    {validation.rules.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">Нет правил</p>
                    ) : (
                      <div className="space-y-2">
                        {validation.rules.map((rule, ruleIndex) => (
                          <ValidationRuleRow
                            key={ruleIndex}
                            rule={rule}
                            onChange={(updates) => updateRule(fieldIndex, ruleIndex, updates)}
                            onRemove={() => removeRule(fieldIndex, ruleIndex)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sanitize */}
                  <SanitizeConfig
                    sanitize={validation.sanitize || []}
                    onChange={(sanitize) => updateFieldValidation(fieldIndex, { sanitize })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick preset buttons */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h5 className="font-medium text-blue-800 mb-2">🎯 Быстрые пресеты</h5>
        <div className="flex flex-wrap gap-2">
          <PresetButton
            label="Email"
            onClick={() => {
              const preset: FieldValidation = {
                fieldName: 'email',
                rules: [
                  { type: 'required', message: 'Email обязателен' },
                  { type: 'email', message: 'Введите корректный email' },
                ],
                sanitize: [{ type: 'trim' }, { type: 'lowercase' }],
              }
              onChange([...validations, preset])
            }}
          />
          <PresetButton
            label="Телефон"
            onClick={() => {
              const preset: FieldValidation = {
                fieldName: 'phone',
                rules: [
                  { type: 'required', message: 'Телефон обязателен' },
                  { type: 'phone', message: 'Введите корректный телефон' },
                ],
                sanitize: [{ type: 'trim' }, { type: 'normalizePhone' }],
              }
              onChange([...validations, preset])
            }}
          />
          <PresetButton
            label="Имя"
            onClick={() => {
              const preset: FieldValidation = {
                fieldName: 'name',
                rules: [
                  { type: 'required', message: 'Имя обязательно' },
                  { type: 'minLength', value: 2, message: 'Минимум 2 символа' },
                  { type: 'maxLength', value: 100, message: 'Максимум 100 символов' },
                ],
                sanitize: [{ type: 'trim' }],
              }
              onChange([...validations, preset])
            }}
          />
          <PresetButton
            label="Сообщение"
            onClick={() => {
              const preset: FieldValidation = {
                fieldName: 'message',
                rules: [
                  { type: 'required', message: 'Сообщение обязательно' },
                  { type: 'minLength', value: 10, message: 'Минимум 10 символов' },
                ],
                sanitize: [{ type: 'trim' }, { type: 'escapeHtml' }],
              }
              onChange([...validations, preset])
            }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Validation Rule Row
 */
interface ValidationRuleRowProps {
  rule: ValidationRule
  onChange: (updates: Partial<ValidationRule>) => void
  onRemove: () => void
}

function ValidationRuleRow({ rule, onChange, onRemove }: ValidationRuleRowProps) {
  const ruleTypes: Array<{ value: ValidationRuleType; label: string; hasValue: boolean }> = [
    { value: 'required', label: 'Обязательное', hasValue: false },
    { value: 'email', label: 'Email', hasValue: false },
    { value: 'url', label: 'URL', hasValue: false },
    { value: 'phone', label: 'Телефон', hasValue: false },
    { value: 'minLength', label: 'Мин. длина', hasValue: true },
    { value: 'maxLength', label: 'Макс. длина', hasValue: true },
    { value: 'min', label: 'Мин. значение', hasValue: true },
    { value: 'max', label: 'Макс. значение', hasValue: true },
    { value: 'pattern', label: 'Regex паттерн', hasValue: true },
    { value: 'creditCard', label: 'Номер карты', hasValue: false },
  ]

  const selectedType = ruleTypes.find(t => t.value === rule.type)

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
      {/* Rule type */}
      <select
        value={rule.type}
        onChange={(e) => onChange({ type: e.target.value as ValidationRuleType, value: undefined })}
        className="px-2 py-1.5 text-sm border border-gray-300 rounded flex-shrink-0"
      >
        {ruleTypes.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* Value (if applicable) */}
      {selectedType?.hasValue && (
        <input
          type={rule.type === 'pattern' ? 'text' : 'number'}
          value={rule.value as string || ''}
          onChange={(e) => onChange({ 
            value: rule.type === 'pattern' ? e.target.value : Number(e.target.value) 
          })}
          placeholder={rule.type === 'pattern' ? '^[a-z]+$' : '0'}
          className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded"
        />
      )}

      {/* Custom message */}
      <input
        type="text"
        value={rule.message || ''}
        onChange={(e) => onChange({ message: e.target.value })}
        placeholder="Сообщение об ошибке..."
        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
      />

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
      >
        ✕
      </button>
    </div>
  )
}

/**
 * Sanitize Config
 */
interface SanitizeConfigProps {
  sanitize: SanitizeRule[]
  onChange: (sanitize: SanitizeRule[]) => void
}

function SanitizeConfig({ sanitize, onChange }: SanitizeConfigProps) {
  const sanitizeTypes: Array<{ value: SanitizeRule['type']; label: string; description: string }> = [
    { value: 'trim', label: 'Trim', description: 'Удалить пробелы в начале и конце' },
    { value: 'lowercase', label: 'Lowercase', description: 'Привести к нижнему регистру' },
    { value: 'uppercase', label: 'Uppercase', description: 'Привести к верхнему регистру' },
    { value: 'stripHtml', label: 'Strip HTML', description: 'Удалить HTML теги' },
    { value: 'escapeHtml', label: 'Escape HTML', description: 'Экранировать HTML' },
    { value: 'normalizePhone', label: 'Normalize Phone', description: 'Нормализовать телефон' },
  ]

  const toggleSanitize = (type: SanitizeRule['type']) => {
    const exists = sanitize.some(s => s.type === type)
    if (exists) {
      onChange(sanitize.filter(s => s.type !== type))
    } else {
      onChange([...sanitize, { type }])
    }
  }

  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-2 block">
        Санитизация (очистка данных)
      </label>
      <div className="grid grid-cols-3 gap-2">
        {sanitizeTypes.map((type) => {
          const isActive = sanitize.some(s => s.type === type.value)
          return (
            <button
              key={type.value}
              onClick={() => toggleSanitize(type.value)}
              className={`
                p-2 text-left rounded border transition-all text-sm
                ${isActive
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }
              `}
            >
              <div className="font-medium">{type.label}</div>
              <div className="text-xs opacity-75">{type.description}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Preset Button
 */
function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
    >
      + {label}
    </button>
  )
}

export default ValidationConfigPanel
