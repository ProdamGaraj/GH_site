/**
 * Модалка разрешения расхождений linked-блоков при сохранении страницы.
 *
 * Контекст. Перед сохранением страницы backend (`/pages/:id/save-preflight`) возвращает
 * список linked-инстансов, содержимое которых разошлось с библиотекой. Пользователь для
 * каждого блока выбирает одно из трёх действий:
 *   🟢 push   — внести изменения в библиотеку (отразятся на всех страницах);
 *   🟡 static — сделать блок статическим (отвязать от библиотеки, заморозить тут);
 *   🔴 revert — отменить изменения (вернуть версию из библиотеки).
 *
 * UX (по требованию владельца):
 *  - изменения сгруппированы по блоку; чекбокс — на уровне блока (выбирает блок целиком
 *    со всеми его внутренними изменениями), детали можно раскрыть;
 *  - выбираем N блоков, жмём одну из трёх кнопок — действие применяется к ним, и они
 *    уходят из списка «не решённых» в «решённые»;
 *  - меню остаётся открытым; нерешённые блоки при сохранении остаются pending
 *    (страница помечается несохранённой, правки живут только в памяти редактора).
 */
import { useEffect, useState } from 'react'
import { X, ChevronRight, ChevronDown, Library, Pin, Undo2, Check } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { cn } from '@/shared/utils'
import type { ChangedLinkedInstance, LinkedDecision } from '@/shared/api'
import {
  applyDecisionToSelected,
  partitionInstances,
  pluralChanges,
  pluralBlocks,
} from '../utils/linkedDecisions'

interface LinkedChangesModalProps {
  isOpen: boolean
  changedInstances: ChangedLinkedInstance[]
  /** Сохранить страницу с принятыми решениями. Нерешённые блоки остаются pending. */
  onCommit: (decisions: Record<string, LinkedDecision>) => void
  /** Отмена сохранения целиком — ничего не пишется. */
  onClose: () => void
}

const ACTION_META: Record<LinkedDecision, { label: string; short: string; cls: string; icon: typeof Library }> = {
  push: { label: 'Внести в библиотеку', short: 'В библиотеку', cls: 'bg-green-600 hover:bg-green-700', icon: Library },
  static: { label: 'Сделать статическим', short: 'Статический', cls: 'bg-amber-500 hover:bg-amber-600', icon: Pin },
  revert: { label: 'Отменить изменения', short: 'Отменено', cls: 'bg-red-600 hover:bg-red-700', icon: Undo2 },
}

export function LinkedChangesModal({ isOpen, changedInstances, onCommit, onClose }: LinkedChangesModalProps) {
  const [decisions, setDecisions] = useState<Record<string, LinkedDecision>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Сброс состояния при каждом открытии / смене набора блоков.
  useEffect(() => {
    if (isOpen) {
      setDecisions({})
      setSelected(new Set())
      setExpanded(new Set())
    }
  }, [isOpen, changedInstances])

  if (!isOpen) return null

  const { pending, decided } = partitionInstances(changedInstances, decisions)

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const allPendingSelected = pending.length > 0 && pending.every((i) => selected.has(i.instanceId))
  const toggleSelectAll = () => {
    setSelected(allPendingSelected ? new Set() : new Set(pending.map((i) => i.instanceId)))
  }

  const applyAction = (action: LinkedDecision) => {
    if (selected.size === 0) return
    setDecisions((prev) => applyDecisionToSelected(prev, selected, action))
    setSelected(new Set())
  }

  const undoDecision = (id: string) => {
    setDecisions((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[680px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <Library className="text-primary-600" size={22} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Изменённые блоки библиотеки</h2>
              <p className="text-sm text-gray-500">
                Выберите блоки и решите, что сделать с изменениями. Нерешённые останутся несохранёнными.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" title="Отменить сохранение">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Не решённые */}
          {pending.length > 0 && (
            <div>
              <label className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={allPendingSelected} onChange={toggleSelectAll} className="rounded" />
                Выбрать все ({pending.length})
              </label>
              <div className="border border-gray-200 rounded-lg divide-y">
                {pending.map((inst) => {
                  const isOpen = expanded.has(inst.instanceId)
                  return (
                    <div key={inst.instanceId} className="p-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(inst.instanceId)}
                          onChange={() => toggleSelect(inst.instanceId)}
                          className="rounded"
                        />
                        <button
                          onClick={() => toggleExpand(inst.instanceId)}
                          className="flex items-center gap-1 flex-1 text-left"
                        >
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <span className="font-medium text-gray-900">{inst.blockName}</span>
                          <span className="text-xs text-gray-500">
                            ({inst.changes.length} {pluralChanges(inst.changes.length)})
                          </span>
                        </button>
                      </div>
                      {isOpen && (
                        <ul className="mt-2 ml-8 space-y-1 text-sm text-gray-600 list-disc list-inside">
                          {inst.changes.map((c, idx) => (
                            <li key={idx}>{c.label}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {pending.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <Check size={16} /> Все блоки обработаны.
            </div>
          )}

          {/* Решённые */}
          {decided.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Решено ({decided.length})</p>
              <div className="border border-gray-200 rounded-lg divide-y">
                {decided.map((inst) => {
                  const meta = ACTION_META[decisions[inst.instanceId]]
                  return (
                    <div key={inst.instanceId} className="flex items-center gap-2 p-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-white', meta.cls)}>
                        <meta.icon size={12} /> {meta.short}
                      </span>
                      <span className="flex-1 text-gray-900">{inst.blockName}</span>
                      <button
                        onClick={() => undoDecision(inst.instanceId)}
                        className="p-1 text-gray-400 hover:text-gray-700"
                        title="Вернуть в список"
                      >
                        <Undo2 size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Action bar — три кнопки для выбранных */}
        <div className="px-6 py-3 border-t bg-gray-50 flex flex-wrap gap-2">
          {(['push', 'static', 'revert'] as LinkedDecision[]).map((action) => {
            const meta = ACTION_META[action]
            return (
              <button
                key={action}
                onClick={() => applyAction(action)}
                disabled={selected.size === 0}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  meta.cls
                )}
              >
                <meta.icon size={16} /> {meta.label}
              </button>
            )
          })}
          <span className="ml-auto self-center text-xs text-gray-500">
            Выбрано: {selected.size}
          </span>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500">
            {pending.length > 0
              ? `${pending.length} ${pluralBlocks(pending.length)} останутся несохранёнными`
              : 'Все изменения распределены'}
          </span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={() => onCommit(decisions)}>
              <Check size={16} className="mr-2" /> Сохранить
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
