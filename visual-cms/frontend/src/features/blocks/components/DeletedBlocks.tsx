import React, { useEffect, useState } from 'react'
import { ArchiveRestore, Loader2, X } from 'lucide-react'
import { blockVersionApi } from '@/shared/api'
import type { DeletedBlock } from '@/shared/types'

/**
 * Удалённые блоки библиотеки: последняя версия каждого удалённого блока
 * (её пишет база при удалении). Восстановление возвращает блок с прежним id —
 * страницы, где он стоял, снова его находят.
 */
export const DeletedBlocks: React.FC<{ onRestored: () => void }> = ({ onRestored }) => {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<DeletedBlock[] | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  const load = () =>
    blockVersionApi
      .getDeleted()
      .then(setItems)
      .catch((err) => {
        console.error('Failed to load deleted blocks:', err)
        setItems([])
      })

  useEffect(() => {
    if (open) load()
  }, [open])

  const restore = async (item: DeletedBlock) => {
    try {
      setRestoring(item.versionId)
      await blockVersionApi.restoreDeleted(item.versionId)
      setItems((prev) => (prev ?? []).filter((d) => d.versionId !== item.versionId))
      onRestored()
    } catch (err) {
      alert('Не удалось восстановить блок: ' + ((err as Error)?.message || 'ошибка'))
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700"
      >
        <ArchiveRestore size={16} /> Удалённые блоки
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-96 rounded-lg border border-gray-200 bg-white shadow-lg" data-testid="deleted-blocks">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Удалённые блоки</span>
            <button type="button" onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Закрыть">
              <X size={14} />
            </button>
          </div>
          {items === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">Удалённых блоков нет</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {items.map((item) => (
                <li key={item.versionId} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      удалён {new Date(item.deletedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restore(item)}
                    disabled={restoring === item.versionId}
                    className="shrink-0 px-2.5 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                  >
                    {restoring === item.versionId ? 'Восстановление...' : 'Восстановить'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
