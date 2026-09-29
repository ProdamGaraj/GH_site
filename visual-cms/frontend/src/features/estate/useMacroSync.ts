import { useCallback, useEffect, useRef, useState } from 'react'
import { macroSyncApi, type StartOptions } from './macroSyncApi'
import {
  isStarting,
  pollInterval,
  shouldPoll,
  showsRunning,
  type MacroSyncState,
  type PendingStart,
} from './macroSync'

/**
 * Закончился ли прогон к этому опросу: сервер показывал его идущим, а теперь
 * нет, — или после нажатия в журнале появился новый прогон, который уже не
 * идёт (короткий прогон успевает завершиться между двумя опросами).
 */
export function runFinished(
  next: MacroSyncState,
  wasRunning: boolean,
  pending: PendingStart | null
): boolean {
  if (next.running) return false
  if (wasRunning) return true
  return !!pending && (next.runs?.[0]?.id ?? null) !== pending.previousRunId
}

/**
 * Состояние синхронизации с MacroCRM и её запуск — общие для панели в списке
 * ЖК и кнопки «Синхронизировать проект» в редакторе.
 *
 * Запуск не ждёт окончания (сервер отвечает 202), поэтому состояние
 * опрашивается, пока прогон идёт; `onFinished` вызывается один раз, когда
 * прогон закончился.
 */
export function useMacroSync(onFinished?: () => void) {
  const [state, setState] = useState<MacroSyncState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Нажали, но сервер прогон ещё не показывает — см. isStarting. В ref — чтобы
  // опрос видел свежее значение, не дожидаясь перерисовки.
  const [pending, setPendingState] = useState<PendingStart | null>(null)
  const pendingRef = useRef<PendingStart | null>(null)
  const setPending = (value: PendingStart | null) => {
    pendingRef.current = value
    setPendingState(value)
  }
  const wasRunning = useRef(false)

  const load = useCallback(async () => {
    try {
      const next = await macroSyncApi.status()
      setState(next)
      // Достучались — прежняя ошибка больше не актуальна. Иначе красная строка
      // висела бы поверх живых данных.
      setError(null)
      if (runFinished(next, wasRunning.current, pendingRef.current)) onFinished?.()
      wasRunning.current = next.running
      // Сервер подтвердил прогон — дальше состояние ведёт он, а не нажатие.
      if (!isStarting(pendingRef.current, next, Date.now())) setPending(null)
    } catch (e: any) {
      setError(e?.message || 'Не удалось получить состояние синхронизации')
    }
  }, [onFinished])

  useEffect(() => {
    load()
  }, [load])

  const starting = isStarting(pending, state, Date.now())
  const running = showsRunning(state, starting)

  // Опрашиваем, пока идёт прогон (нужны живые счётчики), пока состояние ни разу
  // не загрузилось (бэкенд мог перезапускаться) и пока ждём подтверждения
  // только что запущенного прогона.
  useEffect(() => {
    if (!shouldPoll(state, starting)) return
    const timer = setInterval(load, pollInterval(state, starting))
    return () => clearInterval(timer)
  }, [state, starting, load])

  const start = async (options: StartOptions): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await macroSyncApi.start(options)
      // Сервер ответил 202 и создаёт прогон в фоне. Показываем «идёт» сразу,
      // не дожидаясь, пока он появится в журнале.
      setPending({ at: Date.now(), previousRunId: state?.runs?.[0]?.id ?? null })
      await load()
    } catch (e: any) {
      setError(e?.message || 'Не удалось запустить синхронизацию')
    } finally {
      setBusy(false)
    }
  }

  return { state, busy, error, starting, running, start }
}
