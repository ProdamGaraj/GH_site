/**
 * Раскладка раздела «Локация» страницы проекта на телефоне (блок «Complex location»).
 *
 * Было: ряд «кнопки маршрутов + отдел продаж» собран в редакторе встроенными
 * стилями — flex-строка без переноса, у группы кнопок min-width 70%. Встроенный
 * стиль сильнее CSS дизайна, и на телефоне ряд не перестраивался: его
 * минимальная ширина (~390–410px) распирала сетку секции, и правый край раздела
 * — текст, карта, кнопки, «Панорама 360°» — обрезался на 50–130px. С 600px и
 * шире ряд помещается.
 *
 * Стало: на брейкпоинте Mobile (до 767px) — переопределения CMS
 * (variations.mobile.inheritedOverrides у родителя узла, как в
 * complexTemplateLayout.ts). Их видно и можно править в режиме Mobile:
 * - текст локации и «Панорама 360°» — столбиком, кнопка под текстом;
 * - кнопки маршрутов и отдел продаж — столбиком;
 * - кнопки маршрутов — столбиком в порядке, как на ПК слева направо (такси
 *   первым), без min-width 70%; на всю ширину их растягивает CSS дизайна.
 * ПК и планшет не меняются.
 *
 * Чистое преобразование; запись — `migrate-complex-panorama.ts` (тот же блок).
 * Идемпотентно.
 */
import { MigrationError, MigrationResult, StructureNode, findAll, findOne, hasClass } from './choiceToPlanTypes'
import { setOverride } from './complexTemplateLayout'

export const LOCATION_MOBILE_BP = 'mobile'

interface MobileRule {
  label: string
  /** Узел, которому нужна раскладка на телефоне. */
  find: (root: StructureNode) => StructureNode
  styles: Record<string, string>
}

const childWith = (pred: (n: StructureNode) => boolean) => (n: StructureNode) => (n.children ?? []).some(pred)

export const LOCATION_MOBILE_RULES: readonly MobileRule[] = [
  {
    label: 'текст и «Панорама 360°» — кнопка под текстом',
    find: (root) => findOne(root, childWith((n) => n.attributes?.id === 'projectLocationText'), 'строка текста локации'),
    styles: { flexDirection: 'column', alignItems: 'flex-start', gap: '16px' },
  },
  {
    label: 'кнопки маршрутов и отдел продаж — столбиком',
    find: (root) => findOne(root, (n) => hasClass(n, 'location-trip-links'), '.location-trip-links'),
    styles: { flexDirection: 'column', alignItems: 'stretch', gap: '12px' },
  },
  {
    label: 'кнопки маршрутов — столбиком, такси первым, без min-width 70%',
    find: (root) => findOne(root, childWith((n) => hasClass(n, 'location-trip-taxi')), 'группа кнопок маршрутов'),
    styles: { flexDirection: 'column-reverse', minWidth: '0', gap: '8px' },
  },
]

export function layoutLocationMobile(input: StructureNode): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []

  for (const rule of LOCATION_MOBILE_RULES) {
    const node = rule.find(structure)
    const [parent] = findAll(structure, (n) => (n.children ?? []).includes(node))
    if (!parent) throw new MigrationError(`${rule.label}: у узла ${node.id} нет родителя`)
    if (setOverride(parent, String(node.id), LOCATION_MOBILE_BP, rule.styles)) {
      changes.push(`${rule.label} (${node.id}, ${LOCATION_MOBILE_BP})`)
    }
  }

  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}
