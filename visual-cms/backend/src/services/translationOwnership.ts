/**
 * Чей перевод у узла: страницы или библиотечного блока.
 *
 * Перевод принадлежит владельцу узла. Узлы внутри подключённого блока
 * (metadata.linkedBlockId) — блоку: блок один на много страниц, и перевод его
 * текста должен быть один. Всё остальное — странице: собственные узлы, корень
 * экземпляра блока (его id — id плейсхолдера на этой странице), мета страницы
 * (`__page__`), медиа page-переменных (`pagevar:`), строки без узла.
 *
 * Владелец — ближайший блок-предок по дереву ЭТОЙ страницы, а не поиск по всей
 * библиотеке: у копий блоков id узлов совпадают (на стенде 74 таких id), и
 * глобальный поиск дал бы чужой блок. Узел, который на странице встречается
 * в разных блоках, неоднозначен — он остаётся странице, как было до блочных
 * переводов, и попадает в отчёт.
 *
 * Отметка «один текст для всех языков» — строка с locale '*': 'same' — текст
 * основного языка на всех языках (переводы языков не применяются), 'translate'
 * — поле переводится, даже если по умолчанию оно общее (ссылки, медиа).
 *
 * Чистые функции, без БД: чтение и запись — TranslationService.
 */

/** locale отметки «один текст для всех языков». */
export const ALL_LOCALES = '*'
export type SameMark = 'same' | 'translate'
export const SAME: SameMark = 'same'
export const TRANSLATE: SameMark = 'translate'

export interface OwnershipNode {
  id?: string
  metadata?: Record<string, unknown> | null
  children?: OwnershipNode[] | null
  variations?: Record<string, { specificChildren?: OwnershipNode[] | null } | null> | null
}

export interface Ownership {
  /** nodeId → id блока-владельца. Нет в карте — узел страницы. */
  blockOf: Map<string, string>
  /** Узлы, встретившиеся на странице в разных блоках: остаются странице. */
  ambiguous: Set<string>
  /** Блоки, чьи узлы есть на странице (в порядке появления). */
  blockIds: string[]
}

function linkedIdOf(node: OwnershipNode): string | null {
  const id = node.metadata?.linkedBlockId
  return typeof id === 'string' && id ? id : null
}

/**
 * Владельцы узлов развёрнутого дерева страницы (после
 * LinkedBlocksService.updateLinkedBlocks — иначе узлов блока в нём нет).
 */
export function resolveOwnership(expanded: OwnershipNode | null | undefined): Ownership {
  const owners = new Map<string, Set<string | null>>()
  const blockIds: string[] = []

  const visit = (node: OwnershipNode | null | undefined, owner: string | null) => {
    if (!node || typeof node !== 'object') return
    if (node.id) {
      const set = owners.get(node.id) ?? new Set<string | null>()
      set.add(owner)
      owners.set(node.id, set)
    }
    // Корень экземпляра принадлежит тому, кто его содержит; его потомки — блоку.
    const inner = linkedIdOf(node) ?? owner
    if (inner && inner !== owner && !blockIds.includes(inner)) blockIds.push(inner)
    for (const child of node.children ?? []) visit(child, inner)
    for (const variation of Object.values(node.variations ?? {})) {
      for (const child of variation?.specificChildren ?? []) visit(child, inner)
    }
  }
  visit(expanded, null)

  const blockOf = new Map<string, string>()
  const ambiguous = new Set<string>()
  for (const [nodeId, set] of owners) {
    if (set.size > 1) {
      ambiguous.add(nodeId)
      continue
    }
    const [owner] = [...set]
    if (owner) blockOf.set(nodeId, owner)
  }
  return { blockOf, ambiguous, blockIds }
}

/** Блок-владелец узла или null — узел страницы. */
export function blockOwnerOf(ownership: Ownership, nodeId: string): string | null {
  return ownership.blockOf.get(nodeId) ?? null
}

/**
 * Поле по умолчанию «одно для всех языков»: ссылки и медиа. Переводят их
 * редко (баннер с текстом на картинке) — такие поля помечают «переводить».
 * Текст, alt, подписи, заголовки страницы — по умолчанию переводятся.
 */
export function isSameByDefault(field: string): boolean {
  const base = field.replace(/@.*$/, '')
  if (['href', 'src', 'poster', 'data-slide-video', 'bg:image', 'meta:ogImage'].includes(base)) return true
  // Медиа page-переменных: media:<слайд>:<поле>.
  return field.startsWith('media:')
}

