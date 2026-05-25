/**
 * Контролируемый input/textarea для ввода списка значений в одной строке.
 *
 * Проблема, которую решает: «нормализация onChange» в контролируемом инпуте
 * теряет промежуточные состояния, которые не представимы через нормализованный
 * массив. Конкретно — висящая запятая «abc,» нормализуется в `["abc"]`, после
 * чего join даёт обратно «abc», и пользователь не может ввести второй элемент:
 * каждое нажатие запятой визуально откатывается.
 *
 * Решение: хранить «сырую» строку в local state, а наружу отдавать всегда
 * нормализованный массив. Внешнее значение синхронизируется обратно только
 * если оно отличается от парсинга текущего raw — это не мешает пользователю
 * допечатывать и одновременно подхватывает изменения извне (load/reset).
 */
import { useEffect, useRef, useState } from 'react'

/**
 * Pure парсер. Выделен из компонента — чтобы покрыть тестами без DOM.
 *
 * Главный инвариант (его и нарушал старый код): `parseMultiValue` отбрасывает
 * пустые элементы. Из-за этого «abc,» и «abc» возвращают одно и то же значение
 * (`["abc"]`), и контролируемый input, который ре-рендерится из этого массива,
 * не может удержать висящую запятую — её приходится буферизовать в local raw
 * state (см. компонент ниже).
 */
export function parseMultiValue(input: string, separators: RegExp = /,/): string[] {
  return input.split(separators).map(v => v.trim()).filter(v => v.length > 0)
}

interface MultiValueInputProps {
  value: string[]
  onChange: (next: string[]) => void
  multiline?: boolean
  /** Разделители при парсинге. По умолчанию — только запятая. */
  separators?: RegExp
  /** Чем соединять при отображении (когда value меняется извне). По умолчанию — `, `. */
  separator?: string
  placeholder?: string
  className?: string
  rows?: number
}

export function MultiValueInput({
  value,
  onChange,
  multiline = false,
  separators = /,/,
  separator = ', ',
  placeholder,
  className,
  rows,
}: MultiValueInputProps) {
  const parse = (s: string): string[] => parseMultiValue(s, separators)

  const [raw, setRaw] = useState<string>(() => value.join(separator))

  // Чтобы внутри useEffect не зависеть от parse (новая ссылка каждый рендер).
  const parseRef = useRef(parse)
  parseRef.current = parse

  // Синхронизация с внешним value: только если оно реально расходится с тем,
  // что парсится из текущего raw. Иначе любая нормализация onChange сразу же
  // перезатёрла бы пользовательский ввод (тот самый баг).
  useEffect(() => {
    const parsed = parseRef.current(raw)
    const same = parsed.length === value.length && parsed.every((v, i) => v === value[i])
    if (!same) {
      setRaw(value.join(separator))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, separator])

  const handle = (next: string) => {
    setRaw(next)
    onChange(parse(next))
  }

  if (multiline) {
    return (
      <textarea
        value={raw}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        className={className}
        rows={rows}
      />
    )
  }

  return (
    <input
      type="text"
      value={raw}
      onChange={(e) => handle(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  )
}
