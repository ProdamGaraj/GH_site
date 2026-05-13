import React, { useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import {
  deleteNode,
  insertPreparedNode,
  reorderNode,
  selectNode,
  selectSelectedNode,
} from '@/features/editor/editorSlice'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Link2, Trash2, Copy, Plus, MousePointerClick } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import type { BlockNode, Block } from '@/shared/types'
import { generateId } from '@/shared/utils'
import { BlockPicker, type BlockPickerSelection } from '@/features/editor/components/BlockPicker'
import {
  createBlockReferenceNode,
  deepCloneNode,
} from '@/features/editor/utils/carouselHelpers'
import {
  getSlideChildren,
  getSlideDisplayName,
  isLinkedSlide,
  withSlideAttribute,
} from '@/features/editor/utils/staticSlidesHelper'

interface StaticSlidesPanelProps {
  /** Track-узел карусели — его children и есть слайды. */
  track: BlockNode
}

/**
 * Static-режим карусели: гетерогенные слайды.
 *
 * UI-обёртка над editorSlice: добавление через BlockPicker (linked / copy),
 * перестановка drag-n-drop, удаление, дублирование. Сами слайды редактируются
 * как обычные ноды через основной редактор (клик "→" выделяет в дереве).
 */
export const StaticSlidesPanel: React.FC<StaticSlidesPanelProps> = ({ track }) => {
  const dispatch = useAppDispatch()
  const selected = useAppSelector(selectSelectedNode)
  const [pickerOpen, setPickerOpen] = useState(false)

  const slides = useMemo(() => getSlideChildren(track), [track])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handlePick = (selection: BlockPickerSelection) => {
    const { block, mode } = selection
    const node = createBlockReferenceNode(block as Block, mode, {
      generateId,
      extraAttributes: { 'data-carousel-slide': 'true' },
    })
    dispatch(insertPreparedNode({ parentId: track.id, node }))
  }

  const handleDuplicate = (slide: BlockNode, index: number) => {
    // Глубокая копия с remap id (даже для linked-плейсхолдера — иначе будет дубль id).
    const copy = deepCloneNode(slide, generateId)
    const withAttr = withSlideAttribute(copy)
    dispatch(insertPreparedNode({ parentId: track.id, node: withAttr, position: index + 1 }))
  }

  const handleDelete = (slide: BlockNode) => {
    if (!confirm(`Удалить слайд "${getSlideDisplayName(slide, 0)}"?`)) return
    dispatch(deleteNode(slide.id))
  }

  const handleSelect = (slide: BlockNode) => {
    dispatch(selectNode(slide.id))
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const fromIdx = slides.findIndex(s => s.id === active.id)
    const toIdx = slides.findIndex(s => s.id === over.id)
    if (fromIdx === -1 || toIdx === -1) return
    // arrayMove даёт нам целевой индекс в новом массиве — это и есть newIndex для reducer'а.
    const reordered = arrayMove(slides, fromIdx, toIdx)
    const newIndex = reordered.findIndex(s => s.id === active.id)
    dispatch(reorderNode({ nodeId: String(active.id), parentId: track.id, newIndex }))
  }

  return (
    <div className="space-y-3">
      <div className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
        <div className="font-medium mb-0.5">Режим: статические слайды</div>
        <div className="text-blue-800/80">
          Каждый слайд — отдельный блок. Можно вставить из библиотеки (как ссылку или копию)
          или вложить любой существующий блок прямо в трек.
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {slides.length === 0 && (
              <div className="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                Пока нет слайдов. Добавьте первый из библиотеки.
              </div>
            )}
            {slides.map((slide, i) => (
              <SlideRow
                key={slide.id}
                slide={slide}
                index={i}
                selected={slide.id === selected?.id}
                onSelect={() => handleSelect(slide)}
                onDelete={() => handleDelete(slide)}
                onDuplicate={() => handleDuplicate(slide, i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => setPickerOpen(true)}
        className="w-full"
      >
        <Plus size={14} className="mr-1" /> Добавить из библиотеки
      </Button>

      <BlockPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePick}
        title="Добавить слайд из библиотеки"
      />
    </div>
  )
}

interface SlideRowProps {
  slide: BlockNode
  index: number
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
}

const SlideRow: React.FC<SlideRowProps> = ({
  slide,
  index,
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
  const name = getSlideDisplayName(slide, index)
  const childCount = slide.children?.length ?? 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        'flex items-center gap-1.5 rounded border bg-white px-2 py-1.5 ' +
        (selected ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300')
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
      <span className="text-xs font-mono text-gray-400 w-5 text-right">{index + 1}</span>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex items-center gap-1.5 text-left text-sm min-w-0"
        title={linked ? `Linked → library block` : 'Открыть в редакторе'}
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
