/**
 * Перевод объектов продажи MacroCRM v2 в форму, которую принимает estate-service.
 *
 * Главное свойство маппера — терпимость к пустоте. На живых данных заполнены
 * ровно десять полей из ста восьми: entrance, number, floor, rooms, areaTotal,
 * price, priceMaxDiscount, currency, isStudio, windowView. Поля riser, section,
 * titleImage, ceilingHeight пусты у всех ста квартир выборки, а panoUrl — у
 * половины. Поэтому ни одно поле не читается без проверки, и результат обязан
 * оставаться валидным, когда пусто всё, кроме идентификаторов.
 *
 * Цены переводятся из тийинов в сумы ровно один раз, здесь (см. macroUnits).
 */

import { priceFromMinorUnits, areaOrNull } from './macroUnits'

/** Объект продажи из estateSell/list. Описаны только читаемые нами поля. */
export interface MacroSellItem {
  id?: unknown
  houseId?: unknown
  complexId?: unknown
  status?: unknown
  category?: unknown
  dateModified?: unknown
  number?: unknown
  entrance?: unknown
  floor?: unknown
  rooms?: unknown
  areaTotal?: unknown
  price?: unknown
  priceMaxDiscount?: unknown
  currency?: unknown
  isStudio?: unknown
  windowView?: unknown
  panoUrl?: unknown
}

/** Квартира в форме estate-service. Всё, кроме идентификаторов, допускает пустоту. */
export interface ApartmentPayload {
  externalId: number
  externalHouseId: number
  rooms: number
  areaM2: number
  /** Цена к показу в сумах: со скидкой, если она есть. */
  price: number
  /** Прайсовая цена, когда есть скидка — та, что зачёркивают. Иначе null. */
  oldPrice: number | null
  entrance: number | null
  floorNumber: number | null
  /** Этаж строкой для показа: «12» или «12/15», если известна этажность дома. */
  floor: string
  number: string
  isStudio: boolean
  windowView: string
  panoUrl: string
  status: ApartmentStatus
  /** ISO-строка dateModified из CRM либо null. */
  dateModified: string | null
}

export type ApartmentStatus = 'available' | 'reserved' | 'sold' | 'hidden'

/**
 * Числовой справочник статусов MacroCRM (общий для объектов, заявок и домов).
 *
 * Схлопываем восемь состояний CRM в четыре наших: покупателю важно только,
 * можно ли купить. «Сделка в работе» и «бронь» для сайта одно и то же —
 * квартира занята, но не продана.
 */
const STATUS_MAP: Record<number, ApartmentStatus> = {
  10: 'hidden',    // Проверка — в CRM ещё не выпущена в продажу
  20: 'available', // Свободно
  30: 'reserved',  // Бронь
  32: 'reserved',  // Маркетинговый резерв
  50: 'reserved',  // Сделка в работе
  52: 'sold',      // Сделка проведена (маркетинг)
  53: 'reserved',  // Сделка в работе (маркетинг)
  100: 'sold',     // Сделка проведена
}

/**
 * Неизвестный статус прячем, а не показываем свободным.
 *
 * Справочник CRM может пополниться, и цена ошибки несимметрична: лишняя
 * спрятанная квартира — недоработка, проданная в выдаче — звонок клиента,
 * которому продают уже проданное.
 */
const UNKNOWN_STATUS: ApartmentStatus = 'hidden'

export function mapStatus(raw: unknown): ApartmentStatus {
  const code = Number(raw)
  if (!Number.isFinite(code)) return UNKNOWN_STATUS
  return STATUS_MAP[code] ?? UNKNOWN_STATUS
}

function intOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function stringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

/** ISO-строка либо null: даты в CRM приходят как «2026-08-19T17:58:58+05:00». */
function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export interface MapApartmentOptions {
  /** Этажность дома из estateHouses/list — чтобы собрать «12/15». */
  floorsCount?: number | null
}

/**
 * Одна квартира. Возвращает null, если объект непригоден: нет своего id, нет
 * дома или нет площади — по такой записи нечего показывать и не к чему
 * привязать. Отбраковку считает вызывающий, чтобы она попала в журнал синка.
 */
export function mapApartment(
  raw: MacroSellItem,
  options: MapApartmentOptions = {}
): ApartmentPayload | null {
  const externalId = intOrNull(raw.id)
  const externalHouseId = intOrNull(raw.houseId)
  const areaM2 = areaOrNull(raw.areaTotal)
  if (externalId === null || externalHouseId === null || areaM2 === null) return null

  const listPrice = priceFromMinorUnits(raw.price)
  const discounted = priceFromMinorUnits(raw.priceMaxDiscount)

  // Скидка засчитывается, только если она действительно меньше прайса:
  // в выдаче priceMaxDiscount заполнен всегда и часто равен цене.
  const hasDiscount = listPrice !== null && discounted !== null && discounted < listPrice

  const floorNumber = intOrNull(raw.floor)
  const floorsCount = intOrNull(options.floorsCount)

  return {
    externalId,
    externalHouseId,
    rooms: intOrNull(raw.rooms) ?? 0,
    areaM2,
    price: (hasDiscount ? discounted : listPrice) ?? 0,
    oldPrice: hasDiscount ? listPrice : null,
    entrance: intOrNull(raw.entrance),
    floorNumber,
    floor: formatFloor(floorNumber, floorsCount),
    number: stringOrEmpty(raw.number),
    isStudio: raw.isStudio === true,
    windowView: stringOrEmpty(raw.windowView),
    panoUrl: stringOrEmpty(raw.panoUrl),
    status: mapStatus(raw.status),
    dateModified: isoOrNull(raw.dateModified),
  }
}

/**
 * «12/15», если этажность дома известна, иначе «12». Пустая строка, когда
 * этажа нет: «null/15» на карточке хуже, чем отсутствие строки.
 */
export function formatFloor(floor: number | null, floorsCount: number | null): string {
  if (floor === null) return ''
  if (floorsCount === null || floorsCount <= 0) return String(floor)
  return `${floor}/${floorsCount}`
}

export interface MapApartmentsResult {
  apartments: ApartmentPayload[]
  /** Идентификаторы записей, которые не удалось разобрать, — в журнал синка. */
  skipped: Array<{ id: unknown; reason: string }>
}

/**
 * Пачка квартир. Нежилые категории отсекаются здесь: в доме 5139395 на продаже
 * 82 гаража и 16 коммерческих помещений, и в карточках квартир им не место.
 * Серверный фильтр categories мы всё равно шлём, но полагаться только на него
 * нельзя — синк не должен зависеть от того, что фильтр не отвалится.
 */
export function mapApartments(
  items: MacroSellItem[],
  options: MapApartmentOptions = {}
): MapApartmentsResult {
  const apartments: ApartmentPayload[] = []
  const skipped: Array<{ id: unknown; reason: string }> = []

  for (const raw of items) {
    const category = stringOrEmpty(raw.category)
    if (category && category !== 'flat') {
      skipped.push({ id: raw.id, reason: `категория ${category}` })
      continue
    }
    const mapped = mapApartment(raw, options)
    if (!mapped) {
      skipped.push({ id: raw.id, reason: 'нет id, дома или площади' })
      continue
    }
    apartments.push(mapped)
  }

  return { apartments, skipped }
}
