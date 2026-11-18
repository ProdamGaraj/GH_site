/**
 * Вкладка «Ответ»: что из ответа сервиса получит страница. По умолчанию —
 * только статус; поля — явным списком, в переменную страницы (её читают
 * привязки «Получение» с источником page-variable и событие vcms:response).
 */
import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/shared/utils'
import type { RequestSpec, ResponseField } from '@/shared/types/requestSpec'
import { withResponse } from './requestModel'

const label = 'block text-[11px] font-medium text-gray-600 mb-1'
const input = 'px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-md'
const smallButton = 'inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50'

export const ResponseSpecEditor: React.FC<{ value: RequestSpec; onChange: (spec: RequestSpec) => void }> = ({ value, onChange }) => {
  const response = value.response ?? { expose: 'status' as const }
  const fields = response.fields ?? []
  const setFields = (next: ResponseField[]) => onChange(withResponse(value, { fields: next }))

  return (
    <div className="space-y-3">
      <div className="flex gap-1" role="radiogroup" aria-label="Что получит страница">
        {(
          [
            ['status', 'Только статус'],
            ['fields', 'Статус и поля ответа'],
          ] as const
        ).map(([expose, title]) => (
          <button
            key={expose}
            type="button"
            role="radio"
            aria-checked={response.expose === expose}
            onClick={() => onChange(withResponse(value, { expose }))}
            className={cn(smallButton, response.expose === expose && 'border-orange-400 bg-orange-50 text-orange-700')}
          >
            {title}
          </button>
        ))}
      </div>

      {response.expose === 'status' ? (
        <p className="text-xs text-gray-500">Посетитель узнает только, отправлено или нет. Ответ сервиса остаётся на сервере (в журнале).</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={label}>Путь к данным в ответе</span>
              <input
                value={response.dataPath ?? ''}
                placeholder="data.items"
                aria-label="Путь к данным"
                onChange={(e) => onChange(withResponse(value, { dataPath: e.target.value || undefined }))}
                className={cn(input, 'w-full')}
              />
            </label>
            <label className="block">
              <span className={label}>Переменная страницы</span>
              <input
                value={response.variable ?? ''}
                placeholder="result"
                aria-label="Переменная страницы"
                onChange={(e) => onChange(withResponse(value, { variable: e.target.value || undefined }))}
                className={cn(input, 'w-full')}
              />
            </label>
          </div>

          <div>
            <span className={label}>Поля, которые получит страница (остальное не уходит в браузер)</span>
            <div className="space-y-1">
              {fields.map((field, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <input
                    value={field.from}
                    placeholder="price.total"
                    aria-label={`Поле ответа ${i + 1}`}
                    onChange={(e) => setFields(fields.map((f, j) => (j === i ? { ...f, from: e.target.value } : f)))}
                    className={cn(input, 'w-1/2')}
                  />
                  <span className="text-gray-400 text-xs">→</span>
                  <input
                    value={field.to}
                    placeholder="price"
                    aria-label={`Имя на странице ${i + 1}`}
                    onChange={(e) => setFields(fields.map((f, j) => (j === i ? { ...f, to: e.target.value } : f)))}
                    className={cn(input, 'w-1/2')}
                  />
                  <button type="button" aria-label="Удалить поле" onClick={() => setFields(fields.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className={cn(smallButton, 'mt-1')} onClick={() => setFields([...fields, { from: '', to: '' }])}>
              <Plus size={12} /> поле
            </button>
          </div>

          <label className="block w-1/2">
            <span className={label}>Если по пути список — не больше элементов</span>
            <input
              type="number"
              min={1}
              max={500}
              value={response.maxItems ?? ''}
              placeholder="50"
              aria-label="Максимум элементов"
              onChange={(e) => {
                const n = Number(e.target.value)
                onChange(withResponse(value, { maxItems: e.target.value && Number.isInteger(n) && n > 0 ? n : undefined }))
              }}
              className={cn(input, 'w-full')}
            />
          </label>
        </>
      )}
    </div>
  )
}
