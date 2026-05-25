/**
 * Чистая логика модалки разрешения расхождений linked-блоков (LinkedChangesModal).
 *
 * Вынесена из компонента, чтобы покрыть тестами без DOM (в проекте нет jsdom —
 * тестируются чистые функции, см. MultiValueInput.parseMultiValue).
 */
import type { ChangedLinkedInstance, LinkedDecision } from '@/shared/api'

/** Применяет действие ко всем выбранным инстансам, возвращая новую карту решений. */
export function applyDecisionToSelected(
  decisions: Record<string, LinkedDecision>,
  selectedIds: Iterable<string>,
  action: LinkedDecision
): Record<string, LinkedDecision> {
  const next = { ...decisions }
  for (const id of selectedIds) next[id] = action
  return next
}

/** Делит инстансы на нерешённые (pending) и решённые (decided) по карте решений. */
export function partitionInstances(
  instances: ChangedLinkedInstance[],
  decisions: Record<string, LinkedDecision>
): { pending: ChangedLinkedInstance[]; decided: ChangedLinkedInstance[] } {
  const pending: ChangedLinkedInstance[] = []
  const decided: ChangedLinkedInstance[] = []
  for (const inst of instances) {
    if (inst.instanceId in decisions) decided.push(inst)
    else pending.push(inst)
  }
  return { pending, decided }
}

/** Все ли изменённые инстансы получили решение. */
export function isAllResolved(
  instances: ChangedLinkedInstance[],
  decisions: Record<string, LinkedDecision>
): boolean {
  return instances.length > 0 && instances.every((i) => i.instanceId in decisions)
}

/** Русское склонение слова «изменение». */
export function pluralChanges(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'изменение'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'изменения'
  return 'изменений'
}

/** Русское склонение слова «блок». */
export function pluralBlocks(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'блок'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'блока'
  return 'блоков'
}
