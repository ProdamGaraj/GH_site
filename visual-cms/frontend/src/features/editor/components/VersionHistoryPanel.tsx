import { useState, useEffect, useCallback } from 'react'
import { History, RotateCcw, Tag, Trash2, ChevronDown, ChevronUp, Clock, Save, Rocket, X, Check, Pencil, Flag, FileX } from 'lucide-react'
import { versionApi, blockVersionApi } from '@/shared/api'
import type { Block, Page } from '@/shared/types'

/**
 * История версий — общая для страниц и блоков. Что именно хранится и как
 * восстанавливается, решает адаптер (pageVersions / blockVersions ниже).
 *
 * У страницы версия — снимок при сохранении. У блока — его состояние до
 * изменения: savedAt — когда это состояние сохранили, createdAt — когда его
 * заменили. Так видно, каким блок был в нужный момент.
 */
export interface VersionHistoryItem {
  id: string
  version: number
  source: string
  createdAt: string
  savedAt?: string | null
  label?: string | null
  name?: string
  status?: string
}

export interface VersionHistoryAdapter<R> {
  /** «страницу» / «блок» — в подтверждениях. */
  subjectAccusative: string
  list: () => Promise<VersionHistoryItem[]>
  snapshot: () => Promise<unknown>
  restore: (versionId: string) => Promise<R>
  updateLabel: (versionId: string, label: string) => Promise<unknown>
  remove: (versionId: string) => Promise<unknown>
}

/** Страница: снимки при сохранении, деплое и по кнопке. */
export function pageVersions(pageId: string): VersionHistoryAdapter<Page> {
  return {
    subjectAccusative: 'страницу',
    list: () => versionApi.getAll(pageId) as Promise<VersionHistoryItem[]>,
    snapshot: () => versionApi.create(pageId),
    restore: (versionId) => versionApi.restore(pageId, versionId).then((r) => r.page),
    updateLabel: (versionId, label) => versionApi.updateLabel(pageId, versionId, label),
    remove: (versionId) => versionApi.delete(pageId, versionId),
  }
}

/** Блок: состояние до каждого изменения (пишет база), снимки по кнопке. */
export function blockVersions(blockId: string): VersionHistoryAdapter<Block> {
  return {
    subjectAccusative: 'блок',
    list: () => blockVersionApi.getAll(blockId) as Promise<VersionHistoryItem[]>,
    snapshot: () => blockVersionApi.create(blockId),
    restore: (versionId) => blockVersionApi.restore(blockId, versionId).then((r) => r.block),
    updateLabel: (versionId, label) => blockVersionApi.updateLabel(blockId, versionId, label),
    remove: (versionId) => blockVersionApi.delete(blockId, versionId),
  }
}

const SOURCE_CONFIG: Record<string, { icon: typeof Save; label: string; color: string }> = {
  manual: { icon: Save, label: 'Снимок', color: 'text-blue-600 bg-blue-50' },
  auto: { icon: Clock, label: 'Автосохранение', color: 'text-gray-600 bg-gray-50' },
  deploy: { icon: Rocket, label: 'Деплой', color: 'text-green-600 bg-green-50' },
  update: { icon: Pencil, label: 'До изменения', color: 'text-gray-600 bg-gray-50' },
  restore: { icon: RotateCcw, label: 'До восстановления', color: 'text-amber-700 bg-amber-50' },
  delete: { icon: FileX, label: 'До удаления', color: 'text-red-600 bg-red-50' },
  initial: { icon: Flag, label: 'Начало истории', color: 'text-violet-600 bg-violet-50' },
}

const UNKNOWN_SOURCE = { icon: Clock, label: 'Версия', color: 'text-gray-600 bg-gray-50' }

