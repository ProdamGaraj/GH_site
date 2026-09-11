import React, { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { macroSyncApi } from '../macroSyncApi'
import {
  canStart,
  whyDisabled,
  startLabel,
  formatDate,
  formatTime,
  formatDuration,
  summarize,
  shouldPoll,
  STATUS_CLASS,
  STATUS_LABEL,
  POLL_INTERVAL_MS,
  type MacroSyncState,
} from '../macroSync'

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
  const [state, setState] = useState<MacroSyncState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  // Чтобы заметить переход «шёл» → «закончился» и обновить список ЖК.
  const wasRunning = useRef(false)

  const load = useCallback(async () => {
    try {
      const next = await macroSyncApi.status()
      setState(next)
      if (wasRunning.current && !next.running) onFinished?.()
      wasRunning.current = next.running
    } catch (e: any) {
      setError(e?.message || 'Не удалось получить состояние синхронизации')
    }
  }, [onFinished])

  useEffect(() => {
    load()
  }, [load])

  // Пока прогон идёт — опрашиваем, чтобы счётчики шевелились. Когда не идёт,
  // состояние меняется только по кнопке, и опрашивать незачем.
  useEffect(() => {
    if (!shouldPoll(state)) return
    const timer = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [state, load])

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      await macroSyncApi.start({ resume: Boolean(state?.resumable) })
      await load()
    } catch (e: any) {
      setError(e?.message || 'Не удалось запустить синхронизацию')
    } finally {
      setBusy(false)
    }
  }

  const disabledReason = whyDisabled(state, busy)
  const enabled = canStart(state, busy)
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

        <button
          onClick={start}
          disabled={!enabled}
          title={disabledReason || undefined}
          className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
            ${enabled
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
        >
          <RefreshCw size={16} className={state?.running ? 'animate-spin' : undefined} />
          {startLabel(state)}
        </button>
      </div>

      {disabledReason && !state?.running && (
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
