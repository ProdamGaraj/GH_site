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
 * Находит карусель-корень, к которому относится узел targetId:
 *   - сам узел, если он карусель (data-carousel="true");
 *   - иначе ближайший ПРЕДОК с data-carousel="true";
 *   - null, если узел не внутри карусели (или не найден).
 *
 * Нужно, чтобы SlidesPanel не закрывался при выборе слайда-ребёнка: панель
 * резолвит карусель-предка и продолжает работать с ней, а сам выбранный узел
 * (слайд) используется для позиционирования вставки.
 */
export function findCarouselRootFor(
  root: BlockNode | null | undefined,
  targetId: string | null | undefined
): BlockNode | null {
  if (!root || !targetId) return null
  let found: BlockNode | null = null
  const walk = (node: BlockNode, ancestorCarousel: BlockNode | null): boolean => {
    const isCar = node.attributes?.['data-carousel'] === 'true'
    const nearest = isCar ? node : ancestorCarousel
    if (node.id === targetId) {
      found = nearest
      return true
    }
    for (const child of node.children || []) {
      if (walk(child, nearest)) return true
    }
    return false
  }
  walk(root, null)
  return found
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

/** Роль управляющего элемента карусели → её data-атрибут. */
export interface CarouselControlRole {
  key: 'prev' | 'next' | 'dots' | 'counter'
  attr: string
  label: string
}

export const CAROUSEL_CONTROL_ROLES: CarouselControlRole[] = [
  { key: 'prev', attr: 'data-carousel-prev', label: 'Стрелка «назад»' },
  { key: 'next', attr: 'data-carousel-next', label: 'Стрелка «вперёд»' },
  { key: 'dots', attr: 'data-carousel-dots', label: 'Контейнер точек' },
  { key: 'counter', attr: 'data-carousel-counter', label: 'Счётчик (01 / 04)' },
]

/** Плоский список узлов поддерева для пикера: id + отступ-подпись по глубине. */
export function flattenForPicker(root: BlockNode): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = []
  const walk = (n: BlockNode, depth: number): void => {
    const name = n.metadata?.name || n.tagName || 'элемент'
    out.push({ id: n.id, label: `${'  '.repeat(depth)}${name}` })
    for (const c of n.children || []) walk(c, depth + 1)
  }
  walk(root, 0)
  return out
}

/** id первого узла-держателя роли (с данным data-атрибутом), либо ''. */
export function findControlHolderId(root: BlockNode, attr: string): string {
  let found = ''
  const walk = (n: BlockNode): boolean => {
    if (n.attributes?.[attr]) {
      found = n.id
      return true
    }
    for (const c of n.children || []) if (walk(c)) return true
    return false
  }
  walk(root)
  return found
}

/**
 * Назначает роль управления (attr) узлу targetId: снимает атрибут со всех текущих
 * держателей и ставит на target. targetId='' — снять со всех (вернуть в «не задано»).
 * Возвращает минимальный список изменений { id, attributes } для dispatch(updateNode).
 * Чистая функция — без мутаций исходного дерева.
 */
export function assignControlRole(
  root: BlockNode,
  attr: string,
  targetId: string
): Array<{ id: string; attributes: Record<string, string> }> {
  const changes: Array<{ id: string; attributes: Record<string, string> }> = []
  const walk = (n: BlockNode): void => {
    const has = !!n.attributes?.[attr]
    if (n.id === targetId && !has) {
      changes.push({ id: n.id, attributes: { ...(n.attributes || {}), [attr]: 'true' } })
    } else if (n.id !== targetId && has) {
      const next = { ...(n.attributes || {}) }
      delete next[attr]
      changes.push({ id: n.id, attributes: next })
    }
    for (const c of n.children || []) walk(c)
  }
  walk(root)
  return changes
}

/**
 * Дочерние узлы карусель-корня, которые НЕ являются треком — кандидаты в оверлеи
 * (карточка, контролы, текст), которые надо класть поверх слайдов, а не под ними.
 */
export function getOverlayChildren(carouselRoot: BlockNode | null | undefined): BlockNode[] {
  if (!carouselRoot) return []
  return (carouselRoot.children || []).filter(
    (c) => c.attributes?.['data-carousel-track'] !== 'true'
  )
}

/**
 * Создаёт готовый управляющий элемент карусели для роли:
 *  - prev/next → <button> со стрелкой;
 *  - counter   → <span> "01 / 04";
 *  - dots      → контейнер с двумя точками-шаблонами (активная + неактивная),
 *                рантайм клонирует их по числу слайдов с корректным active/inactive.
 * Стили — нейтральные «по белому» (хорошо видно на тёмном слайдере); пользователь
 * дальше двигает/стилизует. Узел уже несёт нужный data-carousel-* атрибут.
 */
