/**
 * Тело заявки для MacroCRM (POST /v2/estateBuy/create) из заявки с сайта.
 *
 * Что куда:
 *   name, phones, email     — из формы. `phone` (устаревший) НЕ шлём никогда:
 *                             вместе с непустым `phones` CRM отвечает 400;
 *   message                 — о чём заявка: планировка / проект / вопрос клиента;
 *   text                    — что клиент смотрел на сайте (для менеджера);
 *   estate_buy_*Interest,
 *   estate_rooms*, *_range,
 *   estate_sell_id          — из каталога (estate-service), не из браузера;
 *   utm                     — метки визита + ip и user-agent с нашего сервера;
 *   is_allow_*              — только если под кнопкой была строка согласия.
 *
 * Чистый модуль без БД и сети: всё, что нужно, приходит аргументами.
 */
import type { LeadInput } from '../../schemas/lead.schema'

// ─── Контекст из каталога ────────────────────────────────────────

/**
 * Ответ estate-service GET /api/lead-context. Копия типа LeadContextDTO
 * (estate-service/src/services/leadContext.ts): сервисы не делят код.
 */
export interface NumberRange {
  min: number
  max: number
}

export interface LeadPlanContext {
  id: string
  planName: string
  rooms: number
  isStudio: boolean
  area: NumberRange | null
  price: NumberRange | null
  floors: number[]
  houseExternalIds: number[]
  onSaleExternalIds: number[]
}

export interface LeadContext {
  complex: { slug: string; name: string } | null
  houseExternalIds: number[]
  plan: LeadPlanContext | null
}

export const EMPTY_CONTEXT: LeadContext = { complex: null, houseExternalIds: [], plan: null }

// ─── Настройки и данные запроса ──────────────────────────────────

export interface LeadCrmConfig {
  /** Тип заявки в CRM (`action`). */
  action: string
  /** Категория недвижимости для заявок о квартирах (`category`). */
  category: string
  /** id рекламного канала «Сайт» в CRM; не задан — поле не шлём. */
  advertisingChannelId?: number | null
}

/** Что знает о запросе только сервер. */
export interface LeadRequestMeta {
  ip?: string | null
  userAgent?: string | null
  /** Домен сайта, с которого пришла заявка (без порта). */
  domain?: string | null
}

// ─── Телефон ─────────────────────────────────────────────────────

/** Длина номера Узбекистана без кода страны. */
const UZ_LOCAL_DIGITS = 9
const UZ_CODE = '998'
/** CRM требует не менее 10 цифр; длиннее 15 номеров не бывает (E.164). */
const MIN_DIGITS = 10
const MAX_DIGITS = 15

/**
 * Телефон в виде «+цифры» или null, если это не телефон.
 *
 * 9 цифр — местный номер Узбекистана («90 123 45 67»): дописываем 998.
 * «00» в начале — международный префикс вместо «+».
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  let digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === UZ_LOCAL_DIGITS) digits = UZ_CODE + digits
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null
  return `+${digits}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim()
  return EMAIL_RE.test(value) ? value : null
}

// ─── Форматирование для менеджера ────────────────────────────────

/** «650 000 000» — разряды через пробел, без зависимости от ICU в контейнере. */
export function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100
  const [int, frac] = String(rounded).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return frac ? `${grouped}.${frac}` : grouped
}

export function formatRange(range: NumberRange | null | undefined, unit = ''): string {
  if (!range) return ''
  const tail = unit ? ` ${unit}` : ''
  return range.min === range.max
    ? `${formatNumber(range.min)}${tail}`
    : `${formatNumber(range.min)}–${formatNumber(range.max)}${tail}`
}

/** «45 с», «3 мин», «3 мин 20 с», «1 ч 5 мин». */
export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  if (s < 60) return `${s} с`
  if (s < 3600) {
    const rest = s % 60
    return rest ? `${Math.floor(s / 60)} мин ${rest} с` : `${Math.floor(s / 60)} мин`
  }
  const minutes = Math.floor((s % 3600) / 60)
  return minutes ? `${Math.floor(s / 3600)} ч ${minutes} мин` : `${Math.floor(s / 3600)} ч`
}

