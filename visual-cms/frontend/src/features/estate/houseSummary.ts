/**
 * Сводка по квартирам дома для админки: сами квартиры приходят из CRM и
 * правятся не здесь — данные для сайта задаются группам планировок.
 */

/** Подписи статусов синхронизации (MacroEstateMapper), в порядке показа. */
const STATUS_LABELS: ReadonlyArray<[string, string]> = [
  ['available', 'в продаже'],
  ['reserved', 'бронь'],
  ['sold', 'проданы'],
  ['hidden', 'не в продаже'],
]

/** «154 квартиры из CRM · в продаже 148 · бронь 4 · проданы 2». */
export function apartmentSummary(apartments: ReadonlyArray<{ status: string }> | undefined): string {
  const list = apartments ?? []
  if (list.length === 0) return 'квартир из CRM пока нет'
  const counts = new Map<string, number>()
  for (const apt of list) counts.set(apt.status, (counts.get(apt.status) ?? 0) + 1)
  const parts = [`${list.length} ${plural(list.length, 'квартира', 'квартиры', 'квартир')} из CRM`]
  for (const [status, label] of STATUS_LABELS) {
    const n = counts.get(status)
    if (n) parts.push(`${label} ${n}`)
    counts.delete(status)
  }
  // Статус, которого нет в справочнике, — как есть: лучше видно, чем потеряно.
  for (const [status, n] of counts) parts.push(`${status || 'без статуса'} ${n}`)
  return parts.join(' · ')
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
