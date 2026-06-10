import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Copy, ChevronDown, ChevronRight, Image as ImageIcon } from 'lucide-react'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import {
  type MapperField,
  readSlideValue,
  writeSlideValue,
  isSlideFieldVisible,
  setSlideFieldVisible,
} from '@/features/editor/utils/bindingMapperHelper'

export type SlideAlignment = 'left' | 'center' | 'right'

interface GenericSlideRowProps {
  slide: Record<string, unknown>
  index: number
  schema: MapperField[]
  expanded: boolean
  onToggle: () => void
  onChange: (next: Record<string, unknown>) => void
  onDelete: () => void
  onDuplicate: () => void
  /** Открывает MediaPicker для конкретного поля. Передаётся ключ поля. */
  onPickMedia: (sourceField: string) => void
}

/**
 * Универсальный редактор одного слайда репитер-карусели.
 * Рендерит инпуты по mapper-схеме (text/url/media). Дополнительно показывает
 * фиксированный селектор alignment (per-slide UI-настройка, не из binding'а).
 */
export const GenericSlideRow: React.FC<GenericSlideRowProps> = ({
  slide,
  index,
  schema,
  expanded,
  onToggle,
  onChange,
  onDelete,
  onDuplicate,
  onPickMedia,
}) => {
  const id = String((slide._id as string | undefined) ?? `slide-${index}`)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Превью: первое media-поле даёт миниатюру, первое text-поле — заголовок строки.
  const firstMedia = schema.find(f => f.kind === 'media')
  const firstText = schema.find(f => f.kind === 'text')
  const previewImage = firstMedia ? readSlideValue(slide, firstMedia.sourceField) : ''
  const previewTitleRaw = firstText ? readSlideValue(slide, firstText.sourceField) : ''
  const previewTitle = previewTitleRaw.trim() || `Слайд ${index + 1}`

  const setField = (sourceField: string, value: string) => {
    onChange(writeSlideValue(slide, sourceField, value))
  }

  // Шапка поля: подпись + чекбокс «Отображать» (по умолчанию ✓).
  // Снятие галочки скрывает блок на этом слайде (текст/кнопку — display:none,
  // фон-картинку — очищает). Логика применения — в RepeaterRenderer и public-site runtime.
  const FieldHeader: React.FC<{ field: MapperField }> = ({ field }) => (
    <div className="flex items-center justify-between mb-1">
      <label className="text-xs font-medium text-gray-700">{field.label}</label>
      <label
        className="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer select-none"
        title="Показывать этот блок на слайде"
      >
        <input
          type="checkbox"
          className="accent-blue-600"
          checked={isSlideFieldVisible(slide, field.sourceField)}
          onChange={e => onChange(setSlideFieldVisible(slide, field.sourceField, e.target.checked))}
        />
        Отображать
      </label>
    </div>
  )

  const setAlignment = (a: SlideAlignment) => {
    onChange({ ...slide, alignment: a })
  }

  const alignment = (slide.alignment === 'left' || slide.alignment === 'center' || slide.alignment === 'right')
    ? slide.alignment
    : 'center'

  return (
    <div ref={setNodeRef} style={style} className="border border-gray-200 rounded bg-white">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
          aria-label="Перетащить"
        >
          <GripVertical size={16} />
        </button>
        <button type="button" onClick={onToggle} className="flex-1 flex items-center gap-2 text-left text-sm">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {previewImage ? (
            <img src={previewImage} alt="" className="w-8 h-8 object-cover rounded border" />
          ) : (
            <div className="w-8 h-8 rounded border bg-gray-50 flex items-center justify-center text-gray-300">
              <ImageIcon size={14} />
            </div>
          )}
          <span className="truncate font-medium text-gray-700">{previewTitle}</span>
        </button>
        <Button variant="ghost" size="sm" onClick={onDuplicate} title="Дублировать">
          <Copy size={14} />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} title="Удалить">
          <Trash2 size={14} className="text-red-600" />
        </Button>
      </div>

      {expanded && (
        <div className="p-3 pt-0 space-y-2">
          {schema.map(field => {
            const value = readSlideValue(slide, field.sourceField)
            if (field.kind === 'media') {
              return (
                <div key={field.sourceField} style={{ opacity: isSlideFieldVisible(slide, field.sourceField) ? 1 : 0.5 }}>
                  <FieldHeader field={field} />
                  <div className="flex gap-2 items-center">
                    <Input
                      value={value}
                      onChange={e => {
                        // При ручной правке URL сбрасываем привязку к media-asset.
                        const next = writeSlideValue(slide, field.sourceField, e.target.value)
                        delete next[`_${field.sourceField}AssetId`]
                        onChange(next)
                      }}
                      placeholder="/media/...png"
                      className="flex-1"
                    />
                    <Button variant="secondary" size="sm" onClick={() => onPickMedia(field.sourceField)}>
                      Из медиатеки
                    </Button>
                  </div>
                </div>
              )
            }
            if (field.kind === 'url') {
              return (
                <div key={field.sourceField} style={{ opacity: isSlideFieldVisible(slide, field.sourceField) ? 1 : 0.5 }}>
                  <FieldHeader field={field} />
                  <Input
                    value={value}
                    onChange={e => setField(field.sourceField, e.target.value)}
                    placeholder="/about или https://"
                  />
                </div>
              )
            }
            // text
            // Для длинных полей (description-style) показываем textarea, иначе input.
            const isMultiline = /description|content|text$/i.test(field.sourceField) && field.sourceField !== 'ctaText'
            return (
              <div key={field.sourceField} style={{ opacity: isSlideFieldVisible(slide, field.sourceField) ? 1 : 0.5 }}>
                <FieldHeader field={field} />
                {isMultiline ? (
                  <textarea
                    value={value}
                    onChange={e => setField(field.sourceField, e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                ) : (
                  <Input value={value} onChange={e => setField(field.sourceField, e.target.value)} />
                )}
              </div>
            )
          })}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Выравнивание</label>
            <select
              value={alignment}
              onChange={e => setAlignment(e.target.value as SlideAlignment)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="left">Слева</option>
              <option value="center">По центру</option>
              <option value="right">Справа</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