export function formatVersionDate(dateStr: string, now = new Date()): string {
  const d = new Date(dateStr)
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин. назад`
  if (diffHour < 24) return `${diffHour} ч. назад`
  if (diffDay < 7) return `${diffDay} дн. назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Точное время — для «сохранено … · заменено …». */
function exactTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface VersionHistoryPanelProps<R> {
  adapter: VersionHistoryAdapter<R>
  /** Подпись текущего состояния, например «v12». */
  currentLabel?: string
  onRestore: (restored: R) => void
  onClose: () => void
}

export function VersionHistoryPanel<R>({ adapter, currentLabel, onRestore, onClose }: VersionHistoryPanelProps<R>) {
  const [versions, setVersions] = useState<VersionHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [labelValue, setLabelValue] = useState('')
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)

  const loadVersions = useCallback(async () => {
    try {
      setLoading(true)
      setVersions(await adapter.list())
    } catch (err) {
      console.error('Failed to load versions:', err)
    } finally {
      setLoading(false)
    }
    // Адаптер вызывающий держит в useMemo: новый — значит, другая страница или блок.
  }, [adapter])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  const handleRestore = async (versionId: string) => {
    if (!confirm(`Восстановить ${adapter.subjectAccusative} до этой версии? Текущее состояние сохранится в истории — восстановление можно отменить.`)) return
    try {
      setRestoring(versionId)
      onRestore(await adapter.restore(versionId))
      await loadVersions()
    } catch (err) {
      console.error('Failed to restore version:', err)
      alert('Не удалось восстановить: ' + ((err as Error)?.message || 'ошибка'))
    } finally {
      setRestoring(null)
    }
  }

  const handleCreateSnapshot = async () => {
    try {
      setCreatingSnapshot(true)
      await adapter.snapshot()
      await loadVersions()
    } catch (err) {
      console.error('Failed to create snapshot:', err)
    } finally {
      setCreatingSnapshot(false)
    }
  }

  const handleDelete = async (versionId: string) => {
    if (!confirm('Удалить эту версию?')) return
    try {
      await adapter.remove(versionId)
      setVersions((prev) => prev.filter((v) => v.id !== versionId))
    } catch (err) {
      console.error('Failed to delete version:', err)
    }
  }

  const handleSaveLabel = async (versionId: string) => {
    try {
      await adapter.updateLabel(versionId, labelValue)
      setVersions((prev) => prev.map((v) => (v.id === versionId ? { ...v, label: labelValue } : v)))
      setEditingLabel(null)
    } catch (err) {
      console.error('Failed to update label:', err)
    }
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden" data-testid="version-history">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">История версий</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-500" aria-label="Закрыть историю">
          <X className="w-4 h-4" />
        </button>
      </div>

      {currentLabel && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-700">Текущая версия: <span className="font-semibold">{currentLabel}</span></p>
        </div>
      )}

      {/* Create snapshot button */}
      <div className="px-4 py-2 border-b border-gray-200">
        <button
          onClick={handleCreateSnapshot}
          disabled={creatingSnapshot}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <Tag className="w-3.5 h-3.5" />
          {creatingSnapshot ? 'Сохранение...' : 'Создать снимок'}
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 px-4">
            <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Нет сохранённых версий</p>
            <p className="text-xs text-gray-400 mt-1">Версии появляются при сохранении изменений</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {versions.map((v) => {
              const cfg = SOURCE_CONFIG[v.source] ?? UNKNOWN_SOURCE
              const Icon = cfg.icon
              const isExpanded = expandedId === v.id

              return (
                <div key={v.id} className="group" data-testid={`version-${v.version}`}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className={`mt-0.5 p-1.5 rounded ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {editingLabel === v.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              value={labelValue}
                              onChange={(e) => setLabelValue(e.target.value)}
                              className="text-sm border rounded px-1.5 py-0.5 w-32 text-gray-900 bg-white"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveLabel(v.id)
                                if (e.key === 'Escape') setEditingLabel(null)
                              }}
                            />
                            <button onClick={() => handleSaveLabel(v.id)} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingLabel(null)} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-gray-900 truncate">{v.label || `v${v.version}`}</span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {v.savedAt
                          ? `сохранено ${exactTime(v.savedAt)} · заменено ${exactTime(v.createdAt)}`
                          : formatVersionDate(v.createdAt)}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 mt-1" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">v{v.version}</span>
                        {v.status && (
                          <>
                            <span className="text-xs text-gray-300">•</span>
                            <span className="text-xs text-gray-500">{v.status}</span>
                          </>
                        )}
                        {v.name && (
                          <>
                            <span className="text-xs text-gray-300">•</span>
                            <span className="text-xs text-gray-500 truncate">{v.name}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2.5">
                        <button
                          onClick={() => handleRestore(v.id)}
                          disabled={restoring === v.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {restoring === v.id ? 'Восстановление...' : 'Восстановить'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingLabel(v.id)
                            setLabelValue(v.label || '')
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          Метка
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(v.id)
                          }}
                          aria-label="Удалить версию"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
