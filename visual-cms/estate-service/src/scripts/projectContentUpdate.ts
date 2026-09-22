/**
 * Что именно изменится в комплексе при заливке текстов из книги.
 *
 * Чистый модуль: сравнение и подготовка строк, без базы. Запись — в
 * `update-project-content.ts`.
 *
 * Зачем отдельно от сида: `seed-design-projects` идемпотентен через УДАЛЕНИЕ
 * комплекса по slug, а дома, квартиры и типы планировок уходят за ним по FK
 * CASCADE. Для проекта, уже связанного с CRM, это стирает сотни
 * синхронизированных квартир. Тексты книги не требуют пересоздания строки —
 * их достаточно обновить.
 */

import { ProjectTexts } from './design-projects.content'
import { COMPLEX_TR_FIELDS } from '../services/i18n'

/** Поле комплекса, которое ведёт книга, и его новое значение. */
export interface FieldChange {
  field: string
  from: unknown
  to: unknown
}

/** Строка перевода для estate_translations. */
export interface TranslationRow {
  entityType: 'complex'
  entityId: string
  locale: string
  field: string
  value: string
}

/**
 * Значение поля для сравнения.
 *
 * jsonb-поля приходят из базы массивами, из книги — тоже массивами, но порядок
 * ключей внутри объектов может отличаться. Сравниваем по JSON: ложное
 * «изменилось» заставило бы писать в базу на каждом прогоне.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || a === undefined) return b === null || b === undefined || b === ''
  if (b === null || b === undefined) return a === ''
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Поля комплекса, которые обновит заливка.
 *
 * Берём только то, что реально пришло из книги: поле, которого в `texts` нет,
 * не трогаем. Иначе импорт неполного листа затёр бы то, что заполнено руками
 * в админке (адрес, метки карты, медиа).
 */
export function planComplexUpdate(
  current: Record<string, unknown>,
  texts: ProjectTexts
): FieldChange[] {
  const changes: FieldChange[] = []
  for (const [field, to] of Object.entries(texts)) {
    if (to === undefined || to === null || to === '') continue
    const from = current[field]
    if (sameValue(from, to)) continue
    changes.push({ field, from, to })
  }
  return changes
}

/**
 * Строки перевода для оверлея.
 *
 * jsonb-поля кладутся строкой JSON — именно так их ждёт `applyOverlay`.
 * Поля вне реестра переводимых пропускаем: оверлей их всё равно не наложит,
 * а строка в таблице создала бы иллюзию перевода.
 */
export function planTranslationRows(
  complexId: string,
  locale: string,
  texts: ProjectTexts
): TranslationRow[] {
  const rows: TranslationRow[] = []
  for (const [field, value] of Object.entries(texts)) {
    if (value === undefined || value === null || value === '') continue
    if (!COMPLEX_TR_FIELDS[field]) continue
    rows.push({
      entityType: 'complex',
      entityId: complexId,
      locale,
      field,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    })
  }
  return rows
}

/**
 * Переводы, которые надо записать: отличающиеся от уже лежащих в базе.
 *
 * Ключ существующих — `field`. Совпавшие пропускаем, чтобы прогон без правок
 * в книге не трогал базу и не двигал `updatedAt`.
 */
export function diffTranslations(
  planned: TranslationRow[],
  existing: Array<{ field: string; value: string }>
): TranslationRow[] {
  const byField = new Map(existing.map((row) => [row.field, row.value]))
  return planned.filter((row) => byField.get(row.field) !== row.value)
}