/** Действует ли «один текст для всех языков» с учётом отметки. */
export function isSameEffective(field: string, mark: SameMark | undefined): boolean {
  if (mark === SAME) return true
  if (mark === TRANSLATE) return false
  return isSameByDefault(field)
}

export interface TranslationRowLike {
  nodeId: string
  field: string
  locale: string
  value: string
  status?: string
}

export type RowSource = 'page' | 'block' | 'legacy'

/** Строка перевода, как её видит страница: значение и откуда оно. */
export interface EffectiveRow extends TranslationRowLike {
  /** page — свой узел; block — перевод блока; legacy — копия блочного перевода в странице (до переноса). */
  source: RowSource
  /** Блок-владелец узла (для source block и legacy). */
  blockId?: string
}

const keyOf = (r: { nodeId: string; field: string }) => `${r.nodeId}\u0000${r.field}`

/**
 * Строки одного языка (или '*'), как их видит страница.
 *
 * Узел блока: строка блока, а если её нет — копия в строках страницы (так
 * хранилось до блочных переводов; после переноса копий нет). Узел страницы —
 * строка страницы; строки блока для чужих узлов не берутся. Строки страницы
 * для узлов, которых в дереве нет, остаются как есть.
 */
export function mergeRows(
  ownership: Ownership,
  pageRows: readonly TranslationRowLike[],
  blockRows: readonly (TranslationRowLike & { blockId: string })[]
): EffectiveRow[] {
  const out = new Map<string, EffectiveRow>()
  for (const row of blockRows) {
    if (blockOwnerOf(ownership, row.nodeId) !== row.blockId) continue
    out.set(keyOf(row), { ...pick(row), source: 'block', blockId: row.blockId })
  }
  for (const row of pageRows) {
    const key = keyOf(row)
    const owner = blockOwnerOf(ownership, row.nodeId)
    if (owner) {
      if (!out.has(key)) out.set(key, { ...pick(row), source: 'legacy', blockId: owner })
      continue
    }
    out.set(key, { ...pick(row), source: 'page' })
  }
  return [...out.values()].sort((a, b) => (a.nodeId === b.nodeId ? a.field.localeCompare(b.field) : a.nodeId.localeCompare(b.nodeId)))
}

function pick(row: TranslationRowLike): TranslationRowLike {
  return { nodeId: row.nodeId, field: row.field, locale: row.locale, value: row.value, status: row.status }
}

/** Отметки «один текст для всех языков» по ключу узел+поле. */
export function marksOf(rows: readonly TranslationRowLike[]): Map<string, SameMark> {
  const marks = new Map<string, SameMark>()
  for (const row of rows) {
    if (row.locale !== ALL_LOCALES) continue
    if (row.value === SAME || row.value === TRANSLATE) marks.set(keyOf(row), row.value)
  }
  return marks
}

export function markOf(marks: Map<string, SameMark>, nodeId: string, field: string): SameMark | undefined {
  return marks.get(keyOf({ nodeId, field }))
}

export interface TranslationMapLike {
  [nodeId: string]: { [field: string]: string }
}

/**
 * Карта переводов языка для применения к дереву. Поле с отметкой «один текст
 * для всех» не переводится: на всех языках остаётся текст основного языка.
 * Без отметки строки языка применяются как раньше (в т.ч. медиа под язык).
 */
export function buildTranslationMap(rows: readonly TranslationRowLike[], marks: Map<string, SameMark>): TranslationMapLike {
  const map: TranslationMapLike = {}
  for (const row of rows) {
    if (row.locale === ALL_LOCALES) continue
    if (markOf(marks, row.nodeId, row.field) === SAME) continue
    ;(map[row.nodeId] ??= {})[row.field] = row.value
  }
  return map
}

export interface SourceEntryLike {
  nodeId: string
  field: string
  value: string
}

/**
 * Непереведённые поля языка: нет непустого перевода и поле не «одно для всех».
 * Пустой перевод на деплое не применяется (остаётся текст основного языка) —
 * поэтому и здесь он не перевод.
 */
export function missingEntries<T extends SourceEntryLike>(
  entries: readonly T[],
  rows: readonly TranslationRowLike[],
  marks: Map<string, SameMark>
): T[] {
  const translated = new Set(rows.filter((r) => r.locale !== ALL_LOCALES && r.value.trim() !== '').map(keyOf))
  return entries.filter((e) => !translated.has(keyOf(e)) && !isSameEffective(e.field, markOf(marks, e.nodeId, e.field)))
}
