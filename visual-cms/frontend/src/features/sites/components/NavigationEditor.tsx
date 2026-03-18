import React, { useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import type { NavigationItem, Page } from '@/shared/types'

interface NavigationEditorProps {
  items: NavigationItem[]
  onChange: (items: NavigationItem[]) => void
  pages: Page[]
}

const generateId = () => crypto.randomUUID()

export const NavigationEditor: React.FC<NavigationEditorProps> = ({ items, onChange, pages }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const addItem = () => {
    onChange([...items, { id: generateId(), label: 'Новый пункт' }])
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, updates: Partial<NavigationItem>) => {
    onChange(items.map((item, i) => i === index ? { ...item, ...updates } : item))
  }

  const addSubItem = (parentIndex: number) => {
    const updated = [...items]
    const parent = { ...updated[parentIndex] }
    parent.children = [...(parent.children || []), { id: generateId(), label: 'Подпункт' }]
    updated[parentIndex] = parent
    onChange(updated)
    setExpandedIds(prev => new Set(prev).add(parent.id))
  }

  const updateSubItem = (parentIndex: number, childIndex: number, updates: Partial<NavigationItem>) => {
    const updated = [...items]
    const parent = { ...updated[parentIndex] }
    parent.children = (parent.children || []).map((child, i) =>
      i === childIndex ? { ...child, ...updates } : child
    )
    updated[parentIndex] = parent
    onChange(updated)
  }

  const removeSubItem = (parentIndex: number, childIndex: number) => {
    const updated = [...items]
    const parent = { ...updated[parentIndex] }
    parent.children = (parent.children || []).filter((_, i) => i !== childIndex)
    updated[parentIndex] = parent
    onChange(updated)
  }

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const updated = [...items]
    const [moved] = updated.splice(from, 1)
    updated.splice(to, 0, moved)
    onChange(updated)
  }

  const getPageUrl = (pageId: string): string => {
    const page = pages.find(p => p.id === pageId)
    if (!page) return '#'
    return page.slug === 'home' || page.slug === 'index' ? '/' : `/${page.slug}`
  }

  const renderItemRow = (
    item: NavigationItem,
    index: number,
    isChild: boolean,
    parentIndex?: number,
    childIndex?: number,
  ) => {
    const hasChildren = !isChild && (item.children?.length || 0) > 0
    const isExpanded = expandedIds.has(item.id)

    return (
      <div
        key={item.id}
        className={`border border-gray-200 rounded-lg bg-white ${isChild ? 'ml-8' : ''} ${
          dragIndex === index && !isChild ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-center gap-2 p-3">
          {/* Drag handle & expand */}
          {!isChild && (
            <button
              className="cursor-grab text-gray-400 hover:text-gray-600"
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => { e.preventDefault() }}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) moveItem(dragIndex, index)
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <GripVertical size={16} />
            </button>
          )}

          {/* Expand toggle for items with children */}
          {!isChild && (
            <button
              onClick={() => toggleExpand(item.id)}
              className="text-gray-400 hover:text-gray-600 w-5"
            >
              {hasChildren ? (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span className="w-4" />}
            </button>
          )}

          {/* Label */}
          <input
            type="text"
            value={item.label}
            onChange={(e) => {
              if (isChild && parentIndex !== undefined && childIndex !== undefined) {
                updateSubItem(parentIndex, childIndex, { label: e.target.value })
              } else {
                updateItem(index, { label: e.target.value })
              }
            }}
            className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Название пункта"
          />

          {/* Page or URL selector */}
          <select
            value={item.pageId || '__url__'}
            onChange={(e) => {
              const val = e.target.value
              if (val === '__url__') {
                if (isChild && parentIndex !== undefined && childIndex !== undefined) {
                  updateSubItem(parentIndex, childIndex, { pageId: undefined })
                } else {
                  updateItem(index, { pageId: undefined })
                }
              } else {
                const upd = { pageId: val, url: undefined }
                if (isChild && parentIndex !== undefined && childIndex !== undefined) {
                  updateSubItem(parentIndex, childIndex, upd)
                } else {
                  updateItem(index, upd)
                }
              }
            }}
            className="w-44 px-2 py-1 border border-gray-200 rounded text-sm bg-white focus:ring-1 focus:ring-blue-500"
          >
            <option value="__url__">Внешняя ссылка</option>
            {pages.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (/{p.slug})
              </option>
            ))}
          </select>

          {/* URL input (only for external links) */}
          {!item.pageId && (
            <input
              type="text"
              value={item.url || ''}
              onChange={(e) => {
                if (isChild && parentIndex !== undefined && childIndex !== undefined) {
                  updateSubItem(parentIndex, childIndex, { url: e.target.value })
                } else {
                  updateItem(index, { url: e.target.value })
                }
              }}
              className="w-48 px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500"
              placeholder="https://..."
            />
          )}

          {/* Page URL preview */}
          {item.pageId && (
            <span className="text-xs text-gray-400 font-mono">{getPageUrl(item.pageId)}</span>
          )}

          {/* New tab checkbox */}
          <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
            <input
              type="checkbox"
              checked={item.openInNewTab || false}
              onChange={(e) => {
                if (isChild && parentIndex !== undefined && childIndex !== undefined) {
                  updateSubItem(parentIndex, childIndex, { openInNewTab: e.target.checked })
                } else {
                  updateItem(index, { openInNewTab: e.target.checked })
                }
              }}
              className="rounded"
            />
            <ExternalLink size={12} />
          </label>

          {/* Add sub-item (only for top-level) */}
          {!isChild && (
            <button
              onClick={() => addSubItem(index)}
              className="text-gray-400 hover:text-blue-600 p-1"
              title="Добавить подпункт"
            >
              <Plus size={14} />
            </button>
          )}

          {/* Remove */}
          <button
            onClick={() => {
              if (isChild && parentIndex !== undefined && childIndex !== undefined) {
                removeSubItem(parentIndex, childIndex)
              } else {
                removeItem(index)
              }
            }}
            className="text-gray-400 hover:text-red-600 p-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Настройте пункты навигационного меню сайта. Ссылки на страницы обновляются автоматически при деплое.
        </p>
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
          Нет пунктов меню. Нажмите «Добавить пункт» чтобы начать.
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id}>
            {renderItemRow(item, index, false)}
            {expandedIds.has(item.id) && item.children?.map((child, childIndex) => (
              renderItemRow(child, index, true, index, childIndex)
            ))}
          </div>
        ))}
      </div>

      <Button onClick={addItem} variant="secondary">
        <Plus size={16} className="mr-2" />
        Добавить пункт
      </Button>
    </div>
  )
}
