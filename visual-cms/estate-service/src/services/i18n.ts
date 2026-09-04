/**
 * Overlay-переводы + языковые производные для estate-сущностей.
 *
 * Модель как в CMS: базовые значения = ru, оверрайды uz/en лежат строками в
 * estate_translations и накладываются при чтении. Нет строки (или пустая) →
 * фолбэк на ru.
 *
 * Всё здесь — чистые функции (без БД), покрываются unit-тестами.
 */

export type Locale = 'ru' | 'uz' | 'en'
export const DEFAULT_LOCALE: Locale = 'ru'
export const SUPPORTED_LOCALES: Locale[] = ['ru', 'uz', 'en']

export function normalizeLocale(input?: string | null): Locale {
  const l = (input || '').toLowerCase()
  return (SUPPORTED_LOCALES as string[]).includes(l) ? (l as Locale) : DEFAULT_LOCALE
}

// --- Реестры переводимых полей (kind: string | json) ---
type FieldKind = 'string' | 'json'
type FieldMap = Record<string, FieldKind>

export const COMPLEX_TR_FIELDS: FieldMap = {
  name: 'string',
  className: 'string',
  intro: 'string',
  about: 'string',
  aboutTitle: 'string',
  aboutExtra: 'string',
  hallTitle: 'string',
  hallText: 'string',
  address: 'string',
  locationTitle: 'string',
  locationText: 'string',
  locationLabels: 'json',
  yardEyebrow: 'string',
  yardTitle: 'string',
  yardText: 'string',
  yardFeatures: 'json',
  stats: 'json',
}
export const HOUSE_TR_FIELDS: FieldMap = {
  name: 'string',
  floors: 'string',
  deadline: 'string',
  className: 'string',
}
export const APARTMENT_TR_FIELDS: FieldMap = {
  apartmentClass: 'string',
  badges: 'json',
  deadline: 'string',
  offerLabel: 'string',
}

// --- Входные структуры (совпадают с полями TypeORM-сущностей) ---
export interface TrRow {
  entityType: string
  entityId: string
  locale: string
  field: string
  value: string
}

/** Подпись на карте проекта, как лежит в БД. */
export interface LocationLabelRow {
  label: string
  accent?: boolean
  top: string
  left: string
}

export interface ComplexRow {
  id: string
  externalId: number | null
  slug: string
  order: number
  status: string
  name: string
  className: string
  intro: string
  about: string
  aboutTitle: string
  aboutExtra: string
  hallTitle: string
  hallText: string
  address: string
  locationTitle: string
  locationText: string
  locationLabels: LocationLabelRow[]
  yardEyebrow: string
  yardTitle: string
  yardText: string
  yardFeatures: string[]
  stats: Array<{ value: string; label: string }>
  logo: string
  logoClass: string
  media: string
  aboutVideo: string
  mapUrl: string
  mapImage: string
  panoramaUrl: string
  heroImages: string[]
  gallery: string[]
  hallGallery: string[]
  yardGallery: string[]
}

export interface HouseRow {
  id: string
  complexId: string
  order: number
  name: string
  floors: string
  deadline: string
  className: string
  entrances?: number | null
}

export interface ApartmentRow {
  id: string
  houseId: string
  order: number
  rooms: number
  areaM2: string | number
  price: string | number
  oldPrice?: string | number | null
  entrance?: number | null
  apartmentClass: string
  badges: string[]
  floor: string
  number: string
  deadline: string
  offerLabel: string
  status: string
  planImage: string
}

// --- Overlay ---
function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/**
 * Индекс переводов: entityType|entityId|locale|field -> value.
 * Собирается один раз на запрос, чтобы наложение было O(1), без .find по массиву.
 */
export function indexTranslations(rows: TrRow[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of rows) {
    map.set(`${r.entityType}|${r.entityId}|${r.locale}|${r.field}`, r.value)
  }
  return map
}

/**
 * Накладывает оверлей нужного языка на базовую (ru) сущность.
 * locale === ru → возвращает base без изменений.
 * Пустое значение оверрайда трактуется как «нет перевода» → фолбэк на ru.
 */
