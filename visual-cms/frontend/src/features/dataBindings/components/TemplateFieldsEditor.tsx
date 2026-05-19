/**
 * TemplateFieldsEditor — UI для ручного управления полями Template-блока.
 * Позволяет просматривать, добавлять (в т.ч. скрытые) и удалять DetectedField.
 */

import React, { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Eye, EyeOff, Sparkles } from 'lucide-react'
import type { DetectedField, DetectedFieldType } from '@/shared/types/template'

interface TemplateFieldsEditorProps {
  fields: DetectedField[]
  blockId: string
  onFieldsChange: (fields: DetectedField[]) => void
}

const FIELD_TYPES: { value: DetectedFieldType; label: string }[] = [
  { value: 'text', label: 'Текст' },
  { value: 'richText', label: 'HTML' },
  { value: 'image', label: 'Изображение' },
  { value: 'link', label: 'Ссылка' },
  { value: 'number', label: 'Число' },
  { value: 'date', label: 'Дата' },
  { value: 'boolean', label: 'Булево' },
  { value: 'list', label: 'Список' },
  { value: 'object', label: 'Объект' },
]

const EMPTY_FORM = { name: '', type: 'text' as DetectedFieldType, hidden: false, selector: '', description: '' }

export const TemplateFieldsEditor: React.FC<TemplateFieldsEditorProps> = ({ fields, onFieldsChange }) => {
  const [localFields, setLocalFields] = useState<DetectedField[]>(fields)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  // Флаг: мы сами только что изменили поля и ждём ответа API.
  // Пока флаг true — игнорируем sync из props, чтобы не откатить оптимистичный апдейт.
  const isPendingRef = useRef(false)

  // Синхронизируем из props только когда нет нашего pending-апдейта
  useEffect(() => {
    if (!isPendingRef.current) {
      setLocalFields(fields)
    }
    // После первого срабатывания (ответ API пришёл) — сбрасываем флаг
    isPendingRef.current = false
  }, [fields])

  const commit = (updated: DetectedField[]) => {
    isPendingRef.current = true
    setLocalFields(updated)   // немедленный визуальный апдейт
    onFieldsChange(updated)   // сохранение через API
  }

  const handleAdd = () => {
    if (!form.name.trim()) return

    const newField: DetectedField = {
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: form.name.trim(),
      type: form.type,
      selector: form.selector.trim() || `[data-bind="${form.name.trim()}"]`,
      required: false,
      description: form.description.trim() || undefined,
      semanticHints: form.hidden ? ['hidden'] : undefined,
    }

    commit([...localFields, newField])
    setForm(EMPTY_FORM)
    setShowAddForm(false)
  }

  const handleDelete = (fieldId: string) => {
    commit(localFields.filter(f => f.id !== fieldId))
  }

  const isHidden = (field: DetectedField) => field.semanticHints?.includes('hidden') ?? false

  const toggleHidden = (field: DetectedField) => {
    const updated = localFields.map(f => {
      if (f.id !== field.id) return f
      const hints = f.semanticHints ?? []
      return {
        ...f,
        semanticHints: isHidden(f)
          ? hints.filter(h => h !== 'hidden')
          : [...hints, 'hidden'],
      }
    })
    commit(updated)
  }

  return (
    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600" />
          <span className="font-medium text-purple-900 text-sm">
            Template Fields ({localFields.length})
          </span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          <Plus size={12} />
          Добавить поле
        </button>
      </div>

      {/* Список полей */}
      {localFields.length > 0 ? (
        <div className="space-y-1">
          {localFields.map(field => (
            <div
              key={field.id}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-purple-200 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium ${isHidden(field) ? 'text-gray-400' : 'text-purple-800'}`}>
                    {field.name}
                  </span>
                  {isHidden(field) && (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">скрытое</span>
                  )}
                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">
                    {field.type}
                  </span>
                </div>
                {field.description && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{field.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleHidden(field)}
                  title={isHidden(field) ? 'Сделать видимым' : 'Сделать скрытым'}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                >
                  {isHidden(field) ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  onClick={() => handleDelete(field.id)}
                  title="Удалить поле"
                  className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-purple-600 italic">Нет полей. Добавьте вручную или они определятся автоматически из элементов с metadata.name.</p>
      )}

      {/* Форма добавления */}
      {showAddForm && (
        <div className="p-3 bg-white border border-purple-300 rounded-lg space-y-2.5">
          <p className="text-xs font-medium text-gray-700">Новое поле</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Имя поля *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="project-image"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Тип</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as DetectedFieldType }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900"
              >
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">CSS-селектор (необязательно)</label>
            <input
              type="text"
              value={form.selector}
              onChange={e => setForm(f => ({ ...f, selector: e.target.value }))}
              placeholder="[data-bind=&quot;project-image&quot;]"
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Описание (необязательно)</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="URL изображения проекта"
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.hidden}
                onChange={e => setForm(f => ({ ...f, hidden: e.target.checked }))}
                className="w-3.5 h-3.5 accent-purple-600"
              />
              <span className="text-xs text-gray-600">Скрытое поле (не отображается в UI)</span>
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!form.name.trim()}
              className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Добавить
            </button>
            <button
              onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM) }}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
