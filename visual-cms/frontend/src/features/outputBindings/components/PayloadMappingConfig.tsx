/**
 * PayloadMappingConfig Component
 * 
 * Согласно ТЗ: docs/data-binding-system-spec.md
 * Этап 4: OUTPUT Bindings
 * 
 * Конфигурация маппинга полей для отправки данных
 */

import type { FieldMapping, AdditionalData, FieldTransform } from '@/shared/types/outputBinding'

interface PayloadMappingConfigProps {
  fieldMappings: FieldMapping[]
  onChange: (mappings: FieldMapping[]) => void
  availableFields: string[]
  additionalData?: AdditionalData
  onAdditionalDataChange?: (data: AdditionalData) => void
}

export function PayloadMappingConfig({
  fieldMappings,
  onChange,
  availableFields,
  additionalData,
  onAdditionalDataChange,
}: PayloadMappingConfigProps) {
  const transforms: Array<{ value: FieldTransform; label: string }> = [
    { value: 'none', label: 'Без изменений' },
    { value: 'toString', label: 'В строку' },
    { value: 'toNumber', label: 'В число' },
    { value: 'toBoolean', label: 'В boolean' },
    { value: 'toDate', label: 'В дату (ISO)' },
    { value: 'custom', label: 'Custom функция' },
  ]

  const addMapping = () => {
    const newMapping: FieldMapping = {
      sourceField: '',
      targetField: '',
      transform: 'none',
      skipIfEmpty: false,
    }
    onChange([...fieldMappings, newMapping])
  }

  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    const updated = fieldMappings.map((m, i) => 
      i === index ? { ...m, ...updates } : m
    )
    onChange(updated)
  }

  const removeMapping = (index: number) => {
    onChange(fieldMappings.filter((_, i) => i !== index))
  }

  const addStaticData = () => {
    const key = prompt('Введите имя поля:')
    if (key && onAdditionalDataChange) {
      onAdditionalDataChange({
        ...additionalData,
        static: {
          ...additionalData?.static,
          [key]: '',
        },
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Field Mappings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Маппинг полей формы</h4>
          <button
            onClick={addMapping}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            + Добавить поле
          </button>
        </div>

        {fieldMappings.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
            <p>Маппинг не настроен</p>
            <p className="text-xs mt-1">Все поля формы будут отправлены как есть</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fieldMappings.map((mapping, index) => (
              <FieldMappingRow
                key={index}
                mapping={mapping}
                onChange={(updates) => updateMapping(index, updates)}
                onRemove={() => removeMapping(index)}
                availableFields={availableFields}
                transforms={transforms}
              />
            ))}
          </div>
        )}
      </div>

      {/* Additional Static Data */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Дополнительные данные</h4>
          <button
            onClick={addStaticData}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            + Статическое поле
          </button>
        </div>

        <div className="space-y-3">
          {/* Static fields */}
          {additionalData?.static && Object.entries(additionalData.static).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Поле</label>
                <input
                  type="text"
                  value={key}
                  disabled
                  className="w-full px-2 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Значение</label>
                <input
                  type="text"
                  value={String(value)}
                  onChange={(e) => {
                    if (onAdditionalDataChange) {
                      onAdditionalDataChange({
                        ...additionalData,
                        static: {
                          ...additionalData?.static,
                          [key]: e.target.value,
                        },
                      })
                    }
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
              <button
                onClick={() => {
                  if (onAdditionalDataChange && additionalData?.static) {
                    const { [key]: _, ...rest } = additionalData.static
                    onAdditionalDataChange({
                      ...additionalData,
                      static: rest,
                    })
                  }
                }}
                className="mt-5 p-1.5 text-red-500 hover:bg-red-50 rounded"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Checkboxes for system fields */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-blue-50 rounded-lg">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={additionalData?.includeTimestamp || false}
                onChange={(e) => {
                  if (onAdditionalDataChange) {
                    onAdditionalDataChange({
                      ...additionalData,
                      includeTimestamp: e.target.checked,
                    })
                  }
                }}
                className="rounded border-gray-300"
              />
              Включить timestamp
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={additionalData?.includePageInfo || false}
                onChange={(e) => {
                  if (onAdditionalDataChange) {
                    onAdditionalDataChange({
                      ...additionalData,
                      includePageInfo: e.target.checked,
                    })
                  }
                }}
                className="rounded border-gray-300"
              />
              Включить pageId
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={additionalData?.includeUserAgent || false}
                onChange={(e) => {
                  if (onAdditionalDataChange) {
                    onAdditionalDataChange({
                      ...additionalData,
                      includeUserAgent: e.target.checked,
                    })
                  }
                }}
                className="rounded border-gray-300"
              />
              Включить User-Agent
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={additionalData?.includeReferrer || false}
                onChange={(e) => {
                  if (onAdditionalDataChange) {
                    onAdditionalDataChange({
                      ...additionalData,
                      includeReferrer: e.target.checked,
                    })
                  }
                }}
                className="rounded border-gray-300"
              />
              Включить Referrer
            </label>
          </div>
        </div>
      </div>

      {/* Payload Preview */}
      <div>
        <h4 className="font-medium text-gray-900 mb-2">Превью payload</h4>
        <pre className="p-3 bg-gray-900 text-green-400 text-xs rounded-lg overflow-auto max-h-48">
          {JSON.stringify(buildPreviewPayload(fieldMappings, additionalData), null, 2)}
        </pre>
      </div>
    </div>
  )
}

/**
 * Field Mapping Row Component
 */
interface FieldMappingRowProps {
  mapping: FieldMapping
  onChange: (updates: Partial<FieldMapping>) => void
  onRemove: () => void
  availableFields: string[]
  transforms: Array<{ value: FieldTransform; label: string }>
}

function FieldMappingRow({
  mapping,
  onChange,
  onRemove,
  availableFields,
  transforms,
}: FieldMappingRowProps) {
  return (
    <div className="p-3 border border-gray-200 rounded-lg bg-white">
      <div className="flex gap-3 items-start">
        {/* Source Field */}
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Поле формы</label>
          <select
            value={mapping.sourceField}
            onChange={(e) => onChange({ 
              sourceField: e.target.value,
              targetField: mapping.targetField || e.target.value,
            })}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
          >
            <option value="">Выберите...</option>
            {availableFields.map((field) => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </div>

        {/* Arrow */}
        <div className="pt-6 text-gray-400">→</div>

        {/* Target Field */}
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Поле в payload</label>
          <input
            type="text"
            value={mapping.targetField}
            onChange={(e) => onChange({ targetField: e.target.value })}
            placeholder="fieldName"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
          />
        </div>

        {/* Remove */}
        <button
          onClick={onRemove}
          className="mt-5 p-1.5 text-red-500 hover:bg-red-50 rounded"
        >
          ✕
        </button>
      </div>

      {/* Options row */}
      <div className="mt-3 flex gap-4 items-center">
        {/* Transform */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Трансформ:</label>
          <select
            value={mapping.transform || 'none'}
            onChange={(e) => onChange({ transform: e.target.value as FieldTransform })}
            className="px-2 py-1 text-xs border border-gray-300 rounded"
          >
            {transforms.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Skip if empty */}
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={mapping.skipIfEmpty || false}
            onChange={(e) => onChange({ skipIfEmpty: e.target.checked })}
            className="rounded border-gray-300"
          />
          Пропустить если пусто
        </label>

        {/* Required */}
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={mapping.required || false}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="rounded border-gray-300"
          />
          Обязательное
        </label>
      </div>

      {/* Custom transform */}
      {mapping.transform === 'custom' && (
        <div className="mt-3">
          <label className="block text-xs text-gray-500 mb-1">
            Custom функция (получает value, возвращает результат)
          </label>
          <textarea
            value={mapping.customTransform || ''}
            onChange={(e) => onChange({ customTransform: e.target.value })}
            placeholder="return value.trim().toLowerCase()"
            rows={2}
            className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 rounded"
          />
        </div>
      )}

      {/* Default value */}
      <div className="mt-3">
        <label className="block text-xs text-gray-500 mb-1">
          Default значение (если пусто)
        </label>
        <input
          type="text"
          value={String(mapping.defaultValue ?? '')}
          onChange={(e) => onChange({ defaultValue: e.target.value || undefined })}
          placeholder="Оставьте пустым если не нужно"
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
        />
      </div>
    </div>
  )
}

/**
 * Build preview payload
 */
function buildPreviewPayload(
  mappings: FieldMapping[],
  additionalData?: AdditionalData
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  // Field mappings
  for (const mapping of mappings) {
    if (mapping.sourceField && mapping.targetField) {
      payload[mapping.targetField] = `<${mapping.sourceField}>`
    }
  }

  // Static data
  if (additionalData?.static) {
    Object.assign(payload, additionalData.static)
  }

  // System fields
  if (additionalData?.includeTimestamp) {
    payload._timestamp = '<ISO date>'
  }
  if (additionalData?.includePageInfo) {
    payload._pageId = '<page-id>'
  }
  if (additionalData?.includeUserAgent) {
    payload._userAgent = '<browser info>'
  }
  if (additionalData?.includeReferrer) {
    payload._referrer = '<referrer URL>'
  }

  return payload
}

export default PayloadMappingConfig
