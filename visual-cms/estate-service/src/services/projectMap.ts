/**
 * Карта проекта: точка дома, отдел продаж и места рядом → данные для
 * страницы проекта.
 *
 * Страница получает плоские списки — под повтор шаблона CMS, в движке которого
 * нет условий:
 *   mapPoints  — все точки: дом, отдел продаж, места. Блок карты раскладывает
 *                их в [data-map-point], рантайм рисует;
 *   mapLegend  — использованные типы мест: название, цвет, SVG иконки, число;
 *   mapOffices — отдел продаж списком 0..1: кнопки поездки повторяются по
 *                нему и пропадают, если отдела нет.
 * Нет точки дома — все три пустые: карты у проекта нет, блок прячется.
 *
 * Иконки — из services/mapIcons.ts: единственный набор на систему.
 * Кривые точки и места неизвестного или скрытого типа отбрасываются, не
 * роняя остальные: данные правят руками, и одна опечатка не должна убирать
 * всю карту.
 *
 * Чистые функции без БД.
 */
import { iconSvg } from './mapIcons'

export type MapLocale = 'ru' | 'uz' | 'en'

export interface GeoPoint {
  lat: number
  lng: number
}

/** Отдел продаж ЖК, как он хранится в complexes.salesOffice. */
export interface SalesOffice extends GeoPoint {
  address?: string
}

/** Место рядом, как оно хранится в complexes.places. */
export interface MapPlace extends GeoPoint {
  id: string
  type: string
  name: string
}

/** Тип места (таблица place_types). */
export interface PlaceTypeRow {
  key: string
  nameRu: string
  nameUz: string
  nameEn: string
  icon: string
  color: string
  order: number
  hidden: boolean
}

export type MapPointKind = 'house' | 'office' | 'place'

export interface MapPointDTO {
  id: string
  kind: MapPointKind
  /** Ключ типа места; у дома и отдела продаж — пусто. */
  type: string
  name: string
  lat: number
  lng: number
  /** Цвет метки: у места — цвет типа, у дома и отдела продаж — пусто (их вид задаёт CSS). */
  color: string
  /** Расстояние от дома по прямой: «≈ 450 м»; у дома — пусто. */
  distance: string
}

export interface MapLegendItem {
  type: string
  name: string
  color: string
  /** Готовый <svg> иконки. */
  icon: string
  count: number
}

export interface MapOfficeDTO extends GeoPoint {
  name: string
  address: string
}

export interface ProjectMapDTO {
  mapPoints: MapPointDTO[]
  mapLegend: MapLegendItem[]
  mapOffices: MapOfficeDTO[]
}

const OFFICE_LABEL: Record<MapLocale, string> = {
  ru: 'Отдел продаж',
  uz: 'Sotuv ofisi',
  en: 'Sales office',
}

const EMPTY: ProjectMapDTO = { mapPoints: [], mapLegend: [], mapOffices: [] }

// --- Точки ---

function coordinate(value: unknown, limit: number): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

/** Точка из jsonb: широта и долгота в своих пределах, иначе null. */
export function readPoint(value: unknown): GeoPoint | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const lat = coordinate(v.lat, 90)
  const lng = coordinate(v.lng, 180)
  return lat === null || lng === null ? null : { lat, lng }
}

/** Числа с точкой: «41.311081, 69.240562», «41.31; 69.28», «41.31 69.28». */
const DOT_PAIR = /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/
/** Десятичная запятая — только если числа разделены не запятой: «41,31; 69,28». */
const COMMA_PAIR = /^(-?\d+(?:,\d+)?)\s*[;\s]\s*(-?\d+(?:,\d+)?)$/

/**
 * Координаты строкой, как их копируют из Яндекс или Google Карт. «41,31, 69,28»
 * не разбирается: где там десятичная запятая, а где разделитель, не понять.
 */
export function parseCoordinates(text: string): GeoPoint | null {
  const s = String(text).trim()
  const m = s.match(DOT_PAIR) ?? s.match(COMMA_PAIR)
  if (!m) return null
  return readPoint({ lat: m[1].replace(',', '.'), lng: m[2].replace(',', '.') })
}

// --- Расстояние ---

const EARTH_RADIUS_M = 6371008.8

/** Расстояние по прямой между точками, метры (гаверсинус). */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

const UNITS: Record<MapLocale, { m: string; km: string; decimal: string }> = {
  ru: { m: 'м', km: 'км', decimal: ',' },
  uz: { m: 'm', km: 'km', decimal: ',' },
  en: { m: 'm', km: 'km', decimal: '.' },
}