function floorsLabel(floors: number[]): string {
  if (!floors.length) return ''
  const min = Math.min(...floors)
  const max = Math.max(...floors)
  return min === max ? String(min) : `${min}–${max}`
}

function roomsLabel(rooms: number, isStudio: boolean): string {
  if (isStudio || rooms === 0) return 'студия'
  return `${rooms}-комн.`
}

/** Подписи полей формы для менеджера; неизвестное поле — как есть. */
const FIELD_LABELS: Record<string, string> = {
  project: 'Проект',
  object: 'Тип объекта',
}

const KIND_TITLES: Record<LeadInput['kind'], string> = {
  callback: 'Обратный звонок',
  project: 'Заявка со страницы проекта',
  plan: 'Консультация по планировке',
}

/** Пустые части выбрасываются — в тексте не бывает «Этажи: .». */
function lines(parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join('\n')
}

/** `message`: о чём заявка. */
export function buildMessage(input: LeadInput, ctx: LeadContext): string {
  const plan = input.kind === 'plan' ? ctx.plan : null
  const snapshot = input.kind === 'plan' ? input.plan : undefined
  const project = ctx.complex?.name || snapshot?.project || ''

  const head =
    input.kind === 'plan'
      ? `${KIND_TITLES.plan}: ${snapshot?.title || (plan ? roomsLabel(plan.rooms, plan.isStudio) : 'без названия')}`
      : KIND_TITLES[input.kind]

  const planLines = plan
    ? [
        plan.planName && `Планировка в CRM: ${plan.planName}`,
        plan.area && `Площадь: ${formatRange(plan.area, 'м²')}`,
        plan.floors.length > 0 && `Этажи: ${floorsLabel(plan.floors)}`,
        snapshot?.deadline && `Срок сдачи: ${snapshot.deadline}`,
        plan.price && `Цена свободных: ${formatRange(plan.price, 'сум')}`,
        `Свободных квартир: ${plan.onSaleExternalIds.length}`,
      ]
    : snapshot
      ? [
          // Подпись карточки уже со словом: «этажи 2–12».
          snapshot.floors,
          snapshot.deadline && `Срок сдачи: ${snapshot.deadline}`,
        ]
      : []

  const fields = Object.entries(input.fields ?? {})
    .filter(([key, value]) => value && !(key === 'project' && value === project))
    .map(([key, value]) => `${FIELD_LABELS[key] ?? key}: ${value}`)

  return lines([
    head,
    project && `Проект: ${project}`,
    ...planLines,
    ...fields,
    input.message && `Вопрос клиента: ${input.message}`,
  ])
}

/** Сколько последних страниц и планировок показывать менеджеру. */
const JOURNEY_PAGES = 15
const JOURNEY_PLANS = 10

function sourceLine(input: LeadInput): string {
  const utm = input.utm
  const tags = utm ? [utm.source, utm.medium, utm.campaign].filter(Boolean) : []
  if (tags.length) return `Источник: ${tags.join(' / ')}`
  const referrer = input.journey?.referrer || ''
  if (referrer) {
    try {
      return `Источник: переход с ${new URL(referrer).hostname}`
    } catch {
      return `Источник: переход с ${referrer}`
    }
  }
  return input.journey ? 'Источник: прямой заход' : ''
}

