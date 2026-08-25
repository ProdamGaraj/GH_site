import React, { useEffect, useState } from 'react'
import { cn } from '@/shared/utils'
import type { Locale, StatItem } from '../types'
import { LOCALES, LOCALE_LABELS } from '../types'

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

export const Label: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {hint && <span className="ml-2 text-xs font-normal text-gray-400">{hint}</span>}
  </label>
)

export const TextField: React.FC<{
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  disabled?: boolean
}> = ({ label, value, onChange, placeholder, hint, disabled }) => (
  <div>
    <Label hint={hint}>{label}</Label>
    <input
      className={inputCls}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
)

export const TextArea: React.FC<{
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  rows?: number
}> = ({ label, value, onChange, placeholder, hint, rows = 3 }) => (
  <div>
    <Label hint={hint}>{label}</Label>
    <textarea
      className={inputCls}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
)

export const NumberField: React.FC<{
  label: string
  value: number | string | null
  onChange: (v: number | null) => void
  hint?: string
}> = ({ label, value, onChange, hint }) => (
  <div>
    <Label hint={hint}>{label}</Label>
    <input
      type="number"
      className={inputCls}
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  </div>
)

export const SelectField: React.FC<{
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
}> = ({ label, value, options, onChange }) => (
  <div>
    <Label>{label}</Label>
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
)

/** Массив строк через перевод строки (для yardFeatures/badges/heroImages...). */
export const StringListField: React.FC<{
  label: string
  value: string[]
  onChange: (v: string[]) => void
  hint?: string
  rows?: number
}> = ({ label, value, onChange, hint, rows = 3 }) => {
  // Локальный raw-text: переносы и пустые строки живут во время ввода. Если
  // контролировать textarea напрямую массивом, `filter(Boolean)` срезает пустую
  // новую строку сразу при Enter → перенос «не работает». В родителя отдаём уже
  // нормализованный массив (trim + без пустых).
  const [text, setText] = useState<string>((value || []).join('\n'))

  // Синхронизация при ВНЕШНЕМ изменении value (не от нашего ввода): сравниваем
  // нормализованные версии, чтобы не перебивать текущий набор текста.
  useEffect(() => {
    const external = (value || []).join('\n')
    const mine = text.split('\n').map((s) => s.trim()).filter(Boolean).join('\n')
    if (external !== mine) setText(external)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (v: string) => {
    setText(v)
    onChange(v.split('\n').map((s) => s.trim()).filter(Boolean))
  }

  return (
    <div>
      <Label hint={hint || 'по одному в строке'}>{label}</Label>
      <textarea
        className={inputCls}
        rows={rows}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  )
}

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

export const LocaleTabs: React.FC<{
  active: Locale
  onChange: (l: Locale) => void
}> = ({ active, onChange }) => (
  <div className="flex gap-1 border-b border-gray-200 mb-4">
    {LOCALES.map((l) => (
      <button
        key={l}
        type="button"
        onClick={() => onChange(l)}
        className={cn(
          'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          active === l
            ? 'border-primary-500 text-primary-700'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        )}
      >
        {LOCALE_LABELS[l]}
        {l !== 'ru' && <span className="ml-1 text-xs text-gray-400">перевод</span>}
      </button>
    ))}
  </div>
)
