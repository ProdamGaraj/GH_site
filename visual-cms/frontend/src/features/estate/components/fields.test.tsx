// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NumberField, SelectField, TextArea, TextField } from './fields'

afterEach(() => cleanup())

/**
 * Раскладку jsdom не считает — проверяем договор классов: ячейка поля —
 * колонка, поле ввода прижато к низу. Так в строке сетки поля ввода стоят на
 * одной линии, даже если подсказка у соседа перенеслась на вторую строку.
 */
describe('однострочные поля: ввод на одной линии в строке сетки', () => {
  const noop = () => {}

  it.each([
    ['TextField', () => <TextField label="Срок сдачи" hint="в CRM нет — впишите вручную" value="" onChange={noop} />, 'textbox'],
    ['NumberField', () => <NumberField label="ID дома в MacroCRM" hint="по нему синхронизация" value={1} onChange={noop} />, 'spinbutton'],
    ['SelectField', () => <SelectField label="Статус" value="a" options={[{ value: 'a', label: 'A' }]} onChange={noop} />, 'combobox'],
  ] as const)('%s', (_name, field, role) => {
    render(field())
    const control = screen.getByRole(role)
    expect(control.className).toMatch(/\bmt-auto\b/)
    expect(control.parentElement!.className).toMatch(/\bflex\b.*\bflex-col\b/)
  })

  it('многострочное (TextArea) — без прижатия: в сетке с items-start высота по содержимому', () => {
    render(<TextArea label="Текст" value="" onChange={noop} />)
    expect(screen.getByRole('textbox').className).not.toMatch(/\bmt-auto\b/)
  })
})
