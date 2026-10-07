/**
 * Перенос переводов узлов библиотечных блоков из страниц в блоки.
 *
 * До блочных переводов перевод текста блока хранился копией в каждой странице,
 * где блок подключён (translations.pageId). Теперь он у блока
 * (block_translations.blockId) — один на все страницы. Здесь — чистый план
 * переноса и проверка «до = после»; запись — migrate-block-translations.ts.
 *
 * Правила:
 *  - переносится строка страницы, чей узел на ЭТОЙ странице принадлежит блоку
 *    (translationOwnership.resolveOwnership — по дереву страницы);
 *  - копии одного перевода на разных страницах сводятся в одну строку блока;
 *    значения расходятся — конфликт: перенос не выполняется, пока его не
 *    разрешат руками (список в отчёте);
 *  - у блока уже есть перевод (записан после выкатки кода) — он главнее:
 *    копии просто удаляются, страницы и так видят перевод блока;
 *  - всё остальное (свои узлы, мета, page-переменные, неоднозначные узлы,
 *    строки без узла) не трогается.
 *
 * Гарантия: ни одна страница ни на одном языке (и в отметках «*») не теряет
 * перевод и не получает другое значение. Появиться перевод может: перевод
 * блока, который был только на части его страниц, становится общим — ради
 * этого перенос и делается; такие поля печатаются списком.
 */
import {
  type Ownership,
  type TranslationRowLike,
  blockOwnerOf,
  mergeRows,
  resolveOwnership,
  type OwnershipNode,
} from '../services/translationOwnership'

export interface PageRow extends TranslationRowLike {
  id: string
  pageId: string
  status: string
}

export interface BlockRow extends TranslationRowLike {
  id?: string
  blockId: string
  status: string
}

export interface PageInput {
  id: string
  /** Дерево страницы с развёрнутыми блоками. */
  expanded: OwnershipNode | null
}

export interface Conflict {
  blockId: string
  nodeId: string
  field: string
  locale: string
  values: Array<{ pageId: string; value: string }>
}

export interface MigrationPlan {
  /** Новые строки блоков. */
  inserts: BlockRow[]
  /** id строк страниц, которые уходят (их перевод теперь у блока). */
  deletePageRowIds: string[]
  conflicts: Conflict[]
  /** Сводка: блок → сколько строк получит. */
  perBlock: Record<string, number>
  /** Строк страниц не тронуто. */
  untouched: number
}

const STATUS_RANK: Record<string, number> = { draft: 0, review: 1, approved: 2, published: 3 }

const blockKey = (blockId: string, r: { nodeId: string; field: string; locale: string }) =>
  `${blockId}\u0000${r.locale}\u0000${r.nodeId}\u0000${r.field}`

export function ownershipByPage(pages: readonly PageInput[]): Map<string, Ownership> {
  return new Map(pages.map((p) => [p.id, resolveOwnership(p.expanded)]))
}

export function planBlockTranslations(
  pages: readonly PageInput[],
  pageRows: readonly PageRow[],
  blockRows: readonly BlockRow[]
): MigrationPlan {
  const owners = ownershipByPage(pages)
  const existing = new Set(blockRows.map((r) => blockKey(r.blockId, r)))
  const candidates = new Map<string, { blockId: string; rows: PageRow[] }>()
  const deletePageRowIds: string[] = []
  let untouched = 0

  for (const row of pageRows) {
    const ownership = owners.get(row.pageId)
    const blockId = ownership ? blockOwnerOf(ownership, row.nodeId) : null
    if (!blockId) {
      untouched++
      continue
    }
    const entry = candidates.get(blockKey(blockId, row)) ?? { blockId, rows: [] }
    entry.rows.push(row)
    candidates.set(blockKey(blockId, row), entry)
  }

  const inserts: BlockRow[] = []
  const conflicts: Conflict[] = []
  const perBlock: Record<string, number> = {}
  for (const [key, { blockId, rows }] of candidates) {
    // У блока перевод уже есть — он и так главнее копий: копии уходят.
    if (existing.has(key)) {
      deletePageRowIds.push(...rows.map((r) => r.id))
      continue
    }
    const values = new Set(rows.map((r) => r.value))
    if (values.size > 1) {
      // Конфликт: копии остаются на местах, страницы видят их, как раньше.
      untouched += rows.length
      const [first] = rows
      conflicts.push({
        blockId,
        nodeId: first.nodeId,
        field: first.field,
        locale: first.locale,
        values: rows.map((r) => ({ pageId: r.pageId, value: r.value })),
      })
      continue
    }
    const best = rows.reduce((a, b) => ((STATUS_RANK[b.status] ?? 0) > (STATUS_RANK[a.status] ?? 0) ? b : a))
    inserts.push({ blockId, nodeId: best.nodeId, field: best.field, locale: best.locale, value: best.value, status: best.status })
    deletePageRowIds.push(...rows.map((r) => r.id))
    perBlock[blockId] = (perBlock[blockId] ?? 0) + 1
  }

  return { inserts, deletePageRowIds, conflicts, perBlock, untouched }
}

