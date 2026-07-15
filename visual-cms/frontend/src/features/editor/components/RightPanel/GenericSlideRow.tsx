import React, { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Copy, ChevronDown, ChevronRight, Image as ImageIcon, Monitor, X, Languages } from 'lucide-react'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import {
  type MapperField,
  readSlideValue,
  writeSlideValue,
  isSlideFieldVisible,
  setSlideFieldVisible,
} from '@/features/editor/utils/bindingMapperHelper'
import {
  readSlideResponsive,
  writeSlideResponsive,
  countSlideResponsive,
} from '@/features/editor/utils/slideResponsiveHelper'

export type SlideAlignment = 'left' | 'center' | 'right'

interface SlideBreakpoint {
  id: string
  name: string
  width: number
}

/**
 * Контекст языкового варианта media-полей слайда (repeat-карусель).
 * Переводы живут как pagevar-переводы страницы: nodeId="pagevar:<var>",
 * field="media:<index>:<sourceField>" — привязаны к ИНДЕКСУ слайда в массиве.
 */
export interface SlideLangContext {
  /** Подпись активного языка (флаг + название). */
  label: string
  read: (sourceField: string) => string
  /** Локальное (optimistic) обновление значения перевода. */
  write: (sourceField: string, value: string) => void
  /** Сохранить (или удалить при пустом значении) перевод — на blur/очистку. */
  commit: (sourceField: string, value: string) => void
  /** Открыть MediaPicker для языкового варианта поля. */
  pick: (sourceField: string) => void
  /** Если задано — редактирование заблокировано (например, слайды не сохранены). */
  disabledReason?: string
}

interface GenericSlideRowProps {
  slide: Record<string, unknown>
  index: number
  schema: MapperField[]
  expanded: boolean
  onToggle: () => void
  onChange: (next: Record<string, unknown>) => void
  onDelete: () => void
  onDuplicate: () => void
  /** Открывает MediaPicker для поля (bpId — для пер-брейкпоинтного адаптив-варианта). */
  onPickMedia: (sourceField: string, bpId?: string) => void
  /** Брейкпоинты для адаптива медиа слайда (по убыванию ширины). */
  breakpoints?: SlideBreakpoint[]
  /** Языковой вариант media-полей (активный не-дефолтный язык страницы). */
  lang?: SlideLangContext
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
  breakpoints = [],
  lang,
}) => {
  // Раскрытие адаптив-блока по полю (какие media-поля показывают пер-брейкпоинт варианты).
  const [rmOpen, setRmOpen] = useState<Record<string, boolean>>({})
  // Раскрытие блока языкового варианта по полю.
  const [langOpen, setLangOpen] = useState<Record<string, boolean>>({})
  const sortedBps = [...breakpoints].sort((a, b) => b.width - a.width)
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
              const rmCount = countSlideResponsive(slide, field.sourceField)
              const isRmOpen = !!rmOpen[field.sourceField]
              const isLangOpen = !!langOpen[field.sourceField]
              const langValue = lang ? lang.read(field.sourceField) : ''
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

                  {/* Адаптив медиа слайда: разные файлы под экран (matchMedia-свап на деплое) */}
                  {sortedBps.length > 0 && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => setRmOpen(prev => ({ ...prev, [field.sourceField]: !prev[field.sourceField] }))}
                        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        <Monitor size={11} />
                        Адаптив под экран{rmCount > 0 ? ` · ${rmCount}` : ''}
                        {isRmOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                      {isRmOpen && (
                        <div className="mt-1 space-y-1 pl-4 border-l border-gray-100">
                          {sortedBps.map(bp => {
                            const rmValue = readSlideResponsive(slide, field.sourceField, bp.id)
                            return (
                              <div key={bp.id} className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 w-24 shrink-0 truncate" title={`${bp.name} (≤${bp.width})`}>
                                  {bp.name} ≤{bp.width}
                                </span>
                                <Input
                                  value={rmValue}
                                  onChange={e => onChange(writeSlideResponsive(slide, field.sourceField, bp.id, e.target.value))}
                                  placeholder="как базовый"
                                  className="flex-1 !h-7 !text-[11px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => onPickMedia(field.sourceField, bp.id)}
                                  title="Выбрать из медиатеки"
                                  className="shrink-0 p-1 rounded border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300"
                                >
                                  <ImageIcon size={12} />
                                </button>
                                {rmValue && (
                                  <button
                                    type="button"
                                    onClick={() => onChange(writeSlideResponsive(slide, field.sourceField, bp.id, ''))}
                                    title="Очистить"
                                    className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Языковой вариант медиа (pagevar-перевод по индексу слайда) */}
                  {lang && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => setLangOpen(prev => ({ ...prev, [field.sourceField]: !prev[field.sourceField] }))}
                        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        <Languages size={11} />
                        Вариант · {lang.label}{langValue ? ' · 1' : ''}
                        {isLangOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                      {isLangOpen && (
                        lang.disabledReason ? (
                          <p className="mt-1 pl-4 text-[10px] text-amber-600">{lang.disabledReason}</p>
                        ) : (
                          <div className="mt-1 pl-4 border-l border-gray-100 flex items-center gap-1">
                            <Input
                              value={langValue}
                              onChange={e => lang.write(field.sourceField, e.target.value)}
                              onBlur={e => lang.commit(field.sourceField, e.target.value.trim())}
                              placeholder="как базовый"
                              className="flex-1 !h-7 !text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() => lang.pick(field.sourceField)}
                              title="Выбрать из медиатеки"
                              className="shrink-0 p-1 rounded border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300"
                            >
                              <ImageIcon size={12} />
                            </button>
                            {langValue && (
                              <button
                                type="button"
                                onClick={() => {
                                  lang.write(field.sourceField, '')
                                  lang.commit(field.sourceField, '')
                                }}
                                title="Убрать языковой вариант"
                                className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
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
