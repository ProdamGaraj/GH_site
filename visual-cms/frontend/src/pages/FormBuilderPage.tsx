import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Eye,
  Settings,
  Send,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchFormById,
  createForm,
  updateForm,
  clearCurrentForm,
} from '@/features/forms/formsSlice'
import type {
  FormField,
  FormFieldType,
  FormSettings,
  FormStatus,
} from '@/shared/types/form'
import { FIELD_TYPE_LABELS } from '@/shared/types/form'
import { DestinationsPanel } from '@/features/forms/components/DestinationsPanel'
import { SubmissionsPanel } from '@/features/forms'

type Tab = 'fields' | 'settings' | 'destinations' | 'submissions' | 'preview'

const DEFAULT_FIELD: () => FormField = () => ({
  id: crypto.randomUUID(),
  name: '',
  label: '',
  type: 'text',
  placeholder: '',
  validation: { required: false },
  order: 0,
})

export const FormBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { currentForm, saving } = useAppSelector((state) => state.forms)

  const isNew = id === 'new' || !id
  const [tab, setTab] = useState<Tab>('fields')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<FormStatus>('draft')
  const [fields, setFields] = useState<FormField[]>([])
  const [settings, setSettings] = useState<FormSettings>({
    successMessage: 'Спасибо! Ваша заявка отправлена.',
    submitButtonText: 'Отправить',
    showResetButton: false,
    storeSubmissions: true,
    rateLimitPerMinute: 5,
  })
  const [expandedField, setExpandedField] = useState<string | null>(null)

  // Load form data
  useEffect(() => {
    if (!isNew && id) {
      dispatch(fetchFormById(id))
    }
    return () => { dispatch(clearCurrentForm()) }
  }, [dispatch, id, isNew])

  useEffect(() => {
    if (currentForm) {
      setName(currentForm.name)
      setDescription(currentForm.description || '')
      setStatus(currentForm.status)
      setFields(currentForm.fields)
      setSettings(currentForm.settings)
    }
  }, [currentForm])

  // Save
  const handleSave = useCallback(async () => {
    const data = { name, description, status, fields, settings }
    if (isNew) {
      const result = await dispatch(createForm(data))
      if (createForm.fulfilled.match(result)) {
        navigate(`/forms/${result.payload.id}`, { replace: true })
      }
    } else if (id) {
      await dispatch(updateForm({ id, data }))
    }
  }, [dispatch, navigate, isNew, id, name, description, status, fields, settings])

  // Field operations
  const addField = useCallback((type: FormFieldType = 'text') => {
    const field = DEFAULT_FIELD()
    field.type = type
    field.order = fields.length
    field.name = `field_${fields.length + 1}`
    field.label = FIELD_TYPE_LABELS[type]
    setFields((prev) => [...prev, field])
    setExpandedField(field.id)
  }, [fields.length])

  const updateField = useCallback((fieldId: string, updates: Partial<FormField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, ...updates } : f))
    )
  }, [])

  const removeField = useCallback((fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId))
  }, [])

  const moveField = useCallback((index: number, direction: 'up' | 'down') => {
    setFields((prev) => {
      const arr = [...prev]
      const newIdx = direction === 'up' ? index - 1 : index + 1
      if (newIdx < 0 || newIdx >= arr.length) return arr
      ;[arr[index], arr[newIdx]] = [arr[newIdx], arr[index]]
      return arr.map((f, i) => ({ ...f, order: i }))
    })
  }, [])

  const duplicateField = useCallback((fieldId: string) => {
    setFields((prev) => {
      const src = prev.find((f) => f.id === fieldId)
      if (!src) return prev
      const copy = { ...src, id: crypto.randomUUID(), name: `${src.name}_copy`, label: `${src.label} (копия)` }
      return [...prev, copy].map((f, i) => ({ ...f, order: i }))
    })
  }, [])

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'fields', label: 'Поля', icon: <Plus className="w-4 h-4" /> },
    { key: 'settings', label: 'Настройки', icon: <Settings className="w-4 h-4" /> },
    { key: 'destinations', label: 'Получатели', icon: <Send className="w-4 h-4" /> },
    { key: 'submissions', label: 'Заявки', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'preview', label: 'Предпросмотр', icon: <Eye className="w-4 h-4" /> },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/forms')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название формы..."
            className="text-xl font-bold bg-transparent border-none outline-none w-full"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание (необязательно)..."
            className="text-sm text-gray-500 bg-transparent border-none outline-none w-full mt-1"
          />
        </div>

        {/* Status toggle */}
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as FormStatus)}
        >
          <option value="draft">Черновик</option>
          <option value="active">Активна</option>
          <option value="disabled">Отключена</option>
        </select>

        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving || !name.trim()}
        >
          <Save className="w-4 h-4 mr-1" />
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'fields' && (
        <FieldsTab
          fields={fields}
          expandedField={expandedField}
          onExpand={setExpandedField}
          onAdd={addField}
          onUpdate={updateField}
          onRemove={removeField}
          onMove={moveField}
          onDuplicate={duplicateField}
        />
      )}
      {tab === 'settings' && (
        <SettingsTab settings={settings} onChange={setSettings} />
      )}
      {tab === 'destinations' && !isNew && id && (
        <DestinationsPanel formId={id} fields={fields} />
      )}
      {tab === 'destinations' && isNew && (
        <div className="text-center py-12 text-gray-500">
          Сохраните форму, чтобы настроить получателей данных
        </div>
      )}
      {tab === 'submissions' && !isNew && id && (
        <SubmissionsPanel formId={id} />
      )}
      {tab === 'submissions' && isNew && (
        <div className="text-center py-12 text-gray-500">
          Сохраните форму, чтобы просматривать заявки
        </div>
      )}
      {tab === 'preview' && (
        <PreviewTab fields={fields} settings={settings} />
      )}
    </div>
  )
}

