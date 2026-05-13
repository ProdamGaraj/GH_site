/**
 * RepeatTemplatePicker — выбор шаблона слайда для repeat-режима карусели.
 *
 * В repeat-режиме шаблоном служит ПЕРВЫЙ child track-узла (см. repeatTemplateHelper).
 * Этот компонент даёт UI поверх инварианта:
 *   - показывает текущий template (linked / inline / отсутствует)
 *   - позволяет заменить template через BlockPicker (linked или copy)
 *   - позволяет detach (linked → inline) — подгружает full structure из БД
 *     и заменяет placeholder на копию.
 *
 * Изменения применяются через editorSlice.replaceChildren — атомарно одним
 * history-step'ом, так что Undo возвращает предыдущий template целиком.
 */
import React, { useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { replaceChildren } from '@/features/editor/editorSlice'
import { Box, Link2, Replace, Unlink } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { blockApi } from '@/shared/api'
import type { Block, BlockNode } from '@/shared/types'
import { generateId } from '@/shared/utils'
import { BlockPicker, type BlockPickerSelection } from '@/features/editor/components/BlockPicker'
import {
  createBlockReferenceNode,
} from '@/features/editor/utils/carouselHelpers'
import {
  detachLinkedTemplate,
  getRepeatTemplate,
  getRepeatTemplateDisplayName,
  getRepeatTemplateKind,
} from '@/features/editor/utils/repeatTemplateHelper'

interface RepeatTemplatePickerProps {
  /** Track-узел карусели — у него ровно один child = template (или ноль если не настроен). */
  track: BlockNode
}

const SLIDE_ATTR = 'data-carousel-slide'

export const RepeatTemplatePicker: React.FC<RepeatTemplatePickerProps> = ({ track }) => {
  const dispatch = useAppDispatch()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detaching, setDetaching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const template = getRepeatTemplate(track)
  const kind = getRepeatTemplateKind(track)
  const displayName = getRepeatTemplateDisplayName(track)
  const linkedId = template?.metadata?.linkedBlockId

  const handlePick = (selection: BlockPickerSelection) => {
    const { block, mode } = selection
    // Гарантируем data-carousel-slide на template — иначе CarouselRuntime
    // не распознает клонированные слайды.
    const node = createBlockReferenceNode(block as Block, mode, {
      generateId,
      extraAttributes: { [SLIDE_ATTR]: 'true' },
    })
    // Заменяем ВЕСЬ children трека (даже если там был мусор — лишние слайды
    // в repeat-режиме игнорируются runtime'ом, чистим сразу).
    if (
      track.children.length > 1 &&
      !confirm(
        `В треке сейчас ${track.children.length} элемент(а/ов). В repeat-режиме используется только первый — ` +
          `остальные будут удалены. Продолжить?`
      )
    ) {
      return
    }
    dispatch(replaceChildren({ parentId: track.id, children: [node], selectFirst: true }))
  }

  const handleDetach = async () => {
    if (!template || !linkedId) return
    if (!confirm('Превратить шаблон в независимую копию? После этого изменения в библиотеке не будут отражаться здесь.')) {
      return
    }
    setDetaching(true)
    setError(null)
    try {
      const block = await blockApi.getById(linkedId)
      if (!block?.structure) {
        throw new Error('Блок в библиотеке не содержит структуры')
      }
      const inline = detachLinkedTemplate(template, block.structure, block.name || 'Block', generateId)
      // Сохраняем атрибут data-carousel-slide на всякий случай (detachLinkedTemplate
      // уже пробрасывает атрибуты placeholder'а, но если placeholder его не имел —
      // выставим явно, чтобы runtime работал корректно).
      if (inline.attributes?.[SLIDE_ATTR] !== 'true') {
        inline.attributes = { ...(inline.attributes || {}), [SLIDE_ATTR]: 'true' }
      }
      dispatch(replaceChildren({ parentId: track.id, children: [inline], selectFirst: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить блок из библиотеки')
    } finally {
      setDetaching(false)
    }
  }

  return (
    <div className="rounded border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {kind === 'linked' ? (
            <Link2 size={16} className="text-purple-600 flex-shrink-0" />
          ) : (
            <Box size={16} className="text-gray-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-gray-500">Шаблон слайда</div>
            <div className="text-sm font-medium text-gray-900 truncate">
              {template ? displayName || '(без имени)' : 'Не задан'}
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPickerOpen(true)}
          title={template ? 'Заменить шаблон' : 'Выбрать шаблон из библиотеки'}
        >
          {template ? (
            <>
              <Replace size={14} className="mr-1" />
              Заменить
            </>
          ) : (
            <>
              <Box size={14} className="mr-1" />
              Выбрать
            </>
          )}
        </Button>
      </div>

      {kind === 'linked' && (
        <div className="flex items-center justify-between text-xs text-purple-700 bg-purple-50 border border-purple-100 rounded px-2 py-1.5">
          <span>Связан с блоком в библиотеке — изменения там отразятся здесь.</span>
          <button
            type="button"
            onClick={handleDetach}
            disabled={detaching}
            className="ml-2 inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 underline disabled:opacity-50"
            title="Превратить в независимую копию"
          >
            <Unlink size={12} />
            {detaching ? 'Отвязываем…' : 'Отвязать'}
          </button>
        </div>
      )}

      {kind === 'inline' && (
        <div className="text-xs text-gray-500">
          Inline-шаблон. Редактируйте напрямую в дереве слоёв.
        </div>
      )}

      {!template && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          Шаблон не задан. Выберите блок из библиотеки или вставьте узел в трек вручную.
        </div>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      <BlockPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePick}
        title={template ? 'Заменить шаблон слайда' : 'Выбрать шаблон слайда'}
      />
    </div>
  )
}
