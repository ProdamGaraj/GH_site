/**
 * id планировки на карточках «Выбрать» (блок «Complex choice»): data-plan-type.
 *
 * Заявка из окна планировки (services/LeadRuntime.ts) отправляет id карточки,
 * а бэкенд по нему берёт из каталога дома, площадь, цены и объекты продажи
 * этой планировки. Без атрибута заявка уйдёт только со снимком карточки
 * (комнаты, площадь) — без домов, цен и id объекта.
 *
 * Чистое преобразование; запись — migrate-choice-plan-lead.ts. Повторный вызов
 * ничего не меняет (alreadyMigrated).
 */
import { MigrationResult, StructureNode, findAll, hasClass, MigrationError } from './choiceToPlanTypes'

export const PLAN_TYPE_ATTR = 'data-plan-type'
export const PLAN_TYPE_SOURCE = '{{$.id}}'

export function migrateChoicePlanLead(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  const cards = findAll(structure, (n) => hasClass(n, 'apartment-card'))
  if (!cards.length) throw new MigrationError('«Выбрать»: нет карточки .apartment-card')
  for (const card of cards) {
    const attributes = (card.attributes ??= {}) as Record<string, string>
    if (attributes[PLAN_TYPE_ATTR] === PLAN_TYPE_SOURCE) continue
    attributes[PLAN_TYPE_ATTR] = PLAN_TYPE_SOURCE
    changes.push(`карточка: ${PLAN_TYPE_ATTR}="${PLAN_TYPE_SOURCE}" (id планировки для заявки)`)
  }
  return { structure, changes, alreadyMigrated: changes.length === 0 }
}
