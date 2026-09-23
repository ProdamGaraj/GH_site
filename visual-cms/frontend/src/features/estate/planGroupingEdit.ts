import type { PlanGroupingConfig } from './types'

/**
 * Правки черновика склейки планировок — чистые функции без React.
 *
 * Кнопки раздела «Планировки на сайте» меняют только настройку; группы по ней
 * считает сервер (тот же код, что и для сайта). Здесь живёт одно правило:
 * каждая планировка упоминается в настройке не больше одного раза — либо в
 * одной ручной группе, либо в `keepSeparate`. Иначе итог зависел бы от
 * порядка правил, и редактор перестал бы быть предсказуемым.
 */

export type PlanGroupingDraft = Required<PlanGroupingConfig>

/** Максимум допуска — тот же, что проверяет estate-service. */
export const MAX_AREA_TOLERANCE = 50

export function emptyDraft(): PlanGroupingDraft {
  return { areaTolerance: 0, groups: [], keepSeparate: [] }
}

/** Допуск в сотых м²: ввод «0.1» не должен превращаться в 0.1000000001. */
export function normalizeTolerance(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(MAX_AREA_TOLERANCE, Math.round(n * 100) / 100)
}

/** Черновик из сохранённой настройки: мусор отбрасывается, повторы убираются. */
export function toDraft(config: PlanGroupingConfig | null | undefined): PlanGroupingDraft {
  const draft = emptyDraft()
  draft.areaTolerance = normalizeTolerance(config?.areaTolerance)
  const used = new Set<string>()
  for (const group of config?.groups ?? []) {
    const plans = uniqueNames(group?.plans ?? []).filter((name) => !used.has(name))
    if (plans.length < 2) continue
    plans.forEach((name) => used.add(name))
    draft.groups.push({ plans })
  }
  draft.keepSeparate = uniqueNames(config?.keepSeparate ?? []).filter((name) => !used.has(name))
  return draft
}

/**
 * Что отправлять на сервер. Настройка по умолчанию сохраняется как null,
 * чтобы в базе не копились пустые объекты.
 */
export function toPayload(draft: PlanGroupingDraft): PlanGroupingConfig | null {
  const clean = toDraft(draft)
  if (clean.areaTolerance === 0 && clean.groups.length === 0 && clean.keepSeparate.length === 0) {
    return null
  }
  return clean
}

export function sameConfig(
  a: PlanGroupingConfig | null | undefined,
  b: PlanGroupingConfig | null | undefined
): boolean {
  return JSON.stringify(toDraft(a)) === JSON.stringify(toDraft(b))
}

export function setTolerance(draft: PlanGroupingDraft, value: unknown): PlanGroupingDraft {
  return { ...draft, areaTolerance: normalizeTolerance(value) }
}

/**
 * Объединить карточки в одну ручную группу.
 *
 * На вход — состав выбранных карточек (имена планировок). Всё, что было про
 * эти планировки в настройке раньше, снимается: ручные группы, из которых
 * они ушли, распадаются, если в них осталось меньше двух.
 */
export function mergeCards(draft: PlanGroupingDraft, cards: string[][]): PlanGroupingDraft {
  const names = uniqueNames(cards.flat())
  if (names.length < 2) return draft
  const cleared = forget(draft, names)
  return { ...cleared, groups: [...cleared.groups, { plans: names }] }
}

/**
 * Отделить планировку от её карточки.
 *
 * Она попадает в `keepSeparate`: просто убрать её из ручной группы мало —
 * автоматическая склейка по площади вернула бы её обратно.
 */
export function separatePlan(draft: PlanGroupingDraft, name: string): PlanGroupingDraft {
  const cleared = forget(draft, [name])
  return { ...cleared, keepSeparate: [...cleared.keepSeparate, name] }
}

/** Вернуть отделённую планировку в автоматическую склейку. */
export function restorePlan(draft: PlanGroupingDraft, name: string): PlanGroupingDraft {
  return forget(draft, [name])
}

/**
 * Распустить ручную карточку: её планировки возвращаются в автоматическую
 * склейку по площади (и могут снова сойтись, если допуск это позволяет).
 */
export function ungroupCard(draft: PlanGroupingDraft, names: string[]): PlanGroupingDraft {
  return forget(draft, names)
}

/** Убрать из настройки имена, которых больше нет на витрине. */
export function dropNames(draft: PlanGroupingDraft, names: string[]): PlanGroupingDraft {
  return forget(draft, names)
}

/** Стирает любые упоминания имён из ручных правил. Допуск не трогает. */
function forget(draft: PlanGroupingDraft, names: string[]): PlanGroupingDraft {
  const gone = new Set(names)
  return {
    areaTolerance: draft.areaTolerance,
    groups: draft.groups
      .map((group) => ({ plans: group.plans.filter((name) => !gone.has(name)) }))
      .filter((group) => group.plans.length >= 2),
    keepSeparate: draft.keepSeparate.filter((name) => !gone.has(name)),
  }
}

function uniqueNames(names: string[]): string[] {
  const out: string[] = []
  for (const raw of names) {
    const name = typeof raw === 'string' ? raw.trim() : ''
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

/** «39.79–40.03 м²» или «21.08 м²». */
export function formatAreaRange(min: number, max: number): string {
  const a = min.toFixed(2)
  const b = max.toFixed(2)
  return a === b ? `${a} м²` : `${a}–${b} м²`
}

/** «2–16» или «5»; пусто — прочерк. */
export function formatNumberRange(values: number[]): string {
  if (values.length === 0) return '—'
  const min = Math.min(...values)
  const max = Math.max(...values)
  return min === max ? String(min) : `${min}–${max}`
}

export function roomsLabel(rooms: number, isStudio: boolean): string {
  return isStudio ? 'Студия' : `${rooms}-комн.`
}