export function applyOverlay<T extends Record<string, any>>(
  base: T,
  entityType: string,
  entityId: string,
  locale: Locale,
  fields: FieldMap,
  index: Map<string, string>
): T {
  if (locale === DEFAULT_LOCALE) return base
  const out: any = { ...base }
  for (const field of Object.keys(fields)) {
    const value = index.get(`${entityType}|${entityId}|${locale}|${field}`)
    if (value === undefined || value === '') continue // фолбэк на ru
    out[field] = fields[field] === 'json' ? safeJsonParse(value, base[field]) : value
  }
  return out
}

// --- Языковые производные (title / meta / price) ---
const WORDS: Record<Locale, { floor: string; entrance: string; numberPrefix: string }> = {
  ru: { floor: 'этаж', entrance: 'подъезд', numberPrefix: '№' },
  uz: { floor: 'qavat', entrance: 'kirish', numberPrefix: '№' },
  en: { floor: 'floor', entrance: 'entrance', numberPrefix: 'No.' },
}

export function toNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Площадь без лишних нулей: 114.00 -> "114", 78.81 -> "78.81". */
export function formatArea(v: string | number): string {
  return String(toNumber(v))
}

/** Группировка разрядов пробелами: 1354320000 -> "1 354 320 000". */
export function groupThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** "1 354 320 000 UZS" (пусто/0 → ''). */
export function formatPrice(v: string | number | null | undefined): string {
  const n = toNumber(v)
  if (n <= 0) return ''
  return `${groupThousands(n)} UZS`
}

/**
 * Одиночное опциональное значение → массив на 0 или 1 элемент.
 *
 * Шаблон CMS рендерит опциональные картинки и плашки через repeater (_repeat):
 * пустой массив = узел вообще не создаётся, и остаётся CSS-заглушка секции.
 * Прямая привязка пустой строки дала бы url("") или пустую стилизованную
 * плашку — видимый дефект. Движок шаблонов не умеет условий, поэтому
 * «условность» выражается длиной массива.
 */
export function optionalOne<K extends string>(key: K, value: string | null | undefined): Array<Record<K, string>> {
  const v = (value || '').trim()
  return v ? ([{ [key]: v }] as Array<Record<K, string>>) : []
}

/**
 * Подписи карты для шаблона: accent → готовый CSS-класс, координаты как есть.
 * Класс собирается здесь, чтобы шаблон просто привязал class={{$.className}}
 * (условий в движке нет).
 */
export function buildLocationLabels(rows: unknown): LocationLabelDTO[] {
  if (!Array.isArray(rows)) return []
  return rows
    .filter((r): r is LocationLabelRow => !!r && typeof r === 'object' && typeof (r as any).label === 'string')
    .map((r) => ({
      label: r.label,
      className: r.accent ? 'map-label accent' : 'map-label',
      top: r.top || '50%',
      left: r.left || '50%',
    }))
}

/**
 * Уникальные непустые значения поля в порядке первого появления.
 * Нужны фильтрам страницы: чипсы «Срок сдачи» и «Класс жилья» разворачиваются
 * из этих списков через _repeat, а не хардкодятся в вёрстке — у каждого ЖК
 * свой набор сроков и классов.
 */
