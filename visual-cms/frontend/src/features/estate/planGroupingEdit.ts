import type { PlanGroupBadges, PlanGroupOverride, PlanGroupingConfig } from './types'

/**
 * Правки черновика склейки планировок — чистые функции без React.
 *
 * Кнопки раздела «Планировки на сайте» меняют только настройку; группы по ней
 * считает сервер (тот же код, что и для сайта). Здесь живёт одно правило:
 * каждая планировка упоминается в настройке не больше одного раза — либо в
 * одной ручной группе, либо в `keepSeparate`. Иначе итог зависел бы от
 * порядка правил, и редактор перестал бы быть предсказуемым.
 *
 * Скрытие и ручные данные групп (`hidden`, `overrides`) живут по именам
 * планировок отдельно от склейки: объединение и отделение карточек их не
 * трогают — правка идёт за своей «якорной» планировкой.
 */

export type PlanGroupingDraft = Required<PlanGroupingConfig>

/** Максимум допуска — тот же, что проверяет estate-service. */
export const MAX_AREA_TOLERANCE = 50

export function emptyDraft(): PlanGroupingDraft {
  return { areaTolerance: 0, groups: [], keepSeparate: [], hidden: [], overrides: {} }
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
  draft.hidden = uniqueNames(config?.hidden ?? []).sort()
  // Ключи по алфавиту: сравнение черновиков идёт через JSON.
  for (const name of Object.keys(config?.overrides ?? {}).sort()) {
    const clean = cleanOverride(config!.overrides![name])
    if (name.trim() && clean) draft.overrides[name] = clean
  }
  return draft
}

const OVERRIDE_NUMBERS = ['priceMin', 'priceMax', 'areaMin', 'areaMax'] as const
const OVERRIDE_LISTS = ['floors', 'entrances'] as const
export const BADGE_LOCALES = ['ru', 'uz', 'en'] as const
export type BadgeLocale = (typeof BADGE_LOCALES)[number]

/** Правка в строгой форме; пустая — null (её в настройке быть не должно). */
function cleanOverride(raw: PlanGroupOverride | undefined): PlanGroupOverride | null {
  if (!raw || typeof raw !== 'object') return null
  const out: PlanGroupOverride = {}
  for (const key of OVERRIDE_NUMBERS) {
    const v = raw[key]
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v
  }
  for (const key of OVERRIDE_LISTS) {
    const v = raw[key]
    if (Array.isArray(v)) out[key] = [...new Set(v.filter((n) => Number.isInteger(n)))].sort((a, b) => a - b)
  }
  const badges: PlanGroupBadges = {}
  for (const locale of BADGE_LOCALES) {
    const list = uniqueNames(raw.badges?.[locale] ?? [])
    if (list.length) badges[locale] = list
  }
  if (Object.keys(badges).length) out.badges = badges
  return Object.keys(out).length ? out : null
}

/**
 * Что отправлять на сервер. Настройка по умолчанию сохраняется как null,
 * чтобы в базе не копились пустые объекты.
 */
