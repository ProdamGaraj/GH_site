/**
 * Карта проекта в админке ЖК: разбор координат и правка списка мест.
 *
 * Координаты вводят строкой, как их копируют из Яндекс или Google Карт:
 * «41.311081, 69.240562». Разбор повторяет estate-service
 * (src/services/projectMap.ts, parseCoordinates) — пакеты раздельные,
 * держать в согласии.
 *
 * Места в форме всегда валидны: новое место добавляется только с типом,
 * названием и разобранными координатами. Поэтому сохранение ЖК не падает на
 * схеме сервера из-за недописанной строки.
 *
 * Чистые функции, без React.
 */
import type { GeoPoint, MapPlace } from './types'

function coordinate(value: string, limit: number): number | null {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

/** Числа с точкой: «41.311081, 69.240562», «41.31; 69.28», «41.31 69.28». */
const DOT_PAIR = /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/
/** Десятичная запятая — только если числа разделены не запятой: «41,31; 69,28». */
const COMMA_PAIR = /^(-?\d+(?:,\d+)?)\s*[;\s]\s*(-?\d+(?:,\d+)?)$/

/** Координаты строкой → точка; неоднозначное («41,31, 69,28») и мусор — null. */
export function parseCoordinates(text: string): GeoPoint | null {
  const s = text.trim()
  const m = s.match(DOT_PAIR) ?? s.match(COMMA_PAIR)
  if (!m) return null
  const lat = coordinate(m[1], 90)
  const lng = coordinate(m[2], 180)
  return lat === null || lng === null ? null : { lat, lng }
}

/** Точка → строка для поля ввода; нет точки — пусто. */
export function formatPoint(point: GeoPoint | null | undefined): string {
  return point ? `${point.lat}, ${point.lng}` : ''
}

/** Новое место: id — uuid, на нём держатся переводы названия. */
export function newPlace(
  type: string,
  name: string,
  point: GeoPoint,
  makeId: () => string = () => crypto.randomUUID()
): MapPlace {
  return { id: makeId(), type, name: name.trim(), lat: point.lat, lng: point.lng }
}

/** Место с правкой; пустое название не принимается — место сохранило бы «пустую» точку. */
export function updatePlace(places: readonly MapPlace[], id: string, patch: Partial<Omit<MapPlace, 'id'>>): MapPlace[] {
  if (patch.name !== undefined && !patch.name.trim()) return [...places]
  return places.map((p) => (p.id === id ? { ...p, ...patch } : p))
}

export function removePlace(places: readonly MapPlace[], id: string): MapPlace[] {
  return places.filter((p) => p.id !== id)
}

/** Сдвиг места на шаг вверх (-1) или вниз (+1); за краем списка — без изменений. */
export function movePlace(places: readonly MapPlace[], id: string, step: -1 | 1): MapPlace[] {
  const from = places.findIndex((p) => p.id === id)
  const to = from + step
  if (from === -1 || to < 0 || to >= places.length) return [...places]
  const next = [...places]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}
