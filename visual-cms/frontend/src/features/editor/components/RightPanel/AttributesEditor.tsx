import React, { useState } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { updateNode } from '@/features/editor/editorSlice'
import type { BlockNode } from '@/shared/types'
import { Plus, Trash2 } from 'lucide-react'

/**
 * Атрибуты, у которых есть отдельные удобные поля выше (ID/Class/Title, медиа,
 * поля форм) — их не показываем в общем редакторе, чтобы не дублировать.
 */
const MANAGED = new Set([
  'id', 'class', 'title', 'style',
  'src', 'alt', 'href', 'placeholder', 'type', 'value', 'name',
])

/**
 * Универсальный редактор произвольных HTML-атрибутов выбранного узла.
 * Нужен, например, чтобы вручную проставить data-carousel и подобные
 * декларативные атрибуты, для которых нет отдельного UI.
 */
export const AttributesEditor: React.FC<{ node: BlockNode }> = ({ node }) => {
  const dispatch = useAppDispatch()
  const [newKey, setNewKey] = useState('')

  const attributes = node.attributes || {}
  const entries = Object.entries(attributes).filter(([k]) => !MANAGED.has(k))

  const setAttrs = (attrs: Record<string, string>) =>
    dispatch(updateNode({ id: node.id, updates: { attributes: attrs } }))

  const updateValue = (key: string, value: string) => setAttrs({ ...attributes, [key]: value })

  const removeKey = (key: string) => {
    const next = { ...attributes }
    delete next[key]
    setAttrs(next)
  }

  const addKey = () => {
    const k = newKey.trim()
    if (!k || k in attributes) return
    setAttrs({ ...attributes, [k]: '' })
    setNewKey('')
  }

  return (
    <div className="space-y-2 pt-2 border-t border-gray-100">
      <h4 className="text-xs font-medium text-gray-700">Произвольные атрибуты</h4>

      {entries.length === 0 && (
        <p className="text-xs text-gray-400">Нет дополнительных атрибутов</p>
      )}

      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-1">
          <span className="text-xs font-mono text-gray-600 w-2/5 truncate" title={key}>
            {key}
          </span>
          <input
            value={value}
            onChange={(e) => updateValue(key, e.target.value)}
            placeholder="значение"
            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            onClick={() => removeKey(key)}
            className="p-1 hover:bg-red-50 rounded"
            title="Удалить атрибут"
          >
            <Trash2 size={12} className="text-red-500" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-1">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addKey()
            }
          }}
          placeholder="data-carousel"
          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button onClick={addKey} className="p-1 hover:bg-gray-100 rounded" title="Добавить атрибут">
          <Plus size={14} className="text-gray-600" />
        </button>
      </div>

      <p className="text-[11px] text-gray-400 leading-snug">
        Например: <code className="bg-gray-100 px-1 rounded">data-carousel</code> = true,{' '}
        <code className="bg-gray-100 px-1 rounded">data-carousel-autoplay</code> = 5000
      </p>
    </div>
  )
}
