/**
 * Helpers для работы с каруселью в редакторе.
 *
 * Карусель в системе устроена так:
 *   carousel-root  [data-carousel="true"]
 *     ├─ track   [data-carousel-track="true"]    ← здесь живут слайды
 *     │   ├─ slide-1
 *     │   ├─ slide-2
 *     │   └─ ...
 *     ├─ dots    [data-carousel-dots="true"]
 *     ├─ prev    [data-carousel-prev]
 *     └─ next    [data-carousel-next]
 *
 * Режимы (определяются по наличию active DataBinding на track-узле):
 *   - 'static'  — слайды живут как обычные дочерние ноды track. CarouselRuntime
 *                 рендерит их as-is.
 *   - 'repeat'  — на track повешен DataBinding с inputConfig.mode='repeater'.
 *                 DataBindingGenerator на public-site клонирует первый child
 *                 track-а по числу элементов массива и подставляет fieldMappings.
 *
 * Эти helpers используются:
 *   - SlidesPanel — определить режим, найти track, добавить linked-блок как слайд
 *   - LayerActions (в перспективе) — те же операции
 */
import type { BlockNode } from '@/shared/types'
import type { Block } from '@/shared/types'
import type { DataBinding } from '@/shared/types/dataBinding'

export type CarouselMode = 'static' | 'repeat'

export const CAROUSEL_MODE_ATTR = 'data-carousel-mode'

/**
 * Ищет track-узел внутри carousel-root по атрибуту data-carousel-track.
 * Поиск глубокий (DFS), но останавливается на первом найденном.
 *
 * Возвращает null, если track не найден (например карусель ещё не до-настроена).
 */
export function findTrackNode(carouselRoot: BlockNode | null | undefined): BlockNode | null {
  if (!carouselRoot) return null
  if (carouselRoot.attributes?.['data-carousel-track'] === 'true') return carouselRoot
  const children = carouselRoot.children || []
  for (const child of children) {
    const found = findTrackNode(child)
    if (found) return found
  }
  return null
}

/**
 * Определяет режим карусели.
 *
 * Источники истины (по приоритету):
 *   1. Атрибут data-carousel-mode на carousel-root: 'static' | 'repeat'
 *      (декларативное намерение, выставляется UI или миграцией).
 *   2. Если атрибута нет — наличие active repeater-binding'а на track / carousel-root
 *      (defensive fallback для legacy-структур и случаев, когда атрибут потеряли,
 *      но binding жив).
 *   3. Иначе → 'static'.
 *
 * Когда carouselRoot=null/undefined → 'static' (безопасный default).
 */
export function getCarouselMode(
  carouselRoot: BlockNode | null | undefined,
  bindings: DataBinding[]
): CarouselMode {
  if (!carouselRoot) return 'static'

  // 1. Явный атрибут — высший приоритет.
  const explicit = carouselRoot.attributes?.[CAROUSEL_MODE_ATTR]
  if (explicit === 'static' || explicit === 'repeat') return explicit

  // 2. Fallback: смотрим в bindings.
  const candidateIds = new Set<string>()
  candidateIds.add(carouselRoot.id)
  const track = findTrackNode(carouselRoot)
  if (track) candidateIds.add(track.id)

  const hasRepeater = bindings.some((b) => {
    if (b.isActive === false) return false
    if (b.bindingType !== 'input' && b.bindingType !== 'bidirectional') return false
    if (!candidateIds.has(b.blockId)) return false
    return b.config?.inputConfig?.mode === 'repeater'
  })

  return hasRepeater ? 'repeat' : 'static'
}

/**
 * Опции вставки library-блока как слайда (или вообще куда угодно).
 */
export interface CreateBlockReferenceOptions {
  /** Атрибуты, которые надо добавить созданному узлу. Полезно для data-carousel-slide="true". */
  extraAttributes?: Record<string, string>
  /** Кастомный генератор id; по умолчанию crypto.randomUUID() с fallback. */
  generateId?: () => string
}

export type InsertMode = 'linked' | 'copy'

