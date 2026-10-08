import React, { useState } from 'react'
import { ArrowDown, ArrowUp, Boxes, Plus, Trash2 } from 'lucide-react'
import { BlockPicker } from '@/features/editor/components/BlockPicker'
import { GallerySlidesField } from '@/shared/forms/GallerySlidesField'
import { MediaField } from '@/shared/forms/mediaFields'
import { RichTextField } from '@/shared/forms/RichTextField'
import { cn } from '@/shared/utils'
import type { MediaSide, NewsSection, SectionType } from '../types'
import { PLAIN_SECTION_TYPES, SECTION_TYPE_LABELS, SIDE_LABELS, moveSection, newBlockSection, newSection, removeSection, updateSection } from '../newsForm'
import { BlockAnchorsDialog } from './BlockAnchorsDialog'
import { BlockSectionFields } from './BlockSectionFields'

const TYPES = PLAIN_SECTION_TYPES

/** Первое фото «фото + текст» — строкой адреса для поля медиа. */
function firstUrl(section: NewsSection): string {
  const [first] = section.media
  return typeof first === 'string' ? first : first?.url ?? ''
}

/**
 * Тело новости — блоки в порядке страницы: «текст», «фото + текст»,
 * «слайдер + текст». Шаблон страницы на сайте рисует для каждого блока
 * заготовку его типа; порядок и состав задаются здесь.
 */
export const SectionsEditor: React.FC<{
  value: NewsSection[]
  onChange: (sections: NewsSection[]) => void
}> = ({ value, onChange }) => {
  const add = (type: SectionType) => onChange([...value, newSection(type)])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickedBlock, setPickedBlock] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {value.length === 0 && <p className="text-sm text-gray-400">Блоков пока нет — добавьте первый.</p>}

      {value.map((section, i) => {
        const patch = (p: Partial<NewsSection>) => onChange(updateSection(value, i, p))
        const isBlock = section.type === 'block'
        const hasMedia = section.type !== 'text' && !isBlock
        return (
          <div key={section.id} data-testid="news-section" className="rounded-lg border border-gray-200 bg-gray-50/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">Блок {i + 1}</span>
              {isBlock ? (
                <span className="flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                  <Boxes size={12} /> {SECTION_TYPE_LABELS.block}
                </span>
              ) : (
              <select
                aria-label={`Тип блока ${i + 1}`}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                value={section.type}
                onChange={(e) => patch({ type: e.target.value as SectionType })}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SECTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              )}
              {hasMedia && (
                <div className="flex rounded-md border border-gray-300 bg-white text-xs" role="group" aria-label={`Сторона медиа, блок ${i + 1}`}>
                  {(['left', 'right'] as MediaSide[]).map((side) => (
                    <button
                      key={side}
                      type="button"
                      aria-pressed={section.side === side}
                      onClick={() => patch({ side })}
                      className={cn('px-2 py-1', section.side === side ? 'bg-primary-50 text-primary-700' : 'text-gray-500')}
                    >
                      {SIDE_LABELS[side]}
                    </button>
                  ))}
                </div>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button type="button" aria-label={`Блок ${i + 1} выше`} disabled={i === 0} onClick={() => onChange(moveSection(value, i, -1))} className="p-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30">
                  <ArrowUp size={16} />
                </button>
                <button type="button" aria-label={`Блок ${i + 1} ниже`} disabled={i === value.length - 1} onClick={() => onChange(moveSection(value, i, 1))} className="p-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30">
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  aria-label={`Удалить блок ${i + 1}`}
                  onClick={() => {
                    if (confirm(`Удалить блок ${i + 1}? Его перевод тоже пропадёт.`)) onChange(removeSection(value, i))
                  }}
                  className="p-1.5 text-red-500 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {isBlock ? (
              <BlockSectionFields section={section} index={i} onChange={patch} />
            ) : (
            <div className={cn(hasMedia && 'grid gap-4 xl:grid-cols-2 items-start')}>
              <RichTextField value={section.html} onChange={(html) => patch({ html })} placeholder="Текст блока" />
              {section.type === 'photoText' && (
                <MediaField label="Фото" value={firstUrl(section)} onChange={(url) => patch({ media: url ? [url] : [] })} />
              )}
              {section.type === 'sliderText' && (
                <GallerySlidesField label="Слайды" hint="фото и видео" value={section.media} onChange={(media) => patch({ media })} />
              )}
            </div>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap gap-2">
        {TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => add(type)}
            className="flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-primary-400 hover:text-primary-700"
          >
            <Plus size={14} /> {SECTION_TYPE_LABELS[type]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:border-indigo-500"
        >
          <Boxes size={14} /> {SECTION_TYPE_LABELS.block}
        </button>
      </div>
      <BlockPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Блок из библиотеки — в новость"
        forcedMode="linked"
        onPick={({ block }) => {
          setPickerOpen(false)
          setPickedBlock(block.id)
        }}
      />
      {pickedBlock && (
        <BlockAnchorsDialog
          blockId={pickedBlock}
          onClose={() => setPickedBlock(null)}
          onReady={(blockId, _name, anchors) => {
            setPickedBlock(null)
            onChange([...value, newBlockSection(blockId, anchors)])
          }}
        />
      )}
    </div>
  )
}
