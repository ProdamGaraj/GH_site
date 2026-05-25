/**
 * Diff одного linked-инстанса на странице против его исходной структуры в библиотеке.
 *
 * Контекст. По инварианту B2 (см. KNOWN_ISSUES.md) полная структура linked-блока
 * живёт ТОЛЬКО в библиотеке; на странице хранится placeholder (`children: []`),
 * который при чтении разворачивается `LinkedBlocksService._applyLinkedBlocks`.
 * Разворачивание детерминированно:
 *
 *   expanded = {
 *     ...JSON.parse(JSON.stringify(library)),   // tagName/content/styles/children/variations — из library 1:1
 *     id: placeholder.id,                        // id берётся у placeholder'а
 *     attributes: { ...library.attributes, ...placeholder.attributes }, // overlay placeholder'а
 *     metadata: { ...library.metadata, linkedBlockId },
 *   }
 *
 * Значит «инстанс НЕ изменён» ⟺ его контентное ядро (tagName, content, styles,
 * layoutMode, дети, variations) совпадает с library. Поэтому при сравнении КОРНЯ
 * инстанса мы игнорируем поля, которые накладывает разворачивание и которые не
 * являются правкой контента: `id`, `attributes` (overlay placeholder'а — туда
 * попадают, например, маркеры hybrid-карусели data-carousel-*), и `metadata`.
 * У ВЛОЖЕННЫХ узлов таких overlay-полей нет — они копируются из library побайтно,
 * поэтому сравниваются целиком (включая id/attributes).
 *
 * Модуль чистый (без БД/DOM) — чтобы покрывать golden-фикстурами.
 */

export type LinkedChangeKind =
  | 'content'
  | 'styles'
  | 'tagName'
  | 'layoutMode'
  | 'attributes'
  | 'variations'
  | 'child-added'
  | 'child-removed'
  | 'reorder'

export interface LinkedChange {
  kind: LinkedChangeKind
  /** Человекочитаемый путь до изменённого узла (имя / tagName). */
  path: string
  /** Короткое описание для UI (русский). */
  label: string
}

export interface LinkedInstanceDiff {
  changed: boolean
  changes: LinkedChange[]
}

/** Имя узла для отображения в diff. */
function nodeName(node: any): string {
  return node?.metadata?.name || node?.tagName || node?.elementType || 'элемент'
}

