import React, { useEffect, useState } from 'react'
import { cn } from '@/shared/utils'
import type { GeoPoint, Locale, StatItem } from '../types'
import { formatPoint, parseCoordinates } from '../projectMap'
import { LOCALES, LOCALE_LABELS } from '../types'

export const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

/**
 * Однострочное поле (ввод, число, список) в строке сетки: метка сверху,
 * поле ввода прижато к низу ячейки. Подсказка у метки может перенестись на
 * вторую строку — поле ввода всё равно на одной линии с соседями. Вне сетки
 * (или в сетке с items-start) ничего не меняется: ячейка по высоте содержимого.
 */
const lineFieldCls = 'flex flex-col'
const lineInputCls = cn(inputCls, 'mt-auto')

export const Label: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <label className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {hint && <span className="ml-2 text-xs font-normal text-gray-400">{hint}</span>}
  </label>
)

/**
 * Раздел редактора ЖК — отдельная карточка. id — якорь меню разделов
 * (sections.ts); отступ сверху — чтобы заголовок не прятался под закреплённой
 * полосой при переходе.
 */
export const FormSection: React.FC<{
  id: string
  title: React.ReactNode
  actions?: React.ReactNode
  testId?: string
  children: React.ReactNode
}> = ({ id, title, actions, testId, children }) => (
  <section id={id} data-testid={testId} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 scroll-mt-24">
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-2">{title}</h2>
      {actions}
    </div>
    {children}
  </section>
)

export const TextField: React.FC<{
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  disabled?: boolean
}> = ({ label, value, onChange, placeholder, hint, disabled }) => (
  <div className={lineFieldCls}>
    <Label hint={hint}>{label}</Label>
    <input
      className={lineInputCls}
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
  <div className={lineFieldCls}>
    <Label hint={hint}>{label}</Label>
    <input
      type="number"
      className={lineInputCls}
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
  <div className={lineFieldCls}>
    <Label>{label}</Label>
    <select className={lineInputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
)

export const CheckboxField: React.FC<{
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}> = ({ label, checked, onChange, hint }) => (
  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
    <input type="checkbox" className="h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
    {hint && <span className="text-xs font-normal text-gray-400">{hint}</span>}
  </label>
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
  className?: string
}> = ({ active, onChange, className }) => (
  <div className={cn('flex gap-1 border-b border-gray-200 mb-4', className)}>
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

/**
 * Перевод значений, пришедших из CRM по-русски (виды из окна): по строке на
 * значение, слева оригинал, справа перевод. Пусто — на сайте останется ru.
 */
export const LabelMapField: React.FC<{
  label: string
  hint?: string
  keys: string[]
  value: Record<string, string>
  onChange: (key: string, text: string) => void
  /** Подпись строки, если ключ не для людей (например, uuid места); по умолчанию — сам ключ. */
  labelOf?: (key: string) => string
}> = ({ label, hint, keys, value, onChange, labelOf = (key) => key }) => (
  <div>
    <Label hint={hint}>{label}</Label>
    <div className="space-y-2">
      {keys.map((key) => (
        <div key={key} className="grid grid-cols-2 gap-3 items-center">
          <span className="text-sm text-gray-600 truncate" title={labelOf(key)}>
            {labelOf(key)}
          </span>
          <input
            className={inputCls}
            value={value[key] ?? ''}
            placeholder={labelOf(key)}
            aria-label={labelOf(key)}
            onChange={(e) => onChange(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  </div>
)

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
