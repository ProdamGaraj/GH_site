/**
 * Бейджи групп планировок на карточках «Выбрать» (блок «Complex choice»).
 *
 * Бейджи («Акция», «Последняя планировка») админ задаёт группе планировок в
 * estate; карточка получает их списком строк `$.badges` на языке страницы.
 *
 * Встают в ряд плашек карточки между классом и площадью: площадь последняя, и
 * правило блока `.apartment-badges span:last-child` красит её светлым — бейдж
 * в конце ряда перехватил бы этот стиль. У бейджей свой, золотой, цвет, чтобы
 * отличались от справочных плашек.
 *
 * Чистое преобразование; запись — migrate-choice-plan-badges.ts. Повторный
 * вызов ничего не меняет (alreadyMigrated).
 */
import { upsertCssSection } from './complexMedia'
import { MigrationError, MigrationResult, StructureNode, findAll, findOne, hasClass, makeNode } from './choiceToPlanTypes'

export const PLAN_BADGES_CLASS = 'plan-badges'
const BADGES_SOURCE = '$.badges'

const CSS_HEAD = '/* ==== plan-badges'
export const PLAN_BADGES_CSS_MARKER = `${CSS_HEAD} v1 ====`
export const PLAN_BADGES_CSS = `${PLAN_BADGES_CSS_MARKER} */
/* Обёртка повторителя не рисуется: бейджи — участники ряда плашек. */
.apartment-badges .${PLAN_BADGES_CLASS} {
  display: contents;
}

.apartment-badges .${PLAN_BADGES_CLASS} span,
.apartment-badges .${PLAN_BADGES_CLASS} span:last-child {
  background: #fdb82a;
  color: #15181d;
}
`

export function migrateChoicePlanBadges(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []
  const metadata = (structure.metadata ??= {}) as Record<string, unknown>

  const row = findOne(structure, (n) => hasClass(n, 'apartment-badges'), '.apartment-badges')
  if (!findAll(row, (n) => hasClass(n, PLAN_BADGES_CLASS)).length) {
    const children = row.children ?? []
    const classChip = children.find((c) => c.attributes?.['data-apartment-class'] !== undefined)
    if (!classChip) throw new MigrationError('«Выбрать»: в ряду плашек нет плашки класса')
    const template = children[children.length - 1]
    const badge = makeNode({
      ...JSON.parse(JSON.stringify(template)),
      id: 'plan-badge',
      content: '{{$}}',
      attributes: {},
    })
    const wrap = makeNode({
      id: 'plan-badges',
      tagName: 'div',
      elementType: 'container',
      attributes: { class: PLAN_BADGES_CLASS },
      _repeat: { source: BADGES_SOURCE },
      children: [badge],
    })
    const at = children.indexOf(classChip)
    row.children = [...children.slice(0, at + 1), wrap, ...children.slice(at + 1)]
    changes.push(`бейджи группы ($.badges) — между классом и площадью`)
  }
  if (upsertCssSection(metadata, CSS_HEAD, PLAN_BADGES_CSS_MARKER, PLAN_BADGES_CSS)) {
    changes.push('CSS бейджей добавлен')
  }
  return { structure, changes, alreadyMigrated: changes.length === 0 }
}