export function distinctValues<T>(rows: T[], pick: (row: T) => string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of rows) {
    const value = (pick(row) || '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/** Подпись планировки: ru "4-комн. 114 м²", uz "4 xonali 114 m²", en "4-room 114 m²". */
export function apartmentTitle(rooms: number, area: string | number, locale: Locale): string {
  const a = formatArea(area)
  if (locale === 'uz') return `${rooms} xonali ${a} m²`
  if (locale === 'en') return `${rooms}-room ${a} m²`
  return `${rooms}-комн. ${a} м²`
}

/** Мета-строка карточки: "№ 102 | 8/9 этаж | 2 подъезд | 1 кв. 2028". */
export function apartmentMeta(a: ApartmentRow, locale: Locale): string {
  const w = WORDS[locale]
  const parts: string[] = []
  if (a.number) parts.push(`${w.numberPrefix} ${a.number}`)
  if (a.floor) {
    parts.push(locale === 'en' ? `${w.floor} ${a.floor}` : `${a.floor} ${w.floor}`)
  }
  if (a.entrance !== null && a.entrance !== undefined) {
    parts.push(locale === 'en' ? `${w.entrance} ${a.entrance}` : `${a.entrance} ${w.entrance}`)
  }
  if (a.deadline) parts.push(a.deadline)
  return parts.join(' | ')
}

// --- DTO выхода ---
/** Подпись карты для шаблона: className уже собран из accent. */
export interface LocationLabelDTO {
  label: string
  className: string
  top: string
  left: string
}

export interface ApartmentDTO {
  id: string
  rooms: number
  areaM2: number
  title: string
  price: number
  oldPrice: number | null
  priceFormatted: string
  oldPriceFormatted: string
  apartmentClass: string
  badges: string[]
  planImage: string
  floor: string
  entrance: number | null
  number: string
  deadline: string
  offerLabel: string
  status: string
  meta: string
  /** offerLabel как массив 0..1 — для условного рендера плашки в шаблоне. */
  offers: Array<{ label: string }>
  /** planImage как массив 0..1 — иначе пустой url() затрёт CSS-заглушку. */
  planImages: Array<{ image: string }>
}

export interface HouseDTO {
  id: string
  name: string
  floors: string
  entrances: number | null
  deadline: string
  className: string
  apartments: ApartmentDTO[]
}

export interface ComplexDetailDTO {
  slug: string
  /** Числовой ID проекта в CRM: {{item.externalId}} в доп.источнике квартир. */
  externalId: number | null
  status: string
  name: string
  className: string
  intro: string
  about: string
  aboutTitle: string
  aboutExtra: string
  aboutVideo: string
  hallTitle: string
  hallText: string
  address: string
  locationTitle: string
  locationText: string
  locationLabels: LocationLabelDTO[]
  mapUrl: string
  mapImage: string
  panoramaUrl: string
  /** mapImage как массив 0..1 — оверлей поверх CSS-карты только при наличии. */
  mapImages: Array<{ image: string }>
  logo: string
  logoClass: string
  media: string
  heroImages: string[]
  gallery: string[]
  hallGallery: string[]
  yard: {
    eyebrow: string
    title: string
    text: string
    features: string[]
    gallery: string[]
  }
  stats: Array<{ value: string; label: string }>
  houses: HouseDTO[]
  apartments: ApartmentDTO[]
  /** Уникальные сроки сдачи по квартирам — чипсы фильтра. */
  deadlines: string[]
  /** Уникальные классы квартир — чипсы фильтра. */
  apartmentClasses: string[]
}

export interface ComplexListItemDTO {
  slug: string
  externalId: number | null
  name: string
  className: string
  intro: string
  cardImage: string
  status: string
  order: number
}

// --- Сборщики ответа ---
export function buildApartmentDTO(
  apartment: ApartmentRow,
  locale: Locale,
  index: Map<string, string>
): ApartmentDTO {
  const a = applyOverlay(apartment, 'apartment', apartment.id, locale, APARTMENT_TR_FIELDS, index)
  const price = toNumber(a.price)
  const oldPrice = a.oldPrice === null || a.oldPrice === undefined ? null : toNumber(a.oldPrice)
  return {
    id: a.id,
    rooms: a.rooms,
    areaM2: toNumber(a.areaM2),
    title: apartmentTitle(a.rooms, a.areaM2, locale),
    price,
    oldPrice,
    priceFormatted: formatPrice(price),
    oldPriceFormatted: oldPrice ? formatPrice(oldPrice) : '',
    apartmentClass: a.apartmentClass,
    badges: Array.isArray(a.badges) ? a.badges : [],
    planImage: a.planImage,
    floor: a.floor,
    entrance: a.entrance ?? null,
    number: a.number,
    deadline: a.deadline,
    offerLabel: a.offerLabel,
    status: a.status,
    meta: apartmentMeta(a, locale),
    offers: optionalOne('label', a.offerLabel),
    planImages: optionalOne('image', a.planImage),
  }
}

export function buildComplexDetail(
  complex: ComplexRow,
  houses: HouseRow[],
  apartments: ApartmentRow[],
  translations: TrRow[],
  locale: Locale
): ComplexDetailDTO {
  const index = indexTranslations(translations)
  const c = applyOverlay(complex, 'complex', complex.id, locale, COMPLEX_TR_FIELDS, index)

  const byHouse = new Map<string, ApartmentRow[]>()
  for (const apt of apartments) {
    const list = byHouse.get(apt.houseId) || []
    list.push(apt)
    byHouse.set(apt.houseId, list)
  }
  const sortByOrder = <T extends { order: number }>(arr: T[]) =>
    [...arr].sort((x, y) => x.order - y.order)

  // DTO квартир строим один раз, переиспользуем в домах и в плоском списке.
  const aptDtoById = new Map<string, ApartmentDTO>()
  for (const apt of apartments) {
    aptDtoById.set(apt.id, buildApartmentDTO(apt, locale, index))
  }

  const houseDTOs: HouseDTO[] = sortByOrder(houses).map((house) => {
    const h = applyOverlay(house, 'house', house.id, locale, HOUSE_TR_FIELDS, index)
    const apts = sortByOrder(byHouse.get(house.id) || []).map((apt) => aptDtoById.get(apt.id)!)
    return {
      id: h.id,
      name: h.name,
      floors: h.floors,
      entrances: h.entrances ?? null,
      deadline: h.deadline,
      className: h.className,
      apartments: apts,
    }
  })

  // Плоский список всех квартир для repeater «Выбрать»: сортировка по
  // ГЛОБАЛЬНОМУ order (грид не сгруппирован по домам, карточки идут вперемешку).
  const flatApartments = sortByOrder(apartments).map((apt) => aptDtoById.get(apt.id)!)

  return {
    slug: c.slug,
    externalId: c.externalId ?? null,
    status: c.status,
    name: c.name,
    className: c.className,
    intro: c.intro,
    about: c.about,
    aboutTitle: c.aboutTitle,
    aboutExtra: c.aboutExtra,
    aboutVideo: c.aboutVideo,
    hallTitle: c.hallTitle,
    hallText: c.hallText,
    address: c.address,
    locationTitle: c.locationTitle,
    locationText: c.locationText,
    locationLabels: buildLocationLabels(c.locationLabels),
    mapUrl: c.mapUrl,
    mapImage: c.mapImage,
    panoramaUrl: c.panoramaUrl,
    mapImages: optionalOne('image', c.mapImage),
    logo: c.logo,
    logoClass: c.logoClass,
    media: c.media,
    heroImages: Array.isArray(c.heroImages) ? c.heroImages : [],
    gallery: Array.isArray(c.gallery) ? c.gallery : [],
    hallGallery: Array.isArray(c.hallGallery) ? c.hallGallery : [],
    yard: {
      eyebrow: c.yardEyebrow,
      title: c.yardTitle,
      text: c.yardText,
      features: Array.isArray(c.yardFeatures) ? c.yardFeatures : [],
      gallery: Array.isArray(c.yardGallery) ? c.yardGallery : [],
    },
    stats: Array.isArray(c.stats) ? c.stats : [],
    houses: houseDTOs,
    apartments: flatApartments,
    deadlines: distinctValues(flatApartments, (a) => a.deadline),
    apartmentClasses: distinctValues(flatApartments, (a) => a.apartmentClass),
  }
}

export function buildComplexListItem(
  complex: ComplexRow,
  translations: TrRow[],
  locale: Locale
): ComplexListItemDTO {
  const index = indexTranslations(translations)
  const c = applyOverlay(complex, 'complex', complex.id, locale, COMPLEX_TR_FIELDS, index)
  return {
    slug: c.slug,
    externalId: c.externalId ?? null,
    name: c.name,
    className: c.className,
    intro: c.intro,
    cardImage: c.media || (Array.isArray(c.heroImages) && c.heroImages[0]) || '',
    status: c.status,
    order: c.order,
  }
}
