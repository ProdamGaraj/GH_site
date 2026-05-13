import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Link2, Trash2, Copy, MousePointerClick } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import type { BlockNode } from '@/shared/types'
import { isLinkedSlide } from '@/features/editor/utils/staticSlidesHelper'
import { getHybridStaticDisplayName } from '@/features/editor/utils/hybridStaticHelper'

interface HybridStaticRowProps {
  slide: BlockNode
  /** Глобальный 1-based индекс среди ВСЕХ слайдов (для нумерации). */
  displayIndex: number
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
}

/**
 * Карточка hybrid-static-слайда в едином списке SlidesPanel.
 *
 * Bordered visually отличается от GenericSlideRow цветовой меткой «STATIC»,
 * чтобы пользователь видел разницу: статический блок vs элемент массива из binding.
 */
export const HybridStaticRow: React.FC<HybridStaticRowProps> = ({
  slide,
  displayIndex,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const linked = isLinkedSlide(slide)
  const name = getHybridStaticDisplayName(slide)
  const childCount = slide.children?.length ?? 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        'flex items-center gap-1.5 rounded border bg-white px-2 py-1.5 ' +
        (selected
          ? 'border-emerald-500 ring-1 ring-emerald-200'
          : 'border-emerald-300 hover:border-emerald-400')
      }
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
        aria-label="Перетащить"
      >
        <GripVertical size={14} />
      </button>
      <span className="text-xs font-mono text-gray-400 w-5 text-right">{displayIndex}</span>
      <span
        className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-emerald-100 text-emerald-700"
        title="Статический слайд (не из массива)"
      >
        Static
      </span>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex items-center gap-1.5 text-left text-sm min-w-0"
        title={linked ? 'Linked → library block' : 'Открыть в редакторе'}
      >
        {linked ? (
          <Link2 size={13} className="shrink-0 text-blue-600" />
        ) : (
          <MousePointerClick size={13} className="shrink-0 text-gray-400" />
        )}
        <span className="truncate text-gray-800">{name}</span>
        {!linked && childCount > 0 && (
          <span className="text-[10px] text-gray-400 shrink-0">({childCount})</span>
        )}
      </button>
      <Button variant="ghost" size="sm" onClick={onDuplicate} title="Дублировать">
        <Copy size={13} />
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} title="Удалить">
        <Trash2 size={13} className="text-red-600" />
      </Button>
    </div>
  )
}