// ─── Fields Tab ──────────────────────────────────────────────────

interface FieldsTabProps {
  fields: FormField[]
  expandedField: string | null
  onExpand: (id: string | null) => void
  onAdd: (type?: FormFieldType) => void
  onUpdate: (id: string, updates: Partial<FormField>) => void
  onRemove: (id: string) => void
  onMove: (index: number, direction: 'up' | 'down') => void
  onDuplicate: (id: string) => void
}

const FieldsTab: React.FC<FieldsTabProps> = ({
  fields, expandedField, onExpand, onAdd, onUpdate, onRemove, onMove, onDuplicate,
}) => {
  const fieldTypes: FormFieldType[] = [
    'text', 'email', 'phone', 'textarea', 'number',
    'select', 'radio', 'checkbox', 'date', 'hidden',
  ]

  return (
    <div className="space-y-4">
      {/* Quick add buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {fieldTypes.map((type) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            + {FIELD_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Fields list */}
      {fields.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Добавьте поля формы с помощью кнопок выше
        </div>
      )}

      {fields.map((field, index) => (
        <FieldEditor
          key={field.id}
          field={field}
          index={index}
          total={fields.length}
          isExpanded={expandedField === field.id}
          onToggle={() => onExpand(expandedField === field.id ? null : field.id)}
          onChange={(updates) => onUpdate(field.id, updates)}
          onRemove={() => onRemove(field.id)}
          onMove={(dir) => onMove(index, dir)}
          onDuplicate={() => onDuplicate(field.id)}
        />
      ))}
    </div>
  )
}

// ─── Field Editor ────────────────────────────────────────────────

interface FieldEditorProps {
  field: FormField
  index: number
  total: number
  isExpanded: boolean
  onToggle: () => void
  onChange: (updates: Partial<FormField>) => void
  onRemove: () => void
  onMove: (dir: 'up' | 'down') => void
  onDuplicate: () => void
}

