import React, { useState, useCallback } from 'react'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import {
  Plus,
  Trash2,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  Power,
  TestTube,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  createDestination,
  updateDestination,
  deleteDestination,
} from '@/features/forms/formsSlice'
import { formApi } from '@/shared/api/formApi'
import type {
  FormField,
  FormDestination,
  DestinationType,
  CreateDestinationRequest,
  UpdateDestinationRequest,
  FieldMappingRule,
  DestinationTestResult,
} from '@/shared/types/form'
import { DESTINATION_TYPE_LABELS, DESTINATION_TYPE_ICONS } from '@/shared/types/form'

interface DestinationsPanelProps {
  formId: string
  fields: FormField[]
}

export const DestinationsPanel: React.FC<DestinationsPanelProps> = ({ formId, fields }) => {
  const dispatch = useAppDispatch()
  const destinations = useAppSelector((state) => state.forms.currentForm?.destinations || [])

  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, DestinationTestResult>>({})
  const [testing, setTesting] = useState<string | null>(null)

  const handleCreate = useCallback(
    async (data: CreateDestinationRequest) => {
      await dispatch(createDestination({ formId, data }))
      setShowNew(false)
    },
    [dispatch, formId]
  )

  const handleUpdate = useCallback(
    async (destId: string, data: UpdateDestinationRequest) => {
      await dispatch(updateDestination({ formId, destId, data }))
      setEditingId(null)
    },
    [dispatch, formId]
  )

  const handleDelete = useCallback(
    async (destId: string, name: string) => {
      if (window.confirm(`Удалить получателя "${name}"?`)) {
        await dispatch(deleteDestination({ formId, destId }))
      }
    },
    [dispatch, formId]
  )

  const handleTest = useCallback(
    async (destId: string) => {
      setTesting(destId)
      try {
        const result = await formApi.testDestination(formId, destId)
        setTestResults((prev) => ({ ...prev, [destId]: result }))
      } catch (err: any) {
        setTestResults((prev) => ({
          ...prev,
          [destId]: { destinationId: destId, destinationName: '', success: false, error: err.message, durationMs: 0 },
        }))
      } finally {
        setTesting(null)
      }
    },
    [formId]
  )

  const handleToggleActive = useCallback(
    async (dest: FormDestination) => {
      await dispatch(updateDestination({
        formId,
        destId: dest.id,
        data: { isActive: !dest.isActive },
      }))
    },
    [dispatch, formId]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-800">
          Получатели данных ({destinations.length})
        </h3>
        <Button variant="primary" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Добавить получателя
        </Button>
      </div>

      {/* New destination form */}
      {showNew && (
        <DestinationEditor
          fields={fields}
          onSave={handleCreate}
          onCancel={() => setShowNew(false)}
        />
      )}

      {/* Destinations list */}
      {destinations.length === 0 && !showNew && (
        <div className="text-center py-12 text-gray-400">
          <Send className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Нет настроенных получателей</p>
          <p className="text-sm mt-1">Добавьте получателей, чтобы данные формы отправлялись в нужные сервисы</p>
        </div>
      )}

      {destinations.map((dest) => (
        <div key={dest.id} className="border border-gray-200 rounded-lg bg-white">
          {editingId === dest.id ? (
            <DestinationEditor
              fields={fields}
              initial={dest}
              onSave={(data) => handleUpdate(dest.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div className="p-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">{DESTINATION_TYPE_ICONS[dest.type]}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{dest.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-500">
                      {DESTINATION_TYPE_LABELS[dest.type]}
                    </span>
                    {!dest.isActive && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                        Отключён
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-500" /> {dest.successCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-red-400" /> {dest.failureCount}
                    </span>
                    {dest.lastError && (
                      <span className="flex items-center gap-1 text-red-400" title={dest.lastError}>
                        <AlertCircle className="w-3 h-3" /> Ошибка
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTest(dest.id)}
                    disabled={testing === dest.id}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                    title="Тест"
                  >
                    <TestTube className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(dest)}
                    className={`p-2 rounded-lg ${dest.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                    title={dest.isActive ? 'Отключить' : 'Включить'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(dest.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dest.id, dest.name)}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Test result */}
              {testResults[dest.id] && (
                <div className={`mt-3 p-2 rounded text-xs ${
                  testResults[dest.id].success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {testResults[dest.id].success
                    ? `✓ Тест успешен (${testResults[dest.id].durationMs}мс)`
                    : `✗ Ошибка: ${testResults[dest.id].error}`}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Destination Editor ──────────────────────────────────────────

interface DestinationEditorProps {
  fields: FormField[]
  initial?: FormDestination
  onSave: (data: CreateDestinationRequest) => void
  onCancel: () => void
}

const DestinationEditor: React.FC<DestinationEditorProps> = ({
  fields, initial, onSave, onCancel,
}) => {
  const [name, setName] = useState(initial?.name || '')
  const [type, setType] = useState<DestinationType>(initial?.type || 'webhook')
  const [config, setConfig] = useState<Record<string, any>>(
    (initial?.config as Record<string, any>) || {}
  )
  const [fieldMapping, setFieldMapping] = useState<FieldMappingRule[]>(initial?.fieldMapping || [])
  const [showMapping, setShowMapping] = useState(false)

  const handleSave = () => {
    onSave({
      name,
      type,
      config: config as any,
      fieldMapping,
      isActive: initial?.isActive ?? true,
      priority: initial?.priority ?? 0,
    })
  }

  const destTypes: DestinationType[] = [
    'webhook', 'telegram', 'email', 'rest-api', 'slack', 'google-sheets',
  ]

  return (
    <div className="p-4 border border-blue-200 rounded-lg bg-blue-50/30">
      <h4 className="font-medium text-gray-800 mb-4">
        {initial ? 'Редактирование получателя' : 'Новый получатель'}
      </h4>

      <div className="space-y-4">
        {/* Name & Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Название</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Мой Telegram-бот" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Тип</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={type}
              onChange={(e) => { setType(e.target.value as DestinationType); setConfig({}) }}
            >
              {destTypes.map((t) => (
                <option key={t} value={t}>
                  {DESTINATION_TYPE_ICONS[t]} {DESTINATION_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Type-specific config */}
        {type === 'webhook' && (
          <WebhookConfig config={config} onChange={setConfig} />
        )}
        {type === 'telegram' && (
          <TelegramConfig config={config} onChange={setConfig} fields={fields} />
        )}
        {type === 'email' && (
          <EmailConfig config={config} onChange={setConfig} fields={fields} />
        )}
        {type === 'rest-api' && (
          <RestApiConfig config={config} onChange={setConfig} />
        )}
        {type === 'slack' && (
          <SlackConfig config={config} onChange={setConfig} fields={fields} />
        )}

        {/* Field Mapping */}
        <div>
          <button
            onClick={() => setShowMapping(!showMapping)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
          >
            {showMapping ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Маппинг полей ({fieldMapping.length})
          </button>

          {showMapping && (
            <div className="mt-3 space-y-2">
              {fieldMapping.map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className="border rounded px-2 py-1 text-sm flex-1"
                    value={rule.sourceField}
                    onChange={(e) => {
                      const m = [...fieldMapping]
                      m[i] = { ...m[i], sourceField: e.target.value }
                      setFieldMapping(m)
                    }}
                  >
                    <option value="">— поле формы —</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.name}>{f.label} ({f.name})</option>
                    ))}
                  </select>
                  <span className="text-gray-400">→</span>
                  <Input
                    className="flex-1"
                    placeholder="Целевое имя"
                    value={rule.targetField}
                    onChange={(e) => {
                      const m = [...fieldMapping]
                      m[i] = { ...m[i], targetField: e.target.value }
                      setFieldMapping(m)
                    }}
                  />
                  <button
                    onClick={() => setFieldMapping(fieldMapping.filter((_, j) => j !== i))}
                    className="p-1 hover:bg-red-100 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setFieldMapping([...fieldMapping, { sourceField: '', targetField: '' }])}
                className="text-xs text-blue-600 hover:underline"
              >
                + Добавить маппинг
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>
            {initial ? 'Сохранить' : 'Добавить'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>Отмена</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Type-specific configs ───────────────────────────────────────

interface ConfigProps {
  config: Record<string, any>
  onChange: (config: Record<string, any>) => void
  fields?: FormField[]
}

const WebhookConfig: React.FC<ConfigProps> = ({ config, onChange }) => (
  <div className="space-y-3">
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
      <Input value={config.url || ''} onChange={(e) => onChange({ ...config, url: e.target.value })}
        placeholder="https://example.com/webhook" />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Метод</label>
        <select className="w-full border rounded-lg px-3 py-2 text-sm"
          value={config.method || 'POST'}
          onChange={(e) => onChange({ ...config, method: e.target.value })}>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Авторизация</label>
        <select className="w-full border rounded-lg px-3 py-2 text-sm"
          value={config.authType || 'none'}
          onChange={(e) => onChange({ ...config, authType: e.target.value })}>
          <option value="none">Без авторизации</option>
          <option value="bearer">Bearer Token</option>
          <option value="api-key">API Key</option>
          <option value="basic">Basic Auth</option>
        </select>
      </div>
    </div>
    {config.authType && config.authType !== 'none' && (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Токен / Ключ</label>
        <Input type="password" value={config.authToken || ''}
          onChange={(e) => onChange({ ...config, authToken: e.target.value })} />
      </div>
    )}
  </div>
)

const TelegramConfig: React.FC<ConfigProps> = ({ config, onChange, fields }) => (
  <div className="space-y-3">
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Bot Token</label>
      <Input type="password" value={config.botToken || ''}
        onChange={(e) => onChange({ ...config, botToken: e.target.value })}
        placeholder="123456:ABC-DEF..." />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Chat ID</label>
      <Input value={config.chatId || ''}
        onChange={(e) => onChange({ ...config, chatId: e.target.value })}
        placeholder="-1001234567890" />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        Шаблон сообщения
        <span className="text-gray-400 font-normal ml-1">
          (используйте {'{{имя_поля}}'} для подстановки)
        </span>
      </label>
      <textarea
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        rows={4}
        value={config.messageTemplate || ''}
        onChange={(e) => onChange({ ...config, messageTemplate: e.target.value })}
        placeholder={`🔔 Новая заявка!\n\nИмя: {{name}}\nТелефон: {{phone}}\nСообщение: {{message}}`}
      />
      {fields && fields.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {fields.map((f) => (
            <button key={f.id}
              className="text-xs px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200"
              onClick={() => onChange({
                ...config,
                messageTemplate: (config.messageTemplate || '') + `{{${f.name}}}`,
              })}
            >
              {`{{${f.name}}}`}
            </button>
          ))}
        </div>
      )}
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Parse Mode</label>
      <select className="w-full border rounded-lg px-3 py-2 text-sm"
        value={config.parseMode || ''}
        onChange={(e) => onChange({ ...config, parseMode: e.target.value })}>
        <option value="">Обычный текст</option>
        <option value="HTML">HTML</option>
        <option value="MarkdownV2">Markdown V2</option>
      </select>
    </div>
  </div>
)

const EmailConfig: React.FC<ConfigProps> = ({ config, onChange, fields }) => (
  <div className="space-y-3">
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Кому (email через запятую)</label>
      <Input value={(config.to || []).join(', ')}
        onChange={(e) => onChange({ ...config, to: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
        placeholder="admin@example.com, manager@example.com" />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Тема письма</label>
      <Input value={config.subject || ''}
        onChange={(e) => onChange({ ...config, subject: e.target.value })}
        placeholder="Новая заявка с сайта: {{name}}" />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Шаблон тела письма</label>
      <textarea
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        rows={6}
        value={config.bodyTemplate || ''}
        onChange={(e) => onChange({ ...config, bodyTemplate: e.target.value })}
        placeholder={`Новая заявка:\n\nИмя: {{name}}\nEmail: {{email}}\nСообщение: {{message}}`}
      />
      {fields && fields.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {fields.map((f) => (
            <button key={f.id}
              className="text-xs px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200"
              onClick={() => onChange({
                ...config,
                bodyTemplate: (config.bodyTemplate || '') + `{{${f.name}}}`,
              })}
            >
              {`{{${f.name}}}`}
            </button>
          ))}
        </div>
      )}
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Формат</label>
        <select className="w-full border rounded-lg px-3 py-2 text-sm"
          value={config.format || 'text'}
          onChange={(e) => onChange({ ...config, format: e.target.value })}>
          <option value="text">Текст</option>
          <option value="html">HTML</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">От кого (email)</label>
        <Input value={config.fromEmail || ''}
          onChange={(e) => onChange({ ...config, fromEmail: e.target.value })}
          placeholder="noreply@example.com" />
      </div>
    </div>
  </div>
)

const RestApiConfig: React.FC<ConfigProps> = ({ config, onChange }) => (
  <div className="space-y-3">
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
      <Input value={config.url || ''} onChange={(e) => onChange({ ...config, url: e.target.value })}
        placeholder="https://api.crm.com/leads" />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Метод</label>
        <select className="w-full border rounded-lg px-3 py-2 text-sm"
          value={config.method || 'POST'}
          onChange={(e) => onChange({ ...config, method: e.target.value })}>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Авторизация</label>
        <select className="w-full border rounded-lg px-3 py-2 text-sm"
          value={config.authType || 'none'}
          onChange={(e) => onChange({ ...config, authType: e.target.value })}>
          <option value="none">Без авторизации</option>
          <option value="bearer">Bearer Token</option>
          <option value="api-key">API Key</option>
          <option value="basic">Basic Auth</option>
        </select>
      </div>
    </div>
    {config.authType && config.authType !== 'none' && (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Токен / Ключ авторизации</label>
        <Input type="password" value={config.authConfig?.token || config.authConfig?.key || ''}
          onChange={(e) => onChange({
            ...config,
            authConfig: { ...config.authConfig, token: e.target.value, key: e.target.value }
          })} />
      </div>
    )}
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Таймаут (мс)</label>
      <Input type="number" value={config.timeout || 30000}
        onChange={(e) => onChange({ ...config, timeout: Number(e.target.value) })} />
    </div>
  </div>
)

const SlackConfig: React.FC<ConfigProps> = ({ config, onChange, fields }) => (
  <div className="space-y-3">
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Webhook URL</label>
      <Input value={config.webhookUrl || ''}
        onChange={(e) => onChange({ ...config, webhookUrl: e.target.value })}
        placeholder="https://hooks.slack.com/services/..." />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Шаблон сообщения</label>
      <textarea
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        rows={4}
        value={config.messageTemplate || ''}
        onChange={(e) => onChange({ ...config, messageTemplate: e.target.value })}
        placeholder={`:bell: Новая заявка!\n*Имя:* {{name}}\n*Телефон:* {{phone}}`}
      />
      {fields && fields.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {fields.map((f) => (
            <button key={f.id}
              className="text-xs px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200"
              onClick={() => onChange({
                ...config,
                messageTemplate: (config.messageTemplate || '') + `{{${f.name}}}`,
              })}
            >
              {`{{${f.name}}}`}
            </button>
          ))}
        </div>
      )}
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Канал</label>
        <Input value={config.channel || ''}
          onChange={(e) => onChange({ ...config, channel: e.target.value })}
          placeholder="#general" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Имя бота</label>
        <Input value={config.username || ''}
          onChange={(e) => onChange({ ...config, username: e.target.value })}
          placeholder="Feedback Bot" />
      </div>
    </div>
  </div>
)
