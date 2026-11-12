/**
 * Экранные правки (variations[bp].inheritedOverrides) так, как их применяет ДЕПЛОЙ.
 *
 * Бэкенд (StyleGenerator.collectResponsiveRules) обходит всё дерево и на каждую
 * запись эмитит правило `[data-element-id="<id>"] { … !important }` внутри
 * @media своего breakpoint'а. Отсюда две особенности, которых раньше не было в
 * редакторе (он читал правку только у прямого родителя и только своего экрана):
 *
 *  1. Правка адресует узел ПО ID, где бы ни лежала. Запись, которую держит не
 *     родитель («чужая»), на сайте работает — значит, и канвас обязан её показать.
 *  2. Экраны каскадируются: правило Desktop HD выходит как `(max-width: 1919px)`
 *     и действует на планшете и телефоне, пока более узкий экран не перебьёт то
 *     же свойство (см. breakpointRanges.ts).
 *
 * При равной силе (!important у всех) побеждает правило, эмитированное позже:
 * сначала порядок экранов (от широкого к узкому), внутри экрана — порядок обхода
 * дерева. Здесь воспроизводится ровно этот порядок.
 */
import type { BlockNode, BlockNodeVariation } from '@/shared/types'
import { applicableBreakpointIds, type BreakpointLike } from './breakpointRanges'

export type ScreenOverride = NonNullable<BlockNodeVariation['inheritedOverrides']>[string]

/**
 * Значение «свойство на этом экране снято». Экранная правка умеет только
 * перебивать, поэтому убрать свойство, пришедшее из основной версии или с более
 * широкого экрана, можно лишь записав сброс: `revert` возвращает значение
 * браузера по умолчанию, как если бы свойство не задавали. Деплой эмитит его
 * как обычное значение (`display: revert !important`), канвас — инлайном.
 */
export const SCREEN_STYLE_RESET = 'revert'

/** Свойства узла без снятых на экране — то, что показываем как «заданные стили». */
export function withoutScreenResets<T extends Record<string, unknown>>(properties: T | undefined): Partial<T> {
  const visible: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties || {})) {
    if (value !== SCREEN_STYLE_RESET) visible[key] = value
  }
  return visible as Partial<T>
}

/**
 * Узел для панелей настроек: снятые на экране свойства убраны, поэтому поле
 * такого свойства пустое, а не показывает служебное значение сброса. Канвас
 * берёт узел из эффективного дерева как есть — ему сброс нужен для отрисовки.
 * Без снятых свойств возвращает тот же узел.
 */
export function hideScreenResets<T extends BlockNode>(node: T): T {
  const properties = node.styles?.properties as Record<string, unknown> | undefined
  if (!properties || !Object.values(properties).includes(SCREEN_STYLE_RESET)) return node
  return { ...node, styles: { ...node.styles, properties: withoutScreenResets(properties) } } as T
}

/**
 * Обход записей одного breakpoint'а в порядке деплоя: правки узла → его
 * specificChildren этого экрана (рекурсивно) → children.
 */
function forEachOverride(
  node: BlockNode,
  breakpointId: string,
  visit: (holder: BlockNode, targetId: string, override: ScreenOverride) => void,
): void {
  const variation = node.variations?.[breakpointId]
  if (variation) {
    for (const [targetId, override] of Object.entries(variation.inheritedOverrides || {})) {
      if (override) visit(node, targetId, override)
    }
    for (const child of variation.specificChildren || []) {
      forEachOverride(child, breakpointId, visit)
    }
  }
  for (const child of node.children || []) {
    forEachOverride(child, breakpointId, visit)
  }
}

const isSet = (value: unknown): boolean => value !== undefined && value !== null && value !== ''

/**
 * Накладывает более позднюю запись на накопленную — как каскад правил деплоя.
 *  - hidden → `display: none`; остальные стили такой записи деплой не эмитит;
 *  - пустые значения стилей деплой пропускает — они ничего не перебивают;
 *  - заданный `display` в более поздней записи снова показывает узел.
 */
export function mergeScreenOverride(acc: ScreenOverride | undefined, next: ScreenOverride): ScreenOverride {
  const merged: ScreenOverride = { ...(acc || {}) }

  if (next.hidden) {
    merged.hidden = true
  } else if (next.styles) {
    const styles: Record<string, unknown> = { ...(merged.styles || {}) }
    for (const [key, value] of Object.entries(next.styles)) {
      if (isSet(value)) styles[key] = value
    }
    if (Object.keys(styles).length > 0) merged.styles = styles as ScreenOverride['styles']
    if (isSet((next.styles as Record<string, unknown>).display)) delete merged.hidden
  }

  if (next.attributes) merged.attributes = { ...(merged.attributes || {}), ...next.attributes }
  if (next.content !== undefined) merged.content = next.content

  return merged
}