const FieldEditor: React.FC<FieldEditorProps> = ({
  field, index, total, isExpanded, onToggle, onChange, onRemove, onMove, onDuplicate,
}) => {
  const hasOptions = ['select', 'radio'].includes(field.type)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Collapsed header */}
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <GripVertical className="w-4 h-4 text-gray-300" />
        <span className="text-xs text-gray-400 w-6">{index + 1}</span>
        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
          {FIELD_TYPE_LABELS[field.type]}
        </span>
        <span className="font-medium text-sm flex-1 truncate">{field.label || '(без названия)'}</span>
        {field.validation.required && (
          <span className="text-xs text-red-500">*обязательное</span>
        )}
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onMove('up') }} disabled={index === 0}
            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMove('down') }} disabled={index === total - 1}
            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate() }}
            className="p-1 hover:bg-gray-200 rounded">
            <Copy className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="p-1 hover:bg-red-100 rounded">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Название поля</label>
              <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Имя (name)</label>
              <Input value={field.name} onChange={(e) => onChange({ name: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={field.type}
                onChange={(e) => onChange({ type: e.target.value as FormFieldType })}
              >
                {Object.entries(FIELD_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
              <Input
                value={field.placeholder || ''}
                onChange={(e) => onChange({ placeholder: e.target.value })}
              />
            </div>
          </div>

          {/* Options for select/radio */}
          {hasOptions && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Варианты</label>
              {(field.options || []).map((opt, optIdx) => (
                <div key={optIdx} className="flex items-center gap-2 mb-2">
                  <Input
                    placeholder="Значение"
                    value={opt.value}
                    onChange={(e) => {
                      const opts = [...(field.options || [])]
                      opts[optIdx] = { ...opts[optIdx], value: e.target.value }
                      onChange({ options: opts })
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Подпись"
                    value={opt.label}
                    onChange={(e) => {
                      const opts = [...(field.options || [])]
                      opts[optIdx] = { ...opts[optIdx], label: e.target.value }
                      onChange({ options: opts })
                    }}
                    className="flex-1"
                  />
                  <button
                    onClick={() => onChange({ options: (field.options || []).filter((_, i) => i !== optIdx) })}
                    className="p-1 hover:bg-red-100 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => onChange({ options: [...(field.options || []), { label: '', value: '' }] })}
                className="text-xs text-blue-600 hover:underline"
              >
                + Добавить вариант
              </button>
            </div>
          )}

          {/* Validation */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Валидация</label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.validation.required || false}
                  onChange={(e) =>
                    onChange({ validation: { ...field.validation, required: e.target.checked } })
                  }
                />
                Обязательное
              </label>

              {field.type === 'email' && (
                <label className="flex items-center gap-2 text-sm text-gray-500">
                  <input type="checkbox" checked disabled /> Проверка email
                </label>
              )}
              {field.type === 'phone' && (
                <label className="flex items-center gap-2 text-sm text-gray-500">
                  <input type="checkbox" checked disabled /> Проверка телефона
                </label>
              )}
            </div>

            {['text', 'textarea'].includes(field.type) && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Мин. длина</label>
                  <Input
                    type="number"
                    min={0}
                    value={field.validation.minLength ?? ''}
                    onChange={(e) =>
                      onChange({ validation: { ...field.validation, minLength: e.target.value ? Number(e.target.value) : undefined } })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Макс. длина</label>
                  <Input
                    type="number"
                    min={0}
                    value={field.validation.maxLength ?? ''}
                    onChange={(e) =>
                      onChange({ validation: { ...field.validation, maxLength: e.target.value ? Number(e.target.value) : undefined } })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Help text */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Подпись / подсказка</label>
            <Input
              value={field.helpText || ''}
              onChange={(e) => onChange({ helpText: e.target.value })}
              placeholder="Текст подсказки под полем"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Settings Tab ────────────────────────────────────────────────

interface SettingsTabProps {
  settings: FormSettings
  onChange: (settings: FormSettings) => void
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onChange }) => {
  const update = (patch: Partial<FormSettings>) => onChange({ ...settings, ...patch })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Сообщение после отправки
        </label>
        <Input
          value={settings.successMessage || ''}
          onChange={(e) => update({ successMessage: e.target.value })}
          placeholder="Спасибо! Ваша заявка отправлена."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL редиректа после отправки
        </label>
        <Input
          value={settings.redirectUrl || ''}
          onChange={(e) => update({ redirectUrl: e.target.value })}
          placeholder="https://example.com/thanks"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Текст кнопки отправки
          </label>
          <Input
            value={settings.submitButtonText || ''}
            onChange={(e) => update({ submitButtonText: e.target.value })}
            placeholder="Отправить"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CSS-класс формы
          </label>
          <Input
            value={settings.cssClass || ''}
            onChange={(e) => update({ cssClass: e.target.value })}
            placeholder="my-form-class"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.showResetButton ?? false}
            onChange={(e) => update({ showResetButton: e.target.checked })}
          />
          Показывать кнопку "Сбросить"
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.storeSubmissions ?? true}
            onChange={(e) => update({ storeSubmissions: e.target.checked })}
          />
          Сохранять заявки в базе данных
        </label>
      </div>

      {/* Anti-spam */}
      <div className="border-t pt-4">
        <h3 className="font-medium text-gray-700 mb-3">Защита от спама</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Honeypot поле (ловушка для ботов)
            </label>
            <Input
              value={settings.honeypotField || ''}
              onChange={(e) => update({ honeypotField: e.target.value })}
              placeholder="website_url"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Лимит отправок / мин (per IP)
            </label>
            <Input
              type="number"
              min={1}
              value={settings.rateLimitPerMinute ?? 5}
              onChange={(e) => update({ rateLimitPerMinute: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* Notification */}
      <div className="border-t pt-4">
        <h3 className="font-medium text-gray-700 mb-3">Уведомления</h3>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Email для уведомлений администратора
          </label>
          <Input
            type="email"
            value={settings.notificationEmail || ''}
            onChange={(e) => update({ notificationEmail: e.target.value })}
            placeholder="admin@example.com"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Preview Tab ─────────────────────────────────────────────────

interface PreviewTabProps {
  fields: FormField[]
  settings: FormSettings
}

const PreviewTab: React.FC<PreviewTabProps> = ({ fields, settings }) => {
  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {fields.map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.validation.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={field.placeholder}
                  rows={4}
                  readOnly
                />
              ) : field.type === 'select' ? (
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">{field.placeholder || 'Выберите...'}</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : field.type === 'radio' ? (
                <div className="space-y-2">
                  {(field.options || []).map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm">
                      <input type="radio" name={field.name} disabled />
                      {opt.label}
                    </label>
                  ))}
                </div>
              ) : field.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled />
                  {field.placeholder || field.label}
                </label>
              ) : field.type === 'hidden' ? (
                <p className="text-xs text-gray-400 italic">Скрытое поле: {field.name}</p>
              ) : (
                <input
                  type={field.type}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder={field.placeholder}
                  readOnly
                />
              )}

              {field.helpText && (
                <p className="text-xs text-gray-400 mt-1">{field.helpText}</p>
              )}
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              {settings.submitButtonText || 'Отправить'}
            </button>
            {settings.showResetButton && (
              <button
                type="button"
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm"
              >
                Сбросить
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default FormBuilderPage
