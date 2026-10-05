// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RichTextField } from './RichTextField'

function Controlled({ initial = '', onChange = () => undefined }: { initial?: string; onChange?: (html: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <RichTextField
        label="Текст"
        value={value}
        onChange={(html) => {
          setValue(html)
          onChange(html)
        }}
      />
      <button type="button" onClick={() => setValue('<p>Снаружи</p>')}>
        заменить
      </button>
    </>
  )
}

afterEach(cleanup)

const editorEl = () => document.querySelector('.ProseMirror') as HTMLElement

describe('RichTextField', () => {
  it('показывает HTML значения и кнопки форматирования', async () => {
    render(<Controlled initial="<p><strong>Жирный</strong> текст</p><ul><li><p>пункт</p></li></ul>" />)
    await waitFor(() => expect(editorEl()).toBeTruthy())
    expect(editorEl().querySelector('strong')?.textContent).toBe('Жирный')
    expect(editorEl().querySelector('ul li')?.textContent).toBe('пункт')
    for (const name of ['Жирный', 'Курсив', 'Подзаголовок', 'Список', 'Нумерованный список', 'Цитата', 'Ссылка']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('только то, что пропустит сервис: кода, блоков кода и разделителей нет', async () => {
    render(<Controlled initial="<p>a</p><pre><code>x</code></pre><hr><h1>h</h1>" />)
    await waitFor(() => expect(editorEl()).toBeTruthy())
    expect(editorEl().querySelector('pre, code, hr, h1')).toBeNull()
  })

  it('кнопка «Жирный» оформляет выделение и отдаёт HTML наружу', async () => {
    const onChange = vi.fn()
    render(<Controlled initial="<p>слово</p>" onChange={onChange} />)
    await waitFor(() => expect(editorEl()).toBeTruthy())
    // Ставим фокус в текст, выделяем всё и жмём «Жирный».
    act(() => {
      editorEl().focus()
      const range = document.createRange()
      range.selectNodeContents(editorEl())
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Жирный' }))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls.at(-1)![0]).toBe('<p><strong>слово</strong></p>')
  })

  it('открытие поля — не правка: onChange не зовётся', async () => {
    const onChange = vi.fn()
    render(<Controlled initial="<p>было</p>" onChange={onChange} />)
    await waitFor(() => expect(editorEl()).toBeTruthy())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('смена значения снаружи переписывает содержимое без события правки', async () => {
    const onChange = vi.fn()
    render(<Controlled initial="<p>было</p>" onChange={onChange} />)
    await waitFor(() => expect(editorEl()).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'заменить' }))
    await waitFor(() => expect(editorEl().textContent).toBe('Снаружи'))
    expect(onChange).not.toHaveBeenCalled() // внешняя смена — не правка пользователя
  })

  it('только чтение — без панели кнопок', async () => {
    render(<RichTextField value="<p>оригинал</p>" onChange={() => undefined} readOnly />)
    await waitFor(() => expect(editorEl()).toBeTruthy())
    expect(screen.queryByRole('toolbar')).toBeNull()
    expect(editorEl().getAttribute('contenteditable')).toBe('false')
  })
})