/** Стабильная сериализация для сравнения (без учёта порядка ключей). */
function stableStringify(value: any): string {
  if (value === null || value === undefined) return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function deepEqual(a: any, b: any): boolean {
  return stableStringify(a) === stableStringify(b)
}

/**
 * Сравнивает инстанс с library-структурой, накапливая изменения.
 * @param isRoot — на корне игнорируем id/attributes/metadata (overlay разворачивания).
 */
function compareNodes(instance: any, library: any, path: string, isRoot: boolean, changes: LinkedChange[]): void {
  if (!instance || !library) return

  if ((instance.tagName ?? null) !== (library.tagName ?? null)) {
    changes.push({ kind: 'tagName', path, label: `${path}: изменён тег (${library.tagName ?? '—'} → ${instance.tagName ?? '—'})` })
  }

  if ((instance.content ?? '') !== (library.content ?? '')) {
    changes.push({ kind: 'content', path, label: `${path}: изменён текст` })
  }

  if (!deepEqual(instance.styles ?? null, library.styles ?? null)) {
    changes.push({ kind: 'styles', path, label: `${path}: изменены стили` })
  }

  if ((instance.layoutMode ?? null) !== (library.layoutMode ?? null)) {
    changes.push({ kind: 'layoutMode', path, label: `${path}: изменён режим раскладки` })
  }

  if (!deepEqual(instance.variations ?? null, library.variations ?? null)) {
    changes.push({ kind: 'variations', path, label: `${path}: изменены адаптивные варианты` })
  }

  // Вложенные узлы копируются из library 1:1, поэтому attributes у них сравниваем.
  // На корне attributes — это overlay placeholder'а поверх library, не правка контента.
  if (!isRoot && !deepEqual(instance.attributes ?? null, library.attributes ?? null)) {
    changes.push({ kind: 'attributes', path, label: `${path}: изменены атрибуты` })
  }

  const instChildren: any[] = Array.isArray(instance.children) ? instance.children : []
  const libChildren: any[] = Array.isArray(library.children) ? library.children : []
  compareChildren(instChildren, libChildren, path, changes)
}

/**
 * Сравнивает списки детей. Перемещение узла (reorder) сохраняет его id, поэтому
 * сопоставление по id отличает «переставили элемент» от «изменили содержимое» —
 * позиционное сравнение давало бы лавину ложных «изменён текст» при сдвиге индексов.
 *
 * Если общих id нет (свежая вставка из библиотеки через cloneNodeWithNewIds
 * перевыдаёт все id) — id бесполезны как ключ; падаем на позиционное сравнение,
 * иначе идентичный по содержимому блок ложно показался бы «полностью заменён».
 */
function compareChildren(instChildren: any[], libChildren: any[], path: string, changes: LinkedChange[]): void {
  const libIds = new Set(libChildren.map((c) => c?.id))
  const hasCommonIds = instChildren.some((c) => c && libIds.has(c.id))

  if (!hasCommonIds) {
    const max = Math.max(instChildren.length, libChildren.length)
    for (let i = 0; i < max; i++) {
      const inst = instChildren[i]
      const lib = libChildren[i]
      if (inst && !lib) {
        changes.push({ kind: 'child-added', path, label: `${path}: добавлен элемент «${nodeName(inst)}»` })
      } else if (!inst && lib) {
        changes.push({ kind: 'child-removed', path, label: `${path}: удалён элемент «${nodeName(lib)}»` })
      } else if (inst && lib) {
        compareNodes(inst, lib, `${path} › ${nodeName(inst)}`, false, changes)
      }
    }
    return
  }

  const libById = new Map(libChildren.map((c) => [c.id, c]))
  const instById = new Map(instChildren.map((c) => [c.id, c]))

  for (const inst of instChildren) {
    if (!libById.has(inst.id)) {
      changes.push({ kind: 'child-added', path, label: `${path}: добавлен элемент «${nodeName(inst)}»` })
    }
  }
  for (const lib of libChildren) {
    if (!instById.has(lib.id)) {
      changes.push({ kind: 'child-removed', path, label: `${path}: удалён элемент «${nodeName(lib)}»` })
    }
  }
  for (const inst of instChildren) {
    const lib = libById.get(inst.id)
    if (lib) compareNodes(inst, lib, `${path} › ${nodeName(inst)}`, false, changes)
  }

  // Reorder: относительный порядок ОБЩИХ узлов отличается.
  const commonInst = instChildren.map((c) => c.id).filter((id) => libById.has(id))
  const commonLib = libChildren.map((c) => c.id).filter((id) => instById.has(id))
  if (commonInst.length > 1 && commonInst.join(' ') !== commonLib.join(' ')) {
    changes.push({ kind: 'reorder', path, label: `${path}: изменён порядок элементов` })
  }
}

/**
 * Возвращает, изменён ли инстанс относительно library-структуры, и список изменений
 * для отображения в UI.
 *
 * Если library-структуры нет (`null`/`undefined`) — считаем инстанс НЕ изменённым:
 * мы не можем доказать расхождение, а ложное «изменён» спровоцировало бы лишний
 * вопрос пользователю и риск затереть библиотеку пустотой.
 */
export function diffLinkedInstance(instance: any, libraryStructure: any): LinkedInstanceDiff {
  if (!instance || !libraryStructure) {
    return { changed: false, changes: [] }
  }
  const changes: LinkedChange[] = []
  compareNodes(instance, libraryStructure, nodeName(instance), true, changes)
  return { changed: changes.length > 0, changes }
}
