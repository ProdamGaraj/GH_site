// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { isEditableTarget, isTypingContext } from './isEditableTarget'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('isEditableTarget', () => {
  it('input / textarea / select — редактируемы', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true)
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableTarget(document.createElement('select'))).toBe(true)
  })

  it('contenteditable="true" — редактируем; ="false" — нет', () => {
    const on = document.createElement('div')
    on.setAttribute('contenteditable', 'true')
    document.body.appendChild(on)
    expect(isEditableTarget(on)).toBe(true)

    const off = document.createElement('div')
    off.setAttribute('contenteditable', 'false')
    expect(isEditableTarget(off)).toBe(false)
  })

  it('внутренний узел Monaco (.view-line внутри .monaco-editor) — редактируем', () => {
    // Регресс: Ctrl+V в поле стилей вставлял копию блока, т.к. target был не textarea
    const editor = document.createElement('div')
    editor.className = 'monaco-editor'
    const line = document.createElement('span')
    line.className = 'view-line'
    editor.appendChild(line)
    document.body.appendChild(editor)
    expect(isEditableTarget(line)).toBe(true)
  })

  it('обычный div / кнопка / null — не редактируемы', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false)
    expect(isEditableTarget(document.createElement('button'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})

describe('isTypingContext', () => {
  it('true когда target — поле', () => {
    expect(isTypingContext({ target: document.createElement('textarea') })).toBe(true)
  })

  it('страховка через document.activeElement, когда target не поле', () => {
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    ta.focus()
    expect(document.activeElement).toBe(ta)
    // target = body (не поле), но фокус на textarea → всё равно печатаем
    expect(isTypingContext({ target: document.body })).toBe(true)
  })

  it('false вне полей', () => {
    document.body.focus()
    expect(isTypingContext({ target: document.createElement('div') })).toBe(false)
  })
})
