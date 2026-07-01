/**
 * Чтение/запись пер-брейкпоинтного медиа слайда repeat-карусели.
 * Хранится в item._responsive[field][bpId] = url (`_`-префикс → перевод-экстрактор
 * пропускает, деплой раскрывает через media:i:field@bp). Иммутабельно: возвращает
 * новый объект слайда, чистит пустые карты, чтобы не копить мусор.
 */
type Slide = Record<string, unknown>
type ResponsiveMap = Record<string, Record<string, string>>

function getMap(slide: Slide): ResponsiveMap {
  const rm = slide._responsive
  return rm && typeof rm === 'object' ? (rm as ResponsiveMap) : {}
}

/** URL пер-брейкпоинтного варианта поля (или ''). */
export function readSlideResponsive(slide: Slide, field: string, bpId: string): string {
  const v = getMap(slide)[field]?.[bpId]
  return typeof v === 'string' ? v : ''
}

/** Записывает (value='' удаляет) вариант; возвращает новый слайд. */
export function writeSlideResponsive(slide: Slide, field: string, bpId: string, value: string): Slide {
  const rm = getMap(slide)
  const curField = rm[field] && typeof rm[field] === 'object' ? rm[field] : {}
  const nextField: Record<string, string> = { ...curField }
  if (value) nextField[bpId] = value
  else delete nextField[bpId]

  const nextRm: ResponsiveMap = { ...rm }
  if (Object.keys(nextField).length === 0) delete nextRm[field]
  else nextRm[field] = nextField

  const next: Slide = { ...slide }
  if (Object.keys(nextRm).length === 0) delete next._responsive
  else next._responsive = nextRm
  return next
}

/** Сколько брейкпоинтных вариантов задано у поля (для бейджа в UI). */
export function countSlideResponsive(slide: Slide, field: string): number {
  const f = getMap(slide)[field]
  return f && typeof f === 'object' ? Object.keys(f).length : 0
}
