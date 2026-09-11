/**
 * Состояние синхронизации с MacroCRM: типы и чистые функции для панели.
 *
 * Логика вынесена из компонента, потому что её надо проверять тестами, а
 * компоненты в этом проекте тестами не покрываются. В панели остаётся только
 * отрисовка того, что посчитано здесь.
 */

export type MacroSyncStatus = 'running' | 'ok' | 'partial' | 'failed'

export interface MacroSyncRun {
  id: string
  houseIds: number[]
  status: MacroSyncStatus
  trigger: string
  apartmentsSeen: number
  plansProbed: number
  planTypesUpserted: number
  imagesDownloaded: number
  apiCalls: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export interface MacroSyncState {
  /** Заданы ли токены. Без них кнопка не должна выглядеть рабочей. */
  configured: boolean
  /** Каких переменных окружения не хватает. */
  missing: string[]
  running: boolean
  /** id прогона, который можно продолжить, либо null. */
  resumable: string | null
  runs: MacroSyncRun[]
}

export const STATUS_LABEL: Record<MacroSyncStatus, string> = {
  running: 'идёт',
  ok: 'успешно',
  partial: 'частично',
  failed: 'ошибка',
}

/** Цвет плашки статуса. Ошибка и «частично» различаются намеренно. */
export const STATUS_CLASS: Record<MacroSyncStatus, string> = {
  running: 'bg-blue-100 text-blue-700',
  ok: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
}

/**
 * Можно ли запускать прогон.
 *
 * Два одновременных прогона поделили бы лимит MacroCRM в 100 запросов в минуту
 * пополам и оба упёрлись бы в 429, поэтому «идёт» блокирует кнопку.
 */
export function canStart(state: MacroSyncState | null, busy: boolean): boolean {
  if (!state || busy) return false
  return state.configured && !state.running
}

/** Почему кнопка недоступна. Пустая строка — доступна. */
export function whyDisabled(state: MacroSyncState | null, busy: boolean): string {
  if (busy) return 'Запускается…'
  if (!state) return 'Проверяем настройки…'
  if (!state.configured) {
    const names = state.missing.join(', ')
    return names
      ? `Не заданы переменные окружения: ${names}`
      : 'Синхронизация не настроена'
  }
  if (state.running) return 'Прогон уже идёт'
  return ''
}

/** Подпись кнопки: продолжение прерванного прогона называется своим именем. */
export function startLabel(state: MacroSyncState | null): string {
  if (state?.running) return 'Синхронизация идёт…'
  if (state?.resumable) return 'Продолжить синхронизацию'
  return 'Синхронизировать'
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** «14:05» — время начала прогона. */
export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** «11.09» — дата прогона, год не показываем: журнал короткий. */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`
}

/**
 * Длительность прогона: «4 мин 12 с».
 *
 * Незавершённый прогон длительности не имеет — показывать «0 с» у идущего
 * значило бы врать.
 */
export function formatDuration(run: MacroSyncRun): string {
  if (!run.finishedAt) return ''
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} с`
  return `${Math.floor(seconds / 60)} мин ${seconds % 60} с`
}

/**
 * Итог прогона одной строкой.
 *
 * Для упавшего показываем причину, а не счётчики: ноль квартир и ноль
 * планировок сами по себе ничего не объясняют.
 */
export function summarize(run: MacroSyncRun): string {
  if (run.status === 'failed') return run.error || 'прогон не удался'

  const parts = [
    `${run.apartmentsSeen} квартир`,
    `${run.planTypesUpserted} планировок`,
  ]
  if (run.plansProbed > 0) parts.push(`опрошено ${run.plansProbed}`)
  if (run.imagesDownloaded > 0) parts.push(`картинок ${run.imagesDownloaded}`)
  if (run.apiCalls > 0) parts.push(`запросов ${run.apiCalls}`)

  const summary = parts.join(', ')
  return run.status === 'partial' && run.error ? `${summary} — ${run.error}` : summary
}

/**
 * Насколько часто опрашивать журнал.
 *
 * Пока прогон идёт — каждые пять секунд, чтобы счётчики шевелились. Когда
 * не идёт, опрашивать незачем: состояние меняется только по кнопке.
 */
export const POLL_INTERVAL_MS = 5000

export function shouldPoll(state: MacroSyncState | null): boolean {
  return state?.running === true
}
