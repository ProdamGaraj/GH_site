import React, { useState } from 'react'
import { RefreshCw, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import {
  canStart,
  whyDisabled,
  startLabel,
  formatDate,
  formatTime,
  formatDuration,
  summarize,
  STATUS_CLASS,
  STATUS_LABEL,
} from '../macroSync'
import { useMacroSync } from '../useMacroSync'

/**
 * Панель синхронизации квартир и планировок с MacroCRM.
 *
 * Запуск не ждёт окончания: полный обход двух домов — 336 запросов под лимитом
 * 100 в минуту, около четырёх минут. Бэкенд отвечает сразу, а панель опрашивает
 * состояние, пока прогон идёт.
 *
 * Вся логика доступности кнопки и подписей — в ../macroSync, здесь только
 * отрисовка: компоненты в этом проекте тестами не покрываются.
 */
export const MacroSyncPanel: React.FC<{ onFinished?: () => void }> = ({ onFinished }) => {
  const [expanded, setExpanded] = useState(false)
  // Состояние, опрос и запуск — общие с кнопкой проекта (useMacroSync).
  const sync = useMacroSync(onFinished)
  const { state, busy, error, starting, running } = sync

  const start = async (full = false) => {
    if (full && !confirm(
      'Опросить планировки всех квартир заново? Это займёт несколько минут ' +
      'и нужно только если привязки потерялись.'
    )) return
    // Полная пересборка и продолжение прерванного прогона — разные вещи:
    // продолжать при full нечего, обход начинается сначала.
    await sync.start(full ? { full: true } : { resume: Boolean(state?.resumable) })
  }

  const disabledReason = whyDisabled(state, busy, starting)
  const enabled = canStart(state, busy, starting)
  const last = state?.runs?.[0]
  const rest = state?.runs?.slice(1) ?? []

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900">Синхронизация с MacroCRM</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Квартиры, планировки и картинки. После успешного прогона страницы проектов
            пересобираются сами.
          </p>

          {last && (
            <div className="mt-3 text-sm text-gray-700 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[last.status]}`}>
                {STATUS_LABEL[last.status]}
              </span>
              <span className="text-gray-500">
                {formatDate(last.startedAt)} {formatTime(last.startedAt)}
              </span>
              {formatDuration(last) && (
                <span className="text-gray-400">· {formatDuration(last)}</span>
              )}
              <span className="text-gray-600">· {summarize(last)}</span>
            </div>
          )}

          {!last && state && (
            <p className="mt-3 text-sm text-gray-400">Ещё ни разу не запускалась</p>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1">
          <button
            onClick={() => start(false)}
            disabled={!enabled}
            title={disabledReason || undefined}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
              ${enabled
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <RefreshCw size={16} className={running ? 'animate-spin' : undefined} />
            {startLabel(state, starting)}
          </button>
          <button
            onClick={() => start(true)}
            disabled={!enabled}
            title="Опросить планировки всех квартир заново"
            className={`text-xs ${enabled ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
          >
            Полная пересборка
          </button>
        </div>
      </div>

      {/* Когда статус не доехал, «Проверяем настройки…» рядом с красной
          ошибкой только путает: причина уже названа ниже. */}
      {disabledReason && !running && !(error && !state) && (
        <div className="px-4 pb-3 -mt-1 text-sm text-amber-700 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{disabledReason}</span>
        </div>
      )}

      {error && (
        <div className="px-4 pb-3 text-sm text-red-600 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {rest.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-4 py-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Предыдущие прогоны ({rest.length})
          </button>

          {expanded && (
            <div className="px-4 pb-3 space-y-1">
              {rest.map((item) => (
                <div key={item.id} className="text-sm flex flex-wrap items-center gap-x-2 text-gray-600">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_CLASS[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                  <span className="text-gray-400">
                    {formatDate(item.startedAt)} {formatTime(item.startedAt)}
                  </span>
                  <span className="truncate">{summarize(item)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
