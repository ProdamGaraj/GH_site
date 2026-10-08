import React from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { TextArea, TextField } from '@/shared/forms/fields'
import { MediaField } from '@/shared/forms/mediaFields'
import { RichTextField } from '@/shared/forms/RichTextField'
import type { BlockValue, DataAnchor, LinkValue, NewsSection } from '../types'
import { orphanValueKeys } from '../newsForm'
import { useBlockAnchors } from './useBlockAnchors'

function asText(v: BlockValue | undefined): string {
  return typeof v?.value === 'string' ? v.value : ''
}
function asLink(v: BlockValue | undefined): LinkValue {
  return typeof v?.value === 'object' && v.value ? v.value : { href: '', text: '' }
}

/**
 * Поля секции-блока: по полю на якорь блока данных. Якорь, пропавший из
 * блока (блок правили), показывается предупреждением: значение больше не
 * выводится — его можно убрать.
 */
export const BlockSectionFields: React.FC<{
  section: NewsSection
  index: number
  onChange: (patch: Partial<NewsSection>) => void
}> = ({ section, index, onChange }) => {
  const { data, error } = useBlockAnchors(section.blockId)
  const values = section.values ?? {}
  const set = (anchor: DataAnchor, value: BlockValue['value']) => onChange({ values: { ...values, [anchor.key]: { kind: anchor.kind, value } } })

  if (error) {
    return (
      <p className="flex items-center gap-2 text-sm text-red-600" role="alert">
        <AlertTriangle size={14} /> {error} — блок {index + 1} на сайте будет пустым.
      </p>
    )
  }
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 size={14} className="animate-spin" /> Загрузка блока…
      </p>
    )
  }

  const orphans = orphanValueKeys(section, data.anchors)
  return (
    <div className="space-y-3" data-testid="block-section-fields">
      <p className="text-xs text-gray-500">Блок библиотеки «{data.name}» — правка его дизайна в библиотеке меняет все новости с ним.</p>
      {data.anchors.length === 0 && <p className="text-sm text-amber-700">У блока больше нет полей данных — он выводится как есть.</p>}
      {data.anchors.map((anchor) => {
        const v = values[anchor.key]
        switch (anchor.kind) {
          case 'richtext':
            return <RichTextField key={anchor.key} label={anchor.label} value={asText(v)} onChange={(html) => set(anchor, html)} />
          case 'image':
            return <MediaField key={anchor.key} label={anchor.label} value={asText(v)} onChange={(url) => set(anchor, url)} />
          case 'link': {
            const link = asLink(v)
            return (
              <div key={anchor.key} className="grid gap-3 sm:grid-cols-2">
                <TextField label={`${anchor.label} — подпись`} value={link.text} onChange={(text) => set(anchor, { ...link, text })} />
                <TextField label={`${anchor.label} — адрес`} value={link.href} placeholder="/ru/… или https://…" onChange={(href) => set(anchor, { ...link, href })} />
              </div>
            )
          }
          default: {
            const text = asText(v)
            return text.length > 80 ? (
              <TextArea key={anchor.key} label={anchor.label} rows={3} value={text} onChange={(t) => set(anchor, t)} />
            ) : (
              <TextField key={anchor.key} label={anchor.label} value={text} onChange={(t) => set(anchor, t)} />
            )
          }
        }
      })}
      {orphans.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800" data-testid="block-orphans">
          <AlertTriangle size={14} />
          Из блока удалены поля: {orphans.join(', ')} — их значения на сайт не выводятся.
          <button
            type="button"
            className="underline"
            onClick={() => onChange({ values: Object.fromEntries(Object.entries(values).filter(([k]) => !orphans.includes(k))) })}
          >
            Убрать
          </button>
        </div>
      )}
    </div>
  )
}