/**
 * «≈ 450 м» до километра (с шагом 10 м, но не меньше 10), дальше «≈ 1,2 км».
 * По прямой: пешком выйдет дальше, поэтому «≈», а не «пешком N минут».
 */
export function formatDistance(meters: number, locale: MapLocale): string {
  const u = UNITS[locale]
  if (meters < 995) return `≈ ${Math.max(10, Math.round(meters / 10) * 10)} ${u.m}`
  return `≈ ${(Math.round(meters / 100) / 10).toFixed(1).replace('.', u.decimal)} ${u.km}`
}

/**
 * Типы мест, которых нет в справочнике. Место неизвестного типа на карту не
 * попадёт, поэтому такое сохранение отклоняется, а не проходит молча.
 */
export function missingPlaceTypes(places: Array<{ type: string }>, knownKeys: Iterable<string>): string[] {
  const known = new Set(knownKeys)
  return [...new Set(places.map((p) => p.type))].filter((key) => !known.has(key))
}

// --- Сборка ---

function typeName(type: PlaceTypeRow, locale: MapLocale): string {
  const byLocale = locale === 'uz' ? type.nameUz : locale === 'en' ? type.nameEn : type.nameRu
  return (byLocale || '').trim() || type.nameRu
}

function readPlaces(value: unknown): MapPlace[] {
  if (!Array.isArray(value)) return []
  const out: MapPlace[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const p = raw as Record<string, unknown>
    const point = readPoint(p)
    const id = typeof p.id === 'string' ? p.id : ''
    const type = typeof p.type === 'string' ? p.type : ''
    const name = typeof p.name === 'string' ? p.name.trim() : ''
    if (!point || !id || !type || !name) continue
    out.push({ id, type, name, ...point })
  }
  return out
}

export interface ProjectMapInput {
  /** Название ЖК на языке страницы — подпись метки дома. */
  name: string
  housePoint: unknown
  salesOffice: unknown
  places: unknown
  /** Перевод адреса отдела продаж (оверлей языка); пусто — адрес из salesOffice. */
  salesOfficeAddress?: string | null
  /** Переводы названий мест по id (оверлей языка). */
  placeNames?: Record<string, string> | null
}

export function buildProjectMap(input: ProjectMapInput, placeTypes: PlaceTypeRow[], locale: MapLocale): ProjectMapDTO {
  const house = readPoint(input.housePoint)
  if (!house) return EMPTY

  const types = new Map(placeTypes.filter((t) => !t.hidden).map((t) => [t.key, t]))
  const names = input.placeNames && typeof input.placeNames === 'object' ? input.placeNames : {}

  const places = readPlaces(input.places)
    .filter((p) => types.has(p.type))
    .map((p) => ({ place: p, type: types.get(p.type)!, meters: distanceMeters(house, p) }))
    // Порядок легенды и списка: по порядку типа, внутри — ближние первыми.
    .sort((a, b) => a.type.order - b.type.order || a.meters - b.meters)

  const points: MapPointDTO[] = [
    { id: 'house', kind: 'house', type: '', name: input.name, ...house, color: '', distance: '' },
  ]

  const officePoint = readPoint(input.salesOffice)
  const offices: MapOfficeDTO[] = []
  if (officePoint) {
    const stored = (input.salesOffice as SalesOffice).address
    const address = (input.salesOfficeAddress || '').trim() || (typeof stored === 'string' ? stored.trim() : '')
    offices.push({ name: OFFICE_LABEL[locale], address, ...officePoint })
    points.push({
      id: 'office',
      kind: 'office',
      type: '',
      name: OFFICE_LABEL[locale],
      ...officePoint,
      color: '',
      distance: formatDistance(distanceMeters(house, officePoint), locale),
    })
  }

  const legend = new Map<string, MapLegendItem>()
  for (const { place, type, meters } of places) {
    const translated = typeof names[place.id] === 'string' ? names[place.id].trim() : ''
    points.push({
      id: place.id,
      kind: 'place',
      type: type.key,
      name: translated || place.name,
      lat: place.lat,
      lng: place.lng,
      color: type.color,
      distance: formatDistance(meters, locale),
    })
    const item = legend.get(type.key)
    if (item) item.count += 1
    else legend.set(type.key, { type: type.key, name: typeName(type, locale), color: type.color, icon: iconSvg(type.icon) ?? '', count: 1 })
  }

  return { mapPoints: points, mapLegend: [...legend.values()], mapOffices: offices }
}
