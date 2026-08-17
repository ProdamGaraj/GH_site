/**
 * Сериализация для админки: сырые (не наложенные) сущности + их переводы,
 * сгруппированные по языку. В отличие от публичного read (overlay одного языка),
 * админке нужны и база (ru), и текущие оверрайды uz/en для вкладок.
 *
 * Чистые функции, покрываются тестами.
 */
import {
  COMPLEX_TR_FIELDS,
  HOUSE_TR_FIELDS,
  APARTMENT_TR_FIELDS,
  TrRow,
} from './i18n'

type FieldKind = 'string' | 'json'

const KIND_BY_TYPE: Record<string, Record<string, FieldKind>> = {
  complex: COMPLEX_TR_FIELDS,
  house: HOUSE_TR_FIELDS,
  apartment: APARTMENT_TR_FIELDS,
}

export function fieldKind(entityType: string, field: string): FieldKind | undefined {
  return KIND_BY_TYPE[entityType]?.[field]
}

/** true, если поле сущности переводимо (есть в реестре). */
export function isTranslatableField(entityType: string, field: string): boolean {
  return fieldKind(entityType, field) !== undefined
}

/** Значения переводов по языку: { uz: {field: value}, en: {...} }. */
export type TranslationsByLocale = Record<string, Record<string, unknown>>

/**
 * Группирует строки переводов по entityId → locale → field → value.
 * json-поля (yardFeatures/stats/badges) парсятся в массив/объект.
 */
export function groupTranslations(rows: TrRow[]): Map<string, TranslationsByLocale> {
  const map = new Map<string, TranslationsByLocale>()
  for (const r of rows) {
    const byLocale = map.get(r.entityId) || {}
    const fields = byLocale[r.locale] || {}
    const kind = fieldKind(r.entityType, r.field)
    let value: unknown = r.value
    if (kind === 'json') {
      try {
        value = JSON.parse(r.value)
      } catch {
        value = r.value
      }
    }
    fields[r.field] = value
    byLocale[r.locale] = fields
    map.set(r.entityId, byLocale)
  }
  return map
}

export interface TranslationRowInput {
  entityType: string
  entityId: string
  locale: string
  field: string
  value: string
}

/**
 * Преобразует payload переводов админки ({ uz: {field:value}, en: {...} }) в
 * строки для estate_translations. Правила:
 *  - ru пропускается (это база), локали кроме uz/en игнорируются;
 *  - непереводимые поля игнорируются;
 *  - json-поля (yardFeatures/stats/badges) сериализуются в JSON-строку;
 *  - пустые значения ('' / null / undefined) не создают строк → фолбэк на ru.
 * Контроллер на update удаляет прежние переводы сущности и вставляет эти.
 */
export function buildTranslationRows(
  entityType: string,
  entityId: string,
  translations: TranslationsByLocale | undefined
): TranslationRowInput[] {
  if (!translations) return []
  const out: TranslationRowInput[] = []
  for (const locale of Object.keys(translations)) {
    if (locale !== 'uz' && locale !== 'en') continue
    const fields = translations[locale] || {}
    for (const field of Object.keys(fields)) {
      const kind = fieldKind(entityType, field)
      if (!kind) continue // непереводимое поле
      const raw = fields[field]
      if (raw === null || raw === undefined || raw === '') continue
      const value = kind === 'json' ? JSON.stringify(raw) : String(raw)
      if (value === '') continue
      out.push({ entityType, entityId, locale, field, value })
    }
  }
  return out
}

function withTranslations<T extends { id: string }>(
  entity: T,
  trMap: Map<string, TranslationsByLocale>
): T & { translations: TranslationsByLocale } {
  return { ...entity, translations: trMap.get(entity.id) || {} }
}

export interface AdminApartment {
  id: string
  translations: TranslationsByLocale
  [key: string]: unknown
}
export interface AdminHouse {
  id: string
  translations: TranslationsByLocale
  apartments: AdminApartment[]
  [key: string]: unknown
}
export interface AdminComplex {
  id: string
  translations: TranslationsByLocale
  houses: AdminHouse[]
  [key: string]: unknown
}

/**
 * Полное дерево ЖК для админки: complex + houses + apartments, у каждого —
 * сырые поля и переводы по языку.
 */
export function buildComplexAdmin(
  complex: { id: string; [k: string]: unknown },
  houses: Array<{ id: string; complexId: string; order: number; [k: string]: unknown }>,
  apartments: Array<{ id: string; houseId: string; order: number; [k: string]: unknown }>,
  translations: TrRow[]
): AdminComplex {
  const trMap = groupTranslations(translations)
  const sortByOrder = <U extends { order: number }>(arr: U[]) =>
    [...arr].sort((a, b) => a.order - b.order)

  const aptsByHouse = new Map<string, typeof apartments>()
  for (const a of apartments) {
    const list = aptsByHouse.get(a.houseId) || []
    list.push(a)
    aptsByHouse.set(a.houseId, list)
  }

  const houseNodes = sortByOrder(houses)
    .filter((h) => h.complexId === complex.id)
    .map((h) => ({
      ...withTranslations(h, trMap),
      apartments: sortByOrder(aptsByHouse.get(h.id) || []).map((a) => withTranslations(a, trMap)),
    }))

  return {
    ...withTranslations(complex, trMap),
    houses: houseNodes,
  }
}
