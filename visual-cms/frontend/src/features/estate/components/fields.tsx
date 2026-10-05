import React, { useEffect, useState } from 'react'
import { cn } from '@/shared/utils'
import { Label, inputCls } from '@/shared/forms/fields'
import type { GeoPoint, StatItem } from '../types'
import { formatPoint, parseCoordinates } from '../projectMap'

// Общие поля форм живут в shared/forms; здесь — только поля ЖК. Реэкспорт —
// чтобы компоненты estate не меняли импорты.
export {
  inputCls,
  Label,
  FormSection,
  TextField,
  TextArea,
  NumberField,
  SelectField,
  CheckboxField,
  StringListField,
  LocaleTabs,
  LabelMapField,
} from '@/shared/forms/fields'

/** Список пар value/label (stats). */
export const StatsField: React.FC<{
  label: string
  value: StatItem[]
  onChange: (v: StatItem[]) => void
}> = ({ label, value, onChange }) => {
  const items = value || []
  const update = (i: number, patch: Partial<StatItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  return (
    <div>
      <Label hint="значение + подпись">{label}</Label>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={inputCls}
              placeholder="значение"
              value={it.value}
              onChange={(e) => update(i, { value: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="подпись"
              value={it.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <button
              type="button"
              className="px-2 text-red-500 hover:text-red-700"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-primary-600 hover:text-primary-800"
          onClick={() => onChange([...items, { value: '', label: '' }])}
        >
          + добавить параметр
        </button>
      </div>
    </div>
  )
}

/**
 * Координаты строкой, как их копируют из Яндекс или Google Карт.
 *
 * Текст ввода живёт в поле; наружу уходит только разобранная точка (или null,
 * если поле очищено и пустое допустимо). Недописанные координаты не портят
 * форму — поле подсвечивается и подсказывает формат.
 */
export const CoordinatesField: React.FC<{
  label?: string
  hint?: string
  value: GeoPoint | null | undefined
  onChange: (point: GeoPoint | null) => void
  /** Можно ли очистить поле: у точки дома и отдела продаж — да, у места — нет. */
  allowEmpty?: boolean
}> = ({ label, hint, value, onChange, allowEmpty = false }) => {
  const [text, setText] = useState(formatPoint(value))

  // Внешняя смена точки (другой ЖК, сброс) — переписываем текст, но не
  // перебиваем то, что человек сейчас набирает и что разбирается в ту же точку.
  useEffect(() => {
    const typed = parseCoordinates(text)
    const same = value ? typed?.lat === value.lat && typed?.lng === value.lng : text.trim() === ''
    if (!same) setText(formatPoint(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const parsed = parseCoordinates(text)
  const invalid = text.trim() !== '' && !parsed
  const emptyForbidden = text.trim() === '' && !allowEmpty

  const handle = (next: string) => {
    setText(next)
    const point = parseCoordinates(next)
    if (point) onChange(point)
    else if (next.trim() === '' && allowEmpty) onChange(null)
  }

  return (
    <div>
      {label && <Label hint={hint}>{label}</Label>}
      <input
        className={cn(inputCls, (invalid || emptyForbidden) && 'border-red-400 focus:ring-red-400')}
        value={text}
        placeholder="41.311081, 69.240562"
        aria-label={label || 'Координаты'}
        aria-invalid={invalid || emptyForbidden}
        onChange={(e) => handle(e.target.value)}
      />
      {invalid && <p className="mt-1 text-xs text-red-600">Не похоже на координаты: нужно «широта, долгота», например 41.311081, 69.240562</p>}
      {parsed && (
        <a
          className="mt-1 inline-block text-xs text-primary-700 hover:underline"
          href={`https://www.openstreetmap.org/?mlat=${parsed.lat}&mlon=${parsed.lng}#map=17/${parsed.lat}/${parsed.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          проверить на карте
        </a>
      )}
    </div>
  )
}