/** `text`: что клиент делал на сайте и откуда отправил заявку. */
export function buildJourneyText(input: LeadInput): string {
  const journey = input.journey
  const pages = (journey?.pages ?? []).slice(-JOURNEY_PAGES)
  const plans = (journey?.plans ?? []).slice(-JOURNEY_PLANS)
  const filters = Object.entries(input.filters ?? {}).filter(([, v]) => v)

  const visits = journey?.visits
    ? `Визитов на сайт: ${journey.visits}${journey.firstSeen ? `, первый — ${journey.firstSeen}` : ''}`
    : ''

  return lines([
    `Заявка с сайта: ${input.form || KIND_TITLES[input.kind]}`,
    `Страница: ${input.page.title ? `${input.page.title} (${input.page.path})` : input.page.path}${input.page.lang ? `, язык ${input.page.lang}` : ''}`,
    sourceLine(input),
    visits,
    pages.length > 0 &&
      `Смотрел страницы:\n${pages.map((p) => `• ${p.title || p.path} — ${formatDuration(p.seconds)}`).join('\n')}`,
    plans.length > 0 &&
      `Открывал планировки:\n${plans.map((p) => `• ${[p.title, p.project].filter(Boolean).join(', ')}`).join('\n')}`,
    filters.length > 0 && `Фильтры планировок: ${filters.map(([k, v]) => `${k}: ${v}`).join('; ')}`,
  ])
}

// ─── Тело запроса ────────────────────────────────────────────────

/** Имя для CRM, если клиент его не указал. */
export const NAMELESS = 'Клиент с сайта'

/**
 * Тело для estateBuy/create. Поля без значения не попадают в тело вовсе:
 * пустая строка или 0 в CRM — это значение, а не «не знаю».
 *
 * `phone` уже нормализован вызывающим (normalizePhone) — без телефона
 * заявки нет, и это решается до сборки тела.
 */
export function buildMacroLead(
  input: LeadInput,
  phone: string,
  ctx: LeadContext,
  meta: LeadRequestMeta,
  config: LeadCrmConfig
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: input.name || NAMELESS,
    phones: [phone],
  }

  const email = normalizeEmail(input.email)
  if (email) body.email = email

  body.message = buildMessage(input, ctx)
  body.text = buildJourneyText(input)
  if (config.action) body.action = config.action

  // Категория «квартира» — когда заявка о жилом проекте: форма проекта или
  // планировки, либо любая форма на странице проекта. Обратный звонок с
  // главной или «Коммерции» о квартире не говорит — категорию не угадываем.
  if (config.category && (input.kind !== 'callback' || ctx.complex)) body.category = config.category

  const plan = input.kind === 'plan' ? ctx.plan : null
  const houses = plan && plan.houseExternalIds.length ? plan.houseExternalIds : ctx.houseExternalIds
  if (houses.length) body.estate_buy_housesInterest = houses

  if (plan) {
    body.estate_rooms = plan.rooms
    body.estate_roomsTo = plan.rooms
    if (plan.area) body.estate_area_range = { ...plan.area }
    if (plan.price) body.estate_price_range = { ...plan.price }
    // Поле одно: объект продажи шлём, только когда он однозначен.
    if (plan.onSaleExternalIds.length === 1) body.estate_sell_id = plan.onSaleExternalIds[0]
  } else if (input.kind === 'plan' && input.plan) {
    // Каталог карточку не нашёл — интерес по снимку карточки, без цен и id.
    const snap = input.plan
    if (typeof snap.rooms === 'number') {
      body.estate_rooms = snap.rooms
      body.estate_roomsTo = snap.rooms
    }
    if (snap.areaMin && snap.areaMax) body.estate_area_range = { min: snap.areaMin, max: snap.areaMax }
  }

  const domain = (meta.domain || '').trim()
  if (domain) body.domain = domain

  if (input.consent === true) {
    body.is_allow_personal_data = 1
    body.is_allow_call = 1
  }

  if (config.advertisingChannelId) {
    body.advertisingChannelId = config.advertisingChannelId
    body.estate_client_from = config.advertisingChannelId
  }

  const utm: Record<string, string> = { channel_medium: 'website', channel_type: 'www' }
  if (domain) utm.channel_name = domain
  const tags = input.utm ?? {}
  if (tags.source) utm.utm_source = tags.source
  if (tags.medium) utm.utm_medium = tags.medium
  if (tags.campaign) utm.utm_campaign = tags.campaign
  if (tags.content) utm.utm_content = tags.content
  if (tags.term) utm.utm_term = tags.term
  if (meta.ip) utm.ip = meta.ip
  if (meta.userAgent) utm.user_agent = meta.userAgent
  body.utm = utm

  return body
}
