/**
 * OutputBindingSubTab — Подтаб "Отправка данных" в панели свойств блока.
 *
 * Позволяет превратить любой блок в «генератор» данных:
 * • создать OUTPUT-привязку к источнику данных
 * • настроить триггеры отправки (submit, click, change, blur, interval, custom)
 * • настроить маппинг полей, валидацию, действия при успехе/ошибке
 *
 * Работает через dataBindingsSlice → DataBinding с bindingType = 'output'
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  fetchBindingsForBlock,
  createBinding,
  updateBinding,
  deleteBinding,
  selectCurrentBlockBindings,
  selectBindingsLoading,
  selectBindingsSaving,
  selectBindingsError,
} from '@/features/dataBindings/dataBindingsSlice'
import { fetchDataSources, selectDataSources, selectDataSourceById } from '@/features/data-sources/dataSourcesSlice'
import { markAsDirty } from '@/features/editor/editorSlice'
import type {
  DataBinding,
  CreateDataBindingRequest,
  OutputBindingConfig,
  FieldMapping,
  ValidationRule,
  SuccessAction,
  ErrorAction,
  ButtonStates,
} from '@/shared/types/dataBinding'
import { EndpointConfigEditor, DEFAULT_OUTPUT_ENDPOINT_CONFIG } from './EndpointConfigEditor'
import {
  Send,
  Plus,
  Trash2,
  Save,
  Loader2,
  Zap,
  Link,
  Shield,
  CheckCircle,
  MousePointer,
  Clock,
  Type,
  Eye,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Globe,
} from 'lucide-react'
import { cn } from '@/shared/utils'

// ─── Props ──────────────────────────────────────────────────────

interface OutputBindingSubTabProps {
  blockId: string
  pageId?: string
}

// ─── Trigger/method constants ──────────────────────────────────

const TRIGGER_OPTIONS: Array<{
  value: OutputBindingConfig['trigger']
  label: string
  description: string
  icon: React.ReactNode
}> = [
  { value: 'submit', label: 'При отправке формы', description: 'Срабатывает при submit формы', icon: <Send size={14} /> },
  { value: 'click', label: 'При клике на кнопку', description: 'Срабатывает при клике', icon: <MousePointer size={14} /> },
  { value: 'change', label: 'При изменении поля', description: 'Срабатывает при изменении значения', icon: <Type size={14} /> },
  { value: 'blur', label: 'При потере фокуса', description: 'Срабатывает при blur', icon: <Eye size={14} /> },
  { value: 'interval', label: 'По интервалу', description: 'Автоотправка каждые N секунд', icon: <Clock size={14} /> },
  { value: 'custom', label: 'Кастомное событие', description: 'По dispatchEvent', icon: <Zap size={14} /> },
]

const VALIDATION_TYPES = [
  { value: 'required', label: 'Обязательное', needsValue: false },
  { value: 'email', label: 'Email', needsValue: false },
  { value: 'minLength', label: 'Мин. длина', needsValue: true },
  { value: 'maxLength', label: 'Макс. длина', needsValue: true },
  { value: 'pattern', label: 'Regex паттерн', needsValue: true },
  { value: 'min', label: 'Мин. значение', needsValue: true },
  { value: 'max', label: 'Макс. значение', needsValue: true },
] as const

const SUCCESS_ACTION_OPTIONS: Array<{ value: SuccessAction['action']; label: string; description: string }> = [
  { value: 'none', label: 'Ничего', description: '' },
  { value: 'showMessage', label: 'Показать сообщение', description: 'Покажет текст после отправки' },
  { value: 'redirect', label: 'Редирект', description: 'Перенаправит на URL' },
  { value: 'refreshData', label: 'Обновить данные', description: 'Перезагрузит привязанные данные' },
  { value: 'resetForm', label: 'Очистить форму', description: 'Сбросит все поля' },
  { value: 'hideBlock', label: 'Скрыть блок', description: 'Скроет текущий блок' },
  { value: 'custom', label: 'Кастомный', description: 'JavaScript callback' },
]

const ERROR_ACTION_OPTIONS: Array<{ value: ErrorAction['action']; label: string }> = [
  { value: 'showError', label: 'Показать ошибку' },
  { value: 'showField', label: 'Подсветить поле' },
  { value: 'retry', label: 'Повторить попытку' },
  { value: 'custom', label: 'Кастомный callback' },
]

// ─── Sub-sections ──────────────────────────────────────────────

type Section = 'trigger' | 'endpoint' | 'mapping' | 'validation' | 'response'

const SECTIONS: Array<{ id: Section; label: string; icon: React.ReactNode }> = [
  { id: 'trigger', label: 'Триггер', icon: <Zap size={14} /> },
  { id: 'endpoint', label: 'Запрос', icon: <Globe size={14} /> },
  { id: 'mapping', label: 'Маппинг', icon: <Link size={14} /> },
  { id: 'validation', label: 'Валидация', icon: <Shield size={14} /> },
  { id: 'response', label: 'Действия', icon: <CheckCircle size={14} /> },
]

// ─── Default configs ───────────────────────────────────────────

const DEFAULT_OUTPUT_CONFIG: OutputBindingConfig = {
  trigger: 'submit',
  endpoint: DEFAULT_OUTPUT_ENDPOINT_CONFIG,
  payloadMappings: [],
  validation: { enabled: false, rules: [] },
  onSuccess: { action: 'showMessage', message: 'Отправлено!' },
  onError: { action: 'showError', message: 'Произошла ошибка. Попробуйте снова.' },
  buttonStates: {
    loading: 'Отправка...',
    success: 'Отправлено!',
    error: 'Ошибка',
    disableOnSubmit: true,
  },
}

// ═════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════

export const OutputBindingSubTab: React.FC<OutputBindingSubTabProps> = ({ blockId, pageId }) => {
  const dispatch = useAppDispatch()

  // Redux selectors
  const allBindings = useAppSelector(selectCurrentBlockBindings)
  const dataSources = useAppSelector(selectDataSources)
  const loading = useAppSelector(selectBindingsLoading)
  const saving = useAppSelector(selectBindingsSaving)
  const error = useAppSelector(selectBindingsError)

  // Filter only output bindings for this block
  const outputBindings = allBindings.filter(
    b => b.bindingType === 'output' || b.bindingType === 'bidirectional'
  )

  // Local state
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null)
  const [config, setConfig] = useState<OutputBindingConfig>(DEFAULT_OUTPUT_CONFIG)
  const [activeSection, setActiveSection] = useState<Section>('trigger')
  const [hasChanges, setHasChanges] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newDataSourceId, setNewDataSourceId] = useState<string>('')

  // Load bindings and data sources on mount
  useEffect(() => {
    dispatch(fetchBindingsForBlock({ blockId, pageId }))
    dispatch(fetchDataSources({}))
  }, [dispatch, blockId, pageId])

  // When bindings load, auto-select the first output binding
  useEffect(() => {
    if (outputBindings.length > 0 && !selectedBindingId) {
      const first = outputBindings[0]
      setSelectedBindingId(first.id)
      setConfig(first.config.outputConfig || DEFAULT_OUTPUT_CONFIG)
    }
  }, [outputBindings.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Selected binding object
  const selectedBinding = outputBindings.find(b => b.id === selectedBindingId) || null

  // Get the linked data source details  
  const linkedDataSource = useAppSelector(
    selectedBinding ? selectDataSourceById(selectedBinding.dataSourceId) : () => undefined
  )

  // ─── Handlers ──────────────────────────────────────────────────

  const updateConfig = useCallback((updates: Partial<OutputBindingConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedBinding) return
    try {
      await dispatch(updateBinding({
        id: selectedBinding.id,
        data: {
          config: {
            ...selectedBinding.config,
            outputConfig: config,
          },
        },
      })).unwrap()
      setHasChanges(false)
      dispatch(markAsDirty())
    } catch (err) {
      console.error('Failed to save output binding:', err)
    }
  }, [dispatch, selectedBinding, config])

  const handleCreate = useCallback(async () => {
    if (!newDataSourceId) return
    try {
      const newBinding: CreateDataBindingRequest = {
        blockId,
        pageId: pageId || undefined,
        dataSourceId: newDataSourceId,
        bindingType: 'output',
        config: { outputConfig: DEFAULT_OUTPUT_CONFIG },
      }
      const created = await dispatch(createBinding(newBinding)).unwrap()
      setSelectedBindingId(created.id)
      setConfig(DEFAULT_OUTPUT_CONFIG)
      setIsCreating(false)
      setNewDataSourceId('')
      setHasChanges(false)
      dispatch(markAsDirty())
    } catch (err) {
      console.error('Failed to create output binding:', err)
    }
  }, [dispatch, blockId, pageId, newDataSourceId])

  const handleDelete = useCallback(async () => {
    if (!selectedBinding) return
    if (!confirm('Удалить привязку отправки данных?')) return
    try {
      await dispatch(deleteBinding(selectedBinding.id)).unwrap()
      setSelectedBindingId(null)
      setConfig(DEFAULT_OUTPUT_CONFIG)
      setHasChanges(false)
      dispatch(markAsDirty())
    } catch (err) {
      console.error('Failed to delete output binding:', err)
    }
  }, [dispatch, selectedBinding])

  const handleSelectBinding = useCallback((binding: DataBinding) => {
    if (hasChanges && !confirm('Есть несохранённые изменения. Переключиться?')) return
    setSelectedBindingId(binding.id)
    setConfig(binding.config.outputConfig || DEFAULT_OUTPUT_CONFIG)
    setHasChanges(false)
  }, [hasChanges])

  const handleToggleActive = useCallback(async (binding: DataBinding) => {
    try {
      await dispatch(updateBinding({
        id: binding.id,
        data: { isActive: !binding.isActive },
      })).unwrap()
      dispatch(markAsDirty())
    } catch (err) {
      console.error('Failed to toggle binding:', err)
    }
  }, [dispatch])

  // ─── Loading state ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-blue-600 mr-2" />
        <span className="text-sm text-gray-600">Загрузка привязок...</span>
      </div>
    )
  }

  // ─── Empty state — no output bindings yet ─────────────────────

  if (outputBindings.length === 0 && !isCreating) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-orange-100 flex items-center justify-center">
            <Send size={24} className="text-orange-600" />
          </div>
          <h4 className="text-sm font-semibold text-gray-900 mb-1">Отправка данных</h4>
          <p className="text-xs text-gray-500 mb-4 max-w-[260px] mx-auto">
            Превратите этот блок в генератор данных — настройте отправку при клике, submit, изменении полей и т.д.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Plus size={16} />
            Настроить отправку
          </button>
        </div>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}
      </div>
    )
  }

  // ─── Creating new output binding ──────────────────────────────

  if (isCreating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Send size={16} className="text-orange-600" />
            Новая привязка отправки
          </h4>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Источник данных (куда отправлять)</label>
          <select
            value={newDataSourceId}
            onChange={e => setNewDataSourceId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="">Выберите источник...</option>
            {dataSources.map(ds => (
              <option key={ds.id} value={ds.id}>
                {ds.name} ({ds.type})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Если нужного источника нет — создайте его в разделе «Источники данных»
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={!newDataSourceId || saving}
            className="flex-1 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Создание...' : 'Создать привязку'}
          </button>
          <button
            onClick={() => { setIsCreating(false); setNewDataSourceId('') }}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    )
  }

  // ─── Main editor UI ───────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Binding selector (if multiple) */}
      {outputBindings.length > 1 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Привязки отправки</label>
          {outputBindings.map(b => (
            <button
              key={b.id}
              onClick={() => handleSelectBinding(b)}
              className={cn(
                'w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all text-sm',
                selectedBindingId === b.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              )}
            >
              <div className="flex items-center gap-2">
                <Send size={14} className="text-orange-600" />
                <span className="font-medium">{b.dataSource?.name || 'Источник данных'}</span>
              </div>
              <span
                className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full',
                  b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                )}
              >
                {b.isActive ? 'Вкл' : 'Выкл'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Header with actions */}
      {selectedBinding && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send size={16} className="text-orange-600" />
              <span className="text-sm font-semibold text-gray-900">
                {selectedBinding.dataSource?.name || 'Отправка данных'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleToggleActive(selectedBinding)}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  selectedBinding.isActive
                    ? 'text-green-600 hover:bg-green-50'
                    : 'text-gray-400 hover:bg-gray-100'
                )}
                title={selectedBinding.isActive ? 'Выключить' : 'Включить'}
              >
                {selectedBinding.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              </button>
              <button
                onClick={() => setIsCreating(true)}
                className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
                title="Добавить ещё привязку"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                title="Удалить привязку"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Linked data source info */}
          {linkedDataSource && (
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <ExternalLink size={13} className="text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{linkedDataSource.name}</p>
                    {'url' in linkedDataSource.config && (
                      <p className="text-[10px] text-gray-400 font-mono truncate">{(linkedDataSource.config as { url: string }).url}</p>
                    )}
                  </div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded flex-shrink-0">
                  {linkedDataSource.type}
                </span>
              </div>
            </div>
          )}

          {/* Section tabs */}
          <div className="flex border-b border-gray-200 -mx-1">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                  activeSection === section.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div className="min-h-[200px]">
            {activeSection === 'trigger' && (
              <TriggerSection config={config} onChange={updateConfig} />
            )}
            {activeSection === 'endpoint' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Настройте конкретный endpoint для отправки данных</p>
                <EndpointConfigEditor
                  value={config.endpoint || DEFAULT_OUTPUT_ENDPOINT_CONFIG}
                  onChange={(endpoint) => updateConfig({ endpoint })}
                  showBody={true}
                  baseUrl={linkedDataSource ? (linkedDataSource.config as any)?.url : undefined}
                />
              </div>
            )}
            {activeSection === 'mapping' && (
              <MappingSection config={config} onChange={updateConfig} />
            )}
            {activeSection === 'validation' && (
              <ValidationSection config={config} onChange={updateConfig} />
            )}
            {activeSection === 'response' && (
              <ResponseSection config={config} onChange={updateConfig} />
            )}
          </div>

          {/* Save bar */}
          {hasChanges && (
            <div className="sticky bottom-0 -mx-4 -mb-4 px-4 py-3 bg-orange-50 border-t border-orange-200 flex items-center justify-between">
              <span className="text-xs text-orange-700">Есть несохранённые изменения</span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Section Components
// ═════════════════════════════════════════════════════════════════

interface SectionProps {
  config: OutputBindingConfig
  onChange: (updates: Partial<OutputBindingConfig>) => void
}

// ─── Trigger ──────────────────────────────────────────────────

const TriggerSection: React.FC<SectionProps> = ({ config, onChange }) => {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Выберите, когда данные будут отправляться:</p>

      <div className="grid grid-cols-2 gap-2">
        {TRIGGER_OPTIONS.map(t => (
          <button
            key={t.value}
            onClick={() => onChange({ trigger: t.value })}
            className={cn(
              'p-3 text-left rounded-lg border-2 transition-all',
              config.trigger === t.value
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={config.trigger === t.value ? 'text-orange-600' : 'text-gray-500'}>{t.icon}</span>
              <span className={cn('text-xs font-medium', config.trigger === t.value ? 'text-orange-700' : 'text-gray-700')}>
                {t.label}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 ml-6">{t.description}</p>
          </button>
        ))}
      </div>

      {/* Interval settings */}
      {config.trigger === 'interval' && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <label className="block text-xs font-medium text-yellow-800 mb-1">Интервал (секунды)</label>
          <input
            type="number"
            min={1}
            value={config.intervalSeconds || 5}
            onChange={e => onChange({ intervalSeconds: Number(e.target.value) })}
            className="w-24 px-2 py-1.5 text-sm border border-yellow-300 rounded"
          />
          <p className="text-[10px] text-yellow-600 mt-1">Данные будут отправляться автоматически каждые N секунд</p>
        </div>
      )}

      {/* Debounce for change trigger */}
      {config.trigger === 'change' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="block text-xs font-medium text-blue-800 mb-1">Debounce (мс)</label>
          <input
            type="number"
            min={0}
            step={100}
            value={config.debounce || 300}
            onChange={e => onChange({ debounce: Number(e.target.value) })}
            className="w-24 px-2 py-1.5 text-sm border border-blue-300 rounded"
          />
          <p className="text-[10px] text-blue-600 mt-1">Задержка перед отправкой после последнего изменения</p>
        </div>
      )}

      {/* Custom event */}
      {config.trigger === 'custom' && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <label className="block text-xs font-medium text-purple-800 mb-1">Название события</label>
          <input
            type="text"
            value={config.customTrigger || ''}
            onChange={e => onChange({ customTrigger: e.target.value })}
            placeholder="myCustomEvent"
            className="w-full px-2 py-1.5 text-sm font-mono border border-purple-300 rounded"
          />
          <p className="text-[10px] text-purple-600 mt-1">
            Вызывайте: <code className="bg-purple-100 px-1 rounded">window.dispatchEvent(new CustomEvent('...'))</code>
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Mapping ───────────────────────────────────────────────────

const MappingSection: React.FC<SectionProps> = ({ config, onChange }) => {
  const mappings = config.payloadMappings || []

  const addMapping = () => {
    onChange({
      payloadMappings: [...mappings, { id: crypto.randomUUID(), sourceField: '', targetProperty: '' }],
    })
  }

  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    const updated = mappings.map((m, i) => (i === index ? { ...m, ...updates } : m))
    onChange({ payloadMappings: updated })
  }

  const removeMapping = (index: number) => {
    onChange({ payloadMappings: mappings.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-700">Маппинг полей</p>
          <p className="text-[10px] text-gray-500">Укажите, какие поля отправлять и под какими именами</p>
        </div>
        <button
          onClick={addMapping}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
        >
          <Plus size={12} /> Поле
        </button>
      </div>

      {mappings.length === 0 ? (
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-xs text-gray-500">Маппинг не задан — все поля формы будут отправлены как есть</p>
        </div>
      ) : (
        <div className="space-y-2">
          {mappings.map((mapping, index) => (
            <div key={index} className="p-3 border border-gray-200 rounded-lg bg-white space-y-2">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 mb-0.5">Поле формы</label>
                  <input
                    type="text"
                    value={mapping.sourceField}
                    onChange={e => updateMapping(index, { sourceField: e.target.value, targetProperty: mapping.targetProperty || e.target.value })}
                    placeholder="name, email, phone..."
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                  />
                </div>
                <span className="text-gray-400 mt-4">→</span>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 mb-0.5">В payload</label>
                  <input
                    type="text"
                    value={mapping.targetProperty}
                    onChange={e => updateMapping(index, { targetProperty: e.target.value })}
                    placeholder="fieldName"
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                  />
                </div>
                <button
                  onClick={() => removeMapping(index)}
                  className="mt-4 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payload preview */}
      {mappings.length > 0 && (
        <div className="p-3 bg-gray-900 rounded-lg">
          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Превью payload</div>
          <pre className="text-green-400 text-xs overflow-auto max-h-32">
            {JSON.stringify(
              Object.fromEntries(
                mappings
                  .filter(m => m.sourceField && m.targetProperty)
                  .map(m => [m.targetProperty, `<${m.sourceField}>`])
              ),
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Validation ────────────────────────────────────────────────

const ValidationSection: React.FC<SectionProps> = ({ config, onChange }) => {
  const validationConfig = config.validation || { enabled: false, rules: [] }
  const rules = validationConfig.rules || []

  const setValidation = (updates: Partial<typeof validationConfig>) => {
    onChange({ validation: { ...validationConfig, ...updates } })
  }

  const addRule = () => {
    setValidation({
      rules: [...rules, { field: '', type: 'required', message: '' } as ValidationRule],
    })
  }

  const updateRule = (index: number, updates: Partial<ValidationRule>) => {
    setValidation({
      rules: rules.map((r, i) => (i === index ? { ...r, ...updates } : r)),
    })
  }

  const removeRule = (index: number) => {
    setValidation({ rules: rules.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
        <div>
          <span className="text-xs font-medium text-gray-700">Валидация данных</span>
          <p className="text-[10px] text-gray-500">Проверка перед отправкой на клиенте</p>
        </div>
        <input
          type="checkbox"
          checked={validationConfig.enabled}
          onChange={e => setValidation({ enabled: e.target.checked })}
          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
        />
      </label>

      {validationConfig.enabled && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Правила</span>
            <button onClick={addRule} className="text-xs text-orange-600 hover:text-orange-700">
              + Добавить правило
            </button>
          </div>

          {rules.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">Нет правил валидации</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <div key={index} className="p-2 border border-gray-200 rounded-lg bg-white">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={rule.field}
                      onChange={e => updateRule(index, { field: e.target.value })}
                      placeholder="Поле"
                      className="w-24 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                    <select
                      value={rule.type}
                      onChange={e => updateRule(index, { type: e.target.value as ValidationRule['type'] })}
                      className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                    >
                      {VALIDATION_TYPES.map(vt => (
                        <option key={vt.value} value={vt.value}>{vt.label}</option>
                      ))}
                    </select>
                    {VALIDATION_TYPES.find(vt => vt.value === rule.type)?.needsValue && (
                      <input
                        type="text"
                        value={String(rule.value ?? '')}
                        onChange={e => updateRule(index, { value: e.target.value })}
                        placeholder="Значение"
                        className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                      />
                    )}
                    <input
                      type="text"
                      value={rule.message}
                      onChange={e => updateRule(index, { message: e.target.value })}
                      placeholder="Сообщение ошибки"
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                    <button onClick={() => removeRule(index)} className="p-1 text-red-400 hover:text-red-600 rounded">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick presets */}
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-[10px] font-medium text-orange-700 uppercase tracking-wide mb-2">Быстрые пресеты</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Email', rules: [{ field: 'email', type: 'required' as const, message: 'Email обязателен' }, { field: 'email', type: 'email' as const, message: 'Некорректный email' }] },
                { label: 'Имя', rules: [{ field: 'name', type: 'required' as const, message: 'Имя обязательно' }, { field: 'name', type: 'minLength' as const, value: 2, message: 'Минимум 2 символа' }] },
                { label: 'Телефон', rules: [{ field: 'phone', type: 'required' as const, message: 'Телефон обязателен' }] },
                { label: 'Сообщение', rules: [{ field: 'message', type: 'required' as const, message: 'Введите сообщение' }, { field: 'message', type: 'minLength' as const, value: 10, message: 'Минимум 10 символов' }] },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => setValidation({ rules: [...rules, ...preset.rules] })}
                  className="px-2 py-1 text-[10px] bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Response (Success / Error actions) ─────────────────────────

const ResponseSection: React.FC<SectionProps> = ({ config, onChange }) => {
  const [tab, setTab] = useState<'success' | 'error' | 'button'>('success')

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {(['success', 'error', 'button'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'success' ? '✅ Успех' : t === 'error' ? '❌ Ошибка' : '🔘 Кнопка'}
          </button>
        ))}
      </div>

      {/* Success */}
      {tab === 'success' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Действие при успехе</label>
            <select
              value={config.onSuccess?.action || 'none'}
              onChange={e => onChange({ onSuccess: { ...config.onSuccess, action: e.target.value as SuccessAction['action'] } })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              {SUCCESS_ACTION_OPTIONS.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            {SUCCESS_ACTION_OPTIONS.find(a => a.value === config.onSuccess?.action)?.description && (
              <p className="mt-1 text-[10px] text-gray-500">
                {SUCCESS_ACTION_OPTIONS.find(a => a.value === config.onSuccess?.action)?.description}
              </p>
            )}
          </div>
          {config.onSuccess?.action === 'showMessage' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Текст сообщения</label>
              <input
                type="text"
                value={config.onSuccess?.message || 'Отправлено!'}
                onChange={e => onChange({
                  onSuccess: { ...config.onSuccess, action: 'showMessage', message: e.target.value },
                })}
                placeholder="Спасибо! Мы свяжемся с вами."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          )}
          {config.onSuccess?.action === 'redirect' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">URL для редиректа</label>
              <input
                type="text"
                value={config.onSuccess?.redirectUrl || ''}
                onChange={e => onChange({
                  onSuccess: { ...config.onSuccess, action: 'redirect', redirectUrl: e.target.value },
                })}
                placeholder="/thank-you"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono"
              />
            </div>
          )}
          {config.onSuccess?.action === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">JavaScript callback</label>
              <textarea
                value={config.onSuccess?.callback || ''}
                onChange={e => onChange({
                  onSuccess: { ...config.onSuccess, action: 'custom', callback: e.target.value },
                })}
                placeholder="console.log('Success!', result)"
                rows={3}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg"
              />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {tab === 'error' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Действие при ошибке</label>
            <select
              value={config.onError?.action || 'showError'}
              onChange={e => onChange({ onError: { ...config.onError, action: e.target.value as ErrorAction['action'] } })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              {ERROR_ACTION_OPTIONS.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          {config.onError?.action === 'showError' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Текст ошибки</label>
              <input
                type="text"
                value={config.onError?.message || ''}
                onChange={e => onChange({
                  onError: { ...config.onError, action: 'showError', message: e.target.value },
                })}
                placeholder="Произошла ошибка. Попробуйте снова."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          )}
          {config.onError?.action === 'retry' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
              <p className="text-xs text-yellow-700">При ошибке запрос будет повторён автоматически</p>
              <div className="flex gap-3">
                <div>
                  <label className="block text-[10px] text-yellow-700 mb-0.5">Попыток</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={config.onError?.retryCount || 3}
                    onChange={e => onChange({
                      onError: { ...config.onError, action: 'retry', retryCount: Number(e.target.value) },
                    })}
                    className="w-16 px-2 py-1 text-xs border border-yellow-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-yellow-700 mb-0.5">Задержка (мс)</label>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={config.onError?.retryDelay || 1000}
                    onChange={e => onChange({
                      onError: { ...config.onError, action: 'retry', retryDelay: Number(e.target.value) },
                    })}
                    className="w-20 px-2 py-1 text-xs border border-yellow-300 rounded"
                  />
                </div>
              </div>
            </div>
          )}
          {config.onError?.action === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">JavaScript callback</label>
              <textarea
                value={config.onError?.callback || ''}
                onChange={e => onChange({
                  onError: { ...config.onError, action: 'custom', callback: e.target.value },
                })}
                placeholder="console.error('Error:', error)"
                rows={3}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg"
              />
            </div>
          )}
        </div>
      )}

      {/* Button states */}
      {tab === 'button' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Настройте текст кнопки в разных состояниях:</p>
          {[
            { key: 'loading' as const, label: 'При отправке', placeholder: 'Отправка...' },
            { key: 'success' as const, label: 'При успехе', placeholder: 'Отправлено!' },
            { key: 'error' as const, label: 'При ошибке', placeholder: 'Ошибка' },
          ].map(state => (
            <div key={state.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{state.label}</label>
              <input
                type="text"
                value={config.buttonStates?.[state.key] || ''}
                onChange={e =>
                  onChange({
                    buttonStates: {
                      ...config.buttonStates,
                      [state.key]: e.target.value,
                    } as ButtonStates,
                  })
                }
                placeholder={state.placeholder}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.buttonStates?.disableOnSubmit !== false}
              onChange={e =>
                onChange({
                  buttonStates: {
                    ...config.buttonStates,
                    disableOnSubmit: e.target.checked,
                  } as ButtonStates,
                })
              }
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            Блокировать кнопку при отправке
          </label>
        </div>
      )}
    </div>
  )
}

export default OutputBindingSubTab