export function toPayload(draft: PlanGroupingDraft): PlanGroupingConfig | null {
  const clean = toDraft(draft)
  if (
    clean.areaTolerance === 0 &&
    clean.groups.length === 0 &&
    clean.keepSeparate.length === 0 &&
    clean.hidden.length === 0 &&
    Object.keys(clean.overrides).length === 0
  ) {
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

/**
 * Убрать из настройки имена, которых больше нет на витрине: из склейки, из
 * скрытых и их ручные данные.
 */
export function dropNames(draft: PlanGroupingDraft, names: string[]): PlanGroupingDraft {
  const gone = new Set(names)
  const cleared = forget(draft, names)
  return {
    ...cleared,
    hidden: cleared.hidden.filter((name) => !gone.has(name)),
    overrides: Object.fromEntries(Object.entries(cleared.overrides).filter(([name]) => !gone.has(name))),
  }
}

/**
 * Стирает упоминания имён из правил склейки. Допуск, скрытие и ручные данные
 * групп не трогает: они идут за планировками, а не за составом карточки.
 */
function forget(draft: PlanGroupingDraft, names: string[]): PlanGroupingDraft {
  const gone = new Set(names)
  return {
    ...draft,
    groups: draft.groups
      .map((group) => ({ plans: group.plans.filter((name) => !gone.has(name)) }))
      .filter((group) => group.plans.length >= 2),
    keepSeparate: draft.keepSeparate.filter((name) => !gone.has(name)),
  }
}

// --- Скрытие групп ---

/**
 * Скрыть группу — все её планировки; вернуть — снять скрытие со всех. Так
 * группа остаётся скрытой, даже если CRM добавит в неё планировку.
 */
export function setGroupHidden(draft: PlanGroupingDraft, names: string[], hidden: boolean): PlanGroupingDraft {
  const rest = draft.hidden.filter((name) => !names.includes(name))
  return { ...draft, hidden: hidden ? uniqueNames([...rest, ...names]).sort() : rest }
}

// --- Ручные данные групп ---

export type OverrideNumberField = (typeof OVERRIDE_NUMBERS)[number]
export type OverrideListField = (typeof OVERRIDE_LISTS)[number]

function withOverride(
  draft: PlanGroupingDraft,
  key: string,
  change: (current: PlanGroupOverride) => PlanGroupOverride
): PlanGroupingDraft {
  const next = cleanOverride(change({ ...(draft.overrides[key] ?? {}) }))
  const overrides = { ...draft.overrides }
  if (next) overrides[key] = next
  else delete overrides[key]
  return { ...draft, overrides }
}

/** Ручное значение поля группы; undefined — вернуть значение CRM. */
export function setOverrideField(
  draft: PlanGroupingDraft,
  key: string,
  field: OverrideNumberField | OverrideListField,
  value: number | number[] | undefined
): PlanGroupingDraft {
  return withOverride(draft, key, (o) => {
    if (value === undefined) delete o[field]
    else (o as Record<string, unknown>)[field] = value
    return o
  })
}

/** Бейджи группы на одном языке; пустой список — убрать. */
export function setBadges(draft: PlanGroupingDraft, key: string, locale: BadgeLocale, list: string[]): PlanGroupingDraft {
  return withOverride(draft, key, (o) => ({ ...o, badges: { ...o.badges, [locale]: list } }))
}

/**
 * «Подставить значения из CRM»: у группы снимаются ручные цена, площадь,
 * этажи и подъезды. Бейджей в CRM нет — они остаются.
 */
export function resetToCrm(draft: PlanGroupingDraft, key: string): PlanGroupingDraft {
  return withOverride(draft, key, (o) => ({ badges: o.badges }))
}

/** Забыть правку целиком (например, не применяющуюся после склейки групп). */
export function forgetOverride(draft: PlanGroupingDraft, key: string): PlanGroupingDraft {
  return withOverride(draft, key, () => ({}))
}

/** Есть ли у группы ручные значения полей из CRM (не считая бейджей). */
export function hasCrmOverride(override: PlanGroupOverride | null | undefined): boolean {
  return !!override && [...OVERRIDE_NUMBERS, ...OVERRIDE_LISTS].some((f) => override[f] !== undefined)
}

/**
 * Что не так с ручными данными группы: «от» больше «до» у цены или площади.
 * Те же правила, что у сервера (он такую настройку не примет), — сохранение
 * и пересчёт ждут исправления. Ключ — якорь правки.
 */
export function overrideProblems(draft: PlanGroupingDraft): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, o] of Object.entries(draft.overrides)) {
    if (o.priceMin !== undefined && o.priceMax !== undefined && o.priceMin > o.priceMax) {
      out[key] = 'Цена «от» больше цены «до»'
    } else if (o.areaMin !== undefined && o.areaMax !== undefined && o.areaMin > o.areaMax) {
      out[key] = 'Площадь «от» больше площади «до»'
    }
  }
  return out
}

// --- Ввод и вывод значений ---

/** Результат разбора поля: значение, «пусто» (вернуть CRM) или ошибка. */
export type Parsed<T> = { ok: true; value: T | undefined } | { ok: false }

/** «450 000 000» → 450000000; пусто — CRM. */
export function parseMoney(text: string): Parsed<number> {
  const t = text.replace(/[\s\u00a0]/g, '')
  if (!t) return { ok: true, value: undefined }
  if (!/^\d{1,13}$/.test(t)) return { ok: false }
  return { ok: true, value: Number(t) }
}

/** «55,3» → 55.3 (сотые); пусто — CRM. */
export function parseArea(text: string): Parsed<number> {
  const t = text.trim().replace(',', '.')
  if (!t) return { ok: true, value: undefined }
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return { ok: false }
  return { ok: true, value: Number(t) }
}

/** Самый длинный список, который разворачивает диапазон: этажей до 300. */
const MAX_LIST = 300

/**
 * «2–16», «2-16», «2, 5, 7», «-1, 1–3» → отсортированные целые без повторов;
 * пусто — CRM.
 */
export function parseNumberList(text: string): Parsed<number[]> {
  const t = text.trim()
  if (!t) return { ok: true, value: undefined }
  const out = new Set<number>()
  for (const token of t.split(/[,;\s]+/).filter(Boolean)) {
    const range = /^(-?\d{1,3})[-–—](-?\d{1,3})$/.exec(token)
    if (range) {
      const a = Number(range[1])
      const b = Number(range[2])
      if (a > b || b - a >= MAX_LIST) return { ok: false }
      for (let n = a; n <= b; n++) out.add(n)
      continue
    }
    if (!/^-?\d{1,3}$/.test(token)) return { ok: false }
    out.add(Number(token))
  }
  if (out.size > MAX_LIST) return { ok: false }
  return { ok: true, value: [...out].sort((a, b) => a - b) }
}

/** «Акция, Последняя планировка» → список без пустых и повторов. */
export function parseBadges(text: string): string[] {
  return uniqueNames(text.split(','))
}

/** 450000000 → «450 000 000». */
export function formatMoney(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** [2,3,4,5,7] → «2–5, 7»; пусто — прочерк. */
export function formatNumberList(values: number[]): string {
  if (values.length === 0) return '—'
  const sorted = [...new Set(values)].sort((a, b) => a - b)
  const parts: string[] = []
  let start = sorted[0]
  let prev = sorted[0]
  for (const n of [...sorted.slice(1), Infinity]) {
    if (n === prev + 1) {
      prev = n
      continue
    }
    parts.push(start === prev ? String(start) : `${start}–${prev}`)
    start = n
    prev = n
  }
  return parts.join(', ')
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