export function buildControlElement(
  roleKey: CarouselControlRole['key'],
  genId: () => string = defaultId
): BlockNode {
  const base = (over: Partial<BlockNode>): BlockNode => ({
    id: genId(),
    tag: 'div',
    tagName: 'div',
    elementType: 'container',
    styles: { properties: {} },
    children: [],
    attributes: {},
    metadata: {},
    ...over,
  })

  if (roleKey === 'prev' || roleKey === 'next') {
    return base({
      tag: 'button',
      tagName: 'button',
      elementType: 'button',
      attributes: { [`data-carousel-${roleKey}`]: 'true' },
      content: roleKey === 'prev' ? '‹' : '›',
      metadata: { name: roleKey === 'prev' ? 'Стрелка назад' : 'Стрелка вперёд' },
      styles: {
        properties: {
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.5)',
          background: 'rgba(0,0,0,0.4)',
          color: '#ffffff',
          cursor: 'pointer',
          fontSize: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
    })
  }

  if (roleKey === 'counter') {
    return base({
      tag: 'span',
      tagName: 'span',
      elementType: 'text',
      attributes: { 'data-carousel-counter': 'true' },
      content: '01 / 04',
      metadata: { name: 'Счётчик' },
      styles: { properties: { color: '#ffffff', fontSize: '14px' } },
    })
  }

  // dots: контейнер + 2 точки-шаблона (active/inactive)
  const dot = (active: boolean): BlockNode =>
    base({
      tag: 'button',
      tagName: 'button',
      elementType: 'button',
      attributes: { 'data-carousel-dot': 'true' },
      metadata: { name: active ? 'Точка (активная)' : 'Точка' },
      styles: {
        // transition на обоих шаблонах — рантайм меняет инлайн-стиль активной/
        // неактивной точки, и переход анимируется плавно (размер/цвет).
        properties: active
          ? { width: '24px', height: '8px', borderRadius: '4px', background: '#ffffff', border: 'none', cursor: 'pointer', padding: '0', transition: 'all 0.3s ease' }
          : { width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', padding: '0', transition: 'all 0.3s ease' },
      },
    })

  return base({
    attributes: { 'data-carousel-dots': 'true' },
    metadata: { name: 'Точки' },
    styles: { properties: { display: 'flex', gap: '8px', alignItems: 'center' } },
    children: [dot(true), dot(false)],
  })
}

export interface CarouselConversionOptions {
  /** Добавить стрелки prev/next и контейнер точек. По умолчанию true. */
  withControls?: boolean
}

/** Кнопка управления каруселью (prev/next). */
function makeControlButton(genId: () => string, dir: 'prev' | 'next', label: string): BlockNode {
  return {
    id: genId(),
    tag: 'button',
    tagName: 'button',
    elementType: 'button',
    styles: { properties: {} },
    children: [],
    attributes: { [`data-carousel-${dir}`]: 'true' },
    content: label,
    metadata: { name: dir === 'prev' ? 'Стрелка назад' : 'Стрелка вперёд' },
  }
}

/**
 * Превращает контейнер в карусель (static-режим): его дети оборачиваются в трек
 * и помечаются как слайды, на корень вешаются data-carousel/-mode, добавляются
 * (опц.) стрелки и контейнер точек.
 *
 * Возвращает только { attributes, children } для dispatch(updateNode) — чистая,
 * без мутаций исходного узла. Layout трека на деплое выставляет CarouselRuntime.
 */
export function buildCarouselConversion(
  node: BlockNode,
  genId: () => string = defaultId,
  options: CarouselConversionOptions = {}
): Pick<BlockNode, 'attributes' | 'children'> {
  const withControls = options.withControls !== false

  // Существующие дети становятся слайдами (новые объекты, без мутации).
  const slides: BlockNode[] = (node.children || []).map((child) => ({
    ...child,
    attributes: { ...(child.attributes || {}), 'data-carousel-slide': 'true' },
  }))

  const track: BlockNode = {
    id: genId(),
    tag: 'div',
    tagName: 'div',
    elementType: 'container',
    styles: { properties: {} },
    children: slides,
    attributes: { 'data-carousel-track': 'true' },
    metadata: { name: 'Трек слайдов' },
  }

  const children: BlockNode[] = [track]

  if (withControls) {
    children.push(
      makeControlButton(genId, 'prev', '‹'),
      makeControlButton(genId, 'next', '›'),
      {
        id: genId(),
        tag: 'div',
        tagName: 'div',
        elementType: 'container',
        styles: { properties: { display: 'flex', gap: '8px', justifyContent: 'center' } },
        children: [],
        attributes: { 'data-carousel-dots': 'true' },
        metadata: { name: 'Точки' },
      }
    )
  }

  return {
    attributes: {
      ...(node.attributes || {}),
      'data-carousel': 'true',
      'data-carousel-mode': 'static',
    },
    children,
  }
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
