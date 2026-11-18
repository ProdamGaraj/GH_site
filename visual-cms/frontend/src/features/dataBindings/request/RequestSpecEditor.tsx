/**
 * Вкладка «Запрос» привязки: метод, путь, query, заголовки, тело — шаблоны
 * со ссылками {{form.x}}; превью «что уйдёт» и тест-отправка тем же кодом,
 * что на сайте (сервер, POST /api/data/requests/preview|test).
 */
import React, { useState } from 'react'
import { Eye, Loader2, Plus, Send, Trash2 } from 'lucide-react'
import { requestApi } from '@/shared/api/requestApi'
import { cn } from '@/shared/utils'
import {
  HTTP_METHODS,
  type HttpMethod,
  type KeyValueTemplate,
  type RequestEditorPayload,
  type RequestPreviewResult,
  type RequestSpec,
  type RequestTestResult,
  type RestBody,
} from '@/shared/types/requestSpec'
import { bodyToText, pairValueText, parseBodyText, refGroups, restOf, sampleFormData, withRest } from './requestModel'
import { RefPalette, TemplateFocusProvider, TemplateInput } from './TemplateFields'

/** Типы источников, для которых есть коннектор на сервере (этап 1 — REST). */
export const SUBMITTABLE_SOURCE_TYPES = ['rest-api', 'rest']

interface RequestSpecEditorProps {
  value: RequestSpec
  onChange: (spec: RequestSpec) => void
  dataSourceId: string
  sourceType: string
  baseUrl?: string
  formFieldNames: string[]
  /** Для тестов: вызовы сервера. */
  api?: Pick<typeof requestApi, 'preview' | 'test'>
}

const label = 'block text-[11px] font-medium text-gray-600 mb-1'
const smallButton = 'inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50'

const PairsEditor: React.FC<{
  title: string
  items: KeyValueTemplate[]
  onChange: (items: KeyValueTemplate[]) => void
  keyPlaceholder: string
  addLabel: string
}> = ({ title, items, onChange, keyPlaceholder, addLabel }) => (
  <div>
    <span className={label}>{title}</span>
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1 items-center">
          <input
            value={item.key}
            placeholder={keyPlaceholder}
            aria-label={`${title}: имя ${i + 1}`}
            onChange={(e) => onChange(items.map((it, j) => (j === i ? { ...it, key: e.target.value } : it)))}
            className="w-1/3 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-md"
          />
          <TemplateInput
            value={pairValueText(item)}
            placeholder="{{form.поле}}"
            aria-label={`${title}: значение ${i + 1}`}
            onChange={(v) => onChange(items.map((it, j) => (j === i ? { ...it, value: v } : it)))}
          />
          <button type="button" aria-label="Удалить" onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
    <button type="button" className={cn(smallButton, 'mt-1')} onClick={() => onChange([...items, { key: '', value: '' }])}>
      <Plus size={12} /> {addLabel}
    </button>
  </div>
)