/**
 * Итоговые экранные правки по id узла для экрана выбранного breakpoint'а:
 * все записи дерева (кто бы их ни держал) со всех экранов, чей диапазон
 * накрывает этот экран.
 */
export function resolveScreenOverrides(
  root: BlockNode,
  breakpointId: string,
  breakpoints?: BreakpointLike[],
): Map<string, ScreenOverride> {
  const resolved = new Map<string, ScreenOverride>()
  for (const bpId of applicableBreakpointIds(breakpoints, breakpointId)) {
    forEachOverride(root, bpId, (_holder, targetId, override) => {
      resolved.set(targetId, mergeScreenOverride(resolved.get(targetId), override))
    })
  }
  return resolved
}

/**
 * Правка узла на ОДНОМ экране — без каскада с других экранов: все записи этого
 * breakpoint'а, кто бы их ни держал, слитые в порядке деплоя. Это то, что
 * деплой эмитит для узла внутри @media данного экрана.
 */
export function resolveOwnScreenOverride(
  root: BlockNode,
  nodeId: string,
  breakpointId: string,
): ScreenOverride | undefined {
  let merged: ScreenOverride | undefined
  forEachOverride(root, breakpointId, (_holder, targetId, override) => {
    if (targetId === nodeId) merged = mergeScreenOverride(merged, override)
  })
  return merged
}

/** Родитель узла в базовом дереве (правки пишутся в его variations). */
export function findBaseParent(node: BlockNode, childId: string): BlockNode | null {
  for (const child of node.children || []) {
    if (child.id === childId) return node
    const found = findBaseParent(child, childId)
    if (found) return found
  }
  return null
}

/**
 * Перед записью правки узла на экране: собирает все его записи этого экрана к
 * законному владельцу (родитель; для корня — сам корень) и убирает «чужие».
 *
 * Зачем: редактор пишет правку в variations родителя, а деплой при конфликте
 * берёт запись, эмитированную позже. Если «чужая» запись лежит глубже по дереву,
 * она перебивала бы правку пользователя — на канвасе ничего не менялось бы.
 * После сборки у узла на этом экране ровно одна запись, и правка действует.
 *
 * Значения сливаются в порядке каскада деплоя, поэтому вид узла не меняется.
 * Возвращает новый корень; если «чужих» записей нет — вход как есть (та же ссылка).
 * Узел вне базового дерева (specificChildren) не трогаем.
 */
export function adoptStrayOverrides(root: BlockNode, nodeId: string, breakpointId: string): BlockNode {
  const ownerId = root.id === nodeId ? root.id : findBaseParent(root, nodeId)?.id
  if (!ownerId) return root

  let merged: ScreenOverride | undefined
  let hasStray = false
  forEachOverride(root, breakpointId, (holder, targetId, override) => {
    if (targetId !== nodeId) return
    merged = mergeScreenOverride(merged, override)
    if (holder.id !== ownerId) hasStray = true
  })
  if (!hasStray || !merged) return root
  const adopted: ScreenOverride = merged

  const rewrite = (node: BlockNode): BlockNode => {
    let next = node

    const variation = node.variations?.[breakpointId]
    const isOwner = node.id === ownerId
    const holdsEntry = Boolean(variation?.inheritedOverrides && nodeId in variation.inheritedOverrides)
    const specific = variation?.specificChildren
    const nextSpecific = specific?.map(rewrite)
    const specificChanged = Boolean(specific && nextSpecific!.some((c, i) => c !== specific[i]))

    if (isOwner || holdsEntry || specificChanged) {
      const nextVariation: BlockNodeVariation = { ...(variation || {}) }
      if (isOwner || holdsEntry) {
        const overrides = { ...(variation?.inheritedOverrides || {}) }
        if (isOwner) overrides[nodeId] = adopted
        else delete overrides[nodeId]
        nextVariation.inheritedOverrides = overrides
      }
      if (specificChanged) nextVariation.specificChildren = nextSpecific
      next = {
        ...next,
        variations: { ...(node.variations || {}), [breakpointId]: nextVariation },
      }
    }

    const children = node.children || []
    const nextChildren = children.map(rewrite)
    if (nextChildren.some((c, i) => c !== children[i])) {
      next = { ...next, children: nextChildren }
    }
    return next
  }

  return rewrite(root)
}