/**
 * Что видит каждая страница: страница → язык → «узел/поле» → значение.
 * Тот же расчёт, что у TranslationService (mergeRows), — поэтому сравнение
 * снимков до и после проверяет ровно то, что уйдёт на сайт и в панель.
 */
export function snapshot(
  pages: readonly PageInput[],
  pageRows: ReadonlyArray<TranslationRowLike & { pageId: string }>,
  blockRows: readonly BlockRow[]
): Map<string, Map<string, Map<string, string>>> {
  const owners = ownershipByPage(pages)
  const out = new Map<string, Map<string, Map<string, string>>>()
  const pageIds = new Set([...pages.map((p) => p.id), ...pageRows.map((r) => r.pageId)])
  for (const pageId of pageIds) {
    const ownership = owners.get(pageId) ?? resolveOwnership(null)
    const own = pageRows.filter((r) => r.pageId === pageId)
    const blocks = blockRows.filter((r) => ownership.blockIds.includes(r.blockId))
    const locales = new Set([...own.map((r) => r.locale), ...blocks.map((r) => r.locale)])
    const byLocale = new Map<string, Map<string, string>>()
    for (const locale of locales) {
      const merged = mergeRows(
        ownership,
        own.filter((r) => r.locale === locale),
        blocks.filter((r) => r.locale === locale)
      )
      if (merged.length === 0) continue
      byLocale.set(locale, new Map(merged.map((r) => [`${r.nodeId}/${r.field}`, r.value])))
    }
    out.set(pageId, byLocale)
  }
  return out
}

export interface SnapshotDiff {
  /** Перевод пропал — недопустимо. */
  lost: string[]
  /** Значение стало другим — недопустимо. */
  changed: string[]
  /**
   * Перевод появился: перевод блока, который раньше был только на части его
   * страниц, теперь виден на всех. Это смысл переноса — допустимо, но
   * печатается списком, чтобы было видно, кто что получил.
   */
  gained: string[]
}

/** Сравнение снимков: lost и changed обязаны быть пустыми. */
export function diffSnapshots(
  before: ReturnType<typeof snapshot>,
  after: ReturnType<typeof snapshot>
): SnapshotDiff {
  const diff: SnapshotDiff = { lost: [], changed: [], gained: [] }
  const pageIds = new Set([...before.keys(), ...after.keys()])
  for (const pageId of pageIds) {
    const b = before.get(pageId) ?? new Map()
    const a = after.get(pageId) ?? new Map()
    for (const locale of new Set([...b.keys(), ...a.keys()])) {
      const bl = b.get(locale) ?? new Map<string, string>()
      const al = a.get(locale) ?? new Map<string, string>()
      for (const key of new Set([...bl.keys(), ...al.keys()])) {
        const was = bl.get(key)
        const now = al.get(key)
        if (was === now) continue
        const line = `${pageId} [${locale}] ${key}: ${JSON.stringify(was ?? null)} → ${JSON.stringify(now ?? null)}`
        if (now === undefined) diff.lost.push(line)
        else if (was === undefined) diff.gained.push(line)
        else diff.changed.push(line)
      }
    }
  }
  return diff
}
