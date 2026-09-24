/**
 * Раскладка шаблона страницы проекта на планшете и телефоне.
 *
 * Было: у блоков «О проекте», «Холлы», «Двор» и «Заявка» во встроенных
 * стилях корня стояло `grid-template-columns: repeat(2, 1fr)`, у «Параметров»
 * — `display: flex` без переноса, а у каждой плашки параметра — сетка с
 * минимумом 200px. Встроенный стиль сильнее CSS дизайна, поэтому его правила
 * «одна колонка до 1180px» не срабатывали: на телефоне карточки сжимались до
 * 3–118px, плашки параметров уезжали за экран, страница прокручивалась вбок.
 * Ещё +4px ширины давала рамка-заглушка редактора на корне страницы.
 *
 * Стало: встроенные колонки и flex убраны — на ПК работает сетка дизайна, — а
 * раскладка на узких экранах задана штатно, переопределениями брейкпоинтов
 * CMS (variations.<bp>.inheritedOverrides у родителя узла). Их видно и можно
 * править в редакторе страницы в режимах Tablet и Mobile. Переопределения
 * ставятся на обе ширины явно: редактор не наследует Tablet в Mobile.
 *
 * Корень блока в редакторе блока переопределений не держит (правка в режиме
 * брейкпоинта уходит в базовые стили), поэтому они живут на странице шаблона —
 * у родителя экземпляра блока. Экземпляр при подстановке из библиотеки
 * сохраняет свой id, по нему и адресуется правило.
 *
 * Чистые функции; запись в базу — `migrate-complex-template-layout.ts`.
 */
import { MigrationError, MigrationResult, StructureNode, hasClass } from './choiceToPlanTypes'

type Properties = Record<string, string>

/** Рамка, которую редактор ставит новому контейнеру как заглушку. */
export const EDITOR_PLACEHOLDER_BORDER = '2px solid #94a3b8'

function propsOf(node: StructureNode): Properties {
  return (node.styles?.properties ?? {}) as Properties
}

/** Удаляет свойства из встроенных стилей узла. Возвращает удалённые пары. */
function dropProperties(node: StructureNode, keys: readonly string[]): string[] {
  const props = { ...propsOf(node) }
  const removed = keys.filter((k) => k in props).map((k) => `${k}: ${props[k]}`)
  if (removed.length === 0) return []
  for (const k of keys) delete props[k]
  node.styles = { ...node.styles, properties: props }
  return removed
}

function result(input: StructureNode, structure: StructureNode, changes: string[]): MigrationResult {
  if (changes.length === 0) return { structure: input, changes, alreadyMigrated: true }
  return { structure, changes, alreadyMigrated: false }
}

// --- Библиотечные блоки ---

/** Блок с сеткой в корне: убрать встроенные колонки — их задаёт CSS дизайна. */
export function stripRootColumns(input: StructureNode, label: string): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const removed = dropProperties(structure, ['gridTemplateColumns'])
  return result(input, structure, removed.length ? [`${label}: убраны встроенные колонки (${removed.join('; ')})`] : [])
}

/** Встроенная раскладка «Параметров», перебивавшая сетку дизайна. */
const STATS_ROW_KEYS = ['display', 'gap', 'justifyContent', 'justifyItems'] as const
const STAT_ITEM_KEYS = ['display', 'gridTemplateColumns', 'gridTemplateRows'] as const

/** «Параметры»: вернуть сетку дизайна строке и flex-колонку плашке. */
export function restoreStatsGrid(input: StructureNode, label: string): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  if (!hasClass(structure, 'stats-row')) throw new MigrationError(`${label}: корень блока не .stats-row`)
  const item = (structure.children ?? []).find((c) => hasClass(c, 'stat-item'))
  if (!item) throw new MigrationError(`${label}: нет шаблона плашки .stat-item`)
  const changes: string[] = []
  const row = dropProperties(structure, STATS_ROW_KEYS)
  if (row.length) changes.push(`${label}: у строки убрана встроенная раскладка (${row.join('; ')})`)
  const cell = dropProperties(item, STAT_ITEM_KEYS)
  if (cell.length) changes.push(`${label}: у плашки убрана встроенная сетка (${cell.join('; ')})`)
  return result(input, structure, changes)
}

// --- Страница шаблона ---

/** Правила экземпляра библиотечного блока по брейкпоинтам: {bpId: {свойство: значение}}. */
export interface InstanceLayout {
  blockId: string
  label: string
  overrides: Record<string, Record<string, string>>
}

interface Located {
  node: StructureNode
  parent: StructureNode
}

function findInstances(root: StructureNode, blockId: string): Located[] {
  const out: Located[] = []
  const walk = (node: StructureNode) => {
    for (const child of node.children ?? []) {
      if ((child.metadata as Record<string, unknown> | undefined)?.linkedBlockId === blockId) {
        out.push({ node: child, parent: node })
      }
      walk(child)
    }
  }
  walk(root)
  return out
}

/** Брейкпоинты страницы; без своих — стандартные, как в StyleGenerator.getBreakpoints. */
function breakpointIds(root: StructureNode): string[] {
  const own = (root.metadata as { breakpoints?: Array<{ id: string }> } | undefined)?.breakpoints ?? []
  return own.length ? own.map((b) => b.id) : ['desktop-fhd', 'desktop-hd', 'tablet', 'mobile']
}

/** Ставит переопределение стилей узла на брейкпоинте у его родителя. true — если изменилось. */
function setOverride(parent: StructureNode, nodeId: string, bpId: string, styles: Record<string, string>): boolean {
  const variations = (parent.variations ??= {}) as Record<string, { inheritedOverrides?: Record<string, { styles?: Record<string, unknown> }> }>
  const variation = (variations[bpId] ??= {})
  const overrides = (variation.inheritedOverrides ??= {})
  const current = overrides[nodeId] ?? {}
  const currentStyles = current.styles ?? {}
  if (Object.entries(styles).every(([k, v]) => currentStyles[k] === v)) return false
  overrides[nodeId] = { ...current, styles: { ...currentStyles, ...styles } }
  return true
}

/**
 * Страница шаблона: переопределения раскладки для экземпляров блоков и
 * снятие рамки-заглушки редактора с корня.
 */
export function layoutTemplatePage(input: StructureNode, plan: readonly InstanceLayout[]): MigrationResult {
  const structure: StructureNode = JSON.parse(JSON.stringify(input))
  const changes: string[] = []
  const known = breakpointIds(structure)

  for (const item of plan) {
    const missing = Object.keys(item.overrides).filter((bp) => !known.includes(bp))
    if (missing.length) throw new MigrationError(`${item.label}: у страницы нет брейкпоинтов ${missing.join(', ')}`)
    const instances = findInstances(structure, item.blockId)
    if (instances.length === 0) throw new MigrationError(`${item.label}: блок ${item.blockId} на странице не найден`)
    for (const { node, parent } of instances) {
      for (const [bpId, styles] of Object.entries(item.overrides)) {
        if (setOverride(parent, String(node.id), bpId, styles)) {
          changes.push(`${item.label} (${node.id}) на ${bpId}: ${Object.entries(styles).map(([k, v]) => `${k}: ${v}`).join('; ')}`)
        }
      }
    }
  }

  if (propsOf(structure).border === EDITOR_PLACEHOLDER_BORDER) {
    dropProperties(structure, ['border'])
    changes.push(`Корень страницы: снята рамка-заглушка редактора (${EDITOR_PLACEHOLDER_BORDER}) — давала +4px ширины`)
  }

  return result(input, structure, changes)
}
