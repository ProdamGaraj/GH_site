/**
 * Поля шаблона и подсказка ссылок: клик по ссылке вставляет `{{ref}}` в
 * поле, где последним стоял курсор.
 */
import React, { createContext, useCallback, useContext, useRef } from 'react'
import { cn } from '@/shared/utils'
import { insertAt, type RefGroup } from './requestModel'

interface FocusTarget {
  element: HTMLInputElement | HTMLTextAreaElement
  setValue: (value: string) => void
}

interface TemplateFocus {
  remember: (target: FocusTarget) => void
  insert: (text: string) => boolean
}

const TemplateFocusContext = createContext<TemplateFocus | null>(null)

export const TemplateFocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const last = useRef<FocusTarget | null>(null)
  const remember = useCallback((target: FocusTarget) => {
    last.current = target
  }, [])
  const insert = useCallback((text: string) => {
    const target = last.current
    if (!target || !target.element.isConnected) return false
    const { element } = target
    const { value, cursor } = insertAt(element.value, element.selectionStart ?? element.value.length, element.selectionEnd ?? element.value.length, text)
    target.setValue(value)
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(cursor, cursor)
    })
    return true
  }, [])
  return <TemplateFocusContext.Provider value={{ remember, insert }}>{children}</TemplateFocusContext.Provider>
}

const inputClass =
  'w-full px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white text-gray-900'

interface TemplateInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
  className?: string
  'aria-label'?: string
}

export const TemplateInput: React.FC<TemplateInputProps> = ({ value, onChange, placeholder, multiline, rows = 6, className, ...rest }) => {
  const focus = useContext(TemplateFocusContext)
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    focus?.remember({ element: e.currentTarget, setValue: onChange })
  if (multiline) {
    return (
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        className={cn(inputClass, className)}
        spellCheck={false}
        aria-label={rest['aria-label']}
      />
    )
  }
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      className={cn(inputClass, className)}
      spellCheck={false}
      aria-label={rest['aria-label']}
    />
  )
}

export const RefPalette: React.FC<{ groups: RefGroup[] }> = ({ groups }) => {
  const focus = useContext(TemplateFocusContext)
  return (
    <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5" data-ref-palette>
      <p className="text-[10px] text-gray-500">Поставьте курсор в поле и нажмите — вставится ссылка. Фильтры: {'{{form.phone | digits}}'}</p>
      {groups.map((group) => (
        <div key={group.title}>
          <p className="text-[10px] font-medium text-gray-600 mb-0.5">{group.title}</p>
          <div className="flex flex-wrap gap-1">
            {group.refs.map((r) => (
              <button
                key={r.ref}
                type="button"
                title={r.hint}
                onMouseDown={(e) => e.preventDefault()} // не забирать фокус у поля
                onClick={() => focus?.insert(`{{${r.ref}}}`)}
                className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-gray-200 rounded hover:border-orange-400 hover:text-orange-700"
              >
                {r.ref}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