const RequestView: React.FC<{ result: RequestPreviewResult }> = ({ result }) => {
  if (result.issues.length) {
    return (
      <ul className="p-2 bg-red-50 border border-red-200 rounded-md text-[11px] text-red-700 list-disc pl-5" data-request-issues>
        {result.issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    )
  }
  const r = result.request
  if (!r) return null
  return (
    <div className="p-2 bg-gray-900 rounded-md text-[11px] font-mono text-gray-100 space-y-1 overflow-x-auto" data-request-view>
      <div>
        <span className="text-orange-300">{r.method}</span> {r.url}
      </div>
      {Object.entries(r.headers).map(([k, v]) => (
        <div key={k} className="text-gray-400">
          {k}: {v}
        </div>
      ))}
      {r.body && (
        <pre className="whitespace-pre-wrap text-gray-100">
          {r.body.format === 'json' ? JSON.stringify(r.body.value, null, 2) : r.body.text}
        </pre>
      )}
    </div>
  )
}

export const RequestSpecEditor: React.FC<RequestSpecEditorProps> = ({
  value,
  onChange,
  dataSourceId,
  sourceType,
  baseUrl,
  formFieldNames,
  api = requestApi,
}) => {
  const rest = restOf(value)
  const body: RestBody = rest.body ?? { format: 'none' }
  const [bodyText, setBodyText] = useState(() => bodyToText(body))
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [sample, setSample] = useState<Record<string, string>>(() => sampleFormData(formFieldNames))
  const [busy, setBusy] = useState<'preview' | 'test' | null>(null)
  const [preview, setPreview] = useState<RequestPreviewResult | null>(null)
  const [test, setTest] = useState<RequestTestResult | null>(null)
  const [callError, setCallError] = useState<string | null>(null)

  if (!SUBMITTABLE_SOURCE_TYPES.includes(sourceType)) {
    return (
      <p className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800" data-unsupported-source>
        Отправка для источника типа «{sourceType}» пока не поддерживается. Сейчас — REST API; GraphQL, SQL и другие появятся позже.
      </p>
    )
  }

  const setBody = (next: RestBody) => onChange(withRest(value, { body: next }))

  const onBodyText = (text: string) => {
    setBodyText(text)
    const parsed = parseBodyText(text)
    if ('error' in parsed) setBodyError(parsed.error)
    else {
      setBodyError(null)
      setBody({ format: 'json', value: parsed.value })
    }
  }

  const switchFormat = (format: RestBody['format']) => {
    if (format === 'json') {
      setBodyText('"{{form}}"')
      setBodyError(null)
      setBody({ format: 'json', value: '{{form}}' })
    } else if (format === 'form-urlencoded') setBody({ format: 'form-urlencoded', fields: formFieldNames.map((n) => ({ key: n, value: `{{form.${n}}}` })) })
    else setBody({ format: 'none' })
  }

  const payload = (): RequestEditorPayload => ({ dataSourceId, request: value, data: sample })

  const run = async (kind: 'preview' | 'test') => {
    setBusy(kind)
    setCallError(null)
    try {
      if (kind === 'preview') {
        setPreview(await api.preview(payload()))
        setTest(null)
      } else {
        setTest(await api.test(payload()))
        setPreview(null)
      }
    } catch (error) {
      setCallError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <TemplateFocusProvider>
      <div className="space-y-3">
        <div>
          <span className={label}>Метод и путь</span>
          <div className="flex gap-1">
            <select
              value={rest.method}
              aria-label="Метод"
              onChange={(e) => onChange(withRest(value, { method: e.target.value as HttpMethod }))}
              className="px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-md bg-white"
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <TemplateInput value={rest.path} placeholder="/clients/{{form.id}}" aria-label="Путь" onChange={(path) => onChange(withRest(value, { path }))} />
          </div>
          {baseUrl && <p className="mt-0.5 text-[10px] text-gray-400 font-mono truncate">к адресу источника: {baseUrl}</p>}
        </div>

        <PairsEditor title="Query-параметры" items={rest.query ?? []} onChange={(query) => onChange(withRest(value, { query }))} keyPlaceholder="имя" addLabel="параметр" />

        <PairsEditor
          title="Заголовки"
          items={(rest.headers ?? []).map((h) => ({ key: h.key, value: h.value }))}
          onChange={(items) => onChange(withRest(value, { headers: items.map((i) => ({ key: i.key, value: pairValueText(i) })) }))}
          keyPlaceholder="X-Header"
          addLabel="заголовок"
        />

        {rest.method !== 'GET' && (
          <div>
            <span className={label}>Тело</span>
            <div className="flex gap-1 mb-1" role="radiogroup" aria-label="Формат тела">
              {(
                [
                  ['json', 'JSON'],
                  ['form-urlencoded', 'Форма'],
                  ['none', 'Нет'],
                ] as const
              ).map(([format, title]) => (
                <button
                  key={format}
                  type="button"
                  role="radio"
                  aria-checked={body.format === format}
                  onClick={() => body.format !== format && switchFormat(format)}
                  className={cn(smallButton, body.format === format && 'border-orange-400 bg-orange-50 text-orange-700')}
                >
                  {title}
                </button>
              ))}
            </div>
            {body.format === 'json' && (
              <>
                <TemplateInput multiline rows={8} value={bodyText} aria-label="Тело JSON" onChange={onBodyText} placeholder={'{\n  "phones": ["{{form.phone | digits}}"]\n}'} />
                {bodyError ? (
                  <p className="text-[10px] text-red-600" data-body-error>
                    {bodyError}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400">Строка целиком из ссылки сохраняет тип значения: числа, списки, объекты.</p>
                )}
              </>
            )}
            {body.format === 'form-urlencoded' && (
              <PairsEditor title="Поля" items={body.fields} onChange={(fields) => setBody({ format: 'form-urlencoded', fields })} keyPlaceholder="имя" addLabel="поле" />
            )}
          </div>
        )}

        <RefPalette groups={refGroups(formFieldNames)} />

        <div className="pt-2 border-t border-gray-100 space-y-2">
          {formFieldNames.length > 0 && (
            <div>
              <span className={label}>Примерные значения для проверки</span>
              <div className="grid grid-cols-2 gap-1">
                {formFieldNames.map((name) => (
                  <input
                    key={name}
                    value={sample[name] ?? ''}
                    aria-label={`Пример: ${name}`}
                    placeholder={name}
                    onChange={(e) => setSample({ ...sample, [name]: e.target.value })}
                    className="px-2 py-1 text-[11px] border border-gray-200 rounded-md"
                  />
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={!!busy || !!bodyError} onClick={() => run('preview')} className={smallButton}>
              {busy === 'preview' ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Показать запрос
            </button>
            <button type="button" disabled={!!busy || !!bodyError} onClick={() => run('test')} className={smallButton}>
              {busy === 'test' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Отправить тест
            </button>
          </div>
          {callError && <p className="text-[11px] text-red-600">{callError}</p>}
          {preview && <RequestView result={preview} />}
          {test && (
            <div className="space-y-1" data-test-result>
              <RequestView result={test} />
              {test.result && (
                <div className={cn('p-2 rounded-md text-[11px] border', test.result.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                  <p className="font-medium">
                    {test.result.ok ? 'Сервис ответил' : 'Ошибка'}: {test.result.status ?? '—'} · {test.result.durationMs} мс
                    {test.result.error && ` · ${test.result.error.code}: ${test.result.error.message}`}
                  </p>
                  {test.result.data !== undefined && (
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-gray-700">
                      {typeof test.result.data === 'string' ? test.result.data : JSON.stringify(test.result.data, null, 2)}
                    </pre>
                  )}
                  {test.pageData !== undefined && (
                    <p className="mt-1 text-gray-600">
                      Странице: <span className="font-mono">{JSON.stringify(test.pageData)}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </TemplateFocusProvider>
  )
}
