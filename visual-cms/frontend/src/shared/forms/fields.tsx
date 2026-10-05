import React, { useEffect, useId, useState } from 'react'
import { cn } from '@/shared/utils'
import { LOCALES, LOCALE_LABELS, type Locale } from './locales'

/**
 * Поля форм админок (ЖК, новости): метка сверху, единый стиль ввода.
 * Перенесены из features/estate — там остались только поля ЖК (параметры,
 * координаты), а прежний модуль реэкспортирует эти.
 */

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

/** Метка поля. htmlFor связывает её с полем: клик ставит фокус, экранный диктор читает название. */
export const Label: React.FC<{ children: React.ReactNode; hint?: string; htmlFor?: string }> = ({ children, hint, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {hint && <span className="ml-2 text-xs font-normal text-gray-400">{hint}</span>}
  </label>
)

/**
 * Раздел редактора — отдельная карточка. id — якорь меню разделов; отступ
 * сверху — чтобы заголовок не прятался под закреплённой полосой при переходе.
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
}> = ({ label, value, onChange, placeholder, hint, disabled }) => {
  const id = useId()
  return (
    <div className={lineFieldCls}>
      <Label hint={hint} htmlFor={id}>{label}</Label>
      <input
        id={id}
        className={lineInputCls}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export const TextArea: React.FC<{
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  rows?: number
}> = ({ label, value, onChange, placeholder, hint, rows = 3 }) => {
  const id = useId()
  return (
    <div>
      <Label hint={hint} htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        className={inputCls}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export const NumberField: React.FC<{
  label: string
  value: number | string | null
  onChange: (v: number | null) => void
  hint?: string
}> = ({ label, value, onChange, hint }) => {
  const id = useId()
  return (
    <div className={lineFieldCls}>
      <Label hint={hint} htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="number"
        className={lineInputCls}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </div>
  )
}

export const SelectField: React.FC<{
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
}> = ({ label, value, options, onChange }) => {
  const id = useId()
  return (
    <div className={lineFieldCls}>
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={lineInputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

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