/**
 * Создаёт BlockNode для вставки library-блока в дерево страницы.
 *
 *   mode='linked' — лёгкий placeholder с metadata.linkedBlockId. При следующем
 *                   PageController.update LinkedBlocksService.updateLinkedBlocks
 *                   развернёт его, подставив свежую структуру из библиотеки.
 *                   Изменения в библиотеке будут автоматически отражаться здесь.
 *   mode='copy'   — глубокая независимая копия block.structure с remap'ом id,
 *                   чтобы не было коллизий с существующими нодами на странице.
 *                   Дальнейшие изменения в библиотеке не повлияют.
 *
 * NB: для linked-режима возвращаем минимальный валидный BlockNode (children=[]).
 * Backend сам подхватит структуру при сохранении.
 */
export function createBlockReferenceNode(
  block: Pick<Block, 'id' | 'name' | 'structure'>,
  mode: InsertMode,
  options: CreateBlockReferenceOptions = {}
): BlockNode {
  const newId = mode === 'linked' ? (options.generateId ?? defaultId)() : ''
  const extraAttrs = options.extraAttributes ?? {}

  if (mode === 'linked') {
    return {
      id: newId,
      tag: 'div',
      tagName: 'div',
      elementType: 'container',
      styles: { properties: {} },
      children: [],
      attributes: { ...extraAttrs },
      metadata: {
        linkedBlockId: block.id,
        name: block.name,
      },
    }
  }

  // mode === 'copy'
  // Не вызываем newId раньше для copy: deepCloneNode сам проставит id корня и
  // всех children через один источник, иначе будет сбиваться счётчик в тестах.
  const copy = deepCloneNode(block.structure, options.generateId ?? defaultId)
  // На корне копии прописываем имя для удобства layer-tree, но БЕЗ linkedBlockId.
  copy.metadata = {
    ...(copy.metadata || {}),
    name: copy.metadata?.name || block.name,
  }
  // linkedBlockId не должен оставаться от оригинала-чтобы copy не считался linked.
  if (copy.metadata.linkedBlockId) delete copy.metadata.linkedBlockId
  // Накатываем extraAttributes, не трогая остальные.
  copy.attributes = { ...(copy.attributes || {}), ...extraAttrs }
  return copy
}

/**
 * Глубокая копия BlockNode с remap'ом всех id (включая children рекурсивно).
 * Сохраняет всю остальную структуру (styles/attributes/metadata/content/animations).
 *
 * Не trimm'ит metadata.linkedBlockId — caller сам решает что с ним делать
 * (для 'copy' режима мы его удаляем уровнем выше).
 */
export function deepCloneNode(
  node: BlockNode,
  genId: () => string = defaultId
): BlockNode {
  // Сериализация — самый быстрый и безопасный способ глубокой копии для plain JSON.
  // BlockNode не содержит функций/Date/Map — JSON-clone валиден.
  const cloned = JSON.parse(JSON.stringify(node)) as BlockNode
  remapIds(cloned, genId)
  return cloned
}

/** Рекурсивно перевыдаёт id всем нодам поддерева (in-place). */
function remapIds(node: BlockNode, genId: () => string): void {
  node.id = genId()
  if (Array.isArray(node.children)) {
    for (const child of node.children) remapIds(child, genId)
  }
  // Responsive variations.specificChildren тоже обходим, иначе там останутся старые id.
  const variations = (node as any).variations as
    | Record<string, { specificChildren?: BlockNode[] }>
    | undefined
  if (variations) {
    for (const v of Object.values(variations)) {
      if (Array.isArray(v?.specificChildren)) {
        for (const child of v.specificChildren) remapIds(child, genId)
      }
    }
  }
}

/**
 * Default id-генератор: crypto.randomUUID() в браузере и Node 19+,
 * с мягким fallback для тестовых сред где crypto может отсутствовать.
 */
function defaultId(): string {
  const c = (globalThis as any).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // RFC4122-ish fallback. Достаточно для уникальности в рамках одной страницы.
  return 'id-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36)
}
