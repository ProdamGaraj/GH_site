/**
 * BlockPicker — модалка выбора блока из библиотеки (isReusable=true).
 *
 * Используется везде, где нужно вставить ссылку на library-блок:
 * - SlidesPanel (статический режим карусели — добавить блок-слайд)
 * - в перспективе: layer-actions, prefab-палитра и т.п.
 *
 * Возвращает выбранный блок целиком (не только id) — caller сам решает
 * как формировать узел: linked (metadata.linkedBlockId) или copy.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Box, Calendar, Search, Sparkles, X } from 'lucide-react'
import { blockApi } from '@/shared/api'
import { cn } from '@/shared/utils'
import type { Block } from '@/shared/types'
import { filterBlocks, formatBlockDate } from './blockPickerHelpers'

export type InsertMode = 'linked' | 'copy'

export interface BlockPickerSelection {
  block: Block
  mode: InsertMode
}

interface BlockPickerProps {
  isOpen: boolean
  onClose: () => void
  onPick: (selection: BlockPickerSelection) => void
  /** Заголовок модалки. По умолчанию "Выбрать блок из библиотеки". */
  title?: string
  /** Скрыть переключатель linked/copy и зафиксировать режим. */
  forcedMode?: InsertMode
  /** Дополнительный фильтр блоков (например, только определённого type). */
  filter?: (block: Block) => boolean
}

export const BlockPicker: React.FC<BlockPickerProps> = ({
  isOpen,
  onClose,
  onPick,
  title = 'Выбрать блок из библиотеки',
  forcedMode,
  filter,
}) => {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<InsertMode>(forcedMode ?? 'linked')

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    setError(null)
    blockApi
      .getReusable()
      .then((data) => {
        if (cancelled) return
        setBlocks(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Не удалось загрузить блоки')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  // Сброс search/mode при закрытии — иначе следующее открытие покажет старый стейт
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      if (!forcedMode) setMode('linked')
    }
  }, [isOpen, forcedMode])

  const filtered = useMemo(
    () => filterBlocks(blocks, search, filter),
    [blocks, search, filter]
  )

  if (!isOpen) return null

  const handlePick = (block: Block) => {
    onPick({ block, mode })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blockpicker-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-[820px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 id="blockpicker-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar: search + mode toggle */}
        <div className="px-6 py-3 border-b flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию или тегу..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          {!forcedMode && (
            <div
              className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg"
              role="radiogroup"
              aria-label="Режим вставки"
            >
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'linked'}
                onClick={() => setMode('linked')}
                title="Связанная вставка — изменения в библиотеке будут отражаться здесь"
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  mode === 'linked'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                Связанный
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'copy'}
                onClick={() => setMode('copy')}
                title="Копия — независимая, дальнейшие изменения библиотеки не повлияют"
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  mode === 'copy'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                Копия
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center text-gray-500 py-12">Загрузка…</div>
          )}
          {error && !loading && (
            <div className="text-center text-red-600 py-12">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              {blocks.length === 0
                ? 'В библиотеке пока нет переиспользуемых блоков.'
                : 'Ничего не найдено.'}
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-2 gap-3" data-testid="blockpicker-grid">
              {filtered.map((block) => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => handlePick(block)}
                  className="text-left border border-gray-200 rounded-lg overflow-hidden hover:border-primary-400 hover:shadow transition-all bg-white"
                  data-testid={`blockpicker-item-${block.id}`}
                >
                  <div className="h-28 bg-gray-50 flex items-center justify-center overflow-hidden">
                    {block.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={block.thumbnail}
                        alt={block.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Box className="w-10 h-10 text-gray-300" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900 text-sm truncate flex-1">
                        {block.name}
                      </h3>
                      {block.isTemplate && (
                        <Sparkles size={12} className="text-purple-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={11} />
                      <span>{formatBlockDate(block.updatedAt)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t text-xs text-gray-500 bg-gray-50">
          {mode === 'linked' ? (
            <>
              <strong className="text-gray-700">Связанный:</strong> изменения блока в
              библиотеке будут автоматически отражаться здесь.
            </>
          ) : (
            <>
              <strong className="text-gray-700">Копия:</strong> создаётся независимая
              копия — будущие изменения библиотеки не повлияют.
            </>
          )}
        </div>
      </div>
    </div>
  )
}

